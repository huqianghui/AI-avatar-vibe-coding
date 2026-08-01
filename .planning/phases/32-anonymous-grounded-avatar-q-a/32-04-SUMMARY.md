---
phase: 32-anonymous-grounded-avatar-q-a
plan: 04
subsystem: ui
tags: [react, tanstack-query, i18next, tailwind-v4, react-router-v7, radix-ui, sonner, vitest]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a plan 02
    provides: POST /public/avatar/chat (ChatResponse { answer, citations, is_refusal }), X-Anon-Session trust boundary
  - phase: 32-anonymous-grounded-avatar-q-a plan 03
    provides: frontend/src/api/public-avatar.ts (createAnonymousSession, sendAnonymousChat), frontend/src/hooks/use-anonymous-voice-live.ts (audio-only WebRTC hook)
provides:
  - frontend/src/hooks/use-anonymous-avatar-session.ts — React-state-only anonymous session lifecycle (never localStorage), renewSession() for silent 401 recovery
  - frontend/src/hooks/use-anonymous-avatar-chat.ts — useMutation wrapper over sendAnonymousChat, detects 401 via real Error-message shape and calls onUnauthorized
  - frontend/src/components/avatar/sources-panel.tsx — structurally separate citation sidebar (loading/populated/empty-pre-question/empty-no-match), never destructive-styled on refusal
  - frontend/src/components/avatar/avatar-input-bar.tsx — text + mic input bar, rate-limit disables only send
  - frontend/src/components/avatar/mic-permission-dialog.tsx — getUserMedia-denial guidance dialog with text-input fallback
  - frontend/src/pages/avatar-page.tsx — composed root page at `/`, wiring all of the above plus AvatarView/VoiceTranscript
  - "/" route now renders AvatarPage with no auth guard (was Navigate to /login)
  - frontend dev-server /public proxy entry so public-avatar.ts's bare /public/avatar/* paths reach the backend in dev
