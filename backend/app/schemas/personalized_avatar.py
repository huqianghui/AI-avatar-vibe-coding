"""Personalized avatar request/response schemas (Phase 33, PERS-02)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.public_avatar import CitationOut


class PersonalizedSessionResponse(BaseModel):
    """Response for POST /api/v1/avatar/session -- no request body accepted,
    identity comes entirely from the JWT (Depends(get_current_user))."""

    session_id: str
    expires_at: datetime

    model_config = ConfigDict(from_attributes=False)


class PersonalizedChatRequest(BaseModel):
    """Request for POST /api/v1/avatar/chat (wired in 33-05). `session_id`
    must belong to the JWT-authenticated caller -- no `user_id` field exists
    here; identity is never taken from the request body (T-33-09). `locale`
    selects the refusal-template language (mirrors Phase 32's anonymous
    request shape) and is forwarded by 33-05, never hardcoded server-side."""

    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1)
    locale: str = "zh-CN"

    model_config = ConfigDict(from_attributes=False)


class PersonalizedChatResponse(BaseModel):
    answer: str
    citations: list[CitationOut]
    is_refusal: bool

    model_config = ConfigDict(from_attributes=True)
