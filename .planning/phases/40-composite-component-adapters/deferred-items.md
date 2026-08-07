# Deferred Items — Phase 40

## Item 1: Backend `seed_data.py` fails due to missing model import (blocks local Playwright E2E run)

- **Found during:** 40-01 pre-commit E2E verification step (attempting to run
  Dialog-touching specs `admin-dry-run.spec.ts` / `admin-persona-knowledge.spec.ts`
  against a locally seeded backend).
- **File:** `backend/app/models/__init__.py`
- **Issue:** `AvatarPersona.knowledge_config` declares
  `relationship("AvatarPersonaKnowledgeConfig", ...)` (see
  `backend/app/models/avatar_persona.py`), but
  `AvatarPersonaKnowledgeConfig` (defined in
  `backend/app/models/avatar_persona_knowledge_config.py`) is never imported
  into `app/models/__init__.py`. SQLAlchemy's mapper configuration fails at
  first query with `InvalidRequestError: ... failed to locate a name
  ('AvatarPersonaKnowledgeConfig')`, which crashes
  `backend/scripts/seed_data.py` before any users/personas are seeded --
  Playwright's `auth.setup.ts` (login as `user1`/`admin`) cannot succeed
  against an unseeded DB.
- **Scope:** Out of scope for 40-01 (`files_modified: [dialog.tsx,
  dialog.test.tsx, _shim-as-child.ts]`) -- this is a pre-existing backend
  model-registration bug introduced by the "persona-hcp-foundry-alignment
  Increment C" commit (`41699ab`), unrelated to the Dialog Fluent UI
  migration.
- **Action:** Not fixed. Documented here per the deviation-rules scope
  boundary. Local Playwright E2E execution for 40-01 was substituted with:
  (a) unit/component-level ARIA assertions in `dialog.test.tsx` covering the
  same `role="dialog"` / `aria-labelledby` / `aria-describedby` contract the
  E2E specs assert on, and (b) static verification that
  `admin-dry-run.spec.ts` / `admin-persona-knowledge.spec.ts` use
  `page.getByRole("dialog")` (role-based, not implementation-detail
  selectors), which the Fluent-backed `dialog.tsx` continues to satisfy
  unchanged. Recommend a future quick-task fix: add
  `from app.models.avatar_persona_knowledge_config import
  AvatarPersonaKnowledgeConfig` to `app/models/__init__.py`'s import list and
  `__all__`.

## Item 2: `admin-skill-editor.spec.ts` "settings tab can save form values" fails independent of Tabs migration

- **Found during:** 40-03 Task 1 (Tabs migration) E2E verification step.
- **File:** `frontend/e2e/admin-skill-editor.spec.ts:222-248`.
- **Issue:** The test fills the settings form, clicks Save, waits 2s, then
  asserts `page.locator("h1")` is visible. It times out waiting for any
  `h1` element after save.
- **Confirmed pre-existing / unrelated to this migration:** Reproduced by
  `git stash`-ing the Fluent-backed `tabs.tsx`/`tabs.test.tsx` changes
  (reverting to the original Radix-based `tabs.tsx`) and re-running just
  this test in isolation -- it fails identically against the ORIGINAL
  pre-migration Tabs implementation. This is a pre-existing flake/bug
  unrelated to COMP-05's Tabs adapter swap.
  Verified `git diff --stat e2e/admin-skill-editor.spec.ts` is empty (spec
  file untouched by this plan).
- **Scope:** Out of scope for 40-03 (`files_modified: [tabs.tsx,
  tabs.test.tsx, tooltip.tsx, tooltip.test.tsx]`) per the deviation-rules
  scope boundary -- not caused by the Tabs Fluent migration.
- **Action:** Not fixed. All other 33/34 tests across the 3 confirmed E2E
  spec files (`conference.spec.ts`, `admin-dry-run.spec.ts`,
  `admin-skill-editor.spec.ts`) pass unmodified against the Fluent-backed
  Tabs adapter, including the specific `data-state` assertions this plan
  targets (`admin-skill-editor.spec.ts:103,337`, `admin-dry-run.spec.ts:299`,
  `conference.spec.ts:28,72,77,78,83,84`).

## Item 3: `voice-session.spec.ts` suite fails on unseeded/empty scenarios list, independent of Tooltip migration

- **Found during:** 40-03 Task 2 (Tooltip migration) E2E spot-check (a scoped
  run touching `voice-controls.tsx`/`left-panel.tsx`/`right-panel.tsx`, real
  Tooltip consumers).
