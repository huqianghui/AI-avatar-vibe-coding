"""Integration tests for the admin public-knowledge-config voice-map API
(Phase 34, LANG-02, D-06/D-07)."""

from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_pkc",
            email="admin_pkc@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin PKC",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_user_and_token() -> tuple[str, str]:
    """Create a regular (non-admin) user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="user_pkc",
            email="user_pkc@test.com",
            hashed_password=get_password_hash("pass123"),
            full_name="Regular User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_active_config(voice_map: str = "{}") -> PublicKnowledgeConfig:
    """Create the single active PublicKnowledgeConfig row used by the resolver."""
    async with TestSessionLocal() as session:
        config = PublicKnowledgeConfig(
            agent_id="test-agent",
            agent_version="1",
            connection_name="conn",
            connection_target="https://search.example",
            index_name="kb1",
            voice_map=voice_map,
            is_active=True,
        )
        session.add(config)
        await session.commit()
        await session.refresh(config)
        return config


class TestGetVoiceMap:
    """Tests for GET /api/v1/admin/public-knowledge-config/voice-map."""

    async def test_admin_gets_voice_map_and_defaults(self, client):
        await _create_active_config('{"es-ES": "es-ES-ElviraNeural"}')
        _, token = await _create_admin_and_token()

        response = await client.get(
            "/api/v1/admin/public-knowledge-config/voice-map",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["voice_map"] == {"es-ES": "es-ES-ElviraNeural"}
        assert data["defaults"] == {
            "zh-CN": "zh-CN-XiaoxiaoMultilingualNeural",
            "en-US": "en-US-AvaNeural",
            "es-ES": "es-ES-ElviraNeural",
            "es-MX": "es-MX-DaliaNeural",
            "es-US": "es-US-PalomaNeural",
        }

    async def test_non_admin_gets_403(self, client):
        await _create_active_config()
        _, token = await _create_user_and_token()

        response = await client.get(
            "/api/v1/admin/public-knowledge-config/voice-map",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestUpdateVoiceMap:
    """Tests for PUT /api/v1/admin/public-knowledge-config/voice-map."""

    async def test_admin_updates_and_persists(self, client):
        await _create_active_config()
        _, token = await _create_admin_and_token()

        put_response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"es-ES": "es-ES-ElviraNeural"}},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert put_response.status_code == 200
        assert put_response.json()["voice_map"] == {"es-ES": "es-ES-ElviraNeural"}

        get_response = await client.get(
            "/api/v1/admin/public-knowledge-config/voice-map",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_response.json()["voice_map"] == {"es-ES": "es-ES-ElviraNeural"}

    async def test_unknown_locale_key_returns_422(self, client):
        await _create_active_config()
        _, token = await _create_admin_and_token()

        response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"fr-FR": "x"}},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 422

    async def test_empty_string_value_for_known_locale_is_accepted(self, client):
        """D-07: an empty value means 'use built-in default', not invalid."""
        await _create_active_config()
        _, token = await _create_admin_and_token()

        response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"es-MX": ""}},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["voice_map"] == {"es-MX": ""}

    async def test_invalid_voice_name_value_returns_422(self, client):
        """WR-01: a voice-name value that isn't a well-formed Azure neural
        voice name (and isn't the D-07 empty-string sentinel) is rejected."""
        await _create_active_config()
        _, token = await _create_admin_and_token()

        response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"es-ES": "<script>alert(1)</script>"}},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 422

    async def test_overlong_voice_name_value_returns_422(self, client):
        """WR-01: a voice-name value exceeding the max length is rejected."""
        await _create_active_config()
        _, token = await _create_admin_and_token()

        response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"es-ES": "es-ES-" + "A" * 200 + "Neural"}},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 422

    async def test_wellformed_voice_name_value_is_accepted(self, client):
        """WR-01: a well-formed Azure neural voice name still passes validation."""
        await _create_active_config()
        _, token = await _create_admin_and_token()

        response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"zh-CN": "zh-CN-XiaoxiaoMultilingualNeural"}},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["voice_map"] == {"zh-CN": "zh-CN-XiaoxiaoMultilingualNeural"}

    async def test_non_admin_put_returns_403(self, client):
        await _create_active_config()
        _, token = await _create_user_and_token()

        response = await client.put(
            "/api/v1/admin/public-knowledge-config/voice-map",
            json={"voice_map": {"es-ES": "es-ES-ElviraNeural"}},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403
