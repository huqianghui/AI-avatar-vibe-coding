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
from app.utils.exceptions import AppException

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
    x_anon_session: str = Header(..., alias="X-Anon-Session"),
    db: AsyncSession = Depends(get_db),
) -> AnonymousAvatarSession:
    """Anonymous trust boundary dependency (Phase 32, ANON-01) — a NEW trust
    boundary, not JWT auth made optional. Validates the `X-Anon-Session`
    header against the live `AnonymousAvatarSession` row."""
    return await verify_anonymous_token(db, x_anon_session)


__all__ = ["get_db", "get_current_user", "require_role", "get_anonymous_session"]
