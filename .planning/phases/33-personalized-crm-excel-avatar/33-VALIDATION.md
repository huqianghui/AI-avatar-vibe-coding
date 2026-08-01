---
phase: 33
slug: personalized-crm-excel-avatar
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Adapted from `33-RESEARCH.md`'s Validation Architecture section to the final
> 8-plan structure and the serialized PERS-01 → PERS-02 → PERS-03 wave order
> (waves 1-8, one requirement fully landing before the next begins, per
> CLAUDE.md's top-priority rule).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 8.3+ + pytest-asyncio 0.24+ (`backend/pyproject.toml` `[dev]` group) |
| **Framework (frontend)** | vitest (`frontend/vitest.config.ts`) |
| **Framework (E2E)** | Playwright (`frontend/e2e/*.spec.ts`, `frontend/e2e/playwright.config.ts`) |
| **Config file** | `backend/pyproject.toml` (pytest deps); `frontend/vitest.config.ts`; `frontend/e2e/playwright.config.ts` |
| **Quick run command** | Per-file, e.g. `cd backend && pytest tests/test_crm_import_service.py -x` / `cd frontend && npx vitest run src/hooks/use-crm-import.test.ts` |
| **Full suite command** | `cd backend && pytest -v` and `cd frontend && npx tsc -b && npm run build && npx vitest run` |
| **Estimated runtime** | ~60s backend full suite, ~40s frontend unit suite, ~90s Playwright specs |

No new test tooling is required — pytest/pytest-asyncio/vitest/Playwright are already configured project-wide (per `33-RESEARCH.md`'s Environment Availability section).

---

## Sampling Rate

- **After every task commit:** Run the task's own module-scoped quick command (see Per-Task Verification Map below)
- **After every plan wave:** Run `cd backend && pytest -v` (if backend files touched) and/or `cd frontend && npx tsc -b && npx vitest run` (if frontend files touched)
- **Before `/gsd-verify-work`:** Full suite (backend `pytest -v` + frontend `npx tsc -b && npm run build && npx vitest run` + all three Playwright specs) must be green
- **Max feedback latency:** 90 seconds (Playwright E2E specs are the slowest single command)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | PERS-01 | — | N/A (model/migration scaffolding) | smoke | `cd backend && alembic upgrade head && python -c "from app.models import UserCrmContext; assert UserCrmContext.__tablename__ == 'user_crm_contexts'"` | ✅ created by task | ⬜ pending |
| 33-01-02 | 01 | 1 | PERS-01 | T-33-02 / T-33-03 | `sanitize_field()`/`sanitize_free_text_with_pii()` redact PII + injection phrases at write time (D-06 first gate, D-07) | unit (TDD) | `cd backend && pytest tests/test_personalization_sanitizer.py -v` | ✅ created by task | ⬜ pending |
| 33-01-03 | 01 | 1 | PERS-01 | T-33-01 | Streaming `openpyxl` read (`read_only=True`) bounds memory; header validated whole-file before any row persists | unit (TDD) | `cd backend && pytest tests/test_crm_import_service.py -v` | ✅ created by task | ⬜ pending |
| 33-02-01 | 02 | 2 | PERS-01 | — | Import result persisted via `CrmImportLog`, not just returned once | integration (TDD) | `cd backend && alembic upgrade head && pytest tests/test_crm_import_service.py -v` | ✅ created by task | ⬜ pending |
| 33-02-02 | 02 | 2 | PERS-01 | T-33-04 / T-33-05 / T-33-07 | `require_role("admin")` on all 3 routes; extension+size cap before parse; result body never echoes `crm_notes`/PII | integration (TDD) | `cd backend && pytest tests/test_admin_crm.py -v` | ✅ created by task | ⬜ pending |
| 33-03-01 | 03 | 3 | PERS-01 | T-33-09 | Client-side `.xlsx`/4MB dropzone restriction (UX-only; real gate is 33-02 server-side) | frontend unit (TDD) | `cd frontend && npx tsc -b && node -e "const a=require('./public/locales/zh-CN/admin.json'); const b=require('./public/locales/en-US/admin.json'); const n1=require('./public/locales/zh-CN/nav.json'); const n2=require('./public/locales/en-US/nav.json'); if(!a.crmData||!b.crmData||!n1.crmData||!n2.crmData) process.exit(1); console.log('ok')"` | ✅ created by task | ⬜ pending |
| 33-03-02 | 03 | 3 | PERS-01 | T-33-08 / T-33-10 | Result card renders only `email`/`row`/`reason`; page nested under `AdminLayout`/`AdminRoute` guard | frontend unit (TDD) | `cd frontend && npx vitest run src/pages/admin/crm-data.test.tsx && npx tsc -b` | ✅ created by task | ⬜ pending |
| 33-03-03 | 03 | 3 | PERS-01 | T-33-11 | E2E covers full upload → result → template-download admin flow | E2E | `cd frontend && npx playwright test admin-crm-data.spec.ts --config=e2e/playwright.config.ts` | ✅ created by task | ⬜ pending |
| 33-04-01 | 04 | 4 | PERS-02 | T-33-05 | User-id-keyed rate-limit bucket is best-effort only; `get_current_user` remains real auth gate | smoke | `cd backend && alembic upgrade head && python -c "from app.models import PersonalizedAvatarSession; from app.services.rate_limit import limiter_user; print('ok')"` | ✅ created by task | ⬜ pending |
| 33-04-02 | 04 | 4 | PERS-02 | T-33-04 (IDOR) | `get_owned_session()` compares `session.user_id == user.id`; identical 404 for missing/foreign/expired/revoked | unit+integration (TDD) | `cd backend && pytest tests/test_personalized_session_service.py tests/test_personalized_avatar_api.py -v` | ✅ created by task | ⬜ pending |
| 33-04-03 | 04 | 4 | PERS-02 | T-33-06 / T-33-07 | Second sanitization gate re-applied at read time; degrades gracefully (returns "") when neither CRM nor preference data exists (D-08); `_load_preferences` isolated behind try/except ImportError since `UserPreference` (33-07) does not exist yet at this wave | unit (TDD) | `cd backend && pytest tests/test_personalization_injection_service.py -v` | ✅ created by task | ⬜ pending |
| 33-05-01 | 05 | 5 | PERS-02 | T-33-08 | `personalization_context` prepended as labeled `developer`-role item under fixed "## User Background" header (D-05 structural segregation) | unit (TDD) | `cd backend && pytest tests/test_agent_chat_service.py -v` | ✅ created by task | ⬜ pending |
| 33-05-02 | 05 | 5 | PERS-02 | T-33-11 | Exactly one `AvatarInteractionLog` row per turn, tagged `user_id`+`personalized_session_id` | unit (TDD) | `cd backend && pytest tests/test_personalized_avatar_service.py -v` | ✅ created by task | ⬜ pending |
| 33-05-03 | 05 | 5 | PERS-02 | T-33-09 | `get_owned_session` runs BEFORE any agent call; foreign `session_id` → 404, agent never invoked | integration (TDD) | `cd backend && pytest tests/test_personalized_avatar_api.py -v` | ✅ created by task | ⬜ pending |
| 33-06-01 | 06 | 6 | PERS-02 | T-33-13 | Only shared `apiClient` (JWT auto-attached) used; no client-supplied identity override | frontend unit (TDD) | `cd frontend && npx vitest run src/hooks/use-personalized-avatar-session.test.ts src/hooks/use-personalized-avatar-chat.test.ts src/api/personalized-avatar.test.ts` | ✅ created by task | ⬜ pending |
| 33-06-02 | 06 | 6 | PERS-02 | T-33-14 (accept) | Badge visibility is cosmetic only; no client-side authorization decision | frontend unit (TDD) | `cd frontend && npx vitest run src/pages/avatar-page.test.tsx && npx tsc -b` | ✅ created by task | ⬜ pending |
| 33-06-03 | 06 | 6 | PERS-02 | T-33-12 | E2E asserts no seeded CRM string ever appears in rendered `innerText` | E2E | `cd frontend && npx playwright test e2e/personalized-avatar-qa.spec.ts` | ✅ created by task | ⬜ pending |
| 33-07-01 | 07 | 7 | PERS-03 | T-33-07 | `Literal[PreferenceCategory]` rejects out-of-set categories with 422 before a row is built | smoke | `cd backend && alembic upgrade head && python -c "from app.models import UserPreference; from app.schemas.user_preference import PersonalizationSummary, UserPreferenceCreate, PREFERENCE_CATEGORIES; assert UserPreference.__tablename__ == 'user_preferences'; assert PREFERENCE_CATEGORIES == ['communication_style', 'focus_area', 'language_preference']"` | ✅ created by task | ⬜ pending |
| 33-07-02 | 07 | 7 | PERS-03 | T-33-04 / T-33-05 / T-33-06 / T-33-08 | Admin-only RBAC on every route; `id`+`user_id` compound filter on update/delete (IDOR); `sanitize_field()` reused on write; `max_length=500` bound | integration (TDD) | `cd backend && pytest tests/test_admin_user_preferences.py -v` | ✅ created by task | ⬜ pending |
| 33-08-01 | 08 | 8 | PERS-03 | — | N/A (typed API client + query hooks, no new trust boundary) | frontend unit (TDD) | `cd frontend && npx vitest run src/api/user-preferences.test.ts src/hooks/use-user-preferences.test.ts` | ✅ created by task | ⬜ pending |
| 33-08-02 | 08 | 8 | PERS-03 | T-33-10 | Component destructures/renders only `customer_name`/`company` from `PersonalizationSummary` — no `crm_notes`/`contact_person` field exists to leak | frontend unit (TDD) | `cd frontend && npx vitest run src/components/admin/user-personalization-dialog.test.tsx && npx tsc -b` | ✅ created by task | ⬜ pending |
| 33-08-03 | 08 | 8 | PERS-03 | T-33-11 (accept) | React JSX auto-escapes `{pref.value}`; no `dangerouslySetInnerHTML` | E2E | `cd frontend && npx playwright test e2e/admin-user-personalization.spec.ts --config=playwright.config.ts` | ✅ created by task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*"File Exists" reads ✅ because every task above is either `tdd="true"` (test written first, within the task's own RED step) or ships a direct migration/import smoke-check or Playwright spec as its sole automated verification — no task defers test creation to a later Wave 0 step.*

---

## Wave 0 Requirements

None. Every task in all 8 plans supplies a concrete `<automated>` command (verified: zero `MISSING` markers across `33-01` through `33-08`). `tdd="true"` tasks create their test file in the task's own RED step; the six non-TDD tasks (`33-01-01`, `33-04-01`, `33-07-01` — model/migration scaffolding; `33-03-03`, `33-06-03`, `33-08-03` — Playwright E2E) each carry a direct, already-runnable automated check. Existing pytest/pytest-asyncio/vitest/Playwright infrastructure covers all phase requirements with no new framework install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logged-in avatar page shows "专属模式" badge + personalized reply; logged-out flow unaffected | PERS-02 | `checkpoint:human-verify` in `33-06` (Task 2 gate) — visual badge placement and end-to-end login→chat feel benefit from human eyeballing before the automated E2E spec (33-06-03) is trusted as the regression guard | 1. Run `cd frontend && npx playwright test e2e/personalized-avatar-qa.spec.ts` once. 2. Manually: start backend+frontend, log in as a seeded user (with or without CRM data), open `/avatar`, confirm header shows email + "专属模式" badge (not "登录"), send a message, confirm a reply renders with no visible CRM text. 3. Log out, reload `/avatar`, confirm header reverts to "登录" and chat still works anonymously. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (zero `MISSING` markers found across `33-01` through `33-08`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task carries its own command; longest gap is the single `checkpoint:human-verify` in 33-06, immediately preceded and followed by automated tasks)
- [x] Wave 0 covers all MISSING references (none exist — see Wave 0 Requirements)
- [x] No watch-mode flags (`vitest run`, not `vitest watch`; `pytest -v`, no `--watch`)
- [x] Feedback latency < 90s (slowest single command is a Playwright spec)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned, not executed — this document reflects the revised 8-plan/8-wave structure as of this revision pass; sign-off boxes above describe the plan set's compliance with the Nyquist rule, not actual test-run results (no task has been executed yet).
