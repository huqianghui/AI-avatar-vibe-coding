"""Integration tests for the public enabled-only AvatarPersona API
(Phase 36, PERSONA-01/02, T-36-01)."""

import json

from app.models.avatar_persona import AvatarPersona
from tests.conftest import TestSessionLocal


async def _create_persona(**overrides) -> AvatarPersona:
    async with TestSessionLocal() as session:
        defaults = {
            "name": "Lisa",
            "character": "lisa",
            "style": "casual-sitting",
            "voice_map": json.dumps({"en-US": "en-US-AvaNeural"}),
            "greeting": "Hi!",
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


class TestListEnabledPersonas:
    async def test_unauthenticated_returns_200_enabled_only(self, client):
        enabled = await _create_persona(name="Enabled One", enabled=True)
        disabled = await _create_persona(name="Disabled One", enabled=False)

        response = await client.get("/api/v1/personas")

        assert response.status_code == 200
        data = response.json()
        names = [p["name"] for p in data]
        ids = [p["id"] for p in data]
        assert enabled.name in names
        assert enabled.id in ids
        assert disabled.name not in names
        assert disabled.id not in ids
