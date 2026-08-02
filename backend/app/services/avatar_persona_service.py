"""AvatarPersona service: CRUD operations plus the unique-default guard
(Phase 36, PERSONA-01/02, D-02).

Exactly one enabled persona is ever flagged `is_default=true`. Disabling or
deleting the current default persona is rejected with 409 unless a new
default is designated first via `new_default_persona_id`."""

import json
import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.avatar_persona import AvatarPersona
from app.schemas.avatar_persona import AvatarPersonaCreate, AvatarPersonaUpdate
from app.utils.exceptions import ConflictException, bad_request, not_found

logger = logging.getLogger(__name__)


def parse_persona_voice_map(persona: AvatarPersona) -> dict[str, str]:
    """Safely parse `AvatarPersona.voice_map` JSON text into a dict.

    Falls back to `{}` on malformed/empty JSON rather than crashing
    (mirrors `public_knowledge_config_service.parse_voice_map`)."""
    try:
        return json.loads(persona.voice_map or "{}")
    except (json.JSONDecodeError, TypeError):
        logger.warning("Malformed voice_map JSON on AvatarPersona %s; using {}", persona.id)
        return {}


async def create_persona(db: AsyncSession, data: AvatarPersonaCreate) -> AvatarPersona:
    """Create a new AvatarPersona. If `is_default=True` is requested, promotes
    it via `set_default_persona` (which also enforces the enabled-only guard)."""
    persona_data = data.model_dump()
    voice_map = persona_data.pop("voice_map", None) or {}
    want_default = persona_data.pop("is_default", False)

    persona = AvatarPersona(**persona_data, voice_map=json.dumps(voice_map), is_default=False)
    db.add(persona)
    await db.flush()
    await db.refresh(persona)

    if want_default:
        persona = await set_default_persona(db, persona.id)
    else:
        await db.commit()
        await db.refresh(persona)
    return persona


async def list_personas(db: AsyncSession, enabled_only: bool = False) -> list[AvatarPersona]:
    """List all AvatarPersona rows, optionally filtered to enabled-only
    (T-36-01: the filter is enforced at the query, not just serialization)."""
    query = select(AvatarPersona)
    if enabled_only:
        query = query.where(AvatarPersona.enabled == True)  # noqa: E712
    query = query.order_by(AvatarPersona.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_persona(db: AsyncSession, persona_id: str) -> AvatarPersona:
    """Get a single AvatarPersona by ID. Raises 404 if not found."""
    persona = await db.get(AvatarPersona, persona_id)
    if persona is None:
        not_found("Persona not found")
    return persona


async def update_persona(
    db: AsyncSession, persona_id: str, data: AvatarPersonaUpdate
) -> AvatarPersona:
    """Update an existing AvatarPersona with partial data.

    Enforces the unique-default guard: transitioning `enabled` True->False on
    the current default persona requires `new_default_persona_id` to promote
    a replacement default first (409 otherwise)."""
    persona = await get_persona(db, persona_id)
    update_data = data.model_dump(exclude_unset=True)
    new_default_persona_id = update_data.pop("new_default_persona_id", None)

    disabling_default = (
        "enabled" in update_data and update_data["enabled"] is False and persona.is_default
    )
    if disabling_default:
        if not new_default_persona_id:
            raise ConflictException(
                message=(
                    "Cannot disable the current default persona without designating "
                    "a new default via new_default_persona_id"
                )
            )
        await set_default_persona(db, new_default_persona_id)
        # Re-fetch: set_default_persona committed a bulk UPDATE clearing is_default
        # on every row (including this one) in a separate transaction step; reload
        # to avoid returning a stale in-memory is_default value.
        persona = await get_persona(db, persona_id)

    if "voice_map" in update_data and update_data["voice_map"] is not None:
        update_data["voice_map"] = json.dumps(update_data["voice_map"])

    want_default = update_data.pop("is_default", None)

    for field, value in update_data.items():
        setattr(persona, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(persona)

    if want_default:
        persona = await set_default_persona(db, persona.id)

    return persona


async def delete_persona(
    db: AsyncSession, persona_id: str, new_default_persona_id: str | None = None
) -> None:
    """Delete an AvatarPersona by ID.

    Enforces the unique-default guard: deleting the current default persona
    requires `new_default_persona_id` to promote a replacement default first
    (409 otherwise). Deleting a non-default persona always succeeds."""
    persona = await get_persona(db, persona_id)
    if persona.is_default:
        if not new_default_persona_id:
            raise ConflictException(
                message=(
                    "Cannot delete the current default persona without designating "
                    "a new default via new_default_persona_id"
                )
            )
        await set_default_persona(db, new_default_persona_id)
    await db.delete(persona)
    await db.commit()


async def set_default_persona(db: AsyncSession, persona_id: str) -> AvatarPersona:
    """Atomically promote `persona_id` to the sole default persona.

    Single-transaction "clear all, set one" guarantees the unique-default
    invariant (D-02, T-36-03) -- the system never observes a state with zero
    or more than one default among enabled personas."""
    target = await db.get(AvatarPersona, persona_id)
    if target is None:
        not_found("Persona not found")
    if not target.enabled:
        bad_request("Cannot set a disabled persona as default")
    await db.execute(update(AvatarPersona).values(is_default=False))
    target.is_default = True
    await db.commit()
    await db.refresh(target)
    return target
