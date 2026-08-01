"""Public anonymous avatar request/response schemas (Phase 32, ANON-01)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnonymousSessionResponse(BaseModel):
    """Response for POST /public/avatar/session — no request body is accepted."""

    session_token: str
    expires_at: datetime

    model_config = ConfigDict(from_attributes=False)
