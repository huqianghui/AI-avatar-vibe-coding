"""FastAPI dependency injection: database session, auth, role checking."""

from collections.abc import Callable

from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.user import User
from app.services.anonymous_session_service import verify_anonymous_token
from app.utils.exceptions import AppException, unauthorized

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from JWT token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise AppException(status_code=401, code="INVALID_TOKEN", message="Invalid token")
    except JWTError:
        raise AppException(status_code=401, code="INVALID_TOKEN", message="Invalid token") from None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AppException(status_code=401, code="USER_NOT_FOUND", message="User not found")
    if not user.is_active:
        raise AppException(status_code=401, code="INACTIVE_USER", message="Inactive user")
    return user


async def get_optional_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Additive-only optional-auth dependency (Phase 37, PERSONA-05/06) for the
    shared anonymous-capable `/public/avatar/webrtc/session` endpoint.

    Mirrors `get_current_user`'s JWT-decode logic exactly, but NEVER raises --
    any failure mode (missing header, malformed header, invalid signature,
    expired token, unknown user, inactive user) degrades to `None` instead of
    a 401. This is a deliberate accepted-risk choice (T-37-04): the endpoint's
    core contract (D-13) is that a JWT is never required, so a garbage/expired
    token must fall back to the anonymous experience, not block it. Parses the
    header manually rather than depending on `oauth2_scheme`, which raises 401
    itself when the header is absent -- the wrong behavior for an optional
    dependency. `get_current_user` is completely untouched by this addition."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


def require_role(role: str) -> Callable:
    """Factory that creates a dependency checking the user's role."""

    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise AppException(
                status_code=403, code="FORBIDDEN", message="Insufficient permissions"
            )
        return user

    return role_checker


async def get_anonymous_session(
    x_anon_session: str | None = Header(None, alias="X-Anon-Session"),
    db: AsyncSession = Depends(get_db),
) -> AnonymousAvatarSession:
    """Anonymous trust boundary dependency (Phase 32, ANON-01) — a NEW trust
    boundary, not JWT auth made optional. Validates the `X-Anon-Session`
    header against the live `AnonymousAvatarSession` row.

    The header is declared optional (default `None`) rather than required so
    a missing header raises the project's structured 401 via `unauthorized()`
    instead of FastAPI's generic 422 request-validation error — an absent
    session is an auth failure, not a malformed request."""
    if x_anon_session is None:
        unauthorized("Missing anonymous session")
    return await verify_anonymous_token(db, x_anon_session)


__all__ = [
    "get_db",
    "get_current_user",
    "get_optional_current_user",
    "require_role",
    "get_anonymous_session",
]
