"""Authenticated personalized avatar endpoints (Phase 33, PERS-02, D-15).

Mounted under settings.api_prefix (/api/v1) -- unlike Phase 32's anonymous
`/public/avatar/*` surface, every route here requires a real JWT
(Depends(get_current_user)); no anonymous-session header exists anywhere in
this router."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.personalized_avatar import (
    PersonalizedChatRequest,
    PersonalizedChatResponse,
    PersonalizedSessionResponse,
)
from app.services.personalized_avatar_service import handle_personalized_turn
from app.services.personalized_session_service import create_personalized_session, get_owned_session
from app.services.public_knowledge_config_service import get_active_public_config_or_none
from app.services.rate_limit import limiter_user

settings = get_settings()

router = APIRouter(prefix="/avatar", tags=["personalized-avatar"])


@router.post(
    "/session",
    response_model=PersonalizedSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter_user.limit(settings.personalized_rate_limit_session_create)
async def create_session(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a personalized avatar session for the JWT-authenticated caller
    (D-13: auto-created when a logged-in user opens the avatar page)."""
    session = await create_personalized_session(db, user)
    return PersonalizedSessionResponse(session_id=session.id, expires_at=session.expires_at)


@router.post("/chat", response_model=PersonalizedChatResponse)
@limiter_user.limit(settings.personalized_rate_limit_chat_user)
async def chat(
    request: Request,
    body: PersonalizedChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Personalized Q&A turn (PERS-02) -- `session_id` ownership is verified
    BEFORE any agent call (T-33-09); the agent/knowledge-source config is
    always the same server-resolved active `PublicKnowledgeConfig` row Phase
    32's anonymous flow uses, never anything client-suppliable."""
    session = await get_owned_session(db, body.session_id, user)
    public_config = await get_active_public_config_or_none(db)
    result = await handle_personalized_turn(
        db, session, user, body.message, public_config, locale=body.locale
    )
    return PersonalizedChatResponse(**result)
