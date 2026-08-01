---
phase: 34-spanish-es-i18n
plan: 05
subsystem: i18n
tags: [i18next, translation, locale-parity, playwright, e2e, admin-settings, gate]

# Dependency graph
requires:
  - phase: 34-spanish-es-i18n
    plan: 02
    provides: Full es-ES/es-MX/es-US translations for admin.json/voice.json/avatar.json; untranslated-whitelist.ts filled to its 15-entry hard cap
  - phase: 34-spanish-es-i18n
    plan: 03
    provides: Full es-ES/es-MX/es-US translations for analytics.json/dashboard.json/nav.json/training.json/scoring.json/conference.json
  - phase: 34-spanish-es-i18n
    plan: 04
    provides: Full es-ES/es-MX/es-US translations for session.json/skill.json/meta-skill.json/auth.json/coach.json/prompts.json; full 16x5 parity suite green (65/65)
provides:
  - "LANG-01 closed: full 16-namespace x 5-locale parity suite verified green as a hard gate, settings.tsx's secondary language Select extended from 2 to 5 options, and a new Playwright E2E spec proves real translated UI + localStorage persistence for all 3 es-* locales with zero i18next missing-key warnings"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radix Select dropdown items are testable in jsdom via userEvent.click on the role=combobox trigger followed by screen.findAllByRole('option') -- no @/components/ui mocking needed for this codebase's existing pointer-capture polyfill in src/test/setup.ts"
    - "Playwright dropdown-item text matching for LanguageSwitcher must use getByRole('menuitem', { name: label }) (substring match), not getByText(label, { exact: true }) -- the flag emoji renders in a sibling <span>, so no single DOM element's full text content equals the bare label alone"

key-files:
  created:
    - frontend/e2e/language-switcher-es.spec.ts
  modified:
    - frontend/src/pages/admin/settings.tsx
    - frontend/src/pages/admin/settings.test.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Task 1 (full parity suite) required zero fixes -- 34-04 already left the full unfiltered locale-parity.test.ts suite green (65/65); re-ran it here as the plan's mandated hard-gate verification, no locale JSON or whitelist changes needed, so no commit was made for that verification-only task"
  - "E2E spec uses /login as its base route instead of the plan's literal '/' instruction -- AvatarPage (the '/' route) does not render <LanguageSwitcher /> at all (confirmed by reading avatar-page.tsx in full); the switcher only lives in auth-layout.tsx (/login), user-layout.tsx, and admin-layout.tsx. /login was chosen because it needs zero auth/session mocking, matching the plan's own interface note that no avatar-session mocking is needed for this spec (Rule 3: auto-fixed blocking issue -- the literal target route has no switcher element to interact with)"
  - "Playwright dropdown click uses getByRole('menuitem', { name: label }) instead of the plan-suggested getByText(label, { exact: true }) -- the flag emoji lives in a sibling <span> inside the same DropdownMenuItem, so no element's full text equals the bare label; substring-matching by accessible name (which Playwright computes from the whole subtree) resolves reliably (Rule 1: auto-fixed test-locator bug discovered while running Task 3)"
  - "E2E translated-text assertion uses auth.json's email label ('Correo Electrónico', identical across all 3 es-* variants but genuinely different from the en-US source 'Email') rather than a per-variant-unique string, satisfying the plan's 'differs from en-US source' requirement without needing a per-variant-unique UI string"

requirements-completed: [LANG-01]

# Metrics
duration: ~40min
completed: 2026-08-02
---

# Phase 34 Plan 05: LANG-01 Closing Gate — Full Parity Hard Gate + Settings Select Parity + Playwright E2E Summary

**Closed LANG-01 by re-verifying the full 16-namespace x 5-locale parity suite as a hard gate (already green from 34-04), extending `settings.tsx`'s secondary language `<Select>` from 2 to 5 options for UI-SPEC consistency, and adding a Playwright E2E spec that proves real translated UI + `localStorage` persistence for es-ES/es-MX/es-US with zero i18next missing-key warnings.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-02
- **Tasks:** 3
- **Files created:** 1 (E2E spec); 3 modified (settings.tsx, settings.test.tsx, REQUIREMENTS.md)

