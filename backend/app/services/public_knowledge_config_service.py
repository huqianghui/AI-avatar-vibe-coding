"""Server-side resolver for the single active public knowledge config
(Phase 32, ANON-02/T-32-05).

An anonymous visitor must never receive a default/fallback agent or
knowledge base — if no `PublicKnowledgeConfig` row is marked `is_active`,
this fails closed with a 404 rather than guessing which config to use.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.utils.exceptions import not_found


async def get_active_public_config(db: AsyncSession) -> PublicKnowledgeConfig:
    """Return the single active `PublicKnowledgeConfig` row, or fail closed
    with 404 if none is configured."""
    result = await db.execute(
        select(PublicKnowledgeConfig).where(PublicKnowledgeConfig.is_active == True)  # noqa: E712
    )
    config = result.scalar_one_or_none()
    if config is None:
        not_found("No active public knowledge configuration")
    return config
