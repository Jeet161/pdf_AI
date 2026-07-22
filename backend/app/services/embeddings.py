from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.document_chunk import DocumentChunk
from app.services.gemini_client import embed_text

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200


def chunk_text(text: str) -> list[str]:
    """
    Splits text into overlapping chunks by character count. Simple and
    predictable - good enough for a first RAG implementation without
    needing a tokenizer dependency.
    """
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        start = end - CHUNK_OVERLAP
        if start <= 0:
            break

    return [c.strip() for c in chunks if c.strip()]


def build_chunks_for_document(db: Session, document_id: str, text: str) -> int:
    """
    Chunks a document's text, embeds each chunk via Gemini, and stores
    them. Returns the number of chunks created. Any existing chunks for
    this document are replaced.
    """
    # Clear old chunks first (e.g. if this is a re-analysis).
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()

    pieces = chunk_text(text)
    
    # Compute embeddings concurrently using a thread pool
    with ThreadPoolExecutor(max_workers=8) as executor:
        embeddings = list(executor.map(embed_text, pieces))

    created = 0
    for index, (piece, embedding) in enumerate(zip(pieces, embeddings)):
        chunk = DocumentChunk(
            document_id=document_id,
            chunk_index=index,
            chunk_text=piece,
            embedding=embedding,
        )
        db.add(chunk)
        created += 1

    db.commit()
    return created


def find_relevant_chunks(db: Session, document_id: str, question: str, top_k: int = 5) -> list[str]:
    """
    Embeds the question and returns the top_k most similar chunks for
    this document, using pgvector's cosine distance operator (<=>).
    """
    question_embedding = embed_text(question)

    results = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.embedding.cosine_distance(question_embedding))
        .limit(top_k)
        .all()
    )

    return [chunk.chunk_text for chunk in results]
