"""AvatarPersona request/response schemas (Phase 36, PERSONA-01/02)."""

import json

from pydantic import BaseModel, ConfigDict, field_validator


class AvatarPersonaCreate(BaseModel):
    """Create a new AvatarPersona. Admin only."""

    name: str
    character: str
    style: str = ""
    voice_map: dict[str, str] = {}
    greeting_map: dict[str, str] = {}
    prompt_fragment: str = ""
    enabled: bool = True
    is_default: bool = False


class AvatarPersonaUpdate(BaseModel):
    """Update an existing AvatarPersona. All fields optional for partial updates.

    `new_default_persona_id` is not a persisted field -- it is a one-shot
    instruction telling the service which persona to atomically promote to
    default before this persona is disabled (D-02 unique-default guard)."""

    name: str | None = None
    character: str | None = None
    style: str | None = None
    voice_map: dict[str, str] | None = None
    greeting_map: dict[str, str] | None = None
    prompt_fragment: str | None = None
    enabled: bool | None = None
    is_default: bool | None = None
    new_default_persona_id: str | None = None


class AvatarPersonaOut(BaseModel):
    """AvatarPersona response with the JSON voice_map/greeting_map fields parsed."""

    id: str
    name: str
    character: str
    style: str
    voice_map: dict[str, str]
    greeting_map: dict[str, str]
    prompt_fragment: str
    enabled: bool
    is_default: bool
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

    @field_validator("voice_map", mode="before")
    @classmethod
    def parse_voice_map(cls, v: str | dict[str, str]) -> dict[str, str]:
        """Parse the JSON Text column into a dict; malformed/empty JSON falls
        back to `{}` rather than crashing (mirrors parse_voice_map())."""
        if isinstance(v, str):
            try:
                return json.loads(v or "{}")
            except (json.JSONDecodeError, TypeError):
                return {}
        return v

    @field_validator("greeting_map", mode="before")
    @classmethod
    def parse_greeting_map(cls, v: str | dict[str, str]) -> dict[str, str]:
        """Parse the JSON Text column into a dict; malformed/empty JSON falls
        back to `{}` rather than crashing (mirrors parse_voice_map())."""
        if isinstance(v, str):
            try:
                return json.loads(v or "{}")
            except (json.JSONDecodeError, TypeError):
                return {}
        return v

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def datetime_to_str(cls, v: object) -> str:
        """Convert datetime to ISO string."""
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)
