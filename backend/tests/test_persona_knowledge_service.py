"""Tests for persona_knowledge_service (persona-hcp-foundry-alignment
Increment C) and the provider-aware KB lookup in
agent_sync_service.sync_agent_for_profile.

RemoteTool connection resolution / MCPTool building (resolve_kb_remote_tool_
connections, build_search_tools) are exercised against HcpKnowledgeConfig in
test_knowledge_base.py -- they are duck-typed and shared, not re-tested here.
This file focuses on the persona-scoped CRUD + resync + the isinstance
dispatch that routes personas to this module instead of knowledge_base_service.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.models.avatar_persona import AvatarPersona
from app.models.avatar_persona_knowledge_config import AvatarPersonaKnowledgeConfig
from app.schemas.knowledge_base import KnowledgeConfigCreate

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def sample_persona(db_session):
    """Create a sample AvatarPersona in the test DB."""
    persona = AvatarPersona(
        id="persona-kb-test-001",
        name="KB Test Persona",
        character="lisa",
        style="casual-sitting",
        voice_map="{}",
        greeting_map="{}",
        prompt_fragment="Be helpful.",
    )
    db_session.add(persona)
    await db_session.flush()
    return persona


@pytest.fixture
async def sample_persona_kb_config(db_session, sample_persona):
    """Create a sample persona knowledge config in the test DB."""
    config = AvatarPersonaKnowledgeConfig(
        id="persona-kb-config-001",
        avatar_persona_id=sample_persona.id,
        connection_name="my-search-conn",
        connection_target="https://search.example.com",
        index_name="persona-index",
        server_label="knowledge-base-persona-index",
        is_enabled=True,
    )
    db_session.add(config)
    await db_session.flush()
    return config


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


class TestPersonaKnowledgeServiceCrud:
    @pytest.mark.asyncio
    async def test_get_configs_empty(self, db_session, sample_persona):
        from app.services.persona_knowledge_service import get_knowledge_configs

        result = await get_knowledge_configs(db_session, sample_persona.id)
        assert result == []

    @pytest.mark.asyncio
    @patch(
        "app.services.persona_knowledge_service._trigger_agent_resync",
        new_callable=AsyncMock,
    )
    async def test_add_knowledge_config(self, mock_resync, db_session, sample_persona):
        from app.services.persona_knowledge_service import add_knowledge_config

        create_data = KnowledgeConfigCreate(
            connection_name="test-conn",
            connection_target="https://search.test.com",
            index_name="test-index",
        )
        result = await add_knowledge_config(db_session, sample_persona.id, create_data)

        assert result.connection_name == "test-conn"
        assert result.index_name == "test-index"
        assert result.server_label == "knowledge-base-test-index"
        assert result.is_enabled is True
        assert result.avatar_persona_id == sample_persona.id
        mock_resync.assert_called_once()

    @pytest.mark.asyncio
    @patch(
        "app.services.persona_knowledge_service._trigger_agent_resync",
        new_callable=AsyncMock,
    )
    async def test_get_configs_after_add(self, mock_resync, db_session, sample_persona):
        from app.services.persona_knowledge_service import (
            add_knowledge_config,
            get_knowledge_configs,
        )

        await add_knowledge_config(
            db_session,
            sample_persona.id,
            KnowledgeConfigCreate(connection_name="conn-a", index_name="index-a"),
        )

        configs = await get_knowledge_configs(db_session, sample_persona.id)
        assert len(configs) == 1
        assert configs[0].connection_name == "conn-a"

    @pytest.mark.asyncio
    @patch(
        "app.services.persona_knowledge_service._trigger_agent_resync",
        new_callable=AsyncMock,
    )
    async def test_remove_knowledge_config(self, mock_resync, db_session, sample_persona_kb_config):
        from app.services.persona_knowledge_service import (
            get_knowledge_configs,
            remove_knowledge_config,
        )

        await remove_knowledge_config(db_session, sample_persona_kb_config.id)

        avatar_persona_id = sample_persona_kb_config.avatar_persona_id
        configs = await get_knowledge_configs(db_session, avatar_persona_id)
        assert len(configs) == 0
        assert mock_resync.call_count == 1

    @pytest.mark.asyncio
    @patch(
        "app.services.persona_knowledge_service._trigger_agent_resync",
        new_callable=AsyncMock,
    )
    async def test_remove_nonexistent_config_raises(self, mock_resync, db_session):
        from app.services.persona_knowledge_service import remove_knowledge_config
        from app.utils.exceptions import AppException

        with pytest.raises(AppException) as exc_info:
            await remove_knowledge_config(db_session, "nonexistent-id")
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Cascade delete + relationship
# ---------------------------------------------------------------------------


class TestAvatarPersonaKnowledgeConfigModel:
    @pytest.mark.asyncio
    async def test_cascade_delete(self, db_session, sample_persona, sample_persona_kb_config):
        from sqlalchemy import select

        await db_session.delete(sample_persona)
        await db_session.flush()

        result = await db_session.execute(
            select(AvatarPersonaKnowledgeConfig).where(
                AvatarPersonaKnowledgeConfig.id == sample_persona_kb_config.id
            )
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_relationship(self, db_session, sample_persona):
        config = AvatarPersonaKnowledgeConfig(
            avatar_persona_id=sample_persona.id,
            connection_name="rel-conn",
            index_name="rel-index",
            server_label="knowledge-base-rel-index",
        )
        db_session.add(config)
        await db_session.flush()

        await db_session.refresh(sample_persona, ["knowledge_configs"])
        assert len(sample_persona.knowledge_configs) == 1
        assert sample_persona.knowledge_configs[0].connection_name == "rel-conn"
        assert sample_persona.knowledge_config_count == 1


# ---------------------------------------------------------------------------
# _trigger_agent_resync
# ---------------------------------------------------------------------------


class TestTriggerAgentResync:
    """Perf follow-up to persona-hcp-foundry-alignment: `_trigger_agent_resync`
    no longer syncs inline -- it only sets "pending", commits, and schedules
    `avatar_persona_service._run_background_agent_sync` via
    `asyncio.create_task`, consistent with create/update/retry-sync. The
    sync's own success/failure outcome is exercised directly against
    `_run_background_agent_sync` in `test_avatar_persona_service.py`'s
    `TestRunBackgroundAgentSync`."""

    @pytest.mark.asyncio
    async def test_marks_pending_and_schedules_background_sync(self, db_session, sample_persona):
        from app.services.persona_knowledge_service import _trigger_agent_resync

        sample_persona.agent_sync_status = "none"
        sample_persona.agent_id = "existing-agent"
        await db_session.flush()

        # Capture (rather than run) the scheduled coroutine so the real
        # background function never actually executes against a real
        # AsyncSessionLocal in this unit test -- close it explicitly to
        # avoid a "coroutine was never awaited" warning.
        captured: dict[str, object] = {}

        def capture_task(coro):
            captured["coro"] = coro
            return None

        with patch("app.services.persona_knowledge_service.asyncio") as mock_asyncio:
            mock_asyncio.create_task.side_effect = capture_task
            await _trigger_agent_resync(db_session, sample_persona.id)

        assert "coro" in captured
        captured["coro"].close()

        await db_session.refresh(sample_persona)
        assert sample_persona.agent_sync_status == "pending"
        assert sample_persona.agent_sync_error == ""
        mock_asyncio.create_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_noop_when_no_agent_id(self, db_session, sample_persona):
        """No-op (no sync scheduled) when the persona has never been synced."""
        from app.services.persona_knowledge_service import _trigger_agent_resync

        sample_persona.agent_id = ""
        await db_session.flush()

        with patch("app.services.persona_knowledge_service.asyncio") as mock_asyncio:
            await _trigger_agent_resync(db_session, sample_persona.id)

        mock_asyncio.create_task.assert_not_called()


# ---------------------------------------------------------------------------
# agent_sync_service.sync_agent_for_profile provider-aware KB dispatch
# ---------------------------------------------------------------------------


class TestSyncAgentForProfileKbDispatch:
    @pytest.mark.asyncio
    async def test_persona_uses_persona_knowledge_service(self, db_session, sample_persona):
        """A persona routes KB lookup to persona_knowledge_service, not
        knowledge_base_service (which is hard-FK'd to hcp_profiles)."""
        from app.services.agent_sync_service import sync_agent_for_profile

        with (
            patch(
                "app.services.persona_knowledge_service.get_knowledge_configs",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_persona_get,
            patch(
                "app.services.knowledge_base_service.get_knowledge_configs",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_hcp_get,
            patch(
                "app.services.agent_sync_service.create_agent",
                new_callable=AsyncMock,
                return_value={"id": "persona-agent", "version": "1"},
            ),
            patch(
                "app.services.agent_sync_service.get_agent_latest_version",
                new_callable=AsyncMock,
                return_value="1",
            ),
        ):
            await sync_agent_for_profile(db_session, sample_persona, prefetched_model="gpt-4o")

        mock_persona_get.assert_awaited_once_with(db_session, sample_persona.id)
        mock_hcp_get.assert_not_called()

    @pytest.mark.asyncio
    async def test_persona_kb_configs_produce_tools(self, db_session, sample_persona):
        """Enabled persona KB configs are resolved via the shared (duck-typed)
        resolve_kb_remote_tool_connections/build_search_tools and passed as
        tools to create_agent."""
        from app.services.agent_sync_service import sync_agent_for_profile

        cfg = AvatarPersonaKnowledgeConfig(
            avatar_persona_id=sample_persona.id,
            connection_name="conn",
            connection_target="https://search.example.com",
            index_name="persona-tools-index",
            server_label="knowledge-base-persona-tools-index",
            is_enabled=True,
        )
        db_session.add(cfg)
        await db_session.flush()

        fake_tool = object()

        with (
            patch(
                "app.services.knowledge_base_service.resolve_kb_remote_tool_connections",
                new_callable=AsyncMock,
                return_value={"persona-tools-index": "rt-conn"},
            ),
            patch(
                "app.services.knowledge_base_service.build_search_tools",
                return_value=[fake_tool],
            ) as mock_build_tools,
            patch(
                "app.services.agent_sync_service.create_agent",
                new_callable=AsyncMock,
                return_value={"id": "persona-agent", "version": "1"},
            ) as mock_create_agent,
            patch(
                "app.services.agent_sync_service.get_agent_latest_version",
                new_callable=AsyncMock,
                return_value="1",
            ),
        ):
            await sync_agent_for_profile(db_session, sample_persona, prefetched_model="gpt-4o")

        mock_build_tools.assert_called_once()
        _, kwargs = mock_create_agent.await_args
        assert kwargs["tools"] == [fake_tool]
