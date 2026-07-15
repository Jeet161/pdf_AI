import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from pgvector.sqlalchemy import Vector
from app.core.database import Base


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# text-embedding-004 (Gemini) produces 768-dimension vectors.
EMBEDDING_DIMENSIONS = 768


class DocumentChunk(Base):
    """
    A document's extracted text, split into smaller overlapping pieces so
    we can do similarity search for the AI chat feature (Phase 6). Each
    chunk stores its own embedding vector for that search.
    """

    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=_new_uuid)
    document_id = Column(
        String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )

    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(String, nullable=False)
    embedding = Column(Vector(EMBEDDING_DIMENSIONS), nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
