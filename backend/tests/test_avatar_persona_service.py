"""Unit tests for avatar_persona_service (Phase 36, PERSONA-01/02/04; Phase 37,
PERSONA-07/HARD-01; persona-hcp-foundry-alignment Increment A)."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models.avatar_persona import AvatarPersona
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.avatar_persona import AvatarPersonaCreate, AvatarPersonaUpdate
from app.services import avatar_persona_service
from app.services.auth import get_password_hash
from app.services.voice_live_webrtc import DEFAULT_PUBLIC_VOICE_BY_LOCALE
from app.utils.exceptions import ConflictException, NotFoundException, ValidationException


async def _create(db, **overrides) -> AvatarPersona:
    defaults = {
        "name": "Lisa Default",
        "character": "lisa",
        "style": "casual-sitting",
        "voice_map": {"en-US": "en-US-AvaNeural"},
        "greeting_map": {"zh-CN": "Hi there!"},
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
            greeting_map={"en-US": "Hello!"},
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
        assert avatar_persona_service.parse_persona_greeting_map(persona) == {"en-US": "Hello!"}
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
            db_session,
            persona.id,
            AvatarPersonaUpdate(name="Renamed", greeting_map={"zh-CN": "New greeting"}),
        )

        assert updated.name == "Renamed"
        assert avatar_persona_service.parse_persona_greeting_map(updated) == {
            "zh-CN": "New greeting"
        }


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


async def _make_user(db_session, username: str = "persona-user") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.flush()
    return user


class TestResolveActivePersona:
    async def test_both_none_returns_the_default_persona(self, db_session):
        default = await _create(db_session, name="Default", is_default=True)
        await _create(db_session, name="Other", is_default=False)

        resolved = await avatar_persona_service.resolve_active_persona(db_session)

        assert resolved.id == default.id

    async def test_requested_enabled_persona_wins_regardless_of_user_id(self, db_session):
        await _create(db_session, name="Default", is_default=True)
        requested = await _create(db_session, name="Requested", enabled=True, is_default=False)
        user = await _make_user(db_session)

        resolved = await avatar_persona_service.resolve_active_persona(
            db_session, user_id=user.id, requested_persona_id=requested.id
        )

        assert resolved.id == requested.id

    async def test_requested_disabled_persona_falls_back_to_default_silently(self, db_session):
        default = await _create(db_session, name="Default", is_default=True)
        disabled = await _create(db_session, name="Disabled", enabled=False, is_default=False)

        resolved = await avatar_persona_service.resolve_active_persona(
            db_session, requested_persona_id=disabled.id
        )

        assert resolved.id == default.id

    async def test_requested_nonexistent_persona_falls_back_to_default_silently(self, db_session):
        default = await _create(db_session, name="Default", is_default=True)

        resolved = await avatar_persona_service.resolve_active_persona(
            db_session, requested_persona_id="does-not-exist"
        )

        assert resolved.id == default.id

    async def test_user_preference_referencing_enabled_persona_wins_over_default(self, db_session):
        await _create(db_session, name="Default", is_default=True)
        preferred = await _create(db_session, name="Preferred", is_default=False)
        user = await _make_user(db_session)
        db_session.add(
            UserPreference(user_id=user.id, category="selected_persona_id", value=preferred.id)
        )
        await db_session.commit()

        resolved = await avatar_persona_service.resolve_active_persona(db_session, user_id=user.id)

        assert resolved.id == preferred.id

    async def test_user_preference_referencing_disabled_persona_falls_back_to_default(
        self, db_session
    ):
        default = await _create(db_session, name="Default", is_default=True)
        disabled = await _create(db_session, name="Disabled", enabled=False, is_default=False)
        user = await _make_user(db_session)
        db_session.add(
            UserPreference(user_id=user.id, category="selected_persona_id", value=disabled.id)
        )
        await db_session.commit()

        resolved = await avatar_persona_service.resolve_active_persona(db_session, user_id=user.id)

        assert resolved.id == default.id

    async def test_user_id_with_no_preference_row_falls_back_to_default(self, db_session):
        default = await _create(db_session, name="Default", is_default=True)
        user = await _make_user(db_session)

        resolved = await avatar_persona_service.resolve_active_persona(db_session, user_id=user.id)

        assert resolved.id == default.id

    async def test_no_default_persona_configured_raises_not_found(self, db_session):
        with pytest.raises(NotFoundException):
            await avatar_persona_service.resolve_active_persona(db_session)


def _make_public_config(voice_map: dict | None = None) -> PublicKnowledgeConfig:
    import json

    return PublicKnowledgeConfig(
        agent_id="public-agent-1",
        agent_version="1",
        connection_name="conn",
        connection_target="https://search.example",
        index_name="kb1",
        voice_map=json.dumps(voice_map or {}),
        is_active=True,
    )


class TestResolveVoiceForLocale:
    async def test_persona_voice_map_wins_when_locale_present(self, db_session):
        persona = await _create(db_session, voice_map={"en-US": "en-US-PersonaVoiceNeural"})
        public_config = _make_public_config({"en-US": "en-US-AdminVoiceNeural"})

        voice = avatar_persona_service.resolve_voice_for_locale(
            persona, "en-US", public_config=public_config
        )

        assert voice == "en-US-PersonaVoiceNeural"

    async def test_falls_back_to_admin_public_config_voice_map(self, db_session):
        persona = await _create(db_session, voice_map={})
        public_config = _make_public_config({"en-US": "en-US-AdminVoiceNeural"})

        voice = avatar_persona_service.resolve_voice_for_locale(
            persona, "en-US", public_config=public_config
        )

        assert voice == "en-US-AdminVoiceNeural"

    async def test_falls_back_to_hardcoded_default_when_no_public_config(self, db_session):
        persona = await _create(db_session, voice_map={})

        voice = avatar_persona_service.resolve_voice_for_locale(
            persona, "en-US", public_config=None
        )

        assert voice == DEFAULT_PUBLIC_VOICE_BY_LOCALE["en-US"]

    async def test_falls_back_to_hardcoded_default_when_public_config_missing_locale(
        self, db_session
    ):
        persona = await _create(db_session, voice_map={})
        public_config = _make_public_config({"zh-CN": "zh-CN-AdminVoiceNeural"})

        voice = avatar_persona_service.resolve_voice_for_locale(
            persona, "en-US", public_config=public_config
        )

        assert voice == DEFAULT_PUBLIC_VOICE_BY_LOCALE["en-US"]


class TestParsePersonaGreetingMap:
    async def test_round_trips_greeting_map(self, db_session):
        persona = await _create(db_session, greeting_map={"en-US": "Hello there!"})

        assert avatar_persona_service.parse_persona_greeting_map(persona) == {
            "en-US": "Hello there!"
        }

    async def test_malformed_json_falls_back_to_empty_dict(self, db_session):
        persona = await _create(db_session)
        persona.greeting_map = "{not valid json"

        assert avatar_persona_service.parse_persona_greeting_map(persona) == {}

    async def test_empty_string_falls_back_to_empty_dict(self, db_session):
        persona = await _create(db_session)
        persona.greeting_map = ""

        assert avatar_persona_service.parse_persona_greeting_map(persona) == {}


class TestResolveGreetingForLocale:
    async def test_exact_locale_match_wins(self, db_session):
        persona = await _create(
            db_session,
            greeting_map={"zh-CN": "你好！", "en-US": "Hello!"},
        )

        assert avatar_persona_service.resolve_greeting_for_locale(persona, "en-US") == "Hello!"

    async def test_falls_back_to_any_available_locale_when_exact_missing(self, db_session):
        persona = await _create(db_session, greeting_map={"zh-CN": "你好！"})

        greeting = avatar_persona_service.resolve_greeting_for_locale(persona, "en-US")

        assert greeting == "你好！"

    async def test_falls_back_to_hardcoded_default_when_no_locales_configured(self, db_session):
        persona = await _create(db_session, greeting_map={})

        greeting = avatar_persona_service.resolve_greeting_for_locale(persona, "en-US")

        assert greeting == avatar_persona_service.DEFAULT_GREETING

    async def test_never_raises_on_malformed_greeting_map(self, db_session):
        persona = await _create(db_session)
        persona.greeting_map = "{not valid json"

        greeting = avatar_persona_service.resolve_greeting_for_locale(persona, "en-US")

        assert greeting == avatar_persona_service.DEFAULT_GREETING


class TestUniqueDefaultDatabaseConstraint:
    """T-HARD-01: the partial unique index rejects a second enabled default
    even when the service-layer guard (set_default_persona) is bypassed via
    direct ORM construction."""

    async def test_direct_orm_bypass_of_second_default_raises_integrity_error(self, db_session):
        db_session.add(
            AvatarPersona(
                name="A",
                character="lisa",
                style="casual",
                voice_map="{}",
                greeting_map="{}",
                prompt_fragment="",
                enabled=True,
                is_default=True,
            )
        )
        await db_session.flush()

        db_session.add(
            AvatarPersona(
                name="B",
                character="harry",
                style="business",
                voice_map="{}",
                greeting_map="{}",
                prompt_fragment="",
                enabled=True,
                is_default=True,
            )
        )
        with pytest.raises(IntegrityError):
            await db_session.flush()


class TestGate1PromptFragmentSanitization:
    async def test_create_persona_sanitizes_pii_in_prompt_fragment(self, db_session):
        persona = await _create(
            db_session,
            prompt_fragment="Contact me at test@example.com for details.",
        )

        assert "test@example.com" not in persona.prompt_fragment
        assert "[EMAIL_REDACTED]" in persona.prompt_fragment

    async def test_update_persona_sanitizes_pii_in_prompt_fragment(self, db_session):
        persona = await _create(db_session)

        updated = await avatar_persona_service.update_persona(
            db_session,
            persona.id,
            AvatarPersonaUpdate(prompt_fragment="Call 13812345678 now."),
        )

        assert "13812345678" not in updated.prompt_fragment
        assert "[PHONE_REDACTED]" in updated.prompt_fragment


class TestToPromptDict:
    """AvatarPersona.to_prompt_dict() (persona-hcp-foundry-alignment Increment A)."""

    async def test_returns_name_and_instructions_override(self, db_session):
        persona = await _create(db_session, name="Lisa Support", prompt_fragment="Be helpful.")

        result = persona.to_prompt_dict()

        assert result == {
            "name": "Lisa Support",
            "agent_instructions_override": "Be helpful.",
        }


class TestAgentSyncOnCreate:
    """Tests for agent sync scheduling on persona creation
    (persona-hcp-foundry-alignment Increment A). Perf follow-up: the real
    ~14s+ sync chain no longer runs inline inside create_persona -- it only
    sets "pending" and schedules `_run_background_agent_sync` via
    `asyncio.create_task`. The sync's own success/failure outcome is
    exercised directly against `_run_background_agent_sync` in
    `TestRunBackgroundAgentSync` below."""

    async def test_create_returns_pending_status_without_syncing_inline(self, db_session):
        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
        ) as mock_sync:
            persona = await _create(db_session, name="Lisa")

        assert persona.agent_sync_status == "pending"
        assert persona.agent_id in ("", None)
        # The real sync only ever runs inside _run_background_agent_sync's
        # own DB session (a separately-scheduled asyncio task) -- never
        # inline within create_persona itself.
        mock_sync.assert_not_awaited()

    async def test_create_when_promoted_to_default_also_returns_pending(self, db_session):
        """Must survive the set_default_persona() re-commit path, not just
        the plain-commit else-branch (T-36-03 promotion path)."""
        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
        ) as mock_sync:
            persona = await _create(db_session, name="Lisa", is_default=True)

        assert persona.is_default is True
        assert persona.agent_sync_status == "pending"
        mock_sync.assert_not_awaited()


class TestAgentSyncOnUpdate:
    """Tests for agent sync scheduling on persona update
    (persona-hcp-foundry-alignment Increment A). Perf follow-up: see
    TestAgentSyncOnCreate's docstring -- update_persona also only sets
    "pending" and schedules the background sync."""

    async def test_update_returns_pending_status_without_syncing_inline(self, db_session):
        persona = await _create(db_session, name="Lisa")

        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
        ) as mock_sync:
            updated = await avatar_persona_service.update_persona(
                db_session, persona.id, AvatarPersonaUpdate(name="Lisa Updated")
            )

        assert updated.agent_sync_status == "pending"
        assert updated.agent_sync_error == ""
        mock_sync.assert_not_awaited()

    async def test_update_does_not_clear_an_existing_agent_id(self, db_session):
        persona = await _create(db_session, name="Lisa")
        persona.agent_id = "persona-agent-preexisting"
        await db_session.commit()

        updated = await avatar_persona_service.update_persona(
            db_session, persona.id, AvatarPersonaUpdate(name="Lisa Renamed")
        )

        assert updated.agent_id == "persona-agent-preexisting"
        assert updated.agent_sync_status == "pending"


class TestDeletePersonaWithAgent:
    """Tests for delete_persona when an agent_id exists
    (persona-hcp-foundry-alignment Increment A). `agent_id` is now set
    directly rather than via a synchronous create-time sync (perf
    follow-up moved that sync to the background) -- delete_persona's own
    logic is unchanged and doesn't care how agent_id got populated."""

    async def test_delete_calls_agent_delete(self, db_session):
        persona = await _create(db_session, name="Lisa")
        persona.agent_id = "persona-agent-del"
        await db_session.commit()

        with patch(
            "app.services.avatar_persona_service.agent_sync_service.delete_agent",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_delete:
            await avatar_persona_service.delete_persona(db_session, persona.id)

        mock_delete.assert_called_once_with(db_session, "persona-agent-del")

    async def test_delete_tolerates_agent_deletion_failure(self, db_session):
        persona = await _create(db_session, name="Lisa")
        persona.agent_id = "persona-agent-del2"
        await db_session.commit()

        with patch(
            "app.services.avatar_persona_service.agent_sync_service.delete_agent",
            new_callable=AsyncMock,
            side_effect=Exception("Delete failed"),
        ):
            await avatar_persona_service.delete_persona(db_session, persona.id)

        with pytest.raises(NotFoundException):
            await avatar_persona_service.get_persona(db_session, persona.id)


class TestRetryAgentSync:
    """Tests for retry_agent_sync (persona-hcp-foundry-alignment Increment
    A). Perf follow-up: returns immediately with "pending"; the sync
    outcome is exercised via TestRunBackgroundAgentSync below."""

    async def test_retry_sets_pending_and_clears_prior_error_without_syncing_inline(
        self, db_session
    ):
        persona = await _create(db_session, name="Lisa")
        persona.agent_sync_status = "failed"
        persona.agent_sync_error = "First failure"
        await db_session.commit()

        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
        ) as mock_sync:
            retried = await avatar_persona_service.retry_agent_sync(db_session, persona.id)

        assert retried.agent_sync_status == "pending"
        assert retried.agent_sync_error == ""
        mock_sync.assert_not_awaited()


