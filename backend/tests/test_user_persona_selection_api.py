"""Integration tests for GET/PUT /api/v1/users/me/selected-persona (Phase 36, PERSONA-03).

Self-service endpoint: a logged-in user's own active persona, resolved via
`resolve_active_persona()`, and a self-service switch that upserts exactly
one `UserPreference(category="selected_persona_id")` row scoped to
`current_user.id` (T-36-20/T-36-21 -- no client-suppliable user_id anywhere).
"""

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.avatar_persona import AvatarPersona
from app.models.user import User
from app.models.user_preference import UserPreference
from app.services.auth import get_password_hash


async def _create_user(db_session, username: str = "selector") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _create_persona(db_session, **overrides) -> AvatarPersona:
    defaults = {
        "name": "Lisa",
        "character": "lisa",
        "style": "casual",
        "voice_map": "{}",
        "greeting": "Hi there!",
        "prompt_fragment": "Be friendly.",
        "enabled": True,
        "is_default": False,
    }
    defaults.update(overrides)
    persona = AvatarPersona(**defaults)
    db_session.add(persona)
    await db_session.commit()
    await db_session.refresh(persona)
    return persona


class TestGetSelectedPersona:
    async def test_returns_default_persona_when_no_preference_row(self, db_session):
        user = await _create_user(db_session)
        default = await _create_persona(db_session, name="Default", is_default=True)

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/users/me/selected-persona")
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == default.id
        assert body["name"] == "Default"
        assert body["character"] == "lisa"
        assert body["style"] == "casual"
        assert body["greeting"] == "Hi there!"

    async def test_returns_users_selected_persona_when_preference_row_exists(self, db_session):
        user = await _create_user(db_session)
        await _create_persona(db_session, name="Default", is_default=True)
        preferred = await _create_persona(db_session, name="Preferred", is_default=False)
        db_session.add(
            UserPreference(user_id=user.id, category="selected_persona_id", value=preferred.id)
        )
        await db_session.commit()

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/users/me/selected-persona")
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 200
        assert resp.json()["id"] == preferred.id

    async def test_missing_auth_header_gets_401(self, db_session):
        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/users/me/selected-persona")
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 401


class TestPutSelectedPersona:
    async def test_switching_to_enabled_persona_returns_200_and_upserts_row(self, db_session):
        user = await _create_user(db_session)
        await _create_persona(db_session, name="Default", is_default=True)
        other = await _create_persona(db_session, name="Other", is_default=False)

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.put(
                    "/api/v1/users/me/selected-persona", json={"persona_id": other.id}
                )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 200
        assert resp.json()["id"] == other.id

        result = await db_session.execute(
            select(UserPreference).where(UserPreference.user_id == user.id)
        )
        rows = result.scalars().all()
        assert len(rows) == 1
        assert rows[0].category == "selected_persona_id"
        assert rows[0].value == other.id

    async def test_switching_twice_updates_existing_row_never_duplicates(self, db_session):
        user = await _create_user(db_session)
        await _create_persona(db_session, name="Default", is_default=True)
        first = await _create_persona(db_session, name="First", is_default=False)
        second = await _create_persona(db_session, name="Second", is_default=False)

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                first_resp = await ac.put(
                    "/api/v1/users/me/selected-persona", json={"persona_id": first.id}
                )
                second_resp = await ac.put(
                    "/api/v1/users/me/selected-persona", json={"persona_id": second.id}
                )
        finally:
            app.dependency_overrides.clear()

        assert first_resp.status_code == 200
        assert second_resp.status_code == 200

        result = await db_session.execute(
            select(UserPreference).where(UserPreference.user_id == user.id)
        )
        rows = result.scalars().all()
        assert len(rows) == 1
        assert rows[0].value == second.id

    async def test_disabled_persona_gets_404_and_no_row_written(self, db_session):
        user = await _create_user(db_session)
        await _create_persona(db_session, name="Default", is_default=True)
        disabled = await _create_persona(
            db_session, name="Disabled", enabled=False, is_default=False
        )

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.put(
                    "/api/v1/users/me/selected-persona", json={"persona_id": disabled.id}
                )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 404
        assert resp.json()["code"]

        result = await db_session.execute(
            select(UserPreference).where(UserPreference.user_id == user.id)
        )
        assert result.scalars().all() == []

    async def test_nonexistent_persona_gets_404_and_no_row_written(self, db_session):
        user = await _create_user(db_session)
        await _create_persona(db_session, name="Default", is_default=True)

        async def override_get_db():
            yield db_session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.put(
                    "/api/v1/users/me/selected-persona", json={"persona_id": "does-not-exist"}
                )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 404

        result = await db_session.execute(
            select(UserPreference).where(UserPreference.user_id == user.id)
        )
        assert result.scalars().all() == []

    async def test_missing_auth_header_gets_401(self, db_session):
        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.put(
                    "/api/v1/users/me/selected-persona", json={"persona_id": "irrelevant"}
                )
        finally:
            app.dependency_overrides.clear()

        assert resp.status_code == 401
