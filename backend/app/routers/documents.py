from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.internal_auth import get_current_user_id
from app.models.document import Document
from app.models.chat_message import ChatMessage
from app.schemas.document import (
    DocumentOut,
    DocumentDetail,
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
)
from app.storage.local_storage import save_pdf
from app.services.pdf_reader import extract_text
from app.services import gemini_client
from app.services.embeddings import build_chunks_for_document, find_relevant_chunks

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


def _get_owned_document(db: Session, document_id: str, user_id: str) -> Document:
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == user_id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    return document


def _gemini_error_response(exc: Exception) -> HTTPException:
    """Turns a Gemini-related exception into a clean, user-facing error."""
    if isinstance(exc, RuntimeError):
        # Our own "no API key configured" message.
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Gemini request failed: {exc}",
    )


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    content = await file.read()

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too large. Maximum size is 20 MB.",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Try extracting text before we save anything, so a corrupt/unreadable
    # PDF is rejected cleanly instead of leaving a broken document behind.
    try:
        extracted = extract_text(content)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read this PDF. It may be corrupted or password-protected.",
        )

    storage_path, file_size = save_pdf(
        owner_id=user_id,
        original_filename=file.filename or "document.pdf",
        content=content,
    )

    document = Document(
        owner_id=user_id,
        original_filename=file.filename or "document.pdf",
        storage_path=storage_path,
        file_size_bytes=file_size,
        extracted_text=extracted,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return document


@router.get("", response_model=list[DocumentOut])
def list_documents(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    documents = (
        db.query(Document)
        .filter(Document.owner_id == user_id)
        .order_by(desc(Document.uploaded_at))
        .all()
    )
    return documents


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return _get_owned_document(db, document_id, user_id)


@router.post("/{document_id}/analyze", response_model=DocumentDetail)
def analyze_document(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Generates a summary and main points for a document using Gemini, and
    also builds the chunk embeddings needed for the chat feature. Safe to
    call again later (e.g. to re-analyze) - it just overwrites results.
    """
    document = _get_owned_document(db, document_id, user_id)

    if not document.extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This document has no extractable text to analyze.",
        )

    try:
        analysis = gemini_client.analyze_document(document.extracted_text)
    except Exception as exc:
        raise _gemini_error_response(exc)

    document.summary = analysis["summary"]
    document.main_points = analysis["main_points"]
    db.commit()
    db.refresh(document)

    # Build embeddings for chat (Phase 6). If this fails, the summary/main
    # points are still saved - chat just won't work until this succeeds.
    try:
        build_chunks_for_document(db, document.id, document.extracted_text)
    except Exception as exc:
        raise _gemini_error_response(exc)

    return document


@router.get("/{document_id}/messages", response_model=list[ChatMessageOut])
def get_chat_history(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _get_owned_document(db, document_id, user_id)  # ownership check

    return (
        db.query(ChatMessage)
        .filter(ChatMessage.document_id == document_id)
        .order_by(ChatMessage.created_at)
        .all()
    )


@router.post("/{document_id}/chat", response_model=ChatResponse)
def chat_with_document(
    document_id: str,
    body: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    document = _get_owned_document(db, document_id, user_id)

    if not body.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    try:
        relevant_chunks = find_relevant_chunks(db, document.id, body.question)

        if not relevant_chunks:
            answer = (
                "This document hasn't been analyzed yet. Please click "
                "'Analyze' first so I have something to search through."
            )
        else:
            answer = gemini_client.answer_question(body.question, relevant_chunks)
    except Exception as exc:
        raise _gemini_error_response(exc)

    db.add(ChatMessage(document_id=document.id, role="user", content=body.question))
    db.add(ChatMessage(document_id=document.id, role="assistant", content=answer))
    db.commit()

    return ChatResponse(answer=answer)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    from pathlib import Path
    document = _get_owned_document(db, document_id, user_id)
    
    try:
        path = Path(document.storage_path)
        if path.exists():
            path.unlink()
    except Exception:
        pass

    db.delete(document)
    db.commit()

