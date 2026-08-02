---
phase: 36-avatar-persona-selection-post-login-landing
verified: 2026-08-02T21:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 36: Avatar Persona Selection & Post-Login Landing Verification Report

**Phase Goal:** Admins manage a catalog of digital-human personas (CRUD, enabled flag, exactly one default); logged-in users switch persona in-page with persistence (`selected_persona_id` in UserPreference); persona resolution (voice fallback chain / greeting / prompt fragment injection) applied to real sessions for both anonymous and personalized paths; regular users land on `/` post-login while admins land on `/admin/dashboard`; `/user/dashboard` stays directly reachable (D-10).

**Verified:** 2026-08-02T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, mapped to plan-level truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can create/edit/enable-disable avatar personas and mark exactly one enabled persona as default | ✓ VERIFIED | `backend/app/api/admin_avatar_personas.py` full CRUD + `/set-default`; `avatar_persona_service.py`'s `set_default_persona()` bulk-clear-then-set transaction; 409 guard on disable/delete of current default (`update_persona`/`delete_persona`). 24 backend tests pass (`test_avatar_persona_service.py`, `test_admin_avatar_personas_api.py`). Admin UI (`persona-table.tsx`/`persona-dialog.tsx`) exercises this via `admin-avatar-personas.spec.ts` E2E (2/2 passed). |
| 2 | Anonymous visitors and logged-in users without a saved selection get the admin-marked default persona automatically — no forced selection page | ✓ VERIFIED | `resolve_active_persona()` precedence chain: explicit id → user preference → default; silent fallback (no exception) on disabled/unknown id (T-36-10/11). Seed script (`seed_data.py::seed_default_avatar_persona`) guarantees exactly one enabled default on fresh install. No selection-gate route exists in `router/index.tsx`. |
| 3 | A logged-in user can switch persona from an in-page entry on the avatar page (switch rebuilds session) and the choice persists as `selected_persona_id` | ✓ VERIFIED | `PersonaSwitcher` mounted in `avatar-page.tsx` header; switch handler disconnects → `useSetSelectedPersona()` PUT → reconnects with new `personaId` → speaks greeting via `sendTextMessage`. Backend `set_selected_persona()` upserts `UserPreference(category="selected_persona_id")`. `persona-switch.spec.ts` E2E (2/2 passed) proves rebuild + reload-persistence + anonymous-hidden. |
| 4 | After login, a regular user lands directly on `/` with personalized memory and remembered persona active; admins still land on `/admin/dashboard` | ✓ VERIFIED | `login.tsx` non-admin branch → `navigate("/")`; `GuestRoute` ternary else-branch → `"/"`; admin branches unchanged in both files. `post-login-landing.spec.ts` (3/3 passed) proves both landing outcomes + D-10 direct access. |
| 5 | The avatar session actually uses the active persona's character/style/voice and speaks its greeting; persona prompt fragment injected alongside CRM/preference context with existing sanitization | ✓ VERIFIED | `public_avatar.py` webrtc handler calls `resolve_active_persona()` + `resolve_voice_for_locale()` (3-tier fallback) and passes `greeting=persona.greeting` into `create_public_webrtc_session_config()`. `handle_anonymous_turn()` injects sanitized default-persona fragment alone; `handle_personalized_turn()` concatenates sanitized persona fragment ahead of CRM context. Two-gate sanitization (`sanitize_free_text_with_pii`) confirmed at both `create_persona`/`update_persona` (gate 1) and both chat handlers (gate 2). |
| 6 | `/user/dashboard` stays directly reachable by URL (D-10) | ✓ VERIFIED | `router/index.tsx` still registers `{ path: "dashboard" ... }` under `ProtectedRoute`; `AdminRoute`'s non-admin fallback and `routing.spec.ts` lines 36/40-45 unchanged; `routing.spec.ts` full run (7/7) + `post-login-landing.spec.ts`'s explicit D-10 test both pass. |