class TestRunBackgroundAgentSync:
    """Tests for `_run_background_agent_sync` (perf follow-up to
    persona-hcp-foundry-alignment) -- the actual sync chain now scheduled
    via `asyncio.create_task` from create/update/retry-sync instead of run
    inline. Exercised directly against its own fresh session, monkeypatched
    to `TestSessionLocal` (mirrors `dry_run_engine`'s established
    background-function test pattern), and verified by reloading the
    persona via a SEPARATE `TestSessionLocal()` session -- proving the
    background task's session-independence, exactly as it behaves in
    production against `AsyncSessionLocal`."""

    async def test_marks_synced_on_success(self, db_session, monkeypatch):
        from tests.conftest import TestSessionLocal

        persona = await _create(db_session, name="Lisa")
        assert persona.agent_sync_status == "pending"

        monkeypatch.setattr(avatar_persona_service, "AsyncSessionLocal", TestSessionLocal)
        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
            return_value={"id": "persona-agent-bg", "name": "Lisa", "model": "gpt-4o"},
        ):
            await avatar_persona_service._run_background_agent_sync(persona.id)

        async with TestSessionLocal() as session:
            reloaded = await session.get(AvatarPersona, persona.id)
            assert reloaded.agent_id == "persona-agent-bg"
            assert reloaded.agent_sync_status == "synced"
            assert reloaded.agent_sync_error == ""

    async def test_marks_failed_on_error(self, db_session, monkeypatch):
        from tests.conftest import TestSessionLocal

        persona = await _create(db_session, name="Lisa")

        monkeypatch.setattr(avatar_persona_service, "AsyncSessionLocal", TestSessionLocal)
        with patch(
            "app.services.avatar_persona_service.agent_sync_service.sync_agent_for_profile",
            new_callable=AsyncMock,
            side_effect=Exception("Network error"),
        ):
            await avatar_persona_service._run_background_agent_sync(persona.id)

        async with TestSessionLocal() as session:
            reloaded = await session.get(AvatarPersona, persona.id)
            assert reloaded.agent_sync_status == "failed"
            assert "Network error" in reloaded.agent_sync_error

    async def test_noop_when_persona_no_longer_exists(self, monkeypatch):
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(avatar_persona_service, "AsyncSessionLocal", TestSessionLocal)

        # Must not raise -- logs a warning and returns.
        await avatar_persona_service._run_background_agent_sync("does-not-exist")

    async def test_unexpected_crash_is_caught_and_never_propagates(self, monkeypatch):
        """A completely unexpected crash (e.g. failure to even open the DB
        session) must never surface as an unhandled asyncio task exception
        -- only `sync_agent_for_profile` failures are caught internally
        around the sync call itself; this covers everything else via the
        function's outer try/except."""

        def broken_session_factory():
            raise RuntimeError("session factory exploded")

        monkeypatch.setattr(avatar_persona_service, "AsyncSessionLocal", broken_session_factory)

        # Must not raise.
        await avatar_persona_service._run_background_agent_sync("any-id")
