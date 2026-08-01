"""User CRM Context ORM model (Phase 33, PERS-01) -- Excel-derived per-user CRM data."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserCrmContext(Base, TimestampMixin):
    """One row per platform user matched from the admin-uploaded CRM Excel
    (D-01/D-02/D-03). Upsert-by-user_id on re-upload -- never a full-table
    replace. All string fields are sanitized (D-06/D-07) before being
    written here by crm_import_service.py."""

    __tablename__ = "user_crm_contexts"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    customer_name: Mapped[str] = mapped_column(String(200), default="")
    company: Mapped[str] = mapped_column(String(200), default="")
    role: Mapped[str] = mapped_column(String(200), default="")
    crm_notes: Mapped[str] = mapped_column(Text, default="")
    contact_person: Mapped[str] = mapped_column(String(200), default="")
