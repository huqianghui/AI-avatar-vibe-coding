"""Tests for the anonymous WebRTC ephemeral-credential endpoint (Phase 32,
Plan 03, ANON-04).

Covers: successful credential issuance with admin-configured avatar identity,
rejection before any Azure credential call when the anonymous session is
missing/invalid, and IP rate-limit enforcement (T-32-11/T-32-12/T-32-14).
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import get_settings
from app.models.avatar_persona import AvatarPersona
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.schemas.avatar_persona import AvatarPersonaCreate
from app.services import avatar_persona_service
from app.services.rate_limit import limiter_ip

settings = get_settings()


async def _create_persona(db_session, **overrides) -> AvatarPersona:
    defaults = {
        "name": "Lisa Default",
        "character": "lisa",
        "style": "casual-sitting",
        "voice_map": {},
        "greeting": "Hi, I'm Lisa!",
        "prompt_fragment": "Be friendly.",
        "enabled": True,
        "is_default": True,
    }
    defaults.update(overrides)
    data = AvatarPersonaCreate(**defaults)
    return await avatar_persona_service.create_persona(db_session, data)


@pytest.fixture(autouse=True)
def _reset_limiter_storage():
    """`client` always presents the same fixed ASGITransport test IP, so every
    test in this file shares one rate-limit bucket unless reset (mirrors
    test_public_avatar_api.py's fixture)."""
    limiter_ip.reset()
    yield
    limiter_ip.reset()


def _make_public_config(voice_map: dict | None = None) -> PublicKnowledgeConfig:
    return PublicKnowledgeConfig(
        agent_id="public-agent-1",
        agent_version="1",
        connection_name="conn",
        connection_target="https://search.example",
        index_name="kb1",
        avatar_character="lori",
        avatar_style="casual",
        voice_map=json.dumps(voice_map or {"zh-CN": "zh-CN-XiaoxiaoMultilingualNeural"}),
        is_active=True,
    )


def _mock_vl_config():
    config = MagicMock()
    config.is_active = True
    config.model_or_deployment = "gpt-4o"
    return config


def _mock_master_config(default_project="my-project"):
    master = MagicMock()
    master.default_project = default_project
    return master


async def _anon_session_and_header(client) -> dict:
    response = await client.post("/public/avatar/session")
    token = response.json()["session_token"]
    return {"X-Anon-Session": token}


class TestWebrtcSessionSuccess:
    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_valid_session_returns_credential_shape(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(db_session)
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config()
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-abc"

        response = await client.post(
            "/public/avatar/webrtc/session", json={"locale": "zh-CN"}, headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        # Same field set as the authenticated WebRTCSessionResponse
        for field in (
            "signaling_url",
            "auth_token",
            "auth_type",
            "model",
            "mode",
            "session_config",
            "agent_id",
            "agent_version",
            "project_name",
            "avatar_warning",
            "greeting",
        ):
            assert field in data
        assert data["auth_token"] == "bearer-token-abc"
        assert data["auth_type"] == "bearer"
        assert data["mode"] == "agent"
        assert data["agent_id"] == "public-agent-1"
        assert data["greeting"] == "Hi, I'm Lisa!"
        mock_exchange.assert_awaited_once()

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_avatar_identity_sourced_from_admin_config_not_client(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        """The issued credential's agent/voice come from the active
        PublicKnowledgeConfig for the requested locale, not a hardcoded
        default and not a client-supplied override (WebrtcSessionRequest has
        no character/style/voice field to supply one)."""
        await _create_persona(db_session)
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config(
            voice_map={
                "zh-CN": "zh-CN-XiaoxiaoMultilingualNeural",
                "en-US": "en-US-AvaNeural",
            }
        )
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-en"

        response = await client.post(
            "/public/avatar/webrtc/session", json={"locale": "en-US"}, headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["agent_id"] == "public-agent-1"
        assert data["session_config"]["voice"]["name"] == "en-US-AvaNeural"
        assert "agent_id=public-agent-1" in data["signaling_url"]


class TestWebrtcSessionMalformedVoiceMap:
    """WR-02: a malformed `voice_map` value on the active PublicKnowledgeConfig
    row must not 500 the anonymous public WebRTC path -- it should be treated
    as if no voice override was configured."""

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_malformed_voice_map_json_falls_back_instead_of_500(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(db_session)
        headers = await _anon_session_and_header(client)
        config = _make_public_config()
        config.voice_map = "{not valid json"
        mock_get_config.return_value = config
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-fallback"

        response = await client.post(
            "/public/avatar/webrtc/session", json={"locale": "zh-CN"}, headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        # No admin-configured voice for zh-CN (parse failed) -> falls back to
        # the built-in default voice, not a 500.
        assert data["session_config"]["voice"]["name"] == "zh-CN-XiaoxiaoMultilingualNeural"


class TestWebrtcSessionLocaleValidation:
    """LANG-02 (34-06, D-06/D-07): es-ES/es-MX/es-US must be accepted by the
    request schema (no 422), while unlisted locales remain rejected."""

    @pytest.mark.parametrize("locale", ["es-ES", "es-MX", "es-US"])
    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_es_locales_accepted(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session, locale
    ):
        await _create_persona(db_session)
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config()
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-es"

        response = await client.post(
            "/public/avatar/webrtc/session", json={"locale": locale}, headers=headers
        )

        assert response.status_code == 200

    async def test_unlisted_locale_rejected(self, client):
        headers = await _anon_session_and_header(client)

        response = await client.post(
            "/public/avatar/webrtc/session", json={"locale": "fr-FR"}, headers=headers
        )

        assert response.status_code == 422


class TestWebrtcSessionAuthGate:
    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    async def test_missing_session_header_returns_401_before_azure_call(
        self, mock_exchange, client
    ):
        response = await client.post("/public/avatar/webrtc/session", json={"locale": "zh-CN"})

        assert response.status_code == 401
        body = response.json()
        assert "code" in body
        mock_exchange.assert_not_called()

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    async def test_invalid_session_header_returns_401_before_azure_call(
        self, mock_exchange, client
    ):
        response = await client.post(
            "/public/avatar/webrtc/session",
            json={"locale": "zh-CN"},
            headers={"X-Anon-Session": "not-a-real-token"},
        )

        assert response.status_code == 401
        mock_exchange.assert_not_called()


class TestWebrtcSessionRateLimit:
    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_exceeding_ip_rate_limit_returns_429_structured_error(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(db_session)
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config()
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-abc"

        limit_count = int(settings.anon_rate_limit_webrtc_ip.split("/")[0])
        statuses = []
        for _ in range(limit_count + 1):
            response = await client.post(
                "/public/avatar/webrtc/session", json={"locale": "zh-CN"}, headers=headers
            )
            statuses.append(response.status_code)

        assert statuses[-1] == 429
        assert response.json()["code"] == "RATE_LIMITED"


class TestWebrtcSessionPersonaResolution:
    """Phase 36, PERSONA-04: the session response's voice_name and greeting
    reflect the resolved persona; an invalid/disabled persona_id degrades to
    the default persona without error (T-36-10/T-36-11)."""

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_persona_voice_map_wins_over_admin_config_voice_map(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(
            db_session,
            voice_map={"en-US": "en-US-PersonaVoiceNeural"},
            greeting="Hello from persona!",
        )
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config(
            voice_map={"en-US": "en-US-AdminVoiceNeural"}
        )
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-persona"

        response = await client.post(
            "/public/avatar/webrtc/session", json={"locale": "en-US"}, headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_config"]["voice"]["name"] == "en-US-PersonaVoiceNeural"
        assert data["greeting"] == "Hello from persona!"

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_explicit_enabled_persona_id_is_used(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(db_session, name="Default", greeting="Default greeting")
        other = await _create_persona(
            db_session,
            name="Other",
            is_default=False,
            greeting="Other greeting",
            voice_map={"zh-CN": "zh-CN-OtherVoiceNeural"},
        )
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config()
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-explicit"

        response = await client.post(
            "/public/avatar/webrtc/session",
            json={"locale": "zh-CN", "persona_id": other.id},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["greeting"] == "Other greeting"
        assert data["session_config"]["voice"]["name"] == "zh-CN-OtherVoiceNeural"

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_disabled_persona_id_falls_back_to_default_without_error(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(db_session, name="Default", greeting="Default greeting")
        disabled = await _create_persona(
            db_session, name="Disabled", enabled=False, is_default=False
        )
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config()
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-disabled"

        response = await client.post(
            "/public/avatar/webrtc/session",
            json={"locale": "zh-CN", "persona_id": disabled.id},
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["greeting"] == "Default greeting"

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_unknown_persona_id_falls_back_to_default_without_error(
        self, mock_get_config, mock_config_svc, mock_exchange, client, db_session
    ):
        await _create_persona(db_session, name="Default", greeting="Default greeting")
        headers = await _anon_session_and_header(client)
        mock_get_config.return_value = _make_public_config()
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config())
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-key")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-unknown"

        response = await client.post(
            "/public/avatar/webrtc/session",
            json={"locale": "zh-CN", "persona_id": "does-not-exist"},
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["greeting"] == "Default greeting"
