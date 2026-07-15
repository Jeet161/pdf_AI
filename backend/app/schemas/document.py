from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: str
    original_filename: str
    file_size_bytes: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetail(DocumentOut):
    extracted_text: Optional[str] = None
    summary: Optional[str] = None
    main_points: Optional[list[str]] = None


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
