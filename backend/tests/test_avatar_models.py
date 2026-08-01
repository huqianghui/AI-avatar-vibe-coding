"""Unit tests for anonymous avatar ORM models (AnonymousAvatarSession,
AvatarInteractionLog, PublicKnowledgeConfig) and their Alembic-created tables."""

from datetime import UTC, datetime

from sqlalchemy import inspect

from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.avatar_interaction_log import AvatarInteractionLog
from app.models.public_knowledge_config import PublicKnowledgeConfig


class TestAnonymousAvatarSessionModel:
    """Tests for AnonymousAvatarSession ORM model defaults."""

    async def test_default_values(self, db_session):
        """Creating a row with only ip_address set defaults request_count=0,
        is_revoked=False, last_response_id=""."""
        now = datetime.now(UTC).replace(tzinfo=None)
        session = AnonymousAvatarSession(
            ip_address="127.0.0.1",
            expires_at=now,
            last_activity_at=now,
        )
        db_session.add(session)
        await db_session.flush()

        assert session.request_count == 0
        assert session.is_revoked is False
        assert session.last_response_id == ""
        assert session.ip_address == "127.0.0.1"
        assert session.id is not None
        assert session.created_at is not None


class TestAvatarInteractionLogModel:
    """Tests for AvatarInteractionLog ORM model, including nullable session FK."""

    async def test_nullable_session_id_survives_session_expiry(self, db_session):
        """Creating a row with session_id=None succeeds — audit rows must survive
        session expiry/cleanup (FK is nullable with ondelete='SET NULL')."""
        log = AvatarInteractionLog(
            session_id=None,
            ip_address="10.0.0.1",
            question="What is BeiGene?",
            answer_summary="BeiGene is a biotech company.",
            citation_count=2,
        )
        db_session.add(log)
        await db_session.flush()

        assert log.session_id is None
        assert log.citation_count == 2
        assert log.is_refusal is False
        assert log.id is not None


class TestPublicKnowledgeConfigModel:
    """Tests for PublicKnowledgeConfig ORM model defaults."""

    async def test_default_values(self, db_session):
        """Creating a row defaults is_active=False and voice_map='{}'."""
        config = PublicKnowledgeConfig()
        db_session.add(config)
        await db_session.flush()

        assert config.is_active is False
        assert config.voice_map == "{}"
        assert config.avatar_character == "lori"
        assert config.avatar_style == "casual"


class TestAlembicMigrationTables:
    """Verify the three new tables exist with expected columns via the test DB
    fixture (setup_db creates all tables via Base.metadata, mirroring what
    `alembic upgrade head` produces from the migration)."""

    async def test_tables_exist_with_expected_columns(self, db_session):
        """All three tables are present with their expected columns."""
        conn = await db_session.connection()
        table_names = await conn.run_sync(lambda sync_conn: inspect(sync_conn).get_table_names())

        for expected_table in (
            "anonymous_avatar_sessions",
            "avatar_interaction_logs",
            "public_knowledge_configs",
        ):
            assert expected_table in table_names

        anon_cols = {
            c["name"]
            for c in await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).get_columns("anonymous_avatar_sessions")
            )
        }
        assert {"id", "ip_address", "expires_at", "request_count", "is_revoked"} <= anon_cols

        log_cols = {
            c["name"]
            for c in await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).get_columns("avatar_interaction_logs")
            )
        }
        assert {"id", "session_id", "question", "citation_count", "is_refusal"} <= log_cols

        config_cols = {
            c["name"]
            for c in await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).get_columns("public_knowledge_configs")
            )
        }
        assert {"id", "agent_id", "voice_map", "is_active"} <= config_cols
