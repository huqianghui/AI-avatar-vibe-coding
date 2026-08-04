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
