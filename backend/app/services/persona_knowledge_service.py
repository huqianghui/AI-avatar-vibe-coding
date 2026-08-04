"""Persona-scoped Knowledge Base service (persona-hcp-foundry-alignment
Increment C).

Sibling to the HCP-scoped CRUD in `knowledge_base_service.py` -- operates on
`AvatarPersonaKnowledgeConfig` (a separate table) instead of
`HcpKnowledgeConfig`. Global discovery (`list_search_connections`,
`list_indexes`) and the RemoteTool connection resolution / MCPTool building
(`resolve_kb_remote_tool_connections`, `build_search_tools`) are NOT
duplicated here -- those functions are duck-typed against config attributes
(`is_enabled`/`index_name`/`connection_target`/`server_label`), not against
`HcpKnowledgeConfig` specifically, so callers reuse them directly from
`knowledge_base_service` (see `agent_sync_service.sync_agent_for_profile`)."""

import asyncio
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.avatar_persona import AvatarPersona
from app.models.avatar_persona_knowledge_config import AvatarPersonaKnowledgeConfig
from app.schemas.knowledge_base import KnowledgeConfigCreate

logger = logging.getLogger(__name__)


async def get_knowledge_configs(
    db: AsyncSession, avatar_persona_id: str
) -> list[AvatarPersonaKnowledgeConfig]:
    """Query all knowledge base configs for an AvatarPersona."""
    result = await db.execute(
        select(AvatarPersonaKnowledgeConfig)
        .where(AvatarPersonaKnowledgeConfig.avatar_persona_id == avatar_persona_id)
        .order_by(AvatarPersonaKnowledgeConfig.created_at)
    )
    return list(result.scalars().all())


async def add_knowledge_config(
    db: AsyncSession,
    avatar_persona_id: str,
    config: KnowledgeConfigCreate,
) -> AvatarPersonaKnowledgeConfig:
    """Create an AvatarPersonaKnowledgeConfig record and trigger agent re-sync."""
    server_label = f"knowledge-base-{config.index_name}"
    record = AvatarPersonaKnowledgeConfig(
        id=str(uuid.uuid4()),
        avatar_persona_id=avatar_persona_id,
        connection_name=config.connection_name,
        connection_target=config.connection_target,
        index_name=config.index_name,
        server_label=server_label,
        is_enabled=True,
    )
    db.add(record)
    await db.flush()

    # Trigger agent re-sync in background (best effort)
    await _trigger_agent_resync(db, avatar_persona_id)

    return record


async def remove_knowledge_config(db: AsyncSession, config_id: str) -> None:
    """Delete a knowledge base config and trigger agent re-sync."""
    result = await db.execute(
        select(AvatarPersonaKnowledgeConfig).where(AvatarPersonaKnowledgeConfig.id == config_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        from app.utils.exceptions import not_found

        not_found("Knowledge config not found")

    avatar_persona_id = record.avatar_persona_id
    await db.delete(record)
    await db.flush()

    # Trigger agent re-sync in background (best effort)
    await _trigger_agent_resync(db, avatar_persona_id)


async def _trigger_agent_resync(db: AsyncSession, avatar_persona_id: str) -> None:
    """Re-sync the persona's AI Foundry Agent after a Knowledge Base config
    change. Mirrors `knowledge_base_service._trigger_agent_resync` for HCP
    profiles -- pending/synced/failed pattern, never swallows the sync result
    silently (agent_sync_status/agent_sync_error stay accurate for the admin
    UI's retry flow).

    Perf follow-up to persona-hcp-foundry-alignment: the actual ~14s+ sync
    chain no longer runs inline here -- this only flips the persona to
    "pending", commits (so the background task's own DB session can see the
    row -- SQLite cannot see an uncommitted row from another connection),
    and schedules `avatar_persona_service._run_background_agent_sync`,
    consistent with `create_persona`/`update_persona`/`retry_agent_sync`."""
    result = await db.execute(select(AvatarPersona).where(AvatarPersona.id == avatar_persona_id))
    persona = result.scalar_one_or_none()
    if not persona or not persona.agent_id:
        return

    persona.agent_sync_status = "pending"
    persona.agent_sync_error = ""
    await db.commit()

    from app.services.avatar_persona_service import _run_background_agent_sync

    asyncio.create_task(_run_background_agent_sync(avatar_persona_id))
    logger.info("KB change scheduled background agent re-sync for persona %s", avatar_persona_id)
