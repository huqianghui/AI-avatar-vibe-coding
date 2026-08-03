"""Tests for dependency injection: get_current_user edge cases."""

import uuid

from jose import jwt

from app.config import get_settings
from app.dependencies import get_optional_current_user
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal

settings = get_settings()


async def _create_user_in_test_db(
    *, username="testuser", password="pass123", role="user", is_active=True
):
    """Insert a user directly via the test DB session."""
    async with TestSessionLocal() as session:
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash(password),
            full_name=username,
            role=role,
            is_active=is_active,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


class TestGetCurrentUserEdgeCases:
    async def test_token_without_sub_returns_401(self, client):
        """JWT with no 'sub' claim should return 401."""
        token = jwt.encode({"data": "no-sub"}, settings.secret_key, algorithm=settings.algorithm)
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        data = resp.json()
        assert data["code"] == "INVALID_TOKEN"

    async def test_token_with_nonexistent_user_returns_401(self, client):
        """JWT with a valid sub pointing to non-existent user should return 401."""
        token = jwt.encode(
            {"sub": "nonexistent-user-id"}, settings.secret_key, algorithm=settings.algorithm
        )
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        data = resp.json()
        assert data["code"] == "USER_NOT_FOUND"

    async def test_inactive_user_returns_401(self, client):
        """JWT for an inactive user should return 401."""
        user = await _create_user_in_test_db(username="inactive_user", is_active=False)
        token = jwt.encode({"sub": user.id}, settings.secret_key, algorithm=settings.algorithm)
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        data = resp.json()
        assert data["code"] == "INACTIVE_USER"

    async def test_malformed_jwt_returns_401(self, client):
        """Completely invalid JWT string should return 401."""
        resp = await client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt"}
        )
        assert resp.status_code == 401


class TestGetOptionalCurrentUser:
    """Phase 37, PERSONA-05/06 (T-37-04): every failure mode degrades to
    `None` -- never raises -- since a JWT is never required on the shared
    anonymous-capable webrtc endpoint this dependency serves."""

    async def test_no_header_returns_none(self, db_session):
        result = await get_optional_current_user(authorization=None, db=db_session)
        assert result is None

    async def test_malformed_header_returns_none(self, db_session):
        result = await get_optional_current_user(authorization="not-a-bearer-token", db=db_session)
        assert result is None

    async def test_empty_bearer_token_returns_none(self, db_session):
        result = await get_optional_current_user(authorization="Bearer ", db=db_session)
        assert result is None

    async def test_expired_token_returns_none(self, db_session):
        user = await _create_user_in_test_db(username="optional_expired")
        from datetime import timedelta

        expired_token = create_access_token(
            data={"sub": user.id}, expires_delta=timedelta(minutes=-5)
        )
        result = await get_optional_current_user(
            authorization=f"Bearer {expired_token}", db=db_session
        )
        assert result is None

    async def test_valid_token_for_active_user_returns_user(self, db_session):
        user = await _create_user_in_test_db(username="optional_active")
        token = create_access_token(data={"sub": user.id})
        result = await get_optional_current_user(authorization=f"Bearer {token}", db=db_session)
        assert result is not None
        assert result.id == user.id

    async def test_valid_token_for_inactive_user_returns_none(self, db_session):
        user = await _create_user_in_test_db(username="optional_inactive", is_active=False)
        token = create_access_token(data={"sub": user.id})
        result = await get_optional_current_user(authorization=f"Bearer {token}", db=db_session)
        assert result is None

    async def test_unknown_user_id_returns_none(self, db_session):
        token = jwt.encode(
            {"sub": "does-not-exist"}, settings.secret_key, algorithm=settings.algorithm
        )
        result = await get_optional_current_user(authorization=f"Bearer {token}", db=db_session)
        assert result is None

    async def test_token_without_sub_returns_none(self, db_session):
        token = jwt.encode({"data": "no-sub"}, settings.secret_key, algorithm=settings.algorithm)
        result = await get_optional_current_user(authorization=f"Bearer {token}", db=db_session)
        assert result is None
