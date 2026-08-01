"""Public anonymous avatar endpoints (Phase 32) — no login required.

Mounted with NO `/api/v1` prefix (see app/main.py): the anonymous public
surface sits outside the versioned authenticated API, mirroring the
codebase's existing precedent of unauthenticated routes (e.g.
`/avatar-thumbnail/{character_id}`) living outside `/api/v1`.
"""

from fastapi import APIRouter, Depends, Request, status
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_anonymous_session
from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.schemas.public_avatar import AnonymousSessionResponse, ChatRequest, ChatResponse
from app.services.anonymous_session_service import create_anonymous_session
from app.services.avatar_service import handle_anonymous_turn
from app.services.public_knowledge_config_service import get_active_public_config
from app.services.rate_limit import limiter_ip, limiter_session

settings = get_settings()

router = APIRouter(prefix="/public/avatar", tags=["public-avatar"])


@router.post(
    "/session",
    response_model=AnonymousSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter_ip.limit(settings.anon_rate_limit_session_create)
async def create_session(request: Request, db: AsyncSession = Depends(get_db)):
    """Issue an anonymous session with no login and no client-supplied identifier."""
    session, token = await create_anonymous_session(db, get_remote_address(request))
    return AnonymousSessionResponse(session_token=token, expires_at=session.expires_at)


@router.post("/chat", response_model=ChatResponse)
@limiter_ip.limit(settings.anon_rate_limit_chat_ip)
@limiter_session.limit(settings.anon_rate_limit_chat_session)
async def chat(
    request: Request,
    body: ChatRequest,
    session: AnonymousAvatarSession = Depends(get_anonymous_session),
    db: AsyncSession = Depends(get_db),
):
    """Grounded anonymous Q&A turn (ANON-02/ANON-03) — the agent/KB is always
    resolved server-side via `get_active_public_config()`; no client-suppliable
    identifier exists anywhere in `ChatRequest` (T-32-05)."""
    public_config = await get_active_public_config(db)
    result = await handle_anonymous_turn(db, session, body.message, public_config)
    return ChatResponse(**result)
