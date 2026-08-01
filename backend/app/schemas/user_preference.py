"""Pydantic schemas for UserPreference admin CRUD + personalization summary
(Phase 33, PERS-03)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PreferenceCategory = Literal["communication_style", "focus_area", "language_preference"]

PREFERENCE_CATEGORIES: list[str] = ["communication_style", "focus_area", "language_preference"]


class UserPreferenceCreate(BaseModel):
    category: PreferenceCategory
    value: str = Field(..., min_length=1, max_length=500)


class UserPreferenceUpdate(BaseModel):
    value: str = Field(..., min_length=1, max_length=500)


class UserPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    category: str
    value: str
    created_at: datetime
    updated_at: datetime


class PersonalizationSummary(BaseModel):
    """Combined read model for the admin '个性化' dialog (D-11): read-only
    CRM match status (customer_name/company ONLY -- never crm_notes/
    contact_person) + the full preference-tag list."""

    crm_matched: bool
    customer_name: str | None = None
    company: str | None = None
    preferences: list[UserPreferenceOut] = []
