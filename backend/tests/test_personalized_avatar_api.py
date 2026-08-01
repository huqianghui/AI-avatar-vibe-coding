"""Integration tests for POST /api/v1/avatar/session and POST
/api/v1/avatar/chat (Phase 33, PERS-02).

Covers the authenticated-session-issuance behavior from 33-04-PLAN.md's
<behavior> block: 201 with a valid JWT, 401 with no Authorization header.

Also covers 33-05-PLAN.md's IDOR-gated chat route: 200 for the owning user,
404 (pre-agent-call) for a foreign session_id, 401 with no Authorization
header.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.personalized_avatar_session import PersonalizedAvatarSession
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user import User
from app.services.auth import get_password_hash


async def _create_user(db_session) -> User:
    user = User(
        username="personalizeduser",
        email="personalizeduser@example.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestCreatePersonalizedSession:
    async def test_authenticated_user_gets_201_session(self, db_session):
        user = await _create_user(db_session)

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.post("/api/v1/avatar/session")
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 201
        body = resp.json()
        assert body["session_id"]
        assert body["expires_at"]

    async def test_missing_auth_header_gets_401(self, db_session):
        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.post("/api/v1/avatar/session")
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 401


def _make_public_config() -> PublicKnowledgeConfig:
    return PublicKnowledgeConfig(
        agent_id="test-agent",
        agent_version="1",
        connection_name="conn",
        connection_target="https://search.example",
        index_name="kb1",
        is_active=True,
    )


async def _make_session(db_session, user: User) -> PersonalizedAvatarSession:
    now = datetime.now(UTC).replace(tzinfo=None)
    session = PersonalizedAvatarSession(
        user_id=user.id,
        expires_at=now + timedelta(minutes=30),
        last_activity_at=now,
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


class TestPersonalizedChat:
    async def test_owning_user_gets_200_with_answer(self, db_session):
        user = await _create_user(db_session)
        session = await _make_session(db_session, user)
        public_config = _make_public_config()
        db_session.add(public_config)
        await db_session.commit()

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            with patch(
                "app.api.personalized_avatar.handle_personalized_turn",
                AsyncMock(
                    return_value={
                        "answer": "Personalized answer.",
                        "citations": [{"title": "T1", "url": "https://a", "page": 1}],
                        "is_refusal": False,
                        "response_id": "resp-1",
                    }
                ),
            ) as mock_handle:
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as ac:
                    resp = await ac.post(
                        "/api/v1/avatar/chat",
                        json={"message": "What is BeiGene?", "session_id": session.id},
                    )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 200
        body = resp.json()
        assert body["answer"] == "Personalized answer."
        assert body["is_refusal"] is False
        mock_handle.assert_awaited_once()

    async def test_foreign_session_id_gets_404_and_agent_never_called(self, db_session):
        owner = await _create_user(db_session)
        session = await _make_session(db_session, owner)

        other_user = User(
            username="otheruser",
            email="otheruser@example.com",
            hashed_password=get_password_hash("password123"),
        )
        db_session.add(other_user)
        await db_session.commit()
        await db_session.refresh(other_user)

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return other_user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            with patch(
                "app.api.personalized_avatar.handle_personalized_turn",
                AsyncMock(),
            ) as mock_handle:
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as ac:
                    resp = await ac.post(
                        "/api/v1/avatar/chat",
                        json={"message": "What is BeiGene?", "session_id": session.id},
                    )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 404
        mock_handle.assert_not_awaited()

    async def test_missing_auth_header_gets_401(self, db_session):
        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.post(
                    "/api/v1/avatar/chat",
                    json={"message": "Hello", "session_id": "irrelevant"},
                )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 401
