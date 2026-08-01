"""CRM Excel import request/response schemas (Phase 33, PERS-01)."""

import json
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    from app.models.crm_import_log import CrmImportLog


class CrmImportResultOut(BaseModel):
    """Response for POST /admin/crm/upload -- immediate synchronous result."""

    success_count: int
    skipped: list[dict]
    unmatched: list[dict]


class CrmImportLogOut(BaseModel):
    """Response for GET /admin/crm/last-import -- persisted result of the
    most recent import, readable in a later request (D-12)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    success_count: int
    skipped: list[dict]
    unmatched: list[dict]
    imported_by: str
    created_at: datetime

    @classmethod
    def from_log(cls, log: "CrmImportLog") -> "CrmImportLogOut":
        """Build from a CrmImportLog ORM row, JSON-decoding skipped/unmatched."""
        return cls(
            id=log.id,
            filename=log.filename,
            success_count=log.success_count,
            skipped=json.loads(log.skipped),
            unmatched=json.loads(log.unmatched),
            imported_by=log.imported_by,
            created_at=log.created_at,
        )