## Accomplishments
- Re-ran the full unfiltered `locale-parity.test.ts` suite as the mandated hard gate: **65/65 tests pass**, 16 namespaces x 5 locales, zero failures — confirms 34-04's work left no regressions
- Extended `frontend/src/pages/admin/settings.tsx`'s "Language Settings" card `<Select>` from 2 (`zh-CN`/`en-US`) to 5 options, adding `es-ES`/`es-MX`/`es-US` `<SelectItem>` entries using the existing `tc(...)` translation pattern — resolves UI-SPEC's flagged Concern #1, purely cosmetic per threat register T-34-06 (accept, no backend mutation path)
- Added a new test to `settings.test.tsx` that opens the real (non-mocked) Radix `<Select>` via `userEvent.click` on the `combobox` role and asserts all 5 `option` elements render with the correct native-language labels
- Created `frontend/e2e/language-switcher-es.spec.ts`: 3 Playwright tests (one per es-* locale) that, against the real running app on `/login`, click the language-switcher trigger and dropdown item, assert `localStorage.getItem("i18nextLng")` matches the target locale, assert the switcher trigger re-renders with the "ES" 2-letter chip, assert real translated UI text is visible (`auth.json`'s "Correo Electrónico" email label, differing from the en-US "Email" source), and assert zero browser console messages matching `/missingKey/i` throughout the flow
- `npx tsc -b`: no type errors
- Full `npm test` (vitest): **214 test files, 2602 tests, all green**
- **LANG-01 marked complete** in `.planning/REQUIREMENTS.md` (checkbox + traceability table status)

## Task Commits

Each task was committed atomically (Task 1 required no code changes, so it has no commit):

1. **Task 1: Run full parity suite as hard gate** — no commit (verification-only; already green from 34-04, zero fixes needed)
2. **Task 2: Extend settings.tsx language Select to 5 options + update test** — `c0e4adf` (feat)
3. **Task 3: Playwright E2E for es-* language switch** — `8c275bc` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `frontend/e2e/language-switcher-es.spec.ts` — new, 3 Playwright tests (es-ES/es-MX/es-US) proving live-app locale switch + translated UI + no missing-key warnings
- `frontend/src/pages/admin/settings.tsx` — added 3 `<SelectItem>` entries (`es-ES`/`es-MX`/`es-US`) to the Language Settings `<Select>`
- `frontend/src/pages/admin/settings.test.tsx` — added a test opening the real Select and asserting all 5 options render
- `.planning/REQUIREMENTS.md` — LANG-01 checkbox and traceability status marked Complete

## Decisions Made
- Task 1 needed zero fixes since the full parity suite was already green from 34-04 — ran it as the plan's mandated hard-gate verification, not as remediation work; no commit was created for it since no files changed
- Chose `/login` over the plan's literal `/` for the E2E spec's base route, since `AvatarPage` (the `/` route) renders no `LanguageSwitcher` at all — `/login` is the only public route needing zero session/auth mocking that also has the switcher, matching the plan's own "no avatar-session mocking needed" interface note
- Switched the dropdown-item locator from `getByText(label, { exact: true })` to `getByRole("menuitem", { name: label })` after the exact-text locator timed out in a first test run — the flag emoji renders in a sibling `<span>` inside the same `DropdownMenuItem`, so no element's full text content equals the bare label alone; role-based accessible-name matching (substring) resolves this reliably
- Used the `auth.json` `email` label ("Correo Electrónico") as the translated-UI-text assertion — it is identical across all 3 es-* variants but genuinely differs from the en-US source ("Email"), satisfying the plan's "differs from en-US" requirement for a stable, easy-to-assert string

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Plan's literal `/` E2E base route has no LanguageSwitcher to interact with**
- **Found during:** Task 3, initial spec authoring
- **Issue:** The plan instructed navigating to `/` (`AvatarPage`) to exercise the language switcher. Reading `avatar-page.tsx` in full confirmed it never imports or renders `<LanguageSwitcher />` — the component only exists inside `auth-layout.tsx` (`/login`), `user-layout.tsx`, and `admin-layout.tsx`. Using the literal route would make every test permanently fail to find the trigger button.
- **Fix:** Used `/login` instead — public, requires no auth/session mocking (consistent with the plan's own "no avatar-session mocking needed" note), and renders the switcher via `AuthLayout`.
- **Files modified:** `frontend/e2e/language-switcher-es.spec.ts`
- **Verification:** All 3 tests pass against the real dev/backend servers started by `playwright.config.ts`'s `webServer` config.
- **Committed in:** `8c275bc`

**2. [Rule 1 - Bug] `getByText(label, { exact: true })` locator timed out on the dropdown item**
- **Found during:** Task 3, first Playwright test run (all 3 tests failed on 30s timeouts)
- **Issue:** `LanguageSwitcher`'s `DropdownMenuItem` renders `<span>{flag}</span>{label}` — the flag is in a sibling element and the label is a raw text node in the same parent, so the menu item's own full text content is `"🇪🇸 Español (España)"`, never exactly `"Español (España)"` alone. `exact: true` text matching never resolved.
- **Fix:** Switched to `page.getByRole("menuitem", { name: label })`, which matches on Playwright's computed accessible name via substring, resolving the same element reliably.
- **Files modified:** `frontend/e2e/language-switcher-es.spec.ts`
- **Verification:** Re-ran `npm run test:e2e -- language-switcher-es.spec.ts` — all 3 tests pass in ~3.4s each (down from 30s timeouts).
- **Committed in:** `8c275bc`

No other deviations — Task 1 and Task 2 executed exactly as written.

## Issues Encountered
None blocking beyond the two auto-fixed items documented above.

## User Setup Required
None — no external service configuration required. No push performed in this session (per standard GSD plan-executor scope; user may push separately per CLAUDE.md's commit-and-push directive).

## Next Phase Readiness
- **LANG-01 is now fully closed**: 16x5 parity suite green (65/65), settings.tsx consistent across all 5 locales, Playwright E2E proves live-app translated rendering + persistence + zero missing-key fallback for all 3 es-* variants
- LANG-02 (voice: es-* neural voice, voice_map extension, refusal templates, mid-session rebuild) may now begin per CLAUDE.md's per-requirement sequencing rule — this plan is the mandated gate that unblocks it
- `untranslated-whitelist.ts` remains at 15/15 (unchanged by this plan)
- Full `npm test` (2602 tests) and `npx tsc -b` both green at the close of this plan — no known regressions carried forward

---
*Phase: 34-spanish-es-i18n*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created/modified files (`frontend/e2e/language-switcher-es.spec.ts`, `frontend/src/pages/admin/settings.tsx`, `frontend/src/pages/admin/settings.test.tsx`, this SUMMARY.md) verified present on disk; both task commit hashes (`c0e4adf`, `8c275bc`) verified present in git history.
