"""Anonymous avatar session token service (Phase 32, ANON-01/ANON-05).

Issues and verifies signed anonymous session tokens backed by
`AnonymousAvatarSession`. The database row — not just the JWT `exp` claim —
is the source of truth for expiry/revocation (T-32-10): a token that decodes
successfully but whose backing row has expired or been revoked is rejected.
"""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.utils.exceptions import unauthorized

settings = get_settings()

ANON_TOKEN_TYPE = "anon"


async def create_anonymous_session(
    db: AsyncSession, ip_address: str
) -> tuple[AnonymousAvatarSession, str]:
    """Create a new anonymous session row and return it with a signed token.

    No client-supplied identifier is accepted anywhere in this path — the
    only input is the server-observed remote IP.
    """
    now = datetime.now(UTC)
    session = AnonymousAvatarSession(
        ip_address=ip_address,
        expires_at=now + timedelta(minutes=settings.anon_session_ttl_minutes),
        last_activity_at=now,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    token = jwt.encode(
        {"sid": session.id, "typ": ANON_TOKEN_TYPE, "exp": session.expires_at},
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    return session, token


async def verify_anonymous_token(db: AsyncSession, token: str) -> AnonymousAvatarSession:
    """Verify a signed anonymous token and return its live backing row.

    Rejects (401) on: invalid/expired JWT signature, wrong `typ` claim,
    missing backing row, revoked row, or a DB `expires_at` that has passed
    even if the JWT `exp` claim technically hasn't (DB is authoritative).
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        unauthorized("Invalid or expired anonymous session")

    if payload.get("typ") != ANON_TOKEN_TYPE:
        unauthorized("Wrong token type")

    session = await db.get(AnonymousAvatarSession, payload.get("sid"))
    now = datetime.now(UTC)
    expires_at = session.expires_at.replace(tzinfo=UTC) if session else now
    if session is None or session.is_revoked or expires_at < now:
        unauthorized("Session expired")

    return session


async def touch_session(db: AsyncSession, session: AnonymousAvatarSession) -> None:
    """Sliding activity marker for audit/abuse-detection purposes only.

    Fixed-window renewal decision: the frontend re-calls
    `POST /public/avatar/session` on 401 rather than relying on server-side
    sliding expiry — this function only updates `last_activity_at`/
    `request_count`, it does NOT extend `expires_at`.
    """
    session.last_activity_at = datetime.now(UTC)
    session.request_count += 1
    await db.commit()
