"""Personalized avatar session service (Phase 33, PERS-02, D-15).

Mirrors anonymous_session_service.py's create/verify shape, keyed by a real
JWT-authenticated `user_id` instead of an anonymous per-IP token."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.personalized_avatar_session import PersonalizedAvatarSession
from app.models.user import User
from app.utils.exceptions import not_found

settings = get_settings()


async def create_personalized_session(db: AsyncSession, user: User) -> PersonalizedAvatarSession:
    now = datetime.now(UTC)
    session = PersonalizedAvatarSession(
        user_id=user.id,
        expires_at=now + timedelta(minutes=settings.personalized_session_ttl_minutes),
        last_activity_at=now,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_owned_session(
    db: AsyncSession, session_id: str, user: User
) -> PersonalizedAvatarSession:
    """Load a session and verify ownership + liveness. Returns 404 (never 403)
    for missing/foreign/expired/revoked -- identical response shape for all
    four cases so a caller can never distinguish "not yours" from "does not
    exist" (IDOR mitigation, T-33-04)."""
    session = await db.get(PersonalizedAvatarSession, session_id)
    now = datetime.now(UTC)
    expires_at = session.expires_at.replace(tzinfo=UTC) if session else now
    if session is None or session.user_id != user.id or session.is_revoked or expires_at < now:
        not_found("Personalized avatar session not found or expired")
    return session


async def touch_session(db: AsyncSession, session: PersonalizedAvatarSession) -> None:
    session.last_activity_at = datetime.now(UTC)
    session.request_count += 1
    await db.commit()
