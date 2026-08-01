"""Admin CRUD for user preference tags + personalization summary
(Phase 33, PERS-03, D-09/D-10/D-11)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_db, require_role
from app.models.user import User
from app.models.user_crm_context import UserCrmContext
from app.models.user_preference import UserPreference
from app.schemas.user_preference import (
    PersonalizationSummary,
    UserPreferenceCreate,
    UserPreferenceOut,
    UserPreferenceUpdate,
)
from app.services.personalization_sanitizer import sanitize_field
from app.utils.exceptions import not_found

router = APIRouter(prefix="/users", tags=["admin-user-preferences"])


async def _get_user_or_404(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        not_found("User not found")
    return user


@router.get("/{user_id}/personalization", response_model=PersonalizationSummary)
async def get_personalization(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Read-only CRM match status + preference tags for one user (D-11)."""
    await _get_user_or_404(db, user_id)

    crm_result = await db.execute(select(UserCrmContext).where(UserCrmContext.user_id == user_id))
    crm = crm_result.scalar_one_or_none()

    prefs_result = await db.execute(
        select(UserPreference)
        .where(UserPreference.user_id == user_id)
        .order_by(UserPreference.created_at.asc())
    )
    preferences = list(prefs_result.scalars().all())

    return PersonalizationSummary(
        crm_matched=crm is not None,
        customer_name=crm.customer_name if crm else None,
        company=crm.company if crm else None,
        preferences=[UserPreferenceOut.model_validate(p) for p in preferences],
    )


@router.post("/{user_id}/preferences", response_model=UserPreferenceOut, status_code=201)
async def create_preference(
    user_id: str,
    data: UserPreferenceCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Add a preference tag for a user (D-09). Value sanitized with the same
    rules as CRM fields (T-33-06)."""
    await _get_user_or_404(db, user_id)
    settings = get_settings()

    preference = UserPreference(
        user_id=user_id,
        category=data.category,
        value=sanitize_field(data.value, settings.crm_field_max_length),
    )
    db.add(preference)
    await db.flush()
    await db.refresh(preference)
    return preference


@router.put("/{user_id}/preferences/{preference_id}", response_model=UserPreferenceOut)
async def update_preference(
    user_id: str,
    preference_id: str,
    data: UserPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Edit a preference tag's value (D-11 "改"). IDOR-safe: filters by BOTH
    preference_id AND user_id (T-33-05)."""
    settings = get_settings()
    result = await db.execute(
        select(UserPreference).where(
            UserPreference.id == preference_id, UserPreference.user_id == user_id
        )
    )
    preference = result.scalar_one_or_none()
    if preference is None:
        not_found("Preference not found")

    preference.value = sanitize_field(data.value, settings.crm_field_max_length)
    await db.flush()
    await db.refresh(preference)
    return preference


@router.delete("/{user_id}/preferences/{preference_id}", status_code=204)
async def delete_preference(
    user_id: str,
    preference_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Delete a preference tag. IDOR-safe: filters by BOTH preference_id AND
    user_id (T-33-05) -- an admin cannot delete another user's row by
    supplying a mismatched user_id/preference_id pair."""
    result = await db.execute(
        select(UserPreference).where(
            UserPreference.id == preference_id, UserPreference.user_id == user_id
        )
    )
    preference = result.scalar_one_or_none()
    if preference is None:
        not_found("Preference not found")

    await db.delete(preference)
    await db.flush()