affects: [32-anonymous-grounded-avatar-q-a plan 05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural citation separation enforced by data flow, not just layout: AvatarPage's chat onSuccess handler passes ONLY data.answer into the TranscriptSegment.content field and ONLY data.citations into SourcesPanel's citations prop — VoiceTranscript has no citation-rendering code path at all, so the separation is mechanical rather than a styling convention"
    - "Anonymous WebRTC hook composed for audio-only reality: AvatarView is passed isDigitalHumanMode={false} since useAnonymousVoiceLive never negotiates a video track (isAvatarConnected always false) — this forces AvatarView's AudioOrb fallback path deterministically instead of relying on an always-false video-connected branch"
    - "Always-connected voice attempt gated by a ref, not a dependency array: the mount-time voiceLive.connect() attempt uses a hasAttemptedConnectRef guard (not connect-identity deps) because the mocked/real hook returns a fresh object each render"

key-files:
  created:
    - frontend/src/hooks/use-anonymous-avatar-session.ts
    - frontend/src/hooks/use-anonymous-avatar-session.test.ts
    - frontend/src/hooks/use-anonymous-avatar-chat.ts
    - frontend/src/hooks/use-anonymous-avatar-chat.test.ts
    - frontend/src/components/avatar/sources-panel.tsx
    - frontend/src/components/avatar/avatar-input-bar.tsx
    - frontend/src/components/avatar/mic-permission-dialog.tsx
    - frontend/src/components/avatar/sources-panel.test.tsx
    - frontend/src/pages/avatar-page.tsx
    - frontend/src/pages/avatar-page.test.tsx
    - frontend/public/locales/zh-CN/avatar.json
    - frontend/public/locales/en-US/avatar.json
  modified:
    - frontend/src/i18n/index.ts
    - frontend/src/router/index.tsx
    - frontend/vite.config.ts

key-decisions:
  - "Corrected the plan's guessed 401-detection shape (err instanceof Response && err.status === 401) to match the real Error-with-message-suffix shape thrown by public-avatar.ts's parseOrThrow"
  - "Corrected the plan's guessed locale path (frontend/src/locales/...) to the project's real convention (frontend/public/locales/{{lng}}/{{ns}}.json, loaded via i18next-http-backend)"
  - "Added a new avatar.json toast.rateLimited key (distinct from the existing input-bar rateLimited countdown key) to carry the UI-SPEC's separate rate-limit-toast copy, since no existing key covered that string"
  - "AvatarPage attempts the anonymous WebRTC connect() once per session token via a ref guard (not an effect dependency on the hook's return object), since the hook returns a new object literal on every render"

patterns-established:
  - "Anonymous page composition: session hook -> chat mutation hook (session hook's renewSession passed as onUnauthorized) -> voice-live hook, all three composed at the page level with zero prop-shape divergence from the authenticated equivalents"

requirements-completed: [ANON-01, ANON-03]

# Metrics
duration: ~95min
completed: 2026-08-01
---

# Phase 32 Plan 04: Anonymous Avatar Page Composition Summary

**Composed the `/` anonymous grounded-Q&A page (session/chat hooks + sources-panel/input-bar/mic-dialog components + AvatarView/VoiceTranscript) with mechanical citation/answer separation, wiring the public route and dev proxy end-to-end.**

## Performance

- **Duration:** ~95 min
- **Started:** (continuation from prior session; Tasks 1-2 completed earlier)
- **Completed:** 2026-08-01
- **Tasks:** 3 (all `tdd="true"`)
- **Files modified/created:** 15

## Accomplishments
- `/` now renders the anonymous avatar page directly (no `/login` redirect), satisfying ANON-01 ("no login required").
- Chat responses render with a hard structural guarantee: the transcript bubble only ever contains `data.answer`; `SourcesPanel` only ever receives `data.citations` — proven mechanically in `avatar-page.test.tsx` by asserting the rendered bubble text does not contain the citation's URL/title.
- Refusal responses (`is_refusal=true`) route `SourcesPanel` to its neutral `empty-no-match` state and keep the transcript bubble on the existing `bg-muted` styling — no destructive/error color anywhere in the refusal path (ANON-03 / locked UI-SPEC color rule).
- Mic-permission denial (simulated via a rejected `navigator.mediaDevices.getUserMedia`) opens `MicPermissionDialog` automatically on mount, with the text input remaining enabled throughout.
- Dev-server `/public` proxy entry added, closing the Wave 3 handoff gap so `public-avatar.ts`'s bare `/public/avatar/*` requests reach the backend during local development.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN per task):

1. **Task 1: Anonymous session + chat hooks** - `acda714` (test) / `b5a5529` (feat)
2. **Task 2: sources-panel, avatar-input-bar, mic-permission-dialog** - `03de304` (test) / `c207fc4` (feat)
3. **Task 3: avatar-page composition + public route wiring** - `a965a16` (test) / `02d03ef` (feat)

_All three tasks used the TDD RED->GREEN pattern (test commit fails as expected, feat commit turns it green)._ No separate plan-metadata commit was made for this SUMMARY per the orchestrator's explicit instruction that it owns STATE.md/ROADMAP.md/REQUIREMENTS.md writes for this plan.

## Files Created/Modified
- `frontend/src/hooks/use-anonymous-avatar-session.ts` - React-state-only session lifecycle, `renewSession()`
- `frontend/src/hooks/use-anonymous-avatar-chat.ts` - `useMutation` wrapper detecting 401 via real `Error` message shape
- `frontend/src/components/avatar/sources-panel.tsx` - citation sidebar, 4 states, never destructive-styled
- `frontend/src/components/avatar/avatar-input-bar.tsx` - text + mic input, rate-limit disables send only
- `frontend/src/components/avatar/mic-permission-dialog.tsx` - getUserMedia-denial guidance dialog
- `frontend/src/pages/avatar-page.tsx` - root composition of all of the above
- `frontend/src/router/index.tsx` - `/` now public, renders `AvatarPage`, no guard
- `frontend/vite.config.ts` - added `/public` dev proxy entry
- `frontend/public/locales/{zh-CN,en-US}/avatar.json` - new namespace, incl. `toast.rateLimited`
- `frontend/src/i18n/index.ts` - registered `"avatar"` namespace
- `*.test.ts(x)` files for all of the above (22 tests total across the plan)

## Decisions Made
- 401-detection shape corrected to match the real `Error`-message-suffix thrown by `public-avatar.ts` (plan guessed a `Response`-object shape that never occurs).
- Locale file path corrected to the project's real `frontend/public/locales/{{lng}}/{{ns}}.json` convention (plan guessed `frontend/src/locales/...`).
- Added `avatar.json`'s `toast.rateLimited` key (distinct string from the existing `rateLimited` input-bar countdown key) to carry the UI-SPEC's dedicated 429-toast copy, since no existing key covered it.
- `AvatarView` composed with `isDigitalHumanMode={false}` for the anonymous page, since `useAnonymousVoiceLive` is audio-only (never negotiates a video track) — this deterministically renders the `AudioOrb` fallback rather than relying on an `isAvatarConnected` flag that would always evaluate false anyway.
- The anonymous WebRTC connect attempt is gated by a `useRef` flag rather than an effect dependency on the hook's return object, since the hook (real or mocked) returns a fresh object literal each render.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected 401-detection shape in `use-anonymous-avatar-chat.ts`**
- **Found during:** Task 1
- **Issue:** Plan's literal template checked `err instanceof Response && err.status === 401`; the real `sendAnonymousChat` throws a plain `Error` with message `` `${action} failed: ${status}` ``, never a `Response`.
- **Fix:** `isUnauthorized()` matches `err instanceof Error && /\b401\b/.test(err.message)` instead.
- **Files modified:** `frontend/src/hooks/use-anonymous-avatar-chat.ts`
- **Verification:** `use-anonymous-avatar-chat.test.ts` (4/4 passing)
- **Committed in:** `b5a5529`

**2. [Rule 1 - Bug] Corrected locale file path convention**
- **Found during:** Task 2
- **Issue:** Plan's file list specified `frontend/src/locales/{zh-CN,en-US}/avatar.json`; the project's real i18next config (`frontend/src/i18n/index.ts`) loads from `frontend/public/locales/{{lng}}/{{ns}}.json` via `i18next-http-backend`.
- **Fix:** Created locale files at the real path; registered `"avatar"` in the `ns` array.
- **Files modified:** `frontend/public/locales/{zh-CN,en-US}/avatar.json`, `frontend/src/i18n/index.ts`
- **Verification:** Key-parity diff between the two locale files; `sources-panel.test.tsx` passes with the real translation-mock convention.
- **Committed in:** `03de304`/`c207fc4`

**3. [Rule 1 - Bug] Reworded a JSDoc comment that tripped a literal-string acceptance grep**
- **Found during:** Task 2
- **Issue:** `sources-panel.tsx`'s JSDoc mentioned the literal string `` `text-destructive` `` in prose, which would fail the acceptance criterion "must not contain `text-destructive`" via a naive grep — same failure mode as Plan 03's "Authorization" deviation.
- **Fix:** Reworded to "the error/destructive color token" without changing meaning.
- **Files modified:** `frontend/src/components/avatar/sources-panel.tsx`
- **Verification:** `grep -c 'text-destructive' sources-panel.tsx` → 0; 10/10 tests still passing.
- **Committed in:** `c207fc4`

**4. [Rule 3 - Blocking] Added `avatar.json`'s `toast.rateLimited` key**
- **Found during:** Task 3
- **Issue:** The plan's action item ("on mutation error/429: `sonner.toast` with rate-limited copy") required a distinct toast string per the UI-SPEC ("请求过于频繁，请稍候再试" / "Too many requests — please wait a moment."), but no existing locale key carried it — the existing `rateLimited` key is the input-bar's `{{seconds}}`-interpolated countdown string, a different UI surface with different copy.
- **Fix:** Added `toast.rateLimited` to both `avatar.json` locale files.
- **Files modified:** `frontend/public/locales/{zh-CN,en-US}/avatar.json`
- **Verification:** `avatar-page.tsx` calls `t("toast.rateLimited")` on 429 detection; `npx tsc -b` clean.
- **Committed in:** `02d03ef`

**5. [Rule 3 - Blocking] Added `/public` dev-proxy entry to `vite.config.ts`**
- **Found during:** Task 3 (explicit Wave 3 handoff item from the execution context, not one of the plan's 3 named per-task file lists)
- **Issue:** `frontend/src/api/public-avatar.ts` calls bare `/public/avatar/*` paths (no `/api/v1` prefix, per that module's docstring); the dev-server proxy only forwarded `/api/*`, so those requests would 404 in local dev.
- **Fix:** Added a sibling `/public` proxy entry mirroring the existing `/api` entry's target/changeOrigin/ws settings.
- **Files modified:** `frontend/vite.config.ts`
- **Verification:** `npm run build` clean; proxy config reviewed against the existing `/api` entry's shape.
- **Committed in:** `02d03ef`

---

**Total deviations:** 5 auto-fixed (3 Rule 1 - bug corrections against guessed shapes/paths, 2 Rule 3 - blocking gaps needed to complete the task as specified).
**Impact on plan:** All auto-fixes were necessary corrections against the plan's own guessed template code/paths or explicit handoff items — no scope creep beyond what Task 3 and the execution context's notes required.

## Issues Encountered
- The local dev backend process (already running before this session, on port 8000) responds `404 Not Found` for `POST /public/avatar/session`, and its `openapi.json` does not list any `/public/avatar/*` or Voice Live avatar-character paths beyond `/api/v1/voice-live/avatar-characters`. Inspection of `backend/app/main.py` confirms `public_avatar_router` IS correctly imported and registered (`app.include_router(public_avatar_router)`, no prefix) in the current source tree — so this is a stale, already-running dev-server process that predates the Plan 02/03 backend work and has not been restarted/reloaded, not a defect in this plan's code. Out of scope to fix (pre-existing process, not a file this plan touched); noted here rather than chased further per the deviation rules' scope boundary.

## Live Browser/Curl Verification

**Not performed / inconclusive due to the stale-backend-process issue above.** A `curl` probe against the running dev backend confirmed the anonymous endpoints aren't currently reachable through that stale process, so an end-to-end anonymous-flow verification through the actual dev servers was not possible in this session without restarting a backend process outside this plan's scope. All verification for this plan is therefore test-level:
- `npx vitest run src/hooks/use-anonymous-avatar-session.test.ts src/hooks/use-anonymous-avatar-chat.test.ts src/components/avatar/sources-panel.test.tsx src/pages/avatar-page.test.tsx` → **22/22 passed**
- `npx tsc -b` → clean, no errors
- `npm run build` → succeeds (pre-existing chunk-size warning unrelated to this plan's files)

No real-browser (Playwright/manual) verification of the rendered anonymous flow was attempted in this session; recommend a fresh `npm run dev` + backend restart before any manual/E2E pass on Plan 05.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `frontend/src/pages/avatar-page.tsx` is the complete composition root for the anonymous flow; Plan 05 can build on it directly (e.g., rate-limit UX polish, end-session handling, mobile Sheet refinement) without further wiring changes.
- Recommend restarting the local backend dev process before any manual/E2E verification pass, so `/public/avatar/*` routes are actually reachable (see "Issues Encountered" above) — this is an environment-state issue, not a code blocker.

---
*Phase: 32-anonymous-grounded-avatar-q-a*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 11 claimed created/modified files verified present on disk; all 6 claimed commit hashes verified present in `git log --oneline --all`. No missing items.
