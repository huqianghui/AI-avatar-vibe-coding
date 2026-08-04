"""Tests for HCP direct voice-mode config (VMODE-01, Plan 38-01).

Covers:
- Task 1: the g40a migration -- adds 6 inline voice-mode columns with correct
  defaults, backfills them from any currently-linked VoiceLiveInstance, and
  is reversible.
- Task 2: create/update HCP profiles without a VoiceLiveInstance link
  (instance reference is no longer mandatory, per the 2026-08-04 rescope),
  and resolve_voice_config() sourcing its output from HcpProfile's own inline
  columns instead of profile.voice_live_instance.
"""

from importlib import util
from pathlib import Path
from types import ModuleType

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.models.user import User
from app.models.voice_live_instance import VoiceLiveInstance
from app.schemas.hcp_profile import HcpProfileCreate, HcpProfileUpdate
from app.services.auth import get_password_hash
from app.services.hcp_profile_service import create_hcp_profile, update_hcp_profile
from app.services.voice_live_instance_service import resolve_voice_config

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"
MIGRATION_FILE = "g40a_add_hcp_direct_voice_config.py"
NEW_COLUMNS = {
    "voice_live_model",
    "voice_name",
    "recognition_language",
    "avatar_character",
    "avatar_style",
    "avatar_enabled",
}


def _load_migration() -> ModuleType:
    spec = util.spec_from_file_location(
        "g40a_add_hcp_direct_voice_config_test",
        MIGRATIONS_DIR / MIGRATION_FILE,
    )
    assert spec is not None
    assert spec.loader is not None
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestMigration:
    """Pure migration tests against a real throwaway SQLite file (sync engine)."""

    def test_migration_adds_columns_and_is_reversible(self, tmp_path: Path) -> None:
        migration = _load_migration()
        assert migration.revision == "g40a_add_hcp_direct_voice_config"
        assert migration.down_revision == "f39a_persona_greeting_map_unique_default"

        database_path = tmp_path / "hcp-voice.db"
        engine = sa.create_engine(f"sqlite:///{database_path}")
        with engine.begin() as connection:
            connection.execute(
                sa.schema.CreateTable(
                    sa.Table(
                        "hcp_profiles",
                        sa.MetaData(),
                        sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("voice_live_instance_id", sa.String(36), nullable=True),
                    )
                )
            )
            connection.execute(
                sa.schema.CreateTable(
                    sa.Table(
                        "voice_live_instances",
                        sa.MetaData(),
                        sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("voice_live_model", sa.String(50)),
                        sa.Column("voice_name", sa.String(200)),
                        sa.Column("avatar_character", sa.String(100)),
                        sa.Column("avatar_style", sa.String(100)),
                        sa.Column("avatar_enabled", sa.Boolean()),
                        sa.Column("recognition_language", sa.String(20)),
                    )
                )
            )
            context = MigrationContext.configure(connection)
            migration.op = Operations(context)

            existing_columns = sa.inspect(connection).get_columns("hcp_profiles")
            before = {column["name"] for column in existing_columns}

            migration.upgrade()

            upgraded_columns = {
                column["name"]: column
                for column in sa.inspect(connection).get_columns("hcp_profiles")
            }
            assert set(upgraded_columns) - before == NEW_COLUMNS

            migration.downgrade()
            downgraded = {
                column["name"] for column in sa.inspect(connection).get_columns("hcp_profiles")
            }
            assert downgraded == before

        engine.dispose()

    def test_migration_backfills_from_linked_instance(self, tmp_path: Path) -> None:
        """A profile previously bound to a VoiceLiveInstance gets its inline columns
        backfilled with that instance's values, not left at hardcoded defaults."""
        migration = _load_migration()

        database_path = tmp_path / "hcp-voice-backfill.db"
        engine = sa.create_engine(f"sqlite:///{database_path}")
        with engine.begin() as connection:
            connection.execute(
                sa.schema.CreateTable(
                    sa.Table(
                        "hcp_profiles",
                        sa.MetaData(),
                        sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("voice_live_instance_id", sa.String(36), nullable=True),
                    )
                )
            )
            connection.execute(
                sa.schema.CreateTable(
                    sa.Table(
                        "voice_live_instances",
                        sa.MetaData(),
                        sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("voice_live_model", sa.String(50)),
                        sa.Column("voice_name", sa.String(200)),
                        sa.Column("avatar_character", sa.String(100)),
                        sa.Column("avatar_style", sa.String(100)),
                        sa.Column("avatar_enabled", sa.Boolean()),
                        sa.Column("recognition_language", sa.String(20)),
                    )
                )
            )
            connection.execute(
                sa.text(
                    "INSERT INTO voice_live_instances "
                    "(id, voice_live_model, voice_name, avatar_character, avatar_style, "
                    "avatar_enabled, recognition_language) VALUES "
                    "('inst-1', 'gpt-realtime', 'zh-CN-XiaoxiaoMultilingualNeural', 'lisa', "
                    "'casual-sitting', 1, 'zh,en')"
                )
            )
            connection.execute(
                sa.text(
                    "INSERT INTO hcp_profiles (id, voice_live_instance_id) "
                    "VALUES ('hcp-1', 'inst-1')"
                )
            )
            # Unlinked profile -- must stay at column defaults, not error out.
            connection.execute(
                sa.text(
                    "INSERT INTO hcp_profiles (id, voice_live_instance_id) VALUES ('hcp-2', NULL)"
                )
            )

            context = MigrationContext.configure(connection)
            migration.op = Operations(context)
            migration.upgrade()

            row = connection.execute(
                sa.text(
                    "SELECT voice_live_model, voice_name, avatar_character, avatar_style, "
                    "avatar_enabled, recognition_language FROM hcp_profiles WHERE id = 'hcp-1'"
                )
            ).fetchone()
            assert row is not None
            assert row[0] == "gpt-realtime"
            assert row[1] == "zh-CN-XiaoxiaoMultilingualNeural"
            assert row[2] == "lisa"
            assert row[3] == "casual-sitting"
            assert bool(row[4]) is True
            assert row[5] == "zh,en"

            unlinked_row = connection.execute(
                sa.text("SELECT voice_live_model, voice_name FROM hcp_profiles WHERE id = 'hcp-2'")
            ).fetchone()
            assert unlinked_row is not None
            assert unlinked_row[0] == "gpt-4o"
            assert unlinked_row[1] == "en-US-AvaNeural"

        engine.dispose()


