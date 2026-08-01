"""Avatar Interaction Log ORM model."""

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AvatarInteractionLog(Base, TimestampMixin):
    """Audit trail: one row per anonymous Q&A turn (AI Avatar Domain Rule 7 —
    every avatar interaction must be traceable to a knowledge source)."""

    __tablename__ = "avatar_interaction_logs"

    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("anonymous_avatar_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    question: Mapped[str] = mapped_column(Text, default="")
    answer_summary: Mapped[str] = mapped_column(Text, default="")
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    is_refusal: Mapped[bool] = mapped_column(Boolean, default=False)
    response_id: Mapped[str] = mapped_column(String(200), default="")
