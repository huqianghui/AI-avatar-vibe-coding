"""Public anonymous avatar request/response schemas (Phase 32, ANON-01/ANON-02/ANON-03)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnonymousSessionResponse(BaseModel):
    """Response for POST /public/avatar/session — no request body is accepted."""

    session_token: str
    expires_at: datetime

    model_config = ConfigDict(from_attributes=False)


class ChatRequest(BaseModel):
    """Request for POST /public/avatar/chat — exactly one field (T-32-05): no
    agent_id/kb_name/hcp_profile_id or any other client-suppliable identifier
    exists anywhere in this schema."""

    message: str = Field(..., min_length=1, max_length=2000)

    model_config = ConfigDict(from_attributes=False)


class CitationOut(BaseModel):
    title: str
    url: str
    page: int

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(BaseModel):
    answer: str
    citations: list[CitationOut]
    is_refusal: bool

    model_config = ConfigDict(from_attributes=True)