async def _seed_user(db) -> str:
    """Create a test user and return user_id."""
    user = User(
        username="voicehcpuser",
        email="voicehcp@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Voice HCP User",
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user.id


class TestCreateWithoutInstance:
    """VMODE-01: creating an HCP profile no longer requires a VoiceLiveInstance link."""

    async def test_create_without_voice_live_instance_id_succeeds(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. NoVL", specialty="Onc", created_by=user_id)
        profile = await create_hcp_profile(db_session, data, user_id)

        assert profile.voice_live_instance_id is None
        assert profile.voice_live_model == "gpt-4o"
        assert profile.voice_name == "en-US-AvaNeural"
        assert profile.avatar_character == "lisa"
        assert profile.avatar_style == "casual"
        assert profile.avatar_enabled is True
        assert profile.recognition_language == "auto"

    async def test_create_with_direct_fields_persists_them(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(
            name="Dr. Direct",
            specialty="Onc",
            created_by=user_id,
            voice_live_model="gpt-realtime",
            voice_name="en-US-AndrewNeural",
            avatar_character="harry",
            avatar_style="front_facing",
            avatar_enabled=False,
            recognition_language="en-US",
        )
        profile = await create_hcp_profile(db_session, data, user_id)

        assert profile.voice_live_instance_id is None
        assert profile.voice_live_model == "gpt-realtime"
        assert profile.voice_name == "en-US-AndrewNeural"
        assert profile.avatar_character == "harry"
        assert profile.avatar_style == "front_facing"
        assert profile.avatar_enabled is False
        assert profile.recognition_language == "en-US"


class TestUpdateWithoutInstance:
    """VMODE-01: voice_live_instance_id can be cleared on update (D-13 reversed)."""

    async def test_update_can_clear_voice_live_instance_id(self, db_session):
        user_id = await _seed_user(db_session)
        inst = VoiceLiveInstance(name="To Be Cleared", created_by=user_id)
        db_session.add(inst)
        await db_session.flush()

        data = HcpProfileCreate(
            name="Dr. Clearable",
            specialty="Onc",
            created_by=user_id,
            voice_live_instance_id=inst.id,
        )
        profile = await create_hcp_profile(db_session, data, user_id)
        assert profile.voice_live_instance_id == inst.id

        updated = await update_hcp_profile(
            db_session, profile.id, HcpProfileUpdate(voice_live_instance_id=None)
        )
        assert updated.voice_live_instance_id is None

    async def test_update_sets_direct_fields(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. Update", specialty="Onc", created_by=user_id)
        profile = await create_hcp_profile(db_session, data, user_id)

        updated = await update_hcp_profile(
            db_session,
            profile.id,
            HcpProfileUpdate(
                voice_live_model="gpt-realtime",
                voice_name="zh-CN-XiaoxiaoMultilingualNeural",
                avatar_character="lisa",
                avatar_style="casual-sitting",
                avatar_enabled=False,
                recognition_language="zh,en",
            ),
        )

        assert updated.voice_live_model == "gpt-realtime"
        assert updated.voice_name == "zh-CN-XiaoxiaoMultilingualNeural"
        assert updated.avatar_character == "lisa"
        assert updated.avatar_style == "casual-sitting"
        assert updated.avatar_enabled is False
        assert updated.recognition_language == "zh,en"


class TestResolveVoiceConfigInlineFirst:
    """VMODE-01: resolve_voice_config() sources from HcpProfile's own inline columns."""

    async def test_resolves_from_inline_fields_regardless_of_instance_link(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(
            name="Dr. Inline",
            specialty="Onc",
            created_by=user_id,
            voice_live_model="gpt-realtime",
            voice_name="en-US-AndrewNeural",
            avatar_character="harry",
            avatar_style="front_facing",
            avatar_enabled=False,
            recognition_language="en-US",
        )
        profile = await create_hcp_profile(db_session, data, user_id)

        config = resolve_voice_config(profile)

        assert config["voice_live_enabled"] is True
        assert config["voice_live_model"] == "gpt-realtime"
        assert config["voice_name"] == "en-US-AndrewNeural"
        assert config["avatar_character"] == "harry"
        assert config["avatar_style"] == "front_facing"
        assert config["avatar_enabled"] is False
        assert config["recognition_language"] == "en-US"

    async def test_resolves_from_inline_defaults_for_new_profile(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. Bare", specialty="Onc", created_by=user_id)
        profile = await create_hcp_profile(db_session, data, user_id)

        config = resolve_voice_config(profile)

        assert config["voice_live_enabled"] is True
        assert config["voice_live_model"] == "gpt-4o"
        assert config["voice_name"] == "en-US-AvaNeural"
        assert config["avatar_character"] == "lisa"
        assert config["avatar_style"] == "casual"
        assert config["avatar_enabled"] is True
        assert config["recognition_language"] == "auto"
        assert config["model_instruction"] == ""
        assert config["response_temperature"] == 0.8
        assert config["custom_lexicon_enabled"] is False
