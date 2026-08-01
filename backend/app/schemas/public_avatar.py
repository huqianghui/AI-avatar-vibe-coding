"""Public anonymous avatar request/response schemas (Phase 32, ANON-01..04)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.voice_live import WebRTCSessionResponse


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


class WebrtcSessionRequest(BaseModel):
    """Request for POST /public/avatar/webrtc/session — locale is the only
    client-suppliable field (T-32-12): no character/style/voice/agent_id/
    kb_name override field exists anywhere in this schema. Avatar identity is
    100% server-resolved from the active `PublicKnowledgeConfig` row."""

    locale: str = Field(default="zh-CN", pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$")

    model_config = ConfigDict(from_attributes=False)


class WebrtcSessionResponse(WebRTCSessionResponse):
    """Mirrors the exact field set of the authenticated `/voice-live/webrtc/session`
    response (`WebRTCSessionResponse`) verbatim — same shape, anonymous trust
    boundary only."""
