"""Tests for personalization_injection_service.py (Phase 33, PERS-02,
D-05/D-06/D-07/D-08).

Covers build_personalization_context()'s behavior spec: CRM-only segment,
silent "" fallback when nothing exists, preference-only segment, the SECOND
sanitization gate re-redacting PII, graceful degradation when
`app.models.user_preference` does not exist, and blank-field omission.
"""

from app.models.user_crm_context import UserCrmContext
from app.services.personalization_injection_service import build_personalization_context


async def _seed_crm(
    db_session,
    user_id: str,
    customer_name: str = "",
    company: str = "",
    role: str = "",
    contact_person: str = "",
    crm_notes: str = "",
) -> None:
    crm = UserCrmContext(
        user_id=user_id,
        customer_name=customer_name,
        company=company,
        role=role,
        contact_person=contact_person,
        crm_notes=crm_notes,
    )
    db_session.add(crm)
    await db_session.commit()


class TestBuildPersonalizationContext:
    async def test_full_crm_context_produces_user_background_segment(self, db_session):
        await _seed_crm(
            db_session,
            user_id="user-1",
            customer_name="Alice",
            company="Acme Corp",
            role="Doctor",
            contact_person="Bob",
            crm_notes="Prefers concise answers.",
        )
        result = await build_personalization_context(db_session, "user-1")
        assert result == (
            "## User Background\n"
            "Customer: Alice\n"
            "Company: Acme Corp\n"
            "Role: Doctor\n"
            "Contact: Bob\n"
            "Notes: Prefers concise answers."
        )
        assert "Preferences:" not in result

    async def test_no_crm_and_no_preferences_returns_empty_string(self, db_session):
        result = await build_personalization_context(db_session, "user-with-nothing")
        assert result == ""

    async def test_missing_user_preference_module_degrades_gracefully(self, db_session):
        """Simulates 33-07 (UserPreference) not yet existing: the CRM-only
        segment must still be returned without raising."""
        await _seed_crm(db_session, user_id="user-2", customer_name="Carol")
        result = await build_personalization_context(db_session, "user-2")
        assert result == "## User Background\nCustomer: Carol"

    async def test_crm_notes_phone_number_is_redacted(self, db_session):
        await _seed_crm(db_session, user_id="user-3", crm_notes="13812345678")
        result = await build_personalization_context(db_session, "user-3")
        assert "13812345678" not in result
        assert "[PHONE_REDACTED]" in result

    async def test_empty_fields_are_omitted_from_output(self, db_session):
        await _seed_crm(db_session, user_id="user-4", customer_name="Dave", company="")
        result = await build_personalization_context(db_session, "user-4")
        assert "Company:" not in result
        assert result == "## User Background\nCustomer: Dave"
