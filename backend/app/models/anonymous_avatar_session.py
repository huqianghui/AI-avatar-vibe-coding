"""Anonymous Avatar Session ORM model."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AnonymousAvatarSession(Base, TimestampMixin):
    """Server-issued anonymous session backing the anonymous avatar token. Source of
    truth for expiry/quota — never trust only the JWT `exp` claim."""

    __tablename__ = "anonymous_avatar_sessions"

    ip_address: Mapped[str] = mapped_column(String(64), default="")
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    last_response_id: Mapped[str] = mapped_column(String(200), default="")
