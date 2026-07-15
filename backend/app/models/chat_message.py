import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey
from app.core.database import Base


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChatMessage(Base):
    """One message (from the user or the AI) in a document's chat history."""

    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=_new_uuid)
    document_id = Column(
        String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )

    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
