"""Integration tests for the admin AvatarPersona CRUD API
(Phase 36, PERSONA-01/02; persona-hcp-foundry-alignment Increment A)."""

from unittest.mock import AsyncMock, patch

from app.models.avatar_persona import AvatarPersona
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_persona",
            email="admin_persona@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Persona",
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
            username="user_persona",
            email="user_persona@test.com",
            hashed_password=get_password_hash("pass123"),
            full_name="Regular User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_persona(**overrides) -> AvatarPersona:
    """Create an AvatarPersona row directly (no HTTP)."""
    import json

    async with TestSessionLocal() as session:
        defaults = {
            "name": "Lisa",
            "character": "lisa",
            "style": "casual-sitting",
            "voice_map": json.dumps({"en-US": "en-US-AvaNeural"}),
            "greeting_map": json.dumps({"zh-CN": "Hi!"}),
            "prompt_fragment": "",
            "enabled": True,
            "is_default": False,
        }
        defaults.update(overrides)
        persona = AvatarPersona(**defaults)
        session.add(persona)
        await session.commit()
        await session.refresh(persona)
        return persona


BASE = "/api/v1/admin/avatar-personas"


class TestCreatePersona:
    async def test_admin_create_returns_201(self, client):
        _, token = await _create_admin_and_token()

        response = await client.post(
            BASE,
            json={
                "name": "Harry",
                "character": "harry",
                "style": "business",
                "voice_map": {"en-US": "en-US-GuyNeural"},
                "greeting_map": {"en-US": "Hello!"},
                "prompt_fragment": "Be formal.",
                "enabled": True,
                "is_default": False,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Harry"
        assert data["voice_map"] == {"en-US": "en-US-GuyNeural"}
        assert data["greeting_map"] == {"en-US": "Hello!"}

    async def test_non_admin_create_returns_403(self, client):
        _, token = await _create_user_and_token()

        response = await client.post(
            BASE,
            json={"name": "Harry", "character": "harry"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestListPersonas:
    async def test_unauthenticated_returns_401(self, client):
        response = await client.get(BASE)

        assert response.status_code == 401


class TestUpdatePersona:
    async def test_admin_updates_fields(self, client):
        persona = await _create_persona(name="Original")
        _, token = await _create_admin_and_token()

        response = await client.put(
            f"{BASE}/{persona.id}",
            json={"name": "Renamed"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Renamed"

    async def test_disabling_current_default_without_transfer_returns_409(self, client):
        persona = await _create_persona(name="Default", is_default=True)
        _, token = await _create_admin_and_token()

        response = await client.put(
            f"{BASE}/{persona.id}",
            json={"enabled": False},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 409
        body = response.json()
        assert body["code"] == "CONFLICT"


class TestSetDefault:
    async def test_promotes_target_and_demotes_prior_default(self, client):
        persona_a = await _create_persona(name="A", is_default=True)
        persona_b = await _create_persona(name="B", is_default=False)
        _, token = await _create_admin_and_token()

        response = await client.post(
            f"{BASE}/{persona_b.id}/set-default",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

        list_response = await client.get(BASE, headers={"Authorization": f"Bearer {token}"})
        defaults = [p for p in list_response.json() if p["is_default"]]
        assert len(defaults) == 1
        assert defaults[0]["id"] == persona_b.id
        assert persona_a.id != defaults[0]["id"]


class TestDeletePersona:
    async def test_deletes_non_default_returns_204(self, client):
        persona = await _create_persona(name="Non-default", is_default=False)
        _, token = await _create_admin_and_token()

        response = await client.delete(
            f"{BASE}/{persona.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 204

    async def test_deletes_current_default_without_transfer_returns_409(self, client):
        persona = await _create_persona(name="Default", is_default=True)
        _, token = await _create_admin_and_token()

        response = await client.delete(
            f"{BASE}/{persona.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 409


class TestRetrySyncEndpoint:
    """Tests for POST /{persona_id}/retry-sync (persona-hcp-foundry-alignment
    Increment A; perf follow-up makes the sync non-blocking -- the route now
    returns immediately with `agent_sync_status="pending"`, and the real
    sync runs in the background via
    `avatar_persona_service._run_background_agent_sync`)."""

    async def test_admin_retry_sync_returns_immediately_with_pending_status(self, client):
        persona = await _create_persona(
            name="Failed Persona", agent_sync_status="failed", agent_sync_error="boom"
        )
        _, token = await _create_admin_and_token()

        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
        ) as mock_sync:
            response = await client.post(
                f"{BASE}/{persona.id}/retry-sync",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["agent_sync_status"] == "pending"
        assert data["agent_sync_error"] == ""
        # The real sync only ever runs inside the background task's own
        # session -- never inline within the request/response cycle.
        mock_sync.assert_not_awaited()

    async def test_non_admin_retry_sync_returns_403(self, client):
        persona = await _create_persona(name="Any")
        _, token = await _create_user_and_token()

        response = await client.post(
            f"{BASE}/{persona.id}/retry-sync",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestAgentPortalUrlEndpoint:
    """Tests for GET /{persona_id}/agent-portal-url (persona-hcp-foundry-alignment
    Increment A)."""

    async def test_no_agent_synced_returns_422(self, client):
        """bad_request() raises ValidationException -> 422 (matches
        hcp_profiles.py's get_agent_portal_url behavior exactly)."""
        persona = await _create_persona(name="No Agent", agent_id="")
        _, token = await _create_admin_and_token()

        response = await client.get(
            f"{BASE}/{persona.id}/agent-portal-url",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"

    async def test_agent_synced_returns_url(self, client):
        persona = await _create_persona(name="Has Agent", agent_id="persona-agent-portal")
        _, token = await _create_admin_and_token()

        with (
            patch(
                "app.services.agent_sync_service.get_portal_url_components",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "app.services.agent_sync_service.get_agent_latest_version",
                new_callable=AsyncMock,
                return_value="3",
            ),
        ):
            response = await client.get(
                f"{BASE}/{persona.id}/agent-portal-url",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["agent_name"] == "persona-agent-portal"
        assert data["agent_version"] == "3"
        assert data["url"] == "https://ai.azure.com"


class TestPersonaKnowledgeConfigsEndpoints:
    """Tests for the persona-scoped Knowledge Base config routes
    (persona-hcp-foundry-alignment Increment C)."""

    async def test_admin_list_configs_empty(self, client):
        persona = await _create_persona(name="No Configs")
        _, token = await _create_admin_and_token()

        response = await client.get(
            f"{BASE}/{persona.id}/knowledge-configs",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json() == []

    async def test_non_admin_list_configs_returns_403(self, client):
        persona = await _create_persona(name="Any")
        _, token = await _create_user_and_token()

        response = await client.get(
            f"{BASE}/{persona.id}/knowledge-configs",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_admin_add_config_returns_201(self, client):
        persona = await _create_persona(name="Add Config Target")
        _, token = await _create_admin_and_token()

        with patch(
            "app.services.persona_knowledge_service._trigger_agent_resync",
            new_callable=AsyncMock,
        ):
            response = await client.post(
                f"{BASE}/{persona.id}/knowledge-configs",
                json={
                    "connection_name": "conn-api",
                    "connection_target": "https://search.example.com",
                    "index_name": "index-api",
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["avatar_persona_id"] == persona.id
        assert data["connection_name"] == "conn-api"
        assert data["index_name"] == "index-api"
        assert data["server_label"] == "knowledge-base-index-api"
        assert data["is_enabled"] is True

    async def test_non_admin_add_config_returns_403(self, client):
        persona = await _create_persona(name="Any")
        _, token = await _create_user_and_token()

        response = await client.post(
            f"{BASE}/{persona.id}/knowledge-configs",
            json={"connection_name": "conn", "index_name": "idx"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_admin_add_then_list_returns_config(self, client):
        persona = await _create_persona(name="List After Add")
        _, token = await _create_admin_and_token()

        with patch(
            "app.services.persona_knowledge_service._trigger_agent_resync",
            new_callable=AsyncMock,
        ):
            await client.post(
                f"{BASE}/{persona.id}/knowledge-configs",
                json={"connection_name": "conn-list", "index_name": "index-list"},
                headers={"Authorization": f"Bearer {token}"},
            )

        response = await client.get(
            f"{BASE}/{persona.id}/knowledge-configs",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["connection_name"] == "conn-list"

    async def test_admin_delete_config_returns_204(self, client):
        persona = await _create_persona(name="Delete Config Target")
        _, token = await _create_admin_and_token()

        with patch(
            "app.services.persona_knowledge_service._trigger_agent_resync",
            new_callable=AsyncMock,
        ):
            create_response = await client.post(
                f"{BASE}/{persona.id}/knowledge-configs",
                json={"connection_name": "conn-del", "index_name": "index-del"},
                headers={"Authorization": f"Bearer {token}"},
            )
            config_id = create_response.json()["id"]

            response = await client.delete(
                f"{BASE}/knowledge-configs/{config_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 204

    async def test_admin_delete_nonexistent_config_returns_404(self, client):
        _, token = await _create_admin_and_token()

        response = await client.delete(
            f"{BASE}/knowledge-configs/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

    async def test_non_admin_delete_config_returns_403(self, client):
        _, token = await _create_user_and_token()

        response = await client.delete(
            f"{BASE}/knowledge-configs/some-id",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403
