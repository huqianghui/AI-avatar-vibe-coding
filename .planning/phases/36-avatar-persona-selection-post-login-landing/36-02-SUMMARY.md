---
phase: 36-avatar-persona-selection-post-login-landing
plan: 02
subsystem: ui
tags: [react, typescript, tanstack-query, react-i18next, playwright, radix-ui, fastapi-client]

# Dependency graph
requires:
  - phase: 36-avatar-persona-selection-post-login-landing (36-01)
    provides: AvatarPersona backend CRUD catalog (/api/v1/admin/avatar-personas, /api/v1/personas), unique-default guard, seed data
provides:
  - Typed AvatarPersona API client (avatarPersonasApi) and TanStack Query hooks (useAvatarPersonas, useCreateAvatarPersona, useUpdateAvatarPersona, useDeleteAvatarPersona, useSetDefaultAvatarPersona)
  - Admin /admin/avatar-personas page (PersonaTable + PersonaDialog), sidebar nav entry, router registration
  - Full 5-locale i18n coverage for the persona catalog (admin.json `personas` namespace, nav.json `avatarPersonas` key)
  - Playwright E2E covering create/set-default/delete-guard/delete admin workflow
affects: [36-03-persona-03, 36-04-persona-04, 36-05-post-login-landing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-persona-id / data-testid row attributes on table rows for deterministic E2E targeting when visible text (character name, thumbnail alt) is ambiguous across rows"
    - "Allowlist-only character/style selection cloned from vl-instance-dialog.tsx's filteredAvatarItems grid (no free-text input) — T-36-05 mitigation"

key-files:
  created:
    - frontend/src/api/avatar-personas.ts
    - frontend/src/hooks/use-avatar-personas.ts
    - frontend/src/hooks/use-avatar-personas.test.ts
    - frontend/src/components/admin/persona-dialog.tsx
    - frontend/src/components/admin/persona-table.tsx
    - frontend/src/pages/admin/avatar-personas.tsx
    - frontend/e2e/admin-avatar-personas.spec.ts
  modified:
    - frontend/public/locales/{en-US,zh-CN,es-ES,es-MX,es-US}/admin.json
    - frontend/public/locales/{en-US,zh-CN,es-ES,es-MX,es-US}/nav.json
    - frontend/src/router/index.tsx
    - frontend/src/components/layouts/admin-layout.tsx

key-decisions:
  - "PersonaTable owns its own delete-confirmation Dialog and internally calls useDeleteAvatarPersona/useUpdateAvatarPersona/useSetDefaultAvatarPersona, exposing only onEdit up to the page — reduces prop-drilling since there's no shared delete-confirmation state needed"
  - "Table's Default column doubles as the set-default affordance: Badge when is_default, clickable 'Set as default' text otherwise — avoids a separate action/i18n key"
  - "Added data-testid/data-persona-id to table rows specifically to make E2E row-targeting deterministic, since a persona whose character/style clones the seeded character (e.g. 'lisa') shares ambiguous visible text (thumbnail alt, character label) with other rows"
  - "es-MX/es-US personas.* strings kept identical to es-ES (no avatar/tech-loanword content required regional variance), consistent with existing avatarCharacter/avatarStyle key precedent in the same files"

patterns-established:
  - "Deterministic E2E row identity: stamp data-persona-id={persona.id} on list-table rows whenever character/name text can collide across rows"

requirements-completed: [PERSONA-01, PERSONA-02]

# Metrics
duration: ~55min
completed: 2026-08-02
---

# Phase 36 Plan 02: Admin Avatar-Persona Management Frontend Summary

**Admin `/admin/avatar-personas` CRUD page (TanStack Query hooks + allowlist-only character/style dialog + catalog table) wired into the sidebar/router, with 5-locale i18n and a Playwright E2E covering the full create → set-default → delete-guard → delete workflow.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 18 (7 created, 11 modified, plus 1 deferred-items.md note)

## Accomplishments
- Typed `avatarPersonasApi` client + 5 TanStack Query hooks (`useAvatarPersonas`, `useCreateAvatarPersona`, `useUpdateAvatarPersona`, `useDeleteAvatarPersona`, `useSetDefaultAvatarPersona`), all invalidating the shared query key on mutation success
- `PersonaDialog`: create/edit dialog with Identity (name, Enabled/Set-as-default Switches), allowlist-only Character & Style grid (cloned from `vl-instance-dialog.tsx`, no free text — T-36-05 mitigation), per-locale Voice selects with a "(use default)" fallback option, Greeting/Prompt-fragment textareas
- `PersonaTable`: catalog table with thumbnail, Default badge/toggle, inline Enabled switch, Edit/Delete icon actions with permanent `aria-label` + tooltip, Delete disabled + guarded tooltip on the default row, and an internal plain-`Dialog` delete confirmation
- `/admin/avatar-personas` page + router registration + sidebar entry ("Avatar Personas" immediately after "Voice Live"), without disturbing the existing `voiceLive` nav item or `<nav>` structure
- Full 5-locale i18n (`personas` namespace in `admin.json`, `avatarPersonas` key in `nav.json`) with genuine translations; `untranslated-whitelist.ts` cap unchanged
- Playwright E2E (`admin-avatar-personas.spec.ts`) covering navigate → create → set-default → delete-guard → delete, using deterministic `data-persona-id` row targeting

## Task Commits

1. **Task 1: API client, TanStack Query hooks, and i18n keys** - `9aafef3` (feat)
2. **Task 2: PersonaDialog, PersonaTable, admin page, router + sidebar wiring** - `1128a5a` (feat)
3. **Task 3: Playwright E2E + full frontend regression gate** - `74069a4` (test)

## Files Created/Modified
- `frontend/src/api/avatar-personas.ts` - `avatarPersonasApi` typed client (list/get/create/update/remove/setDefault)
- `frontend/src/hooks/use-avatar-personas.ts` - TanStack Query hooks, `avatar-personas` query key
- `frontend/src/hooks/use-avatar-personas.test.ts` - 5 hook test suites (Vitest)
- `frontend/src/components/admin/persona-dialog.tsx` - `PersonaDialog` create/edit form
- `frontend/src/components/admin/persona-table.tsx` - `PersonaTable` catalog table + delete confirmation
- `frontend/src/pages/admin/avatar-personas.tsx` - page composing table + dialog + header
- `frontend/e2e/admin-avatar-personas.spec.ts` - Playwright E2E for the admin CRUD story
- `frontend/public/locales/*/admin.json` (5 locales) - new `personas` namespace
- `frontend/public/locales/*/nav.json` (5 locales) - new `avatarPersonas` key
- `frontend/src/router/index.tsx` - registered `avatar-personas` route
- `frontend/src/components/layouts/admin-layout.tsx` - added `Smile`-icon sidebar entry

## Decisions Made
- See `key-decisions` in frontmatter above (row-identity data attribute, table Default-column dual purpose, dialog/table ownership split, es-MX/es-US translation reuse).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ambiguous text-based E2E row matching required a test-hook attribute**
- **Found during:** Task 3 (E2E authoring)
- **Issue:** Identifying "the seeded default persona's row" purely by visible text (`getByRole("heading")`, `hasText: "Lisa"`, or exact-cell accessible-name matching) was unreliable: the admin-layout `Breadcrumb` renders a duplicate `h2` heading with the same page title as the page's own `h1` (strict-mode violation), and the character thumbnail's `<img alt="Lisa">` plus the Character & Style column text make any row using the "lisa" character match "Lisa" text/accessible-name queries — including a newly created test persona that clones the seeded character/style.
- **Fix:** (a) Scoped the page-title heading assertion to `level: 1` to disambiguate from the breadcrumb's `h2`. (b) Added `data-testid="persona-row"` and `data-persona-id={persona.id}` to `PersonaTable`'s `<tr>` elements, and rewrote the E2E test to capture the initial default persona's id from the DOM before mutating anything, then target rows by that id (or by the newly-created persona's id returned in the create-response body) for all subsequent assertions/actions — eliminating all text-based ambiguity.
- **Files modified:** `frontend/src/components/admin/persona-table.tsx`, `frontend/e2e/admin-avatar-personas.spec.ts`
- **Verification:** `npx playwright test e2e/admin-avatar-personas.spec.ts` — 4/4 passed (repeatably, across 3 consecutive runs after the fix)
- **Committed in:** `74069a4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, test-authoring only — no production-code defect beyond the added test-hook attributes)
**Impact on plan:** No scope creep; the `data-persona-id` attribute is a minimal, low-risk addition solely to make the table's rows reliably addressable, consistent with the plan's own emphasis on precise UI-SPEC compliance.

## Issues Encountered
- The dev SQLite DB (`backend/ai_coach.db`) had drifted from its pristine seed state during iterative E2E debugging (several failed early runs left orphaned `E2E Persona *` rows and no longer had the originally-seeded "Lisa" persona as default, since `seed_default_avatar_persona()` is idempotent and skips once any row exists). Restored the clean single-default-"Lisa" seed state directly via SQLite before the final passing gate run, matching `seed_data.py`'s original fields exactly.
- `voice-live-proxy.spec.ts` has 4 pre-existing failures unrelated to this plan's changes (real Azure Voice Live connection timing, a missing "Dr. Zhang Wei" HCP seed profile, a missing batch-resync button, a missing session-end "Continue" button) — reproduced identically before and after this plan's edits, confirming they are not caused by the sidebar/router changes. Logged to `deferred-items.md` per the scope-boundary rule; not fixed. The plan's own regression guard, `voice-live-proxy.spec.ts:489` ("admin sidebar shows Voice Live link"), passes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useAvatarPersonas`/`useCreateAvatarPersona`/`useUpdateAvatarPersona`/`useDeleteAvatarPersona`/`useSetDefaultAvatarPersona` and the `avatarPersonasApi` client are stable public interfaces ready for 36-03/36-04 (persona selection/session application) and 36-05 (post-login landing) to consume.
- The `data-persona-id` row-identity pattern established here is reusable for any future admin table needing deterministic E2E targeting.
- No blockers identified for 36-03+.

---
*Phase: 36-avatar-persona-selection-post-login-landing*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commit hashes (`9aafef3`, `1128a5a`, `74069a4`) verified present in `git log`.
