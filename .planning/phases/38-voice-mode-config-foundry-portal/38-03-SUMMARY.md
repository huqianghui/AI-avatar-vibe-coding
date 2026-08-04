---
phase: 38-voice-mode-config-foundry-portal
plan: 03
subsystem: ui
tags: [react, i18n, playwright, vitest]

# Dependency graph
requires:
  - phase: 38-voice-mode-config-foundry-portal (Plan 38-02)
    provides: "Shared, standalone AvatarCharacterGallery component and voice-constants.ts locale exports (SUPPORTED_VOICE_LOCALES/LOCALE_FLAGS/LOCALE_LABEL_KEY)"
provides:
  - "Persona editor's Character & Avatar card delegating to the shared AvatarCharacterGallery component, with zero local gallery-state duplication"
  - "Persona editor's locale constants sourced from voice-constants.ts, matching the HCP editor exactly"
  - "Speech card retitled to 'Speech output' (or locale-equivalent) phrasing across all 5 locales"
  - "E2E coverage proving the shared gallery renders in the persona editor and a selection persists across save + reload"
affects: [admin-avatar-personas, hcp-profile-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persona editor and HCP editor now both consume AvatarCharacterGallery and voice-constants.ts as their single source of truth for the avatar picker and locale metadata"

key-files:
  created: []
  modified:
    - frontend/src/pages/admin/persona-editor.tsx
    - frontend/src/pages/admin/persona-editor.test.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/es-ES/admin.json
    - frontend/public/locales/es-MX/admin.json
    - frontend/public/locales/es-US/admin.json
    - frontend/e2e/admin-avatar-personas.spec.ts

key-decisions:
  - "Verified gallery-selection persistence via the same border-primary selection-ring class re-located by its stable avatar-item-* data-testid, rather than relying on any DOM attribute exposed by AvatarView (the real component exposes no such attribute outside unit-test mocks)"
  - "Selected Harry/business as the non-default character/style in the new E2E test, distinct from the seeded default persona's Lisa/casual-sitting"

requirements-completed: [VMODE-02]

# Metrics
duration: 22min
completed: 2026-08-04
---

# Phase 38 Plan 03: Persona Editor Foundry-Portal Parity Summary

**Swapped persona-editor.tsx's duplicated inline avatar gallery for the shared `AvatarCharacterGallery` component built in Plan 38-02, deduped its private locale constants against `voice-constants.ts`, and retitled the Speech card to "Speech output" phrasing across all 5 locales.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-04T14:00:00+08:00 (approx.)
- **Completed:** 2026-08-04T14:22:00+08:00 (approx.)
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced Card #2's inline filter-button row + `filteredAvatarItems.map` grid with a single `<AvatarCharacterGallery character={form.character} style={form.style} onSelect={...} />` call, deleting the now-dead `AvatarGridItem` type, `avatarFilter`/`setAvatarFilter` state, `filteredAvatarItems` memo, `failedThumbnailsRef`/`handleThumbnailError`, and the unused `AVATAR_CHARACTERS`/`getAvatarInitials`/`cn` imports
- Replaced the private `PERSONA_VOICE_LOCALES`/`FLAGS`/`LOCALE_LABEL_KEY` constants with imports of `SUPPORTED_VOICE_LOCALES`/`LOCALE_FLAGS`/`LOCALE_LABEL_KEY` from the shared `voice-constants.ts`, renaming all in-file call sites
- Retitled `personas.editor.speechSectionTitle`'s translated VALUE (key unchanged) to portal-style "Speech output" phrasing in all 5 locales: en-US "Speech output", zh-CN "语音输出", es-ES/es-MX/es-US "Salida de voz"
- Added 2 new unit tests: one asserting the shared gallery's `avatar-character-grid` test-id renders (proving the swap, not a coincidental pass-through), and one reading the en-US locale JSON value directly to guard the "output" phrasing without hardcoding every locale's exact string
- Added a new E2E test proving the shared `AvatarCharacterGallery` renders (filter buttons + grid container) in the persona editor, that a non-default character/style selection (Harry/business) can be made through it, and that the selection survives a save + page reload

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap in AvatarCharacterGallery, dedupe locale constants, retitle Speech card** - `9e56808` (feat)
2. **Task 2: Extend persona E2E coverage for the shared gallery** - `025299e` (test)

**Plan metadata:** this SUMMARY.md commit (docs)

## Files Created/Modified
- `frontend/src/pages/admin/persona-editor.tsx` - Character & Avatar card now delegates to `<AvatarCharacterGallery>`; locale constants imported from `voice-constants.ts`; all local avatar-gallery state/types deleted
- `frontend/src/pages/admin/persona-editor.test.tsx` - Added a gallery-render assertion (`avatar-character-grid` test-id) and a locale-JSON-value assertion for the "Speech output" retitle
- `frontend/public/locales/{en-US,zh-CN,es-ES,es-MX,es-US}/admin.json` - Updated `personas.editor.speechSectionTitle`'s translated VALUE only (key unchanged)
- `frontend/e2e/admin-avatar-personas.spec.ts` - New test: shared gallery renders + a Harry/business selection persists across save + reload; added `galleryPersonaId` teardown tracking

## Decisions Made
- Persistence verification in the E2E test uses the gallery item's `border-primary` selection-ring class (re-located by its stable `avatar-item-*` data-testid after reload) instead of any `AvatarView` DOM attribute, since the real (non-mocked) `AvatarView` component exposes no `data-avatar-character`/`data-avatar-style` attribute -- that attribute only exists in the persona-editor unit test's `vi.mock` of `AvatarView`, not in production markup
- Chose Harry/business as the E2E test's non-default character/style, distinct from the seeded default persona's Lisa/casual-sitting, to make the persistence assertion unambiguous

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pre-existing unrelated test failure** (not fixed, out of scope per the deviation rules' scope boundary, already logged in `deferred-items.md` from Plan 38-02): `frontend/src/pages/login.test.tsx > LoginPage > navigates user to /user/dashboard on login success` fails on the full `npx vitest run` pass (`/` vs `/user/dashboard`). `login.tsx`/`login.test.tsx` were not read or touched by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Persona editor and HCP profile editor now share one avatar-gallery implementation and one locale-constants module -- no further dedup work needed for these two pages
- No blockers. The `login.test.tsx` failure (pre-existing, unrelated) remains open and tracked in Plan 38-02's `deferred-items.md`

## Final Verification Results
- `cd frontend && npx vitest run src/pages/admin/persona-editor.test.tsx` -- 34/34 passed
- `cd frontend && npx tsc -b` -- clean
- `cd frontend && npx playwright test --config=e2e/playwright.config.ts admin-avatar-personas.spec.ts` -- 5/5 passed (including the new gallery-persistence test)
- `cd frontend && npx vitest run` (full suite) -- 2677/2678 passed; 1 pre-existing unrelated failure (`login.test.tsx`), not fixed per scope boundary, already logged in Plan 38-02's `deferred-items.md`
- `cd frontend && npm run build` -- passes (pre-existing large-chunk warning only, unrelated to this plan)

---
*Phase: 38-voice-mode-config-foundry-portal*
*Completed: 2026-08-04*
