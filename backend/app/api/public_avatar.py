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
from app.dependencies import get_anonymous_session, get_optional_current_user
from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.user import User
from app.schemas.public_avatar import (
    AnonymousSessionResponse,
    ChatRequest,
    ChatResponse,
    PublicPersonaResponse,
    WebrtcSessionRequest,
    WebrtcSessionResponse,
)
from app.services.anonymous_session_service import create_anonymous_session
from app.services.avatar_persona_service import (
    resolve_active_persona,
    resolve_greeting_for_locale,
    resolve_voice_for_locale,
)
from app.services.avatar_service import handle_anonymous_turn
from app.services.personalization_injection_service import build_personalization_context
from app.services.personalization_sanitizer import sanitize_free_text_with_pii
from app.services.public_knowledge_config_service import get_active_public_config_or_none
from app.services.rate_limit import limiter_ip, limiter_session
from app.services.voice_live_webrtc import create_public_webrtc_session_config

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
    resolved server-side via `get_active_public_config_or_none()`; no
    client-suppliable identifier exists anywhere in `ChatRequest` (T-32-05).
    Foundry IQ is optional: with no active config the turn degrades to an
    ungrounded plain-model answer (no citations) instead of failing."""
    public_config = await get_active_public_config_or_none(db)
    result = await handle_anonymous_turn(
        db, session, body.message, public_config, locale=body.locale
    )
    return ChatResponse(**result)


@router.get("/persona", response_model=PublicPersonaResponse)
@limiter_ip.limit(settings.anon_rate_limit_webrtc_ip)
async def get_persona(
    request: Request,
    session: AnonymousAvatarSession = Depends(get_anonymous_session),
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persona IDENTITY metadata only (Phase 37, PERSONA-05 fidelity gap
    closure) — lets the anonymous avatar page render the resolved persona's
    static preview (character/style) before any WebRTC connect attempt, so a
    denied mic permission or absent Azure config never regresses the page to
    a generic orb instead of the configured default persona. Reuses the same
    resolution precedence as the WebRTC/chat paths (`resolve_active_persona`)
    -- a logged-in caller's own `selected_persona_id` preference wins over the
    catalog default, exactly like the WebRTC session endpoint. Reuses the
    webrtc IP rate limit rather than inventing a new config knob, since this
    call happens at the same page-load cadence."""
    persona = await resolve_active_persona(
        db,
        user_id=(current_user.id if current_user else None),
        requested_persona_id=None,
    )
    return PublicPersonaResponse(
        persona_id=persona.id,
        name=persona.name,
        character=persona.character,
        style=persona.style,
    )


@router.post("/webrtc/session", response_model=WebrtcSessionResponse)
@limiter_ip.limit(settings.anon_rate_limit_webrtc_ip)
@limiter_session.limit(settings.anon_rate_limit_webrtc_session)
async def webrtc_session(
    request: Request,
    body: WebrtcSessionRequest,
    session: AnonymousAvatarSession = Depends(get_anonymous_session),
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Anonymous-capable, optionally-authenticated WebRTC ephemeral-credential
    issuance (ANON-04; PERSONA-05/06) — the avatar character/style/agent are
    always resolved server-side from the active `PublicKnowledgeConfig` row
    and the resolved persona; `get_anonymous_session` runs before any Azure
    credential call is attempted (T-32-14) and its `X-Anon-Session`
    requirement is unaffected by whether a JWT was also supplied. Voice and
    greeting are resolved from the active persona (Phase 36, PERSONA-04) --
    a client-supplied `persona_id` that is disabled/unknown silently falls
    back to the default persona (T-36-10/T-36-11). When `current_user` is
    resolved from a valid JWT (D-13/D-37-1: never required), the SAME shared
    endpoint additionally scopes persona resolution to their `user_id` and
    merges their CRM/preference context into `instructions` (D-37-2,
    T-37-06) -- an anonymous caller never triggers that CRM lookup at all."""
    public_config = await get_active_public_config_or_none(db)
    persona = await resolve_active_persona(
        db,
        user_id=(current_user.id if current_user else None),
        requested_persona_id=body.persona_id,
    )
    voice = resolve_voice_for_locale(persona, body.locale, public_config=public_config)
    sanitized_fragment = sanitize_free_text_with_pii(persona.prompt_fragment)
    crm_context = await build_personalization_context(db, current_user.id) if current_user else None
    instructions = "\n\n".join(filter(None, [sanitized_fragment, crm_context]))
    credential = await create_public_webrtc_session_config(
        db,
        agent_id=(public_config.agent_id if public_config else None),
        agent_version=(public_config.agent_version if public_config else None),
        voice_name=voice,
        locale=body.locale,
        greeting=resolve_greeting_for_locale(persona, body.locale),
        character=persona.character,
        style=persona.style,
        instructions=instructions or None,
    )
    return WebrtcSessionResponse(**credential.model_dump())
