"""Admin API for editing PublicKnowledgeConfig.voice_map (Phase 34, LANG-02, D-06/D-07)."""

import json

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.public_knowledge_config import (
    PublicKnowledgeConfigVoiceMapOut,
    PublicKnowledgeConfigVoiceMapUpdate,
)
from app.services.public_knowledge_config_service import get_active_public_config
from app.services.voice_live_webrtc import DEFAULT_PUBLIC_VOICE_BY_LOCALE

router = APIRouter(prefix="/admin/public-knowledge-config", tags=["admin-public-knowledge-config"])


@router.get("/voice-map", response_model=PublicKnowledgeConfigVoiceMapOut)
async def get_voice_map(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> PublicKnowledgeConfigVoiceMapOut:
    """Return the current admin-configured voice_map plus built-in defaults."""
    config = await get_active_public_config(db)
    voice_map = json.loads(config.voice_map or "{}")
    return PublicKnowledgeConfigVoiceMapOut(
        voice_map=voice_map, defaults=DEFAULT_PUBLIC_VOICE_BY_LOCALE
    )


@router.put("/voice-map", response_model=PublicKnowledgeConfigVoiceMapOut)
async def update_voice_map(
    body: PublicKnowledgeConfigVoiceMapUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> PublicKnowledgeConfigVoiceMapOut:
    """Persist a new voice_map (any subset of the 5-locale allowlist)."""
    config = await get_active_public_config(db)
    config.voice_map = json.dumps(body.voice_map)
    await db.commit()
    await db.refresh(config)
    return PublicKnowledgeConfigVoiceMapOut(
        voice_map=json.loads(config.voice_map), defaults=DEFAULT_PUBLIC_VOICE_BY_LOCALE
    )
