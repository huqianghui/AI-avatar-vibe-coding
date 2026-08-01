"""CRM Excel import audit log (Phase 33, PERS-01, D-04/D-12) -- one row per
admin-triggered import, so the admin "CRM 数据" page can read back the
result of the most recent upload in a LATER, separate request (the upload
response itself is only available once, synchronously)."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CrmImportLog(Base, TimestampMixin):
    __tablename__ = "crm_import_logs"

    filename: Mapped[str] = mapped_column(String(255), default="")
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    # JSON-encoded list[dict]: [{"row": int, "reason": str}, ...] (skipped)
    # or [{"row": int, "email": str, "reason": str}, ...] (unmatched).
    skipped: Mapped[str] = mapped_column(Text, default="[]")
    unmatched: Mapped[str] = mapped_column(Text, default="[]")
    imported_by: Mapped[str] = mapped_column(String(36), default="")
    # Override TimestampMixin's server_default(func.now()) -- SQLite's
    # CURRENT_TIMESTAMP has only second-level resolution, so two admin
    # uploads within the same second would get identical created_at and
    # break "most recent import" ordering (D-12). A Python-side
    # microsecond-precision default fixes this for this audit-log table.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
