import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, HTTPException, status
from fastapi.concurrency import run_in_threadpool
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

logger = logging.getLogger(__name__)

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


def _run_ocr_background(document_id: str, pdf_bytes: bytes, db_url: str) -> None:
    """
    Background task: runs Gemini Vision OCR on a scanned PDF and saves the
    result to the database incrementally so text appears live on the UI.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        doc = session.query(Document).filter(Document.id == document_id).first()
        if doc and doc.status != "completed":
            logger.info(f"Background OCR starting for document {document_id}...")

            def save_progress(partial_text: str):
                try:
                    p_engine = create_engine(db_url)
                    P_Session = sessionmaker(bind=p_engine)
                    p_session = P_Session()
                    p_doc = p_session.query(Document).filter(Document.id == document_id).first()
                    if p_doc:
                        p_doc.extracted_text = partial_text
                        p_session.commit()
                    p_session.close()
                    p_engine.dispose()
                except Exception as pe:
                    logger.warning(f"Failed to update progress: {pe}")

            text = extract_text(pdf_bytes, progress_callback=save_progress)
            
            doc = session.query(Document).filter(Document.id == document_id).first()
            if doc:
                if text:
                    doc.extracted_text = text
                    doc.status = "completed"
                    session.commit()
                    logger.info(f"Background OCR complete for {document_id}: {len(text)} chars")
                else:
                    doc.status = "failed"
                    session.commit()
                    logger.warning(f"Background OCR produced no text for {document_id}")
    except Exception as exc:
        logger.error(f"Background OCR failed for {document_id}: {exc}")
        try:
            doc = session.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "completed" if doc.extracted_text else "failed"
                session.commit()
        except Exception:
            pass
    finally:
        session.close()
        engine.dispose()


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    filename = file.filename or "document.pdf"
    content_type = (file.content_type or "").lower()
    ext = Path(filename).suffix.lower()

    is_pdf = content_type == "application/pdf" or ext == ".pdf"
    is_image = content_type.startswith("image/") or ext in [".png", ".jpg", ".jpeg", ".webp"]

    if not (is_pdf or is_image):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and Image files (PNG, JPG, JPEG, WEBP) are supported.",
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

    # If an image file was uploaded, convert it on the fly to a single-page PDF
    if is_image:
        try:
            import fitz
            img_doc = fitz.open(stream=content, filetype=ext.lstrip(".") or "png")
            pdf_bytes = img_doc.convert_to_pdf()
            content = pdf_bytes
            img_doc.close()
        except Exception as exc:
            logger.error(f"Image to PDF conversion failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not process image file. It may be corrupted.",
            )

    # Quick PyMuPDF text extraction (digital PDFs) — instant, no API.
    extracted = ""
    total_pages = 0
    try:
        import fitz
        text_parts = []
        with fitz.open(stream=content, filetype="pdf") as doc:
            total_pages = len(doc)
            for page in doc:
                t = page.get_text().strip()
                if len(t) > 30:
                    text_parts.append(t)
        
        # Only consider extracted text valid if average text per page > 40 chars
        candidate_text = "\n\n".join(text_parts)
        if len(candidate_text) > 50 and (len(candidate_text) / max(1, total_pages)) >= 40:
            extracted = candidate_text
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read this PDF. It may be corrupted or password-protected.",
        )

    doc_status = "completed" if extracted else "processing"

    storage_path, file_size = save_pdf(
        owner_id=user_id,
        original_filename=filename,
        content=content,
    )

    document = Document(
        owner_id=user_id,
        original_filename=filename,
        storage_path=storage_path,
        file_size_bytes=file_size,
        status=doc_status,
        extracted_text=extracted if extracted else None,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # If the PDF had no digital text (scanned/photo), kick off OCR in background.
    if doc_status == "processing":
        from app.core.config import settings
        background_tasks.add_task(
            _run_ocr_background,
            document.id,
            content,
            settings.database_url,
        )
        logger.info(f"Scanned document detected — OCR queued in background for {document.id}")

    return document


@router.post("/{document_id}/retry", response_model=DocumentOut)
def retry_ocr(
    document_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Re-queues OCR for a document that failed due to quota exhaustion.
    Resets status to 'processing' and kicks off background OCR again.
    """
    document = _get_owned_document(db, document_id, user_id)

    if document.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is already being processed. Please wait.",
        )

    if document.extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text has already been extracted successfully.",
        )

    stored_path = Path(document.storage_path)
    if not stored_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on disk.",
        )

    pdf_bytes = stored_path.read_bytes()
    document.status = "processing"
    document.extracted_text = None
    db.commit()
    db.refresh(document)

    from app.core.config import settings as app_settings
    background_tasks.add_task(
        _run_ocr_background,
        document.id,
        pdf_bytes,
        app_settings.database_url,
    )
    logger.info(f"OCR retry queued for document {document_id}")
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

    if document.status == "processing" and not document.extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text is currently being extracted by AI in the background. Please wait a moment for scanning to complete.",
        )

    # If there's no extracted text (scanned PDF where OCR failed at upload time due
    # to quota), try OCR again now that the user has clicked Analyze.
    if not document.extracted_text:
        stored_path = Path(document.storage_path)
        if stored_path.exists():
            try:
                re_extracted = extract_text(stored_path.read_bytes())
                if re_extracted:
                    document.extracted_text = re_extracted
                    document.status = "completed"
                    db.commit()
                    db.refresh(document)
            except Exception as exc:
                logger.warning(f"Re-extraction at analyze time failed for {document.id}: {exc}")

    if not document.extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract text from this document. If it is a scanned/photo PDF, the Gemini API quota may be exhausted — please try again later.",
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
    # points are still saved and returned - chat just won't work until the
    # user re-analyzes or quota recovers.
    try:
        build_chunks_for_document(db, document.id, document.extracted_text)
    except Exception as exc:
        logger.warning(
            f"Embedding step failed for document {document.id} (summary was saved): {exc}"
        )

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
    document = _get_owned_document(db, document_id, user_id)
    
    try:
        path = Path(document.storage_path)
        if path.exists():
            path.unlink()
    except Exception:
        pass

    db.delete(document)
    db.commit()

