import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, BigInteger, JSON
from app.core.database import Base


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Document(Base):
    """
    One row per uploaded PDF. `owner_id` matches the Better Auth user id
    from the frontend (a string, not a numeric id) - it's passed in from
    Next.js after it verifies the session, so we trust it here.
    """

    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_new_uuid)
    owner_id = Column(String, nullable=False, index=True)

    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)

    # Filled in during later phases (text extraction, summary, etc.)
    extracted_text = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    main_points = Column(JSON, nullable=True)  # list[str], stored as JSON

    uploaded_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
