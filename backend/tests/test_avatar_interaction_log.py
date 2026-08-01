"""Audit-log completeness test (Phase 32-05, ANON-05 / T-32-08).

Drives 3 real calls to `handle_anonymous_turn()` -- one grounded success, one
refusal, and one where the Agent stream raises -- against an in-memory
SQLite `db_session` with mocked Azure boundaries (`stream_agent_response`,
`retrieve_citations`), and asserts exactly one `AvatarInteractionLog` row is
written per turn, with `citation_count`/`is_refusal` matching each case.

This mirrors, at the backend layer, the same observable contract
`frontend/e2e/anonymous-avatar-qa.spec.ts` proves at the UI layer: every
anonymous chat turn produces a matching audit-log row.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.avatar_interaction_log import AvatarInteractionLog
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.services.agent_chat_service import AgentResponseEvent
from app.services.avatar_service import handle_anonymous_turn


async def _agent_events(*events):
    for event in events:
        yield event


async def _agent_raises(*_args, **_kwargs):
    raise RuntimeError("Simulated Agent stream failure")
    yield  # pragma: no cover -- makes this an async generator function


async def _make_session(db_session) -> AnonymousAvatarSession:
    now = datetime.now(UTC).replace(tzinfo=None)
    session = AnonymousAvatarSession(
        ip_address="203.0.113.30",
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


class TestAuditLogCompletenessAcrossThreeTurns:
    async def test_success_refusal_and_agent_error_each_write_exactly_one_row(
        self, db_session
    ):
        session = await _make_session(db_session)
        public_config = _make_public_config()

        # Turn 1: success with grounded citations.
        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="Grounded answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-success"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(
                    return_value=[{"title": "T1", "url": "https://a", "page": 1}]
                ),
            ),
        ):
            success_result = await handle_anonymous_turn(
                db_session, session, "What is BeiGene?", public_config
            )

        # Turn 2: refusal (zero-hit search).
        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                return_value=_agent_events(
                    AgentResponseEvent(kind="text", text="This is a fabricated answer."),
                    AgentResponseEvent(kind="completed", response_id="resp-refusal"),
                ),
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(return_value=[]),
            ),
        ):
            refusal_result = await handle_anonymous_turn(
                db_session, session, "Off-topic question", public_config
            )

        # Turn 3: the Agent stream raises mid-response.
        with (
            patch(
                "app.services.avatar_service.stream_agent_response",
                side_effect=_agent_raises,
            ),
            patch(
                "app.services.avatar_service.retrieve_citations",
                AsyncMock(
                    return_value=[{"title": "T2", "url": "https://b", "page": 2}]
                ),
            ),
        ):
            error_result = await handle_anonymous_turn(
                db_session, session, "Question during an outage", public_config
            )

        # The turn never raised out of handle_anonymous_turn -- it degraded
        # gracefully to the fixed refusal response instead.
        assert error_result["is_refusal"] is True
        assert error_result["citations"] == []

        rows = (
            (await db_session.execute(select(AvatarInteractionLog)))
            .scalars()
            .all()
        )
        assert len(rows) == 3

        by_response_id = {row.response_id: row for row in rows}

        success_row = by_response_id["resp-success"]
        assert success_row.citation_count == 1
        assert success_row.is_refusal is False
        assert success_row.session_id == session.id

        refusal_row = by_response_id["resp-refusal"]
        assert refusal_row.citation_count == 0
        assert refusal_row.is_refusal is True

        # The failed turn never received a response_id from the Agent, so it
        # is logged under the empty-string fallback used by the service.
        error_row = by_response_id[""]
        assert error_row.citation_count == 0
        assert error_row.is_refusal is True
        assert error_row.question == "Question during an outage"

        assert success_result["is_refusal"] is False
        assert refusal_result["is_refusal"] is True
