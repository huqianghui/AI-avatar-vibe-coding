"""Self-service selected-persona endpoint (Phase 36, PERSONA-03).

JWT-gated only -- every route here requires a real logged-in user via
`Depends(get_current_user)`; neither route ever accepts or reads a
client-supplied `user_id` (T-36-21). Mounted under `settings.api_prefix`
(unlike the anonymous `/public/avatar/*` surface)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.avatar_persona_service import resolve_active_persona, set_selected_persona

router = APIRouter(prefix="/users/me", tags=["user-persona-selection"])


class SelectedPersonaOut(BaseModel):
    """The caller's resolved active persona -- just enough for the frontend
    switcher trigger + greeting playback (Phase 36, PERSONA-03)."""

    id: str
    name: str
    character: str
    style: str
    greeting: str

    model_config = ConfigDict(from_attributes=True)


class SelectPersonaRequest(BaseModel):
    persona_id: str = Field(..., min_length=1)

    model_config = ConfigDict(from_attributes=False)


@router.get("/selected-persona", response_model=SelectedPersonaOut)
async def get_selected_persona(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SelectedPersonaOut:
    """Always 200 -- resolves to at least the catalog's default persona via
    `resolve_active_persona()`, never 404."""
    persona = await resolve_active_persona(db, user_id=current_user.id)
    return SelectedPersonaOut.model_validate(persona)


@router.put("/selected-persona", response_model=SelectedPersonaOut)
async def put_selected_persona(
    body: SelectPersonaRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SelectedPersonaOut:
    """Switch the caller's own active persona (T-36-20: rejects a disabled/
    unknown `persona_id` with 404, no row written -- no partial state)."""
    persona = await set_selected_persona(db, user_id=current_user.id, persona_id=body.persona_id)
    return SelectedPersonaOut.model_validate(persona)
