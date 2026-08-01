"""Tests for admin user-preference CRUD + personalization summary endpoint
(Phase 33, PERS-03)."""

import uuid

import pytest
from sqlalchemy import select

from app.dependencies import get_current_user
from app.main import app
from app.models.user import User
from app.models.user_crm_context import UserCrmContext
from app.models.user_preference import UserPreference


async def _seed_user(db_session, role: str = "user") -> User:
    unique = uuid.uuid4().hex[:8]
    user = User(
        username=f"u-{role}-{unique}",
        email=f"{role}-{unique}@example.com",
        hashed_password="x",
        role=role,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def _override_current_user(user: User):
    async def _fake():
        return user

    return _fake


@pytest.fixture(autouse=True)
async def _clear_overrides():
    yield
    app.dependency_overrides.pop(get_current_user, None)


class TestPersonalizationSummary:
    async def test_no_crm_no_preferences_returns_empty_summary(self, client, db_session):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.get(f"/api/v1/users/{target.id}/personalization")

        assert resp.status_code == 200
        assert resp.json() == {
            "crm_matched": False,
            "customer_name": None,
            "company": None,
            "preferences": [],
        }

    async def test_crm_matched_populates_customer_and_company_only(self, client, db_session):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        db_session.add(UserCrmContext(user_id=target.id, customer_name="张三", company="示例医院"))
        await db_session.commit()
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.get(f"/api/v1/users/{target.id}/personalization")

        body = resp.json()
        assert body["crm_matched"] is True
        assert body["customer_name"] == "张三"
        assert body["company"] == "示例医院"
        assert "crm_notes" not in body
        assert "contact_person" not in body


class TestCreatePreference:
    async def test_create_returns_201_with_sanitized_value(self, client, db_session):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.post(
            f"/api/v1/users/{target.id}/preferences",
            json={"category": "focus_area", "value": "a\x00b 肿瘤"},
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["category"] == "focus_area"
        assert body["value"] == "ab 肿瘤"

    async def test_invalid_category_returns_422(self, client, db_session):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.post(
            f"/api/v1/users/{target.id}/preferences",
            json={"category": "not_a_real_category", "value": "x"},
        )

        assert resp.status_code == 422

    async def test_non_admin_gets_403(self, client, db_session):
        non_admin = await _seed_user(db_session, "user")
        target = await _seed_user(db_session, "user")
        app.dependency_overrides[get_current_user] = _override_current_user(non_admin)

        resp = await client.post(
            f"/api/v1/users/{target.id}/preferences",
            json={"category": "focus_area", "value": "x"},
        )

        assert resp.status_code == 403


class TestUpdateAndDeletePreference:
    async def test_update_sanitizes_value(self, client, db_session):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        pref = UserPreference(user_id=target.id, category="focus_area", value="old")
        db_session.add(pref)
        await db_session.commit()
        await db_session.refresh(pref)
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.put(
            f"/api/v1/users/{target.id}/preferences/{pref.id}",
            json={"value": "new\x00value"},
        )

        assert resp.status_code == 200
        assert resp.json()["value"] == "newvalue"

    async def test_delete_removes_row(self, client, db_session):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        pref = UserPreference(user_id=target.id, category="focus_area", value="x")
        db_session.add(pref)
        await db_session.commit()
        await db_session.refresh(pref)
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.delete(f"/api/v1/users/{target.id}/preferences/{pref.id}")

        assert resp.status_code == 204
        remaining = await db_session.execute(
            select(UserPreference).where(UserPreference.id == pref.id)
        )
        assert remaining.scalar_one_or_none() is None

    async def test_delete_with_wrong_user_id_returns_404_and_does_not_delete(
        self, client, db_session
    ):
        admin = await _seed_user(db_session, "admin")
        target = await _seed_user(db_session, "user")
        other_user = await _seed_user(db_session, "user")
        pref = UserPreference(user_id=target.id, category="focus_area", value="x")
        db_session.add(pref)
        await db_session.commit()
        await db_session.refresh(pref)
        app.dependency_overrides[get_current_user] = _override_current_user(admin)

        resp = await client.delete(f"/api/v1/users/{other_user.id}/preferences/{pref.id}")

        assert resp.status_code == 404
        remaining = await db_session.execute(
            select(UserPreference).where(UserPreference.id == pref.id)
        )
        assert remaining.scalar_one_or_none() is not None
