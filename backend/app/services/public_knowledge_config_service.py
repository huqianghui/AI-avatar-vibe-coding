"""Server-side resolver for the single active public knowledge config
(Phase 32, ANON-02/T-32-05).

An anonymous visitor must never receive a default/fallback agent or
knowledge base — if no `PublicKnowledgeConfig` row is marked `is_active`,
this fails closed with a 404 rather than guessing which config to use.
"""

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.utils.exceptions import not_found

logger = logging.getLogger(__name__)


async def get_active_public_config(db: AsyncSession) -> PublicKnowledgeConfig:
    """Return the single active `PublicKnowledgeConfig` row, or fail closed
    with 404 if none is configured."""
    config = await get_active_public_config_or_none(db)
    if config is None:
        not_found("No active public knowledge configuration")
    return config


async def get_active_public_config_or_none(db: AsyncSession) -> PublicKnowledgeConfig | None:
    """Return the single active `PublicKnowledgeConfig` row, or None.

    Callers that can degrade gracefully without a Foundry IQ knowledge base
    (ungrounded model-mode voice/chat) use this instead of the fail-closed
    variant -- the anonymous surface must stay usable even before an admin
    has ever configured a public knowledge base.
    """
    result = await db.execute(
        select(PublicKnowledgeConfig).where(PublicKnowledgeConfig.is_active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


def parse_voice_map(config: PublicKnowledgeConfig) -> dict[str, str]:
    """Safely parse `PublicKnowledgeConfig.voice_map` JSON text into a dict.

    The column is a bare `Text` field with no DB-level JSON constraint and is
    editable outside the validated PUT endpoint (DB tooling, migrations, seed
    scripts). Falls back to `{}` on malformed JSON rather than letting a
    `JSONDecodeError`/`TypeError` bubble up as an uncaught 500 -- this
    resolver is on the anonymous public WebRTC path, so a bad DB value must
    not take down that surface (WR-02).
    """
    try:
        return json.loads(config.voice_map or "{}")
    except (json.JSONDecodeError, TypeError):
        logger.warning("Malformed voice_map JSON on PublicKnowledgeConfig %s; using {}", config.id)
        return {}
