"""Public API for listing enabled AvatarPersona rows (Phase 36, PERSONA-01/02).

Intentionally has NO auth dependency -- this is the anonymous path a visitor
uses to see which personas are selectable. T-36-01: the enabled-only filter
is enforced at the service-layer query, not just the response serializer."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.avatar_persona import AvatarPersonaOut
from app.services import avatar_persona_service

router = APIRouter(prefix="/personas", tags=["avatar-personas"])


@router.get("", response_model=list[AvatarPersonaOut])
async def list_enabled_personas(
    db: AsyncSession = Depends(get_db),
) -> list[AvatarPersonaOut]:
    """List enabled AvatarPersona rows only. No authentication required."""
    personas = await avatar_persona_service.list_personas(db, enabled_only=True)
    return [AvatarPersonaOut.model_validate(p) for p in personas]
