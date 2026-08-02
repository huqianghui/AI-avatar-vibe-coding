"""Unit tests for avatar_persona_service (Phase 36, PERSONA-01/02)."""

import pytest
from sqlalchemy import func, select

from app.models.avatar_persona import AvatarPersona
from app.schemas.avatar_persona import AvatarPersonaCreate, AvatarPersonaUpdate
from app.services import avatar_persona_service
from app.utils.exceptions import ConflictException, NotFoundException, ValidationException


async def _create(db, **overrides) -> AvatarPersona:
    defaults = {
        "name": "Lisa Default",
        "character": "lisa",
        "style": "casual-sitting",
        "voice_map": {"en-US": "en-US-AvaNeural"},
        "greeting": "Hi there!",
        "prompt_fragment": "Be friendly.",
        "enabled": True,
        "is_default": False,
    }
    defaults.update(overrides)
    data = AvatarPersonaCreate(**defaults)
    return await avatar_persona_service.create_persona(db, data)


class TestCreatePersona:
    async def test_persists_all_fields_with_generated_id(self, db_session):
        persona = await _create(
            db_session,
            name="Harry Business",
            character="harry",
            style="business",
            voice_map={"en-US": "en-US-GuyNeural"},
            greeting="Hello!",
            prompt_fragment="Speak formally.",
            enabled=True,
            is_default=False,
        )

        assert persona.id is not None and len(persona.id) > 0
        assert persona.name == "Harry Business"
        assert persona.character == "harry"
        assert persona.style == "business"
        assert avatar_persona_service.parse_persona_voice_map(persona) == {
            "en-US": "en-US-GuyNeural"
        }
        assert persona.greeting == "Hello!"
        assert persona.prompt_fragment == "Speak formally."
        assert persona.enabled is True
        assert persona.is_default is False


class TestListPersonas:
    async def test_enabled_only_false_returns_all(self, db_session):
        await _create(db_session, name="A", enabled=True)
        await _create(db_session, name="B", enabled=False)

        result = await avatar_persona_service.list_personas(db_session, enabled_only=False)

        assert len(result) == 2

    async def test_enabled_only_true_excludes_disabled(self, db_session):
        await _create(db_session, name="A", enabled=True)
        await _create(db_session, name="B", enabled=False)

        result = await avatar_persona_service.list_personas(db_session, enabled_only=True)

        assert len(result) == 1
        assert result[0].name == "A"


class TestSetDefaultPersona:
    async def test_clears_prior_default_in_same_transaction(self, db_session):
        persona_a = await _create(db_session, name="A", is_default=True)
        persona_b = await _create(db_session, name="B", is_default=False)

        await avatar_persona_service.set_default_persona(db_session, persona_b.id)

        refreshed_a = await avatar_persona_service.get_persona(db_session, persona_a.id)
        refreshed_b = await avatar_persona_service.get_persona(db_session, persona_b.id)
        assert refreshed_a.is_default is False
        assert refreshed_b.is_default is True

        count_result = await db_session.execute(
            select(func.count()).select_from(AvatarPersona).where(AvatarPersona.is_default == True)  # noqa: E712
        )
        assert count_result.scalar() == 1

    async def test_disabled_persona_raises_validation_error(self, db_session):
        persona = await _create(db_session, name="Disabled", enabled=False)

        with pytest.raises(ValidationException):
            await avatar_persona_service.set_default_persona(db_session, persona.id)

    async def test_missing_persona_raises_not_found(self, db_session):
        with pytest.raises(NotFoundException):
            await avatar_persona_service.set_default_persona(db_session, "does-not-exist")


class TestUpdatePersona:
    async def test_disabling_current_default_without_transfer_raises_conflict(self, db_session):
        persona = await _create(db_session, name="A", is_default=True)

        with pytest.raises(ConflictException):
            await avatar_persona_service.update_persona(
                db_session, persona.id, AvatarPersonaUpdate(enabled=False)
            )

    async def test_disabling_current_default_with_transfer_succeeds(self, db_session):
        persona_a = await _create(db_session, name="A", is_default=True)
        persona_b = await _create(db_session, name="B", is_default=False)

        updated = await avatar_persona_service.update_persona(
            db_session,
            persona_a.id,
            AvatarPersonaUpdate(enabled=False, new_default_persona_id=persona_b.id),
        )

        assert updated.enabled is False
        assert updated.is_default is False
        refreshed_b = await avatar_persona_service.get_persona(db_session, persona_b.id)
        assert refreshed_b.is_default is True

    async def test_updates_non_default_fields(self, db_session):
        persona = await _create(db_session, name="Original")

        updated = await avatar_persona_service.update_persona(
            db_session, persona.id, AvatarPersonaUpdate(name="Renamed", greeting="New greeting")
        )

        assert updated.name == "Renamed"
        assert updated.greeting == "New greeting"


class TestDeletePersona:
    async def test_deleting_current_default_without_transfer_raises_conflict(self, db_session):
        persona = await _create(db_session, name="A", is_default=True)

        with pytest.raises(ConflictException):
            await avatar_persona_service.delete_persona(db_session, persona.id)

    async def test_deleting_current_default_with_transfer_succeeds(self, db_session):
        persona_a = await _create(db_session, name="A", is_default=True)
        persona_b = await _create(db_session, name="B", is_default=False)

        await avatar_persona_service.delete_persona(
            db_session, persona_a.id, new_default_persona_id=persona_b.id
        )

        with pytest.raises(NotFoundException):
            await avatar_persona_service.get_persona(db_session, persona_a.id)
        refreshed_b = await avatar_persona_service.get_persona(db_session, persona_b.id)
        assert refreshed_b.is_default is True

    async def test_deleting_non_default_succeeds_unconditionally(self, db_session):
        await _create(db_session, name="A", is_default=True)
        persona_b = await _create(db_session, name="B", is_default=False)

        await avatar_persona_service.delete_persona(db_session, persona_b.id)

        with pytest.raises(NotFoundException):
            await avatar_persona_service.get_persona(db_session, persona_b.id)


class TestParsePersonaVoiceMap:
    async def test_round_trips_voice_map(self, db_session):
        persona = await _create(db_session, voice_map={"zh-CN": "zh-CN-XiaoxiaoNeural"})

        assert avatar_persona_service.parse_persona_voice_map(persona) == {
            "zh-CN": "zh-CN-XiaoxiaoNeural"
        }

    async def test_malformed_json_falls_back_to_empty_dict(self, db_session):
        persona = await _create(db_session)
        persona.voice_map = "{not valid json"

        assert avatar_persona_service.parse_persona_voice_map(persona) == {}

    async def test_empty_string_falls_back_to_empty_dict(self, db_session):
        persona = await _create(db_session)
        persona.voice_map = ""

        assert avatar_persona_service.parse_persona_voice_map(persona) == {}
