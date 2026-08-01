"""Integration tests for POST /api/v1/avatar/session (Phase 33, PERS-02).

Covers the authenticated-session-issuance behavior from 33-04-PLAN.md's
<behavior> block: 201 with a valid JWT, 401 with no Authorization header.
"""

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
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
