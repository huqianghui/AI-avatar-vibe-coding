"""AvatarPersona request/response schemas (Phase 36, PERSONA-01/02)."""

import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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

    # Interim response + proactive engagement (persona-hcp-foundry-alignment
    # Increment F) -- mirrors HcpProfileCreate's fields of the same name.
    proactive_engagement: bool = False
    interim_response_enabled: bool = False
    interim_response_type: Literal["llm", "static"] = "llm"
    interim_response_threshold_ms: int = Field(default=500, ge=0)

    # Speech recognition model + Speech input/output Advanced settings
    # (persona-hcp-foundry-alignment Increment G) -- mirrors HcpProfileCreate's
    # fields of the same name. auto_detect_language is persona-only (no HCP
    # equivalent field; HCP reuses recognition_language's "auto" sentinel).
    speech_recognition_model: str = "azure-speech"
    eou_detection: bool = False
    noise_suppression: bool = False
    echo_cancellation: bool = False
    phrase_list: str = ""
    voice_temperature: float = Field(default=0.9, ge=0, le=1)
    playback_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    custom_lexicon_url: str = ""
    auto_detect_language: bool = False


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

    # Interim response + proactive engagement (Increment F)
    proactive_engagement: bool | None = None
    interim_response_enabled: bool | None = None
    interim_response_type: Literal["llm", "static"] | None = None
    interim_response_threshold_ms: int | None = Field(default=None, ge=0)

    # Speech recognition model + Speech input/output Advanced settings
    # (Increment G) -- all optional, partial-update semantics.
    speech_recognition_model: str | None = None
    eou_detection: bool | None = None
    noise_suppression: bool | None = None
    echo_cancellation: bool | None = None
    phrase_list: str | None = None
    voice_temperature: float | None = Field(default=None, ge=0, le=1)
    playback_speed: float | None = Field(default=None, ge=0.5, le=2.0)
    custom_lexicon_url: str | None = None
    auto_detect_language: bool | None = None


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

    # AI Foundry Agent sync fields (persona-hcp-foundry-alignment Increment A)
    agent_id: str = ""
    agent_version: str = ""
    agent_sync_status: str = "none"
    agent_sync_error: str = ""

    # Interim response + proactive engagement (Increment F)
    proactive_engagement: bool = False
    interim_response_enabled: bool = False
    interim_response_type: str = "llm"
    interim_response_threshold_ms: int = 500

    # Speech recognition model + Speech input/output Advanced settings
    # (persona-hcp-foundry-alignment Increment G)
    speech_recognition_model: str = "azure-speech"
    eou_detection: bool = False
    noise_suppression: bool = False
    echo_cancellation: bool = False
    phrase_list: str = ""
    voice_temperature: float = 0.9
    playback_speed: float = 1.0
    custom_lexicon_url: str = ""
    auto_detect_language: bool = False

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
