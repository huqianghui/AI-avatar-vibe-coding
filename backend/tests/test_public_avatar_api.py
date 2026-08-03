"""Tests for the anonymous public avatar trust boundary (Phase 32, ANON-01).

Covers session token issuance/verification (Task 1) and the chat endpoint
(Task 3, appended below).
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from jose import jwt

from app.config import get_settings
from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.avatar_persona import AvatarPersona
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user import User
from app.schemas.avatar_persona import AvatarPersonaCreate
from app.services import avatar_persona_service
from app.services.anonymous_session_service import (
    create_anonymous_session,
    touch_session,
    verify_anonymous_token,
)
from app.services.auth import create_access_token, get_password_hash
from app.services.avatar_service import REFUSAL_TEMPLATES
from app.services.rate_limit import limiter_ip
from tests.conftest import TestSessionLocal

settings = get_settings()


async def _create_persona(db_session, **overrides) -> AvatarPersona:
    defaults = {
        "name": "Lisa Default",
        "character": "lisa",
        "style": "casual-sitting",
        "voice_map": {},
        "greeting_map": {"zh-CN": "Hi, I'm Lisa!"},
        "prompt_fragment": "Be friendly.",
        "enabled": True,
        "is_default": True,
    }
    defaults.update(overrides)
    data = AvatarPersonaCreate(**defaults)
    return await avatar_persona_service.create_persona(db_session, data)


async def _create_user_and_token(username="public_persona_user") -> tuple[str, str]:
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Persona User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


@pytest.fixture(autouse=True)
def _reset_limiter_storage():
    """Prevent cross-test pollution: `client` always presents the same fixed
    ASGITransport test IP, so every test in this file shares one rate-limit
    bucket unless reset (mirrors test_rate_limiting.py's fixture)."""
    limiter_ip.reset()
    yield
    limiter_ip.reset()


def _make_public_config() -> PublicKnowledgeConfig:
    return PublicKnowledgeConfig(
        agent_id="test-agent",
        agent_version="1",
        connection_name="conn",
        connection_target="https://search.example",
        index_name="kb1",
        is_active=True,
    )


async def _anon_session_and_header(client) -> dict:
    response = await client.post("/public/avatar/session")
    token = response.json()["session_token"]
    return {"X-Anon-Session": token}


class TestCreateAnonymousSession:
    async def test_creates_row_and_signed_token(self, db_session):
        """Row is inserted with expiry = now + anon_session_ttl_minutes; the
        signed token's `sid` claim matches the row's id, `typ` == "anon"."""
        session, token = await create_anonymous_session(db_session, "203.0.113.5")

        assert session.id is not None
        assert session.ip_address == "203.0.113.5"

        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sid"] == session.id
        assert payload["typ"] == "anon"


class TestVerifyAnonymousToken:
    async def test_returns_live_row_for_fresh_token(self, db_session):
        session, token = await create_anonymous_session(db_session, "203.0.113.6")

        verified = await verify_anonymous_token(db_session, token)

        assert verified.id == session.id

    async def test_rejects_expired_jwt_claim(self, db_session):
        """A JWT whose own `exp` claim has passed is rejected."""
        session, _ = await create_anonymous_session(db_session, "203.0.113.7")
        expired_token = jwt.encode(
            {
                "sid": session.id,
                "typ": "anon",
                "exp": datetime.now(UTC) - timedelta(minutes=5),
            },
            settings.secret_key,
            algorithm=settings.algorithm,
        )

        from app.utils.exceptions import AppException

        try:
            await verify_anonymous_token(db_session, expired_token)
            raise AssertionError("Expected UNAUTHORIZED")
        except AppException as exc:
            assert exc.status_code == 401

    async def test_rejects_when_db_row_expired_even_if_jwt_claim_valid(self, db_session):
        """DB is source of truth: expires_at in the past on the row rejects the
        token even though the JWT's own `exp` claim is still in the future."""
        session, _ = await create_anonymous_session(db_session, "203.0.113.8")
        session.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
        await db_session.commit()

        still_valid_jwt_exp = jwt.encode(
            {
                "sid": session.id,
                "typ": "anon",
                "exp": datetime.now(UTC) + timedelta(minutes=30),
            },
            settings.secret_key,
            algorithm=settings.algorithm,
        )

        from app.utils.exceptions import AppException

        try:
            await verify_anonymous_token(db_session, still_valid_jwt_exp)
            raise AssertionError("Expected UNAUTHORIZED")
        except AppException as exc:
            assert exc.status_code == 401

    async def test_rejects_revoked_session(self, db_session):
        session, token = await create_anonymous_session(db_session, "203.0.113.9")
        session.is_revoked = True
        await db_session.commit()

        from app.utils.exceptions import AppException

        try:
            await verify_anonymous_token(db_session, token)
            raise AssertionError("Expected UNAUTHORIZED")
        except AppException as exc:
            assert exc.status_code == 401

    async def test_rejects_wrong_token_type(self, db_session):
        session = AnonymousAvatarSession(
            ip_address="203.0.113.10",
            expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=30),
            last_activity_at=datetime.now(UTC).replace(tzinfo=None),
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        wrong_type_token = jwt.encode(
            {
                "sid": session.id,
                "typ": "access",
                "exp": datetime.now(UTC) + timedelta(minutes=30),
            },
            settings.secret_key,
            algorithm=settings.algorithm,
        )

        from app.utils.exceptions import AppException

        try:
            await verify_anonymous_token(db_session, wrong_type_token)
            raise AssertionError("Expected UNAUTHORIZED")
        except AppException as exc:
            assert exc.status_code == 401


class TestTouchSession:
    async def test_updates_last_activity_and_increments_request_count(self, db_session):
        """`touch_session` bumps `last_activity_at` and `request_count` but does
        NOT extend `expires_at` (fixed-window renewal decision)."""
        session, _ = await create_anonymous_session(db_session, "203.0.113.20")
        original_expires_at = session.expires_at
        original_count = session.request_count

        await touch_session(db_session, session)

        assert session.request_count == original_count + 1
        assert session.last_activity_at is not None
        assert session.expires_at == original_expires_at


class TestCreateSessionEndpoint:
    async def test_returns_201_with_session_token_and_expiry(self, client):
        response = await client.post("/public/avatar/session")

        assert response.status_code == 201
        body = response.json()
        assert "session_token" in body
        assert "expires_at" in body

        payload = jwt.decode(
            body["session_token"], settings.secret_key, algorithms=[settings.algorithm]
        )
        assert payload["typ"] == "anon"

    async def test_ignores_any_client_supplied_body(self, client):
        """No request body field is ever consumed — a supplied body is simply ignored."""
        response = await client.post(
            "/public/avatar/session",
            json={"agent_id": "should-be-ignored", "user_id": "not-a-thing"},
        )

        assert response.status_code == 201


class TestChatEndpoint:
    """POST /public/avatar/chat (Phase 32, Task 3)."""

    async def test_returns_200_with_answer_citations_is_refusal(self, client):
        headers = await _anon_session_and_header(client)
        result = {
            "answer": "Grounded answer.",
            "citations": [{"title": "T1", "url": "https://a", "page": 1}],
            "is_refusal": False,
            "response_id": "resp-1",
        }

        with (
            patch(
                "app.api.public_avatar.get_active_public_config_or_none",
                AsyncMock(return_value=_make_public_config()),
            ),
            patch(
                "app.api.public_avatar.handle_anonymous_turn",
                AsyncMock(return_value=result),
            ),
        ):
            response = await client.post(
                "/public/avatar/chat", json={"message": "What is BeiGene?"}, headers=headers
            )

        assert response.status_code == 200
        body = response.json()
        assert body["answer"] == "Grounded answer."
        assert body["citations"] == [{"title": "T1", "url": "https://a", "page": 1}]
        assert body["is_refusal"] is False

    async def test_missing_session_header_returns_401_structured_error(self, client):
        response = await client.post("/public/avatar/chat", json={"message": "Hello"})

        assert response.status_code == 401
        body = response.json()
        assert "code" in body
        assert "message" in body

    async def test_message_over_2000_chars_returns_422(self, client):
        headers = await _anon_session_and_header(client)

        response = await client.post(
            "/public/avatar/chat", json={"message": "x" * 2001}, headers=headers
        )

        assert response.status_code == 422

    async def test_exceeding_ip_rate_limit_returns_429_with_rate_limited_code(self, client):
        """Reuses Plan 01's structured 429 handler — confirms wiring only, not
        the limiter's own correctness (already covered by test_rate_limiting.py)."""
        headers = await _anon_session_and_header(client)
        limit_count = int(settings.anon_rate_limit_chat_ip.split("/")[0])
        result = {"answer": "ok", "citations": [], "is_refusal": True, "response_id": ""}

        statuses = []
        with (
            patch(
                "app.api.public_avatar.get_active_public_config_or_none",
                AsyncMock(return_value=_make_public_config()),
            ),
            patch(
                "app.api.public_avatar.handle_anonymous_turn",
                AsyncMock(return_value=result),
            ),
        ):
            for _ in range(limit_count + 1):
                response = await client.post(
                    "/public/avatar/chat", json={"message": "Hello"}, headers=headers
                )
                statuses.append(response.status_code)

        assert statuses[-1] == 429
        assert response.json()["code"] == "RATE_LIMITED"


class TestChatEndpointLocale:
    """POST /public/avatar/chat locale forwarding (Phase 34-07, LANG-02)."""

    async def test_es_mx_locale_forwards_to_handle_anonymous_turn_and_returns_refusal(self, client):
        """A supplied `locale=es-MX` is forwarded to `handle_anonymous_turn` as
        the `locale` kwarg, and the es-MX `REFUSAL_TEMPLATES` string is what
        comes back through the response body."""
        headers = await _anon_session_and_header(client)
        result = {
            "answer": REFUSAL_TEMPLATES["es-MX"],
            "citations": [],
            "is_refusal": True,
            "response_id": "",
        }
        mock_turn = AsyncMock(return_value=result)

        with (
            patch(
                "app.api.public_avatar.get_active_public_config_or_none",
                AsyncMock(return_value=_make_public_config()),
            ),
            patch("app.api.public_avatar.handle_anonymous_turn", mock_turn),
        ):
            response = await client.post(
                "/public/avatar/chat",
                json={"message": "What is the weather today?", "locale": "es-MX"},
                headers=headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["answer"] == REFUSAL_TEMPLATES["es-MX"]
        assert body["is_refusal"] is True
        assert mock_turn.call_args.kwargs["locale"] == "es-MX"

    async def test_no_locale_field_defaults_to_zh_cn(self, client):
        """Backward compatibility: omitting `locale` still returns 200 and
        forwards the zh-CN default to `handle_anonymous_turn`."""
        headers = await _anon_session_and_header(client)
        result = {
            "answer": REFUSAL_TEMPLATES["zh-CN"],
            "citations": [],
            "is_refusal": True,
            "response_id": "",
        }
        mock_turn = AsyncMock(return_value=result)

        with (
            patch(
                "app.api.public_avatar.get_active_public_config_or_none",
                AsyncMock(return_value=_make_public_config()),
            ),
            patch("app.api.public_avatar.handle_anonymous_turn", mock_turn),
        ):
            response = await client.post(
                "/public/avatar/chat", json={"message": "Hello"}, headers=headers
            )

        assert response.status_code == 200
        assert response.json()["answer"] == REFUSAL_TEMPLATES["zh-CN"]
        assert mock_turn.call_args.kwargs["locale"] == "zh-CN"

    async def test_unsupported_locale_returns_422(self, client):
        headers = await _anon_session_and_header(client)

        response = await client.post(
            "/public/avatar/chat",
            json={"message": "Bonjour", "locale": "fr-FR"},
            headers=headers,
        )

        assert response.status_code == 422


class TestPersonaEndpoint:
    """GET /public/avatar/persona (Phase 37, PERSONA-05 fidelity gap closure):
    lets the anonymous avatar page render the resolved persona's identity
    (character/style) before any WebRTC connect attempt."""

    async def test_returns_200_with_default_persona_metadata(self, client, db_session):
        persona = await _create_persona(db_session)
        headers = await _anon_session_and_header(client)

        response = await client.get("/public/avatar/persona", headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert body["persona_id"] == persona.id
        assert body["name"] == "Lisa Default"
        assert body["character"] == "lisa"
        assert body["style"] == "casual-sitting"

    async def test_missing_session_header_returns_401_structured_error(self, client, db_session):
        await _create_persona(db_session)

        response = await client.get("/public/avatar/persona")

        assert response.status_code == 401
        body = response.json()
        assert "code" in body
        assert "message" in body

    async def test_response_never_contains_prompt_fragment_or_greeting_or_voice_map(
        self, client, db_session
    ):
        await _create_persona(
            db_session,
            prompt_fragment="SECRET: never leak this to a pre-connect client.",
            greeting_map={"zh-CN": "Hi, I'm Lisa!"},
            voice_map={"zh-CN": "zh-CN-XiaoxiaoMultilingualNeural"},
        )
        headers = await _anon_session_and_header(client)

        response = await client.get("/public/avatar/persona", headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert "prompt_fragment" not in body
        assert "greeting" not in body
        assert "voice_map" not in body
        assert set(body.keys()) == {"persona_id", "name", "character", "style"}

    async def test_logged_in_user_with_selected_persona_gets_their_persona(
        self, client, db_session
    ):
        await _create_persona(db_session, name="Default", is_default=True)
        other = await _create_persona(
            db_session, name="Other", character="lori", style="graceful-sitting", is_default=False
        )
        user_id, token = await _create_user_and_token()
        await avatar_persona_service.set_selected_persona(
            db_session, user_id=user_id, persona_id=other.id
        )
        headers = await _anon_session_and_header(client)
        headers["Authorization"] = f"Bearer {token}"

        response = await client.get("/public/avatar/persona", headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert body["persona_id"] == other.id
        assert body["character"] == "lori"
        assert body["style"] == "graceful-sitting"


class TestChatEndpointUngroundedFallback:
    """Foundry IQ is optional: with NO active PublicKnowledgeConfig the chat
    endpoint still answers (ungrounded) -- handle_anonymous_turn receives
    public_config=None instead of the request failing with 404."""

    async def test_no_config_forwards_none_and_returns_200(self, client):
        headers = await _anon_session_and_header(client)
        result = {
            "answer": "Ungrounded answer.",
            "citations": [],
            "is_refusal": False,
            "response_id": "resp-model-1",
        }
        mock_turn = AsyncMock(return_value=result)

        with (
            patch(
                "app.api.public_avatar.get_active_public_config_or_none",
                AsyncMock(return_value=None),
            ),
            patch("app.api.public_avatar.handle_anonymous_turn", mock_turn),
        ):
            response = await client.post(
                "/public/avatar/chat", json={"message": "你好"}, headers=headers
            )

        assert response.status_code == 200
        body = response.json()
        assert body["answer"] == "Ungrounded answer."
        assert body["citations"] == []
        assert body["is_refusal"] is False
        mock_turn.assert_awaited_once()
        assert mock_turn.call_args.args[3] is None
