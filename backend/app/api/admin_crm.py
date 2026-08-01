"""Admin CRM Excel import API endpoints (Phase 33, PERS-01, D-01..D-04/D-12)."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.crm_import import CrmImportLogOut, CrmImportResultOut
from app.services import crm_import_service
from app.services.crm_import_service import CrmHeaderValidationError
from app.utils.exceptions import bad_request

router = APIRouter(prefix="/admin/crm", tags=["admin-crm"])

ALLOWED_EXTENSION = ".xlsx"
TEMPLATE_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/template")
async def download_crm_template(
    _admin: User = Depends(require_role("admin")),
) -> Response:
    """Download the standard CRM Excel template (D-01). Admin only."""
    content = crm_import_service.generate_crm_template_workbook()
    return Response(
        content=content,
        media_type=TEMPLATE_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="crm_template.xlsx"'},
    )


@router.get("/last-import", response_model=CrmImportLogOut | None)
async def get_last_crm_import(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Return the most recent CRM import result, or null if none ran yet (D-12). Admin only."""
    log = await crm_import_service.get_last_import_log(db)
    return CrmImportLogOut.from_log(log) if log else None


@router.post("/upload", response_model=CrmImportResultOut)
async def upload_crm_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Upload + parse + upsert a CRM Excel mapping file (D-01..D-04). Admin only.

    Whole-file header mismatch -> 422 via bad_request() (the project's one
    established error-raise convention -- equivalent to CONTEXT.md D-04's
    colloquial "400 + expected-format hint"). Row-level issues (missing
    field / unmatched user) never raise here -- they come back in the
    result's skipped/unmatched lists per D-04.
    """
    if not file.filename or Path(file.filename).suffix.lower() != ALLOWED_EXTENSION:
        bad_request(f"Only {ALLOWED_EXTENSION} files are supported")

    content = await file.read()
    settings = get_settings()
    if len(content) > settings.crm_max_file_size_bytes:
        bad_request(
            f"File size exceeds maximum of {settings.crm_max_file_size_bytes // (1024 * 1024)}MB"
        )

    try:
        result = await crm_import_service.parse_and_import_crm_excel(db, content)
    except CrmHeaderValidationError as exc:
        bad_request(str(exc))

    await crm_import_service.record_import_log(db, file.filename, result, admin.id)
    return CrmImportResultOut(
        success_count=result.success_count,
        skipped=result.skipped,
        unmatched=result.unmatched,
    )
