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
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user_preference import UserPreference
from app.schemas.avatar_persona import AvatarPersonaCreate, AvatarPersonaUpdate
from app.services.personalization_sanitizer import sanitize_free_text_with_pii
from app.services.public_knowledge_config_service import parse_voice_map
from app.services.voice_live_webrtc import DEFAULT_PUBLIC_VOICE_BY_LOCALE
from app.utils.exceptions import ConflictException, bad_request, not_found

logger = logging.getLogger(__name__)

# UserPreference.category value used to store a logged-in user's own selected
# persona (Phase 36, PERSONA-04). Read-only here -- writing this category is
# owned by 36-04, which does not exist yet at the time this plan executes.
SELECTED_PERSONA_PREFERENCE_CATEGORY = "selected_persona_id"


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
    # Gate 1 (T-36-12): sanitize the free-text prompt_fragment at admin-save
    # time. Gate 2 re-sanitizes again at chat-injection time (see
    # avatar_service.py / personalized_avatar_service.py).
    persona_data["prompt_fragment"] = sanitize_free_text_with_pii(
        persona_data.get("prompt_fragment")
    )

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

    if "prompt_fragment" in update_data:
        # Gate 1 (T-36-12): re-sanitize on every update, same as create.
        update_data["prompt_fragment"] = sanitize_free_text_with_pii(update_data["prompt_fragment"])

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


async def _get_default_persona(db: AsyncSession) -> AvatarPersona:
    """Return the catalog's single enabled default persona. Raises 404 if
    none is configured -- a true misconfiguration (the unique-default guard
    in set_default_persona/update_persona/delete_persona keeps exactly one
    enabled persona flagged default once any persona has ever been created;
    seed_data.py also guarantees one on a fresh install)."""
    result = await db.execute(
        select(AvatarPersona).where(
            AvatarPersona.is_default == True,  # noqa: E712
            AvatarPersona.enabled == True,  # noqa: E712
        )
    )
    default = result.scalars().first()
    if default is None:
        not_found("No default persona configured")
    return default


async def resolve_active_persona(
    db: AsyncSession,
    *,
    user_id: str | None = None,
    requested_persona_id: str | None = None,
) -> AvatarPersona:
    """Resolve the persona that should shape the current session/chat turn
    (Phase 36, PERSONA-04, T-36-10/T-36-11/T-36-13).

    Precedence:
    1. `requested_persona_id` set and refers to an ENABLED persona -> that
       persona wins outright, regardless of `user_id` (the anonymous WebRTC
       path never has a user_id; this also lets a not-yet-logged-in switcher
       preview work).
    2. `requested_persona_id` set but disabled/unknown -> falls through to
       the default persona SILENTLY -- never an exception, so a probing
       client can never learn whether an id exists or is enabled.
    3. `requested_persona_id` is None and `user_id` is set -> the user's own
       `UserPreference(category="selected_persona_id")` row wins if it still
       references an enabled persona; otherwise falls through to default.
    4. Otherwise -> the catalog's single enabled default persona.
    """
    if requested_persona_id:
        candidate = await db.get(AvatarPersona, requested_persona_id)
        if candidate is not None and candidate.enabled:
            return candidate
        return await _get_default_persona(db)

    if user_id:
        pref_result = await db.execute(
            select(UserPreference).where(
                UserPreference.user_id == user_id,
                UserPreference.category == SELECTED_PERSONA_PREFERENCE_CATEGORY,
            )
        )
        pref = pref_result.scalars().first()
        if pref is not None:
            candidate = await db.get(AvatarPersona, pref.value)
            if candidate is not None and candidate.enabled:
                return candidate

    return await _get_default_persona(db)


def resolve_voice_for_locale(
    persona: AvatarPersona,
    locale: str,
    *,
    public_config: PublicKnowledgeConfig | None = None,
) -> str:
    """3-tier voice fallback chain (Phase 36, PERSONA-04):
    persona.voice_map[locale] -> Phase 34 admin PublicKnowledgeConfig
    voice_map[locale] -> DEFAULT_PUBLIC_VOICE_BY_LOCALE[locale]."""
    persona_map = parse_persona_voice_map(persona)
    if locale in persona_map:
        return persona_map[locale]
    if public_config is not None:
        config_map = parse_voice_map(public_config)
        if locale in config_map:
            return config_map[locale]
    return DEFAULT_PUBLIC_VOICE_BY_LOCALE.get(locale, DEFAULT_PUBLIC_VOICE_BY_LOCALE["zh-CN"])