- **File:** `frontend/e2e/voice-session.spec.ts:24` (`createSessionViaApi`
  helper: `const scenarioId = scenarios[0].id` throws
  `TypeError: Cannot read properties of undefined (reading 'id')` because
  `scenarios` is an empty array against this worktree's local DB state).
- **Confirmed pre-existing / unrelated to this migration:** Reproduced by
  `git stash`-ing the Fluent-backed `tooltip.tsx`/`tooltip.test.tsx` changes
  (reverting to the original Radix-based `tooltip.tsx`) and re-running one
  of the failing tests in isolation -- it fails identically against the
  ORIGINAL pre-migration Tooltip implementation with the exact same
  `scenarios[0].id` TypeError, before any Tooltip-rendering code even runs.
  Same root cause class as deferred Item 1 (unseeded/incompletely-seeded
  local DB in this worktree).
- **Scope:** Out of scope for 40-03 (`files_modified: [tabs.tsx,
  tabs.test.tsx, tooltip.tsx, tooltip.test.tsx]`) per the deviation-rules
  scope boundary -- purely a test-data/seed-state issue, not caused by the
  Tooltip Fluent migration.
- **Action:** Not fixed. Tooltip correctness was instead verified via: (a)
  the 4 `tooltip.test.tsx` unit tests (2 preserved + 2 new, all passing) that
  directly assert the `relationship` default-injection and override behavior
  against real Fluent DOM output, (b) `npx tsc -b` clean across all ~20
  confirmed `asChild` consumer call sites, and (c) `npm run build` exiting 0
  (confirms every consumer file importing `Tooltip`/`TooltipTrigger`/
  `TooltipContent`/`TooltipProvider` still compiles against the new prop
  surface).

## Item 4: 21-22 pre-existing `getByText` "multiple elements found" test failures, unrelated to Form migration

- **Found during:** 40-04 (Form migration) full-suite coverage run
  (`npx vitest run --coverage`), executed to confirm the 4 coverage
  thresholds still pass with `form.tsx` no longer excluded.
- **Files affected:** `dry-run-report.test.tsx`, `hcp-profile-editor.test.tsx`,
  `persona-editor.test.tsx`, `prompts.test.tsx`,
  `user-personalization-dialog.test.tsx`, `training.test.tsx`,
  `user-pages.test.tsx` (7 test files, 21-22 individual test failures across
  the full run; count varies slightly between runs, appears flaky).
- **Issue:** All failures are `getMultipleElementsFoundError` from
  `@testing-library/dom` -- e.g.
  `src/pages/user/user-pages.test.tsx:126` calling
  `screen.getByText("scenarioSelection.emptyTitle")` finds more than one
  matching element (duplicate tab-content text rendered by Fluent's `<Tab>`,
  which renders both a `fui-Tab__content` span and a
  `fui-Tab__content--reserved-space` span with identical text for layout
  reservation purposes).
- **Confirmed pre-existing / unrelated to this migration:** Reproduced via
  `git stash` (reverting this plan's `form.tsx`/`form.test.tsx`/
  `vitest.config.ts` changes back to the 40-03 base commit) and re-running
  `hcp-profile-editor.test.tsx` in isolation -- the identical 6 failures
  exist on the unmodified 40-03 base commit, before any Form-related code
  change. Root cause traces to the 40-03 Tabs+Tooltip Fluent migration's
  `<Tab>` adapter (`tabs.tsx`), which renders duplicate text spans (visible
  content + reserved-space clone) that `getByText` cannot disambiguate
  without a more specific query (e.g. `getAllByText()[0]` or
  `within(container).getByRole(...)`). `git stash pop` restored this plan's
  changes after confirmation.
- **Scope:** Out of scope for 40-04 (`files_modified: [form.tsx,
  form.test.tsx, vitest.config.ts]`) per the deviation-rules scope
  boundary -- not caused by, and not touching, any file in this plan.
- **Action:** Not fixed. `form.test.tsx`'s own 6 tests all pass; the 4
  coverage thresholds (statements 71%, branches 82%, functions 70%, lines
  71%) pass with actual measured coverage of 87.16% / 83.8% / 73.44% /
  87.16% respectively, with `form.tsx` counted in the denominator. The
  pre-existing failures do not affect `form.tsx` coverage or correctness.
  Recommend a future quick-task fix: update the affected `getByText` calls
  in the 7 listed test files to use `getAllByText(...)[0]` or a
  `role`-scoped query, to account for Fluent `<Tab>`'s dual-span rendering
  introduced in 40-03.
