"""Schemas for the admin public-knowledge-config voice-map endpoints (Phase 34, LANG-02)."""

import re

from pydantic import BaseModel, field_validator

VOICE_MAP_LOCALES = {"zh-CN", "en-US", "es-ES", "es-MX", "es-US"}

#: Max length for a single voice-map value (Azure neural voice names are short,
#: e.g. "zh-CN-XiaoxiaoMultilingualNeural"); guards against megabyte-scale garbage
#: being persisted into the `Text` column (WR-01).
VOICE_NAME_MAX_LENGTH = 100

#: Matches Azure neural voice names such as "es-ES-ElviraNeural" or
#: "zh-CN-XiaoxiaoMultilingualNeural" -- language-region prefix followed by a
#: voice display name ending in "Neural". Empty string is validated separately
#: (D-07: empty means "use built-in default").
AZURE_VOICE_NAME_PATTERN = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z]{2,4})+-[A-Za-z0-9]+Neural$")


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
        for locale, voice in value.items():
            if voice == "":
                continue  # D-07: empty means "use built-in default", not invalid
            if len(voice) > VOICE_NAME_MAX_LENGTH:
                raise ValueError(
                    f"Voice name for {locale} exceeds max length of {VOICE_NAME_MAX_LENGTH}"
                )
            if not AZURE_VOICE_NAME_PATTERN.match(voice):
                raise ValueError(f"Invalid voice name for {locale}: {voice!r}")
        return value
