"""Personalization injection-context builder (Phase 33, PERS-02, D-05/D-06/D-07/D-08).

Builds the "## User Background" prompt segment from UserCrmContext +
UserPreference, re-running personalization_sanitizer's rules as the SECOND
of the two required sanitization gates (D-06) -- the first gate already ran
at CRM-import time (crm_import_service.py, 33-01). Returns "" when neither a
CRM row nor any preference rows exist for the user (D-08 silent fallback --
callers must treat "" as "inject nothing", never as an error).

Preference lookup is deliberately isolated behind a try/except ImportError:
`UserPreference` (Phase 33 PERS-03, 33-07) does not exist yet -- PERS-03
executes AFTER this plan and 33-05 in the serialized PERS-01->02->03 wave
order (CLAUDE.md top-priority rule). This function must degrade gracefully
(CRM-only injection, no crash) rather than hard-import a model that might not
be defined.

Ownership note: THIS FILE owns the runtime wiring of preference tags into the
prompt segment. 33-07 (PERS-03) does not, and must not, modify this file --
it only needs to create a `UserPreference` model matching the shape this
function already queries (`user_id`, `category`, `value`). Once 33-07 lands,
`_load_preferences` below starts succeeding automatically on its next
invocation -- no code change required anywhere."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user_crm_context import UserCrmContext
from app.services.personalization_sanitizer import sanitize_field, sanitize_free_text_with_pii

settings = get_settings()


async def _load_crm_context(db: AsyncSession, user_id: str) -> UserCrmContext | None:
    result = await db.execute(select(UserCrmContext).where(UserCrmContext.user_id == user_id))
    return result.scalar_one_or_none()


async def _load_preferences(db: AsyncSession, user_id: str) -> list:
    try:
        from app.models.user_preference import UserPreference
    except ImportError:
        return []
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    return list(result.scalars().all())


async def build_personalization_context(db: AsyncSession, user_id: str) -> str:
    """Returns the sanitized "## User Background" segment, or "" if the user
    has no CRM context AND no preference tags (D-08)."""
    crm = await _load_crm_context(db, user_id)
    preferences = await _load_preferences(db, user_id)
    if crm is None and not preferences:
        return ""

    lines = ["## User Background"]
    if crm is not None:
        if crm.customer_name:
            lines.append(
                f"Customer: {sanitize_field(crm.customer_name, settings.crm_field_max_length)}"
            )
        if crm.company:
            lines.append(f"Company: {sanitize_field(crm.company, settings.crm_field_max_length)}")
        if crm.role:
            lines.append(f"Role: {sanitize_field(crm.role, settings.crm_field_max_length)}")
        if crm.contact_person:
            lines.append(
                f"Contact: {sanitize_field(crm.contact_person, settings.crm_field_max_length)}"
            )
        if crm.crm_notes:
            notes = sanitize_free_text_with_pii(crm.crm_notes, settings.crm_notes_max_length)
            lines.append(f"Notes: {notes}")
    if preferences:
        pref_str = ", ".join(
            f"{sanitize_field(p.category, 100)}={sanitize_field(p.value, 200)}" for p in preferences
        )
        lines.append(f"Preferences: {pref_str}")
    return "\n".join(lines)
