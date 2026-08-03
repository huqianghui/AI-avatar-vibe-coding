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
    """Request for POST /public/avatar/chat — `message` plus `locale` (T-32-05): no
    agent_id/kb_name/hcp_profile_id or any other client-suppliable identifier
    exists anywhere in this schema. `locale` drives which language the
    grounded/refusal response is generated in (LANG-02); it is pattern-constrained
    to the same 5-entry closed allowlist as `WebrtcSessionRequest.locale`."""

    message: str = Field(..., min_length=1, max_length=2000)
    locale: str = Field(default="zh-CN", pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$")

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
    """Request for POST /public/avatar/webrtc/session — locale plus an
    optional `persona_id` (Phase 36, PERSONA-04): no character/style/voice/
    agent_id/kb_name override field exists anywhere in this schema. Avatar
    character/style/agent identity remains 100% server-resolved from the
    active `PublicKnowledgeConfig` row; `persona_id` only ever selects among
    the admin-managed, enabled `AvatarPersona` catalog via
    `resolve_active_persona()` (T-36-10: an invalid/disabled value silently
    falls back to the default persona, never an error)."""

    locale: str = Field(default="zh-CN", pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$")
    persona_id: str | None = None

    model_config = ConfigDict(from_attributes=False)


class PublicPersonaResponse(BaseModel):
    """Response for GET /public/avatar/persona (Phase 37, PERSONA-05 fidelity
    gap closure) — persona IDENTITY metadata only, so the anonymous avatar
    page can render the resolved persona's static preview before any WebRTC
    connection attempt/mic permission. Deliberately excludes
    `prompt_fragment` (must never leak to a pre-connect client), `greeting`,
    and `voice_map` — those remain session-time-only concerns resolved by
    `POST /public/avatar/webrtc/session`."""

    persona_id: str
    name: str
    character: str
    style: str

    model_config = ConfigDict(from_attributes=True)


class WebrtcSessionResponse(WebRTCSessionResponse):
    """Mirrors the exact field set of the authenticated `/voice-live/webrtc/session`
    response (`WebRTCSessionResponse`) verbatim — same shape, anonymous trust
    boundary only. Inherits `greeting` (Phase 36, PERSONA-04) from the base
    class: the resolved active persona's greeting text."""
