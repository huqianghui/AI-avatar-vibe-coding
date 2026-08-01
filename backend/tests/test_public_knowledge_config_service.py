"""Tests for the public knowledge config resolver service (Phase 32, ANON-02/T-32-05).

Verifies the fail-closed contract: an anonymous visitor must never receive a
default/fallback agent or knowledge base when no active config is configured.
"""

import pytest

from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.services.public_knowledge_config_service import get_active_public_config, parse_voice_map
from app.utils.exceptions import AppException


def _make_public_config(
    is_active: bool = True, voice_map: str | None = None
) -> PublicKnowledgeConfig:
    return PublicKnowledgeConfig(
        agent_id="test-agent",
        agent_version="1",
        connection_name="conn",
        connection_target="https://search.example",
        index_name="kb1",
        is_active=is_active,
        voice_map=voice_map,
    )


class TestGetActivePublicConfig:
    async def test_returns_active_config_row(self, db_session):
        """When exactly one active row exists, it is returned."""
        config = _make_public_config(is_active=True)
        db_session.add(config)
        await db_session.commit()
        await db_session.refresh(config)

        result = await get_active_public_config(db_session)

        assert result.id == config.id
        assert result.agent_id == "test-agent"

    async def test_ignores_inactive_config_row(self, db_session):
        """An inactive row must never be returned; fails closed with 404."""
        inactive = _make_public_config(is_active=False)
        db_session.add(inactive)
        await db_session.commit()

        with pytest.raises(AppException) as exc_info:
            await get_active_public_config(db_session)

        assert exc_info.value.status_code == 404

    async def test_raises_404_when_no_config_exists(self, db_session):
        """No rows at all: fails closed with 404 rather than guessing."""
        with pytest.raises(AppException) as exc_info:
            await get_active_public_config(db_session)

        assert exc_info.value.status_code == 404


class TestParseVoiceMap:
    """WR-02: `parse_voice_map` must never raise on a malformed DB value --
    the anonymous public WebRTC path depends on this not 500ing."""

    def test_parses_valid_json(self):
        config = _make_public_config(voice_map='{"es-ES": "es-ES-ElviraNeural"}')

        assert parse_voice_map(config) == {"es-ES": "es-ES-ElviraNeural"}

    def test_none_value_falls_back_to_empty_dict(self):
        config = _make_public_config(voice_map=None)

        assert parse_voice_map(config) == {}

    def test_empty_string_falls_back_to_empty_dict(self):
        config = _make_public_config(voice_map="")

        assert parse_voice_map(config) == {}

    def test_malformed_json_falls_back_to_empty_dict_instead_of_raising(self):
        config = _make_public_config(voice_map="{not valid json")

        assert parse_voice_map(config) == {}
