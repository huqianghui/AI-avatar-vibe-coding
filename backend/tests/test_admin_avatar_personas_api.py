"""Integration tests for the admin AvatarPersona CRUD API
(Phase 36, PERSONA-01/02)."""

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
