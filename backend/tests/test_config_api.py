"""Configuration API endpoint tests."""

from unittest.mock import MagicMock, patch

from app.models.service_config import ServiceConfig
from app.models.user import User
from app.services.auth import get_password_hash
from tests.conftest import TestSessionLocal


async def _create_and_login(client, username="configuser", password="pass123"):
    """Helper: create a user and return a valid auth token."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash(password),
            full_name=f"Test {username}",
            role="user",
        )
        session.add(user)
        await session.commit()

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    return login_resp.json()["access_token"]


class TestGetFeatures:
    """Tests for GET /api/v1/config/features."""

    async def test_get_features_with_auth_returns_200(self, client):
        token = await _create_and_login(client)

        with patch("app.api.config.get_settings") as mock_get_settings:
            mock_settings = MagicMock()
            mock_settings.feature_avatar_enabled = False
            mock_settings.feature_voice_enabled = False
            mock_settings.feature_realtime_voice_enabled = False
            mock_settings.feature_conference_enabled = False
            mock_settings.feature_voice_live_enabled = False
            mock_settings.feature_legacy_coach_nav_enabled = False
            mock_settings.default_voice_mode = "text_only"
            mock_settings.region = "global"
            mock_get_settings.return_value = mock_settings

            response = await client.get(
                "/api/v1/config/features",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200
        data = response.json()

        # Verify feature flags present
        features = data["features"]
        assert "avatar_enabled" in features
        assert "voice_enabled" in features
        assert "realtime_voice_enabled" in features
        assert "conference_enabled" in features
        assert "voice_live_enabled" in features
        assert "legacy_coach_nav_enabled" in features
        assert features["legacy_coach_nav_enabled"] is False
        assert "default_voice_mode" in features
        assert "region" in features

        # Verify mocked defaults
        assert features["avatar_enabled"] is False
        assert features["voice_enabled"] is False
        assert features["default_voice_mode"] == "text_only"
        assert features["region"] == "global"

        # Verify available_adapters is a dict
        assert "available_adapters" in data
        assert isinstance(data["available_adapters"], dict)

    async def test_get_features_enables_voice_from_active_speech_config(self, client):
        token = await _create_and_login(client, username="configspeech")
        async with TestSessionLocal() as session:
            session.add(
                ServiceConfig(
                    service_name="azure_speech_stt",
                    display_name="Azure Speech (STT)",
                    is_active=True,
                )
            )
            await session.commit()

        with patch("app.api.config.get_settings") as mock_get_settings:
            mock_settings = MagicMock()
            mock_settings.feature_avatar_enabled = False
            mock_settings.feature_voice_enabled = False
            mock_settings.feature_realtime_voice_enabled = False
            mock_settings.feature_conference_enabled = False
            mock_settings.feature_voice_live_enabled = False
            mock_settings.feature_legacy_coach_nav_enabled = False
            mock_settings.default_voice_mode = "text_only"
            mock_settings.region = "global"
            mock_get_settings.return_value = mock_settings

            response = await client.get(
                "/api/v1/config/features",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        assert response.json()["features"]["voice_enabled"] is True

    async def test_get_features_without_auth_returns_401(self, client):
        response = await client.get("/api/v1/config/features")
        assert response.status_code == 401
