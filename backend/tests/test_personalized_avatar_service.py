"""Tests for the personalized authenticated avatar Q&A orchestrator (Phase
33, PERS-02, D-05/D-08/D-15).

Mocks `stream_agent_response`, `retrieve_citations`, and
`build_personalization_context` -- never calls live Azure services from
pytest. Structurally mirrors test_avatar_service.py.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import select

from app.models.avatar_interaction_log import AvatarInteractionLog
from app.models.personalized_avatar_session import PersonalizedAvatarSession
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user import User
from app.services.agent_chat_service import AgentResponseEvent
from app.services.auth import get_password_hash
from app.services.avatar_service import REFUSAL_TEMPLATES
from app.services.personalized_avatar_service import handle_personalized_turn


async def _agent_events(*events):
    for event in events:
        yield event


async def _make_user(db_session) -> User:
    user = User(
        username="pers-turn-user",
        email="pers-turn-user@example.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _make_session(db_session, user: User) -> PersonalizedAvatarSession:
    now = datetime.now(UTC).replace(tzinfo=None)
    session = PersonalizedAvatarSession(
        user_id=user.id,
        expires_at=now + timedelta(minutes=30),
        last_activity_at=now,
    )
    db_session.add(session)
    await db_session.flush()
    return session


def _make_public_config() -> PublicKnowledgeConfig:
    return PublicKnowledgeConfig(
        agent_id="test-agent",
        agent_version="1",
        connection_name="conn",
        connection_target="https://search.example",
        index_name="kb1",
        is_active=True,
    )


class TestHandlePersonalizedTurnForwarding:
    async def test_build_personalization_context_result_forwarded_to_agent_call(self, db_session):
        """The built context string is forwarded verbatim into
        stream_agent_response's personalization_context kwarg."""
        user = await _make_user(db_session)
        session = await _make_session(db_session, user)
        public_config = _make_public_config()
        citations = [{"title": "T1", "url": "https://a", "page": 1}]

        stream_mock = MagicMock(
            side_effect=lambda *args, **kwargs: _agent_events(
                AgentResponseEvent(kind="text", text="Personalized answer."),
                AgentResponseEvent(kind="completed", response_id="resp-1"),
            )
        )

        with (
            patch(
                "app.services.personalized_avatar_service.stream_agent_response",
                stream_mock,
            ),
            patch(
                "app.services.personalized_avatar_service.retrieve_citations",
                AsyncMock(return_value=citations),
            ),
            patch(
                "app.services.personalized_avatar_service.build_personalization_context",
                AsyncMock(return_value="## User Background\nCustomer: Acme"),
            ),
        ):
            result = await handle_personalized_turn(
                db_session, session, user, "What is BeiGene?", public_config
            )

        assert result["is_refusal"] is False
        assert result["answer"] == "Personalized answer."
        stream_mock.assert_called_once()
        _, call_kwargs = stream_mock.call_args
        assert call_kwargs["personalization_context"] == "## User Background\nCustomer: Acme"

    async def test_empty_personalization_context_still_forwarded_as_empty_string(self, db_session):
        """D-08: when build_personalization_context returns '', the turn still
        proceeds -- stream_agent_response is called with
        personalization_context=''."""
        user = await _make_user(db_session)
        session = await _make_session(db_session, user)
        public_config = _make_public_config()

        stream_mock = MagicMock(
            side_effect=lambda *args, **kwargs: _agent_events(
                AgentResponseEvent(kind="text", text="Unpersonalized answer."),
                AgentResponseEvent(kind="completed", response_id="resp-2"),
            )
        )

        with (
            patch(
                "app.services.personalized_avatar_service.stream_agent_response",
                stream_mock,
            ),
            patch(
                "app.services.personalized_avatar_service.retrieve_citations",
                AsyncMock(return_value=[{"title": "T1", "url": "https://a", "page": 1}]),
            ),
            patch(
                "app.services.personalized_avatar_service.build_personalization_context",
                AsyncMock(return_value=""),
            ),
        ):
            result = await handle_personalized_turn(
                db_session, session, user, "Generic question", public_config
            )

        assert result["answer"] == "Unpersonalized answer."
        stream_mock.assert_called_once()
        _, call_kwargs = stream_mock.call_args
        assert call_kwargs["personalization_context"] == ""


class TestHandlePersonalizedTurnAuditLog:
    async def test_writes_exactly_one_audit_log_row_tagged_with_user_and_session(self, db_session):
        user = await _make_user(db_session)
        session = await _make_session(db_session, user)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.personalized_avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="Answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-3"),
                ),
            ),
            patch(
                "app.services.personalized_avatar_service.retrieve_citations",
                AsyncMock(return_value=[{"title": "T1", "url": "https://a", "page": 1}]),
            ),
            patch(
                "app.services.personalized_avatar_service.build_personalization_context",
                AsyncMock(return_value=""),
            ),
        ):
            await handle_personalized_turn(
                db_session, session, user, "What is BeiGene?", public_config
            )

        rows = (await db_session.execute(select(AvatarInteractionLog))).scalars().all()
        assert len(rows) == 1
        assert rows[0].user_id == user.id
        assert rows[0].personalized_session_id == session.id
        assert rows[0].session_id is None
        assert rows[0].ip_address == ""


class TestHandlePersonalizedTurnRefusal:
    async def test_refusal_template_wins_on_zero_citations(self, db_session):
        user = await _make_user(db_session)
        session = await _make_session(db_session, user)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.personalized_avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="Fabricated answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-4"),
                ),
            ),
            patch(
                "app.services.personalized_avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.services.personalized_avatar_service.build_personalization_context",
                AsyncMock(return_value=""),
            ),
        ):
            result = await handle_personalized_turn(
                db_session, session, user, "Off-topic question", public_config
            )

        assert result["is_refusal"] is True
        assert result["citations"] == []
        assert result["answer"] == REFUSAL_TEMPLATES["zh-CN"]

    async def test_agent_or_citation_failure_degrades_to_refusal_and_still_audits(self, db_session):
        user = await _make_user(db_session)
        session = await _make_session(db_session, user)
        public_config = _make_public_config()

        async def _raise_stream(*args, **kwargs):
            raise RuntimeError("agent stream failed")
            yield  # pragma: no cover - unreachable, keeps this an async generator

        with (
            patch(
                "app.services.personalized_avatar_service.stream_agent_response",
                side_effect=_raise_stream,
            ),
            patch(
                "app.services.personalized_avatar_service.retrieve_citations",
                AsyncMock(return_value=[{"title": "T1", "url": "https://a", "page": 1}]),
            ),
            patch(
                "app.services.personalized_avatar_service.build_personalization_context",
                AsyncMock(return_value=""),
            ),
        ):
            result = await handle_personalized_turn(
                db_session, session, user, "Trigger failure", public_config
            )

        assert result["is_refusal"] is True
        assert result["answer"] == REFUSAL_TEMPLATES["zh-CN"]

        rows = (await db_session.execute(select(AvatarInteractionLog))).scalars().all()
        assert len(rows) == 1
        assert rows[0].is_refusal is True
