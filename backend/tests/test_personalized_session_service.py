"""Tests for personalized_session_service.py (Phase 33, PERS-02, D-15).

Covers create_personalized_session() and get_owned_session()'s IDOR-safe
ownership check (T-33-04): missing/foreign/expired/revoked sessions must all
raise the identical 404.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.personalized_avatar_session import PersonalizedAvatarSession
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.personalized_session_service import (
    create_personalized_session,
    get_owned_session,
)
from app.utils.exceptions import NotFoundException


async def _create_user(db_session, username: str = "crmuser") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestCreatePersonalizedSession:
    async def test_creates_session_row_for_user(self, db_session):
        user = await _create_user(db_session)
        session = await create_personalized_session(db_session, user)
        assert session.id
        assert session.user_id == user.id
        assert session.is_revoked is False
        assert session.request_count == 0

    async def test_expires_at_respects_ttl_setting(self, db_session):
        user = await _create_user(db_session)
        before = datetime.now(UTC)
        session = await create_personalized_session(db_session, user)
        expires_at = session.expires_at.replace(tzinfo=UTC)
        assert expires_at > before + timedelta(minutes=30)


class TestGetOwnedSession:
    async def test_owner_can_load_own_session(self, db_session):
        user = await _create_user(db_session)
        created = await create_personalized_session(db_session, user)
        loaded = await get_owned_session(db_session, created.id, user)
        assert loaded.id == created.id

    async def test_foreign_user_gets_404_not_403(self, db_session):
        owner = await _create_user(db_session, "owner")
        other = await _create_user(db_session, "other")
        created = await create_personalized_session(db_session, owner)
        with pytest.raises(NotFoundException):
            await get_owned_session(db_session, created.id, other)

    async def test_nonexistent_session_gets_same_404(self, db_session):
        user = await _create_user(db_session)
        with pytest.raises(NotFoundException):
            await get_owned_session(db_session, "does-not-exist", user)

    async def test_expired_own_session_gets_same_404(self, db_session):
        user = await _create_user(db_session)
        now = datetime.now(UTC)
        session = PersonalizedAvatarSession(
            user_id=user.id,
            expires_at=now - timedelta(minutes=5),
            last_activity_at=now - timedelta(minutes=10),
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)
        with pytest.raises(NotFoundException):
            await get_owned_session(db_session, session.id, user)

    async def test_revoked_own_session_gets_same_404(self, db_session):
        user = await _create_user(db_session)
        now = datetime.now(UTC)
        session = PersonalizedAvatarSession(
            user_id=user.id,
            expires_at=now + timedelta(minutes=30),
            last_activity_at=now,
            is_revoked=True,
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)
        with pytest.raises(NotFoundException):
            await get_owned_session(db_session, session.id, user)
