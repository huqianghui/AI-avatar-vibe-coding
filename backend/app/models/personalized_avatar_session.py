"""Personalized Avatar Session ORM model (Phase 33, PERS-02, D-15).

Mirrors AnonymousAvatarSession's shape but is keyed by `user_id` (a real JWT
identity) instead of `ip_address` -- the server-side row remains the source
of truth for expiry/revocation, never just the caller's JWT claim."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PersonalizedAvatarSession(Base, TimestampMixin):
    __tablename__ = "personalized_avatar_sessions"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    last_response_id: Mapped[str] = mapped_column(String(200), default="")
