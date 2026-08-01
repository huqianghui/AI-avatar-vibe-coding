"""Schemas for the admin public-knowledge-config voice-map endpoints (Phase 34, LANG-02)."""

from pydantic import BaseModel, field_validator

VOICE_MAP_LOCALES = {"zh-CN", "en-US", "es-ES", "es-MX", "es-US"}


class PublicKnowledgeConfigVoiceMapOut(BaseModel):
    """Response body: current admin-configured voice_map plus built-in defaults."""

    voice_map: dict[str, str]
    defaults: dict[str, str]


class PublicKnowledgeConfigVoiceMapUpdate(BaseModel):
    """Request body for PUT: any subset of the 5-locale allowlist.

    An empty-string value for a known locale is accepted (D-07: empty means
    "use built-in default", not invalid).
    """

    voice_map: dict[str, str]

    @field_validator("voice_map")
    @classmethod
    def validate_locale_keys(cls, value: dict[str, str]) -> dict[str, str]:
        unknown = set(value.keys()) - VOICE_MAP_LOCALES
        if unknown:
            raise ValueError(f"Unknown locale key(s): {sorted(unknown)}")
        return value