**Score:** 6/6 roadmap success-criteria truths verified (11/11 counting plan-level sub-truths across all 5 plans — see Required Artifacts / Key Links below for the full must_haves breakdown).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/avatar_persona.py` | `AvatarPersona(Base, TimestampMixin)` | ✓ VERIFIED | All D-01 fields present (name, character, style, voice_map, greeting, prompt_fragment, enabled, is_default) |
| `backend/alembic/versions/e38a_create_avatar_persona_table.py` | migration off `d37a_user_preference_table` | ✓ VERIFIED | `down_revision = "d37a_user_preference_table"`; `op.create_table` with all columns |
| `backend/app/schemas/avatar_persona.py` | Pydantic v2 schemas | ✓ VERIFIED | `AvatarPersonaCreate`/`Update`/`Out` present |
| `backend/app/services/avatar_persona_service.py` | CRUD + guard + resolvers | ✓ VERIFIED | All 10 exported functions present: `create_persona`, `list_personas`, `get_persona`, `update_persona`, `delete_persona`, `set_default_persona`, `_get_default_persona`, `resolve_active_persona`, `set_selected_persona`, `resolve_voice_for_locale` |
| `backend/app/api/admin_avatar_personas.py` | Admin CRUD router | ✓ VERIFIED | `prefix="/admin/avatar-personas"`, 6 routes (GET/POST/GET-by-id/PUT/DELETE/set-default) |
| `backend/app/api/avatar_personas.py` | Public enabled-only router | ✓ VERIFIED | `prefix="/personas"`, no auth dependency, `enabled_only=True` |
| `backend/app/api/user_persona_selection.py` | Self-service selected-persona endpoint | ✓ VERIFIED | `/api/v1/users/me/selected-persona` GET/PUT, JWT-gated |
| `backend/scripts/seed_data.py` | one default persona seed | ✓ VERIFIED | `seed_default_avatar_persona()`, idempotent, character="lisa" (not "jeff") |
| `frontend/src/api/avatar-personas.ts` | typed API client | ✓ VERIFIED | `avatarPersonasApi` (list/get/create/update/remove/setDefault) |
| `frontend/src/hooks/use-avatar-personas.ts` | TanStack Query hooks | ✓ VERIFIED | 5 hooks exported; 5/5 vitest tests pass |
| `frontend/src/components/admin/persona-dialog.tsx` / `persona-table.tsx` | Admin UI | ✓ VERIFIED | Both exist, render, and are exercised by E2E |
| `frontend/src/pages/admin/avatar-personas.tsx` | admin page | ✓ VERIFIED | Composes table + dialog; routed at `/admin/avatar-personas` |
| `frontend/src/hooks/use-selected-persona.ts` | user-facing hooks | ✓ VERIFIED | `useSelectedPersona`/`useSetSelectedPersona`/`useEnabledPersonas` |
| `frontend/src/components/avatar/persona-switcher.tsx` | switcher UI | ✓ VERIFIED | Hidden when unauthenticated (returns null); 5/5 vitest tests pass |
| `frontend/src/pages/login.tsx` / `frontend/src/router/auth-guard.tsx` | redirect targets | ✓ VERIFIED | Both changed to `"/"` for non-admin; admin branch and `AdminRoute` untouched |
| E2E specs (`admin-avatar-personas.spec.ts`, `persona-switch.spec.ts`, `post-login-landing.spec.ts`) | E2E coverage | ✓ VERIFIED | All present and passing (see Behavioral Spot-Checks) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `admin_avatar_personas.py` | `avatar_persona_service.py` | function calls | ✓ WIRED | create/update/delete/set_default calls confirmed by grep + passing tests |
| `main.py` | `admin_avatar_personas_router`, `avatar_personas_router`, `user_persona_selection_router` | `app.include_router` | ✓ WIRED | All 3 routers registered and imported |
| `public_avatar.py` webrtc handler | `resolve_active_persona` / `resolve_voice_for_locale` | function calls | ✓ WIRED | Confirmed at lines 84-91; `greeting=persona.greeting` passed through |
| `avatar_service.py::handle_anonymous_turn` | `stream_agent_response` | `personalization_context=` | ✓ WIRED | Sanitized persona fragment passed alone |
| `personalized_avatar_service.py::handle_personalized_turn` | `build_personalization_context` + persona fragment | string concatenation | ✓ WIRED | `"\n\n".join(filter(None, [sanitized_persona_fragment, crm_context]))` |
| `router/index.tsx` | `pages/admin/avatar-personas.tsx` | lazy route | ✓ WIRED | `path: "avatar-personas"` under AdminRoute > AdminLayout |
| `admin-layout.tsx` | `/admin/avatar-personas` | sidebar nav entry | ✓ WIRED | Inserted after `voiceLive`, `Smile` icon; `voice-live-proxy.spec.ts:489` still passes |
| `persona-switcher.tsx onSelect` | `PUT /api/v1/users/me/selected-persona` | `useSetSelectedPersona()` | ✓ WIRED | Confirmed in `avatar-page.tsx` switch handler |
| `avatar-page.tsx` switch handler | `fetchAnonymousWebrtcSession(...,personaId)` | disconnect/reconnect | ✓ WIRED | `attemptMicConnect(personaId)` called post-mutation-success |
| `login.tsx` onSuccess (non-admin) | `navigate("/")` | mutation callback | ✓ WIRED | Confirmed line 36 |
| `auth-guard.tsx` GuestRoute | `<Navigate to="/">` | ternary | ✓ WIRED | Confirmed; admin branch unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend persona/session/injection tests | `pytest tests/test_avatar_persona_service.py tests/test_admin_avatar_personas_api.py tests/test_avatar_personas_api.py tests/test_user_persona_selection_api.py tests/test_public_webrtc_session.py tests/test_avatar_service.py tests/test_personalized_avatar_service.py` | 80 passed | ✓ PASS |
| Frontend hook/switcher/locale-parity tests | `npx vitest run src/hooks/use-avatar-personas.test.ts src/components/avatar/persona-switcher.test.tsx src/i18n/locale-parity.test.ts` | 75 passed (3 files) | ✓ PASS |
| TypeScript build | `npx tsc -b` | zero errors | ✓ PASS |
| Persona/landing E2E suite | `npx playwright test e2e/admin-avatar-personas.spec.ts e2e/persona-switch.spec.ts e2e/post-login-landing.spec.ts e2e/routing.spec.ts` | 16 passed | ✓ PASS |
| Regression guard: admin sidebar "Voice Live" link | `npx playwright test e2e/voice-live-proxy.spec.ts -g "admin sidebar shows Voice Live link"` | 3 passed (incl. setup) | ✓ PASS |
| Regression guard: chrome-absence on `/` | `npx playwright test e2e/anonymous-avatar-qa.spec.ts` | 7 passed | ✓ PASS |
| voice-live-proxy.spec.ts full run | `npx playwright test e2e/voice-live-proxy.spec.ts e2e/anonymous-avatar-qa.spec.ts` | 22 passed, 4 failed | ✓ PASS (failures match deferred-items.md exactly: lines 176/380/519/536 — pre-existing, unrelated to Phase 36) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERSONA-01 | 36-01, 36-02 | Admin persona CRUD catalog | ✓ SATISFIED | Model/service/routers/UI all present, tested |
| PERSONA-02 | 36-01, 36-02 | Unique-default guard, seed | ✓ SATISFIED | `set_default_persona` transactional guard, 409 on disable/delete of default, seed produces exactly one default |
| PERSONA-03 | 36-04 | In-page switch + persistence | ✓ SATISFIED | `PersonaSwitcher` + `set_selected_persona` upsert, E2E persistence proof |
| PERSONA-04 | 36-03 | Session resolution (voice/greeting/prompt) | ✓ SATISFIED | `resolve_active_persona`/`resolve_voice_for_locale` wired into webrtc session + both chat handlers, two-gate sanitization |
| LAND-01 | 36-05 | Post-login landing redirect | ✓ SATISFIED | `login.tsx`/`auth-guard.tsx` redirect to `/` for regular users; admin unchanged; D-10 preserved |

No orphaned requirements found — REQUIREMENTS.md maps exactly these 5 IDs to Phase 36, and all 5 appear in plan frontmatter.

### Anti-Patterns Found

None. Scanned all key backend/frontend files created or modified by this phase for TODO/FIXME/placeholder/stub patterns — the single `placeholder` match is a legitimate HTML input placeholder attribute (`t("personas.namePlaceholder")`), not a stub indicator.

### Human Verification Required

None. All must-haves were verifiable via automated tests (pytest/vitest/Playwright) and direct codebase inspection (grep + file reads), and all checks passed. No visual/UX-quality or external-service-dependent items remained unverifiable.

### Gaps Summary

No gaps found. All 5 plans (36-01 through 36-05) were verified against the live codebase, not just their SUMMARY.md claims:
- Backend persona catalog, CRUD guard, and seed are real and tested (80 backend tests green).
- Persona resolution is genuinely wired into both the anonymous WebRTC session endpoint and both chat-injection handlers (grep-confirmed call sites, not just declared interfaces).
- The frontend switcher and admin UI are wired end-to-end (not stubs) — TanStack Query hooks call the real API client, components are mounted in real pages/routes, and Playwright E2E exercises the full user stories against a real running backend+frontend.
- The post-login landing redirect change is a real 2-line diff verified in both files, with the one intentional `routing.spec.ts` assertion change and the other two `/user/dashboard` references confirmed untouched.
- All previously-identified regression guards (`voice-live-proxy.spec.ts:489` sidebar link, `anonymous-avatar-qa.spec.ts` chrome-absence, `untranslated-whitelist.ts` at 15 entries) hold.
- The 4 `voice-live-proxy.spec.ts` failures reproduced during this verification match `deferred-items.md` exactly (lines 176, 380, 519, 536) — confirmed pre-existing and unrelated to Phase 36's changes.

---

*Verified: 2026-08-02T21:00:00Z*
*Verifier: Claude (gsd-verifier)*
