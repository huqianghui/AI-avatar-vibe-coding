"""Tests for the anonymous public avatar trust boundary (Phase 32, ANON-01).

Covers session token issuance/verification (Task 1) and the chat endpoint
(Task 3, appended below).
"""

from datetime import UTC, datetime, timedelta

from jose import jwt

from app.config import get_settings
from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.services.anonymous_session_service import (
    create_anonymous_session,
    verify_anonymous_token,
)

settings = get_settings()


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
