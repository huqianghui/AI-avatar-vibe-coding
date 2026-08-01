"""Tests for the anonymous grounded avatar Q&A orchestrator (Phase 32,
ANON-02/ANON-03/ANON-05).

Mocks `stream_agent_response` (async generator stub) and `retrieve_citations`
— never calls live Azure services from pytest.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.avatar_interaction_log import AvatarInteractionLog
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.services.agent_chat_service import AgentResponseEvent
from app.services.avatar_service import REFUSAL_TEMPLATES, handle_anonymous_turn


async def _agent_events(*events):
    for event in events:
        yield event


async def _make_session(db_session) -> AnonymousAvatarSession:
    now = datetime.now(UTC).replace(tzinfo=None)
    session = AnonymousAvatarSession(
        ip_address="203.0.113.20",
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


class TestHandleAnonymousTurnRefusal:
    async def test_refusal_template_wins_on_zero_citations_regardless_of_agent_text(
        self, db_session
    ):
        """Zero-hit questions ALWAYS return the fixed refusal template and
        citations=[], is_refusal=True — even if the Agent produced real text."""
        session = await _make_session(db_session)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="This is a fabricated answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-1"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
        ):
            result = await handle_anonymous_turn(
                db_session, session, "Off-topic question", public_config
            )

        assert result["is_refusal"] is True
        assert result["citations"] == []
        assert result["answer"] == REFUSAL_TEMPLATES["zh-CN"]

    async def test_writes_exactly_one_audit_log_row_on_refusal(self, db_session):
        session = await _make_session(db_session)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="completed", response_id="resp-2"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
        ):
            await handle_anonymous_turn(db_session, session, "Off-topic question", public_config)

        rows = (await db_session.execute(select(AvatarInteractionLog))).scalars().all()
        assert len(rows) == 1
        assert rows[0].is_refusal is True
        assert rows[0].citation_count == 0


class TestHandleAnonymousTurnSuccess:
    async def test_returns_agent_answer_with_grounded_citations(self, db_session):
        session = await _make_session(db_session)
        public_config = _make_public_config()
        citations = [{"title": "T1", "url": "https://a", "page": 1}]

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="Grounded "),
                    AgentResponseEvent(kind="text", text="answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-3"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=citations),
            ),
        ):
            result = await handle_anonymous_turn(
                db_session, session, "What is BeiGene?", public_config
            )

        assert result["is_refusal"] is False
        assert result["answer"] == "Grounded answer."
        assert result["citations"] == citations

    async def test_audit_log_citation_count_matches_filtered_list(self, db_session):
        session = await _make_session(db_session)
        public_config = _make_public_config()
        citations = [
            {"title": "T1", "url": "https://a", "page": 1},
            {"title": "T2", "url": "https://b", "page": 2},
        ]

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="Answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-4"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=citations),
            ),
        ):
            await handle_anonymous_turn(db_session, session, "What is BeiGene?", public_config)

        rows = (await db_session.execute(select(AvatarInteractionLog))).scalars().all()
        assert len(rows) == 1
        assert rows[0].citation_count == 2
        assert rows[0].is_refusal is False


class TestRefusalTemplatesLocaleCoverage:
    """LANG-02 (34-06, D-08): REFUSAL_TEMPLATES must cover all 5 locales,
    and handle_anonymous_turn must return the exact per-locale string."""

    def test_all_five_locale_keys_present_and_non_empty(self):
        for key in ("zh-CN", "en-US", "es-ES", "es-MX", "es-US"):
            assert key in REFUSAL_TEMPLATES
            assert REFUSAL_TEMPLATES[key].strip() != ""

    async def test_handle_anonymous_turn_returns_es_es_refusal_verbatim(self, db_session):
        session = await _make_session(db_session)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="completed", response_id="resp-es-es"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
        ):
            result = await handle_anonymous_turn(
                db_session, session, "Off-topic question", public_config, locale="es-ES"
            )

        assert result["is_refusal"] is True
        assert result["answer"] == REFUSAL_TEMPLATES["es-ES"]

    async def test_handle_anonymous_turn_returns_es_mx_refusal_verbatim(self, db_session):
        session = await _make_session(db_session)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="completed", response_id="resp-es-mx"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
        ):
            result = await handle_anonymous_turn(
                db_session, session, "Off-topic question", public_config, locale="es-MX"
            )

        assert result["is_refusal"] is True
        assert result["answer"] == REFUSAL_TEMPLATES["es-MX"]

    async def test_handle_anonymous_turn_returns_es_us_refusal_verbatim(self, db_session):
        session = await _make_session(db_session)
        public_config = _make_public_config()

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="completed", response_id="resp-es-us"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
        ):
            result = await handle_anonymous_turn(
                db_session, session, "Off-topic question", public_config, locale="es-US"
            )

        assert result["is_refusal"] is True
        assert result["answer"] == REFUSAL_TEMPLATES["es-US"]


class TestHandleAnonymousTurnNoClientOverride:
    async def test_never_passes_request_supplied_agent_or_kb_identifiers(self, db_session):
        """handle_anonymous_turn only ever reads agent_id/index_name from the
        PublicKnowledgeConfig row passed in — never from any other source."""
        session = await _make_session(db_session)
        public_config = _make_public_config()

        def _stream_side_effect(_db, agent_name, agent_version, _message, _prev):
            assert agent_name == public_config.agent_id
            assert agent_version == public_config.agent_version
            return _agent_events(AgentResponseEvent(kind="completed", response_id="resp-5"))

        retrieve_mock = AsyncMock(return_value=[])

        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                side_effect=_stream_side_effect,
            ),
            patch("app.services.avatar_service.retrieve_citations", retrieve_mock),
        ):
            await handle_anonymous_turn(db_session, session, "Any question", public_config)

        retrieve_mock.assert_awaited_once_with(
            public_config.connection_target, public_config.index_name, "Any question"
        )
