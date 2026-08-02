"""Configuration API endpoint: feature flags, available adapters."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.services import config_service
from app.services.agents.registry import registry

router = APIRouter(prefix="/config", tags=["config"])


class FeatureFlags(BaseModel):
    """Current feature toggle state."""

    avatar_enabled: bool
    voice_enabled: bool
    realtime_voice_enabled: bool
    conference_enabled: bool
    voice_live_enabled: bool
    legacy_coach_nav_enabled: bool
    default_voice_mode: str
    region: str


class ConfigResponse(BaseModel):
    """Configuration response with feature flags and available adapters."""

    features: FeatureFlags
    available_adapters: dict[str, list[str]]


@router.get("/features", response_model=ConfigResponse)
async def get_features(
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current feature flags and available adapters."""
    settings = get_settings()
    adapters = registry.list_all_categories()
    azure_speech_stt = await config_service.get_config(db, "azure_speech_stt")
    azure_speech_tts = await config_service.get_config(db, "azure_speech_tts")
    azure_avatar = await config_service.get_config(db, "azure_avatar")
    azure_openai_realtime = await config_service.get_config(db, "azure_openai_realtime")
    azure_voice_live = await config_service.get_config(db, "azure_voice_live")
    return ConfigResponse(
        features=FeatureFlags(
            avatar_enabled=settings.feature_avatar_enabled
            or bool(azure_avatar and azure_avatar.is_active),
            voice_enabled=settings.feature_voice_enabled
            or bool(azure_speech_stt and azure_speech_stt.is_active)
            or bool(azure_speech_tts and azure_speech_tts.is_active),
            realtime_voice_enabled=settings.feature_realtime_voice_enabled
            or bool(azure_openai_realtime and azure_openai_realtime.is_active),
            conference_enabled=settings.feature_conference_enabled,
            voice_live_enabled=settings.feature_voice_live_enabled
            or bool(azure_voice_live and azure_voice_live.is_active),
            legacy_coach_nav_enabled=settings.feature_legacy_coach_nav_enabled,
            default_voice_mode=settings.default_voice_mode,
            region=settings.region,
        ),
        available_adapters=adapters,
    )
