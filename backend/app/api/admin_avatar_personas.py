"""Admin API for AvatarPersona CRUD management (Phase 36, PERSONA-01/02).

All routes are admin-only (T-36-02). The unique-default guard (D-02) is
enforced in the service layer -- `ConflictException` propagates through the
global exception handler as a natural 409, not caught here."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.avatar_persona import AvatarPersonaCreate, AvatarPersonaOut, AvatarPersonaUpdate
from app.services import avatar_persona_service

router = APIRouter(prefix="/admin/avatar-personas", tags=["admin-avatar-personas"])


@router.get("", response_model=list[AvatarPersonaOut])
async def list_personas(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> list[AvatarPersonaOut]:
    """List all AvatarPersona rows (enabled and disabled). Admin only."""
    personas = await avatar_persona_service.list_personas(db, enabled_only=False)
    return [AvatarPersonaOut.model_validate(p) for p in personas]


@router.post("", response_model=AvatarPersonaOut, status_code=201)
async def create_persona(
    data: AvatarPersonaCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Create a new AvatarPersona. Admin only."""
    persona = await avatar_persona_service.create_persona(db, data)
    return AvatarPersonaOut.model_validate(persona)


@router.get("/{persona_id}", response_model=AvatarPersonaOut)
async def get_persona(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Get a single AvatarPersona by ID. Admin only."""
    persona = await avatar_persona_service.get_persona(db, persona_id)
    return AvatarPersonaOut.model_validate(persona)


@router.put("/{persona_id}", response_model=AvatarPersonaOut)
async def update_persona(
    persona_id: str,
    data: AvatarPersonaUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Update an AvatarPersona. Admin only.

    Disabling the current default persona requires `new_default_persona_id`
    in the body to atomically promote a replacement first (409 otherwise)."""
    persona = await avatar_persona_service.update_persona(db, persona_id, data)
    return AvatarPersonaOut.model_validate(persona)


@router.delete("/{persona_id}", status_code=204)
async def delete_persona(
    persona_id: str,
    new_default_persona_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> Response:
    """Delete an AvatarPersona. Admin only.

    Deleting the current default persona requires `?new_default_persona_id=`
    to atomically promote a replacement first (409 otherwise)."""
    await avatar_persona_service.delete_persona(
        db, persona_id, new_default_persona_id=new_default_persona_id
    )
    return Response(status_code=204)


@router.post("/{persona_id}/set-default", response_model=AvatarPersonaOut)
async def set_default_persona(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Promote a persona to be the sole default. Admin only."""
    persona = await avatar_persona_service.set_default_persona(db, persona_id)
    return AvatarPersonaOut.model_validate(persona)
