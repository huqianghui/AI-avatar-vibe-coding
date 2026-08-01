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
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.services.rate_limit import limiter_ip

settings = get_settings()


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
        self, mock_get_config, mock_config_svc, mock_exchange, client
    ):
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
        ):
            assert field in data
        assert data["auth_token"] == "bearer-token-abc"
        assert data["auth_type"] == "bearer"
        assert data["mode"] == "agent"
        assert data["agent_id"] == "public-agent-1"
        mock_exchange.assert_awaited_once()

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_avatar_identity_sourced_from_admin_config_not_client(
        self, mock_get_config, mock_config_svc, mock_exchange, client
    ):
        """The issued credential's agent/voice come from the active
        PublicKnowledgeConfig for the requested locale, not a hardcoded
        default and not a client-supplied override (WebrtcSessionRequest has
        no character/style/voice field to supply one)."""
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


class TestWebrtcSessionLocaleValidation:
    """LANG-02 (34-06, D-06/D-07): es-ES/es-MX/es-US must be accepted by the
    request schema (no 422), while unlisted locales remain rejected."""

    @pytest.mark.parametrize("locale", ["es-ES", "es-MX", "es-US"])
    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    @patch("app.api.public_avatar.get_active_public_config")
    async def test_es_locales_accepted(
        self, mock_get_config, mock_config_svc, mock_exchange, client, locale
    ):
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
        self, mock_get_config, mock_config_svc, mock_exchange, client
    ):
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
