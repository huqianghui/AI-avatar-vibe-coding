"""UserPreference ORM model (Phase 33, PERS-03) -- admin-manually-tagged
per-user preference labels (D-09/D-10)."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserPreference(Base, TimestampMixin):
    """One row per manually-tagged preference for a user. Independent of
    UserCrmContext (D-10) -- CRM Excel re-upload never touches these rows.
    Multiple rows may share the same category (e.g. two "focus_area" tags).
    Extension point for Phase 34+ auto-extraction (PERS-04, deferred)."""

    __tablename__ = "user_preferences"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False, default="")
