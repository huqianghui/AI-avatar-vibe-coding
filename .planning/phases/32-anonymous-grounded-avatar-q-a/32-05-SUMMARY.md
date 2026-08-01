---
phase: 32-anonymous-grounded-avatar-q-a
plan: 05
subsystem: testing
tags: [playwright, e2e, pytest, webrtc, avatar, audit-log]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a
    provides: "Plans 02-04's public avatar session/chat/webrtc endpoints, anonymous voice-live hook, and AvatarInteractionLog model"
provides:
  - "End-to-end Playwright proof of the anonymous main user story (no-login, grounded Q&A, structurally separate sources panel, refusal path, rate-limit UI)"
  - "End-to-end Playwright proof of the voice path (mic-permission denial dialog + fallback to text, real WebRTC offer/answer handshake reaching connected state via fake transport)"
  - "Backend audit-log completeness proof: success/refusal/agent-error turns each produce exactly one AvatarInteractionLog row"
  - "Human-verified sign-off that the avatar audibly speaks and no /public/avatar/* request carries an Authorization: Bearer header"
affects: [33, 34, 35]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playwright addInitScript fakes for RTCPeerConnection + WebSocket to drive a real hook state machine deterministically without live Azure infra"
    - "Dismiss-modal-before-interact helper for tests where a Radix Dialog's aria-hidden background would otherwise hide the underlying textbox from the a11y tree"

key-files:
  created:
    - frontend/e2e/anonymous-avatar-qa.spec.ts
    - frontend/e2e/anonymous-avatar-voice.spec.ts
    - backend/tests/test_avatar_interaction_log.py
  modified:
    - backend/app/services/avatar_service.py
    - frontend/src/api/public-avatar.ts
    - frontend/src/pages/avatar-page.tsx
    - frontend/src/pages/avatar-page.test.tsx

key-decisions:
  - "Mocked all /public/avatar/* endpoints via page.route() in both E2E specs rather than hitting the real dev backend, to keep the suite isolated from the in-memory rate-limiter's shared state and from needing a live PublicKnowledgeConfig/Foundry IQ index"
  - "Faked RTCPeerConnection and WebSocket at the browser-global level (not the hook level) so the real use-anonymous-voice-live.ts connect() state machine runs unmodified end-to-end"
  - "handle_anonymous_turn now degrades to the fixed refusal response on any agent-stream/citation-retrieval exception instead of propagating, so the audit-log write is never skipped"

requirements-completed: [ANON-01, ANON-02, ANON-03, ANON-04, ANON-05]

# Metrics
duration: ~55min
completed: 2026-08-01
---

# Phase 32 Plan 05: Anonymous Avatar E2E + Audit-Log Completeness Summary

**Two Playwright specs (text Q&A + voice/WebRTC) and one backend audit-log test proving the full anonymous avatar journey holds together end-to-end, closed out by a human-verified checkpoint for audible speech and JWT-absence.**

## Performance

- **Duration:** ~55 min (session continued from a prior compacted context; exact start not recorded)
- **Completed:** 2026-08-01
- **Tasks:** 2 (1 auto/tdd, 1 checkpoint:human-verify)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Proved the main anonymous user story end-to-end in a real browser: no-login landing, grounded Q&A with a structurally separate sources panel, the fixed refusal template + neutral empty-source state, and rate-limited send-disable UI.
- Proved the voice path end-to-end: mic-permission denial opens a dialog with a working "Use Text Instead" fallback, and a fully faked WebRTC/signaling transport drives the real `use-anonymous-voice-live.ts` connect() state machine to `connected`.
- Proved backend audit-log completeness: 3 real calls to `handle_anonymous_turn()` (success, refusal, agent-stream failure) each produce exactly one `AvatarInteractionLog` row with correct `citation_count`/`is_refusal`.
- Human verified the one behavior automated tests structurally cannot assert: audible avatar speech in sync with the transcript, and the complete absence of an `Authorization: Bearer` header on the anonymous `/public/avatar/*` path.

## Task Commits

1. **Task 1: E2E specs + audit-log completeness test** - `33ff1b0` (test)
2. **Task 2: Human verification of full anonymous voice+text avatar experience** - checkpoint, no code changes; approved by user (all 6 checks passed)

**Plan metadata:** (this commit) - `docs(32-05): add plan summary`

## Files Created/Modified
- `frontend/e2e/anonymous-avatar-qa.spec.ts` - 4 tests: no-login/no-redirect, grounded Q&A with structurally separate transcript/sources regions, refusal + neutral empty state, 429 rate-limit UI
- `frontend/e2e/anonymous-avatar-voice.spec.ts` - 2 tests: mic-denial dialog + text fallback, granted-mic full fake WebRTC handshake to `connected`
- `backend/tests/test_avatar_interaction_log.py` - success/refusal/agent-error turns each write exactly one audit-log row
- `backend/app/services/avatar_service.py` - `handle_anonymous_turn` now catches agent-stream/citation-retrieval exceptions and degrades to the refusal path instead of skipping the audit-log write
- `frontend/src/api/public-avatar.ts` - added `AnonymousApiError` (carries HTTP status + `Retry-After` seconds) so callers can drive the rate-limit countdown
- `frontend/src/pages/avatar-page.tsx` - wired 429 chat errors into a `rateLimitSeconds` countdown that disables only the send button; deferred `handleUseTextInstead`'s textarea focus past the current render so Radix's Dialog focus-trap doesn't steal it back
- `frontend/src/pages/avatar-page.test.tsx` - added a unit test covering the 429-disables-send-but-not-textarea behavior

## Decisions Made
- Used `page.route()` interception for all three `/public/avatar/*` endpoints in both specs rather than a live dev backend, to keep the suite deterministic and independent of the real anonymous rate-limiter's shared in-memory state.
- Chose to fake `RTCPeerConnection`/`WebSocket` at the `window` level via `addInitScript` (matching this codebase's established `unified-training-pinned-agent.spec.ts` convention) rather than mocking the hook itself, so the real offer/answer/signaling state machine is exercised, not a stub.
- `dismissMicDialogIfOpen()` helper added to the text-path qa-spec tests: the always-connected avatar auto-attempts a WebRTC/mic connection on mount, and a mocked 503 broker failure (used purely to avoid a real 30s hang) also opens the modal `MicPermissionDialog`, which Radix marks the background `aria-hidden` while open — hiding the textbox from the accessibility tree until dismissed via the app's own "Use Text Instead" affordance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Audit-log write skipped on Agent-stream failure**
- **Found during:** Task 1 (writing `test_avatar_interaction_log.py`'s agent-error case)
- **Issue:** `handle_anonymous_turn` had no try/except around the `asyncio.gather(collect_agent_text(), retrieve_citations(...))` call, so an Agent-stream exception propagated and skipped the audit-log write entirely — violating the "every anonymous turn is auditable" requirement (ANON-05 / T-32-08).
- **Fix:** Wrapped the gather in try/except, degrading to `("", None, [])` (the fixed refusal path) on any exception so the audit-log write below still runs.
- **Files modified:** `backend/app/services/avatar_service.py`
- **Verification:** `test_avatar_interaction_log.py`'s third turn (agent-stream raises) asserts a row is still written with `citation_count=0`, `is_refusal=True`, `response_id=""`.
- **Committed in:** `33ff1b0`

**2. [Rule 2 - Missing Critical] Rate-limit countdown never wired into the send button**
- **Found during:** Task 1 (writing the 429 rate-limit E2E test)
- **Issue:** `AvatarInputBar` already accepted a `rateLimitSeconds` prop specifically to disable the send button on 429, but `avatar-page.tsx` never passed it — the send button never actually disabled on a real rate-limit response.
- **Fix:** Added `AnonymousApiError` (carries status + `Retry-After`) to `public-avatar.ts`; added a countdown timer in `avatar-page.tsx` driven from the chat mutation's `onError`, wired into `AvatarInputBar`.
- **Files modified:** `frontend/src/api/public-avatar.ts`, `frontend/src/pages/avatar-page.tsx`
- **Verification:** New unit test in `avatar-page.test.tsx` + the E2E rate-limit test, both passing.
- **Committed in:** `33ff1b0`

**3. [Rule 1 - Bug] Mic-denial "Use Text Instead" focus stolen by Radix's focus trap**
- **Found during:** Task 1 (voice E2E spec's mic-denial test, `toBeFocused()` assertion)
- **Issue:** `handleUseTextInstead` called `textareaRef.current?.focus()` synchronously in the same handler that closes the dialog; Radix's Dialog focus-trap was still active at that exact point (it only releases once React re-renders with `open=false`), so the focus call was immediately stolen back into the closing dialog.
- **Fix:** Deferred the `.focus()` call via `setTimeout(..., 0)` so it runs after the trap has released.
- **Files modified:** `frontend/src/pages/avatar-page.tsx`
- **Verification:** Voice E2E spec's mic-denial test passes reliably; existing unit tests for `avatar-page.tsx` still pass.
- **Committed in:** `33ff1b0`

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 bug)
**Impact on plan:** All three were necessary for Task 1's own acceptance criteria (the audit-completeness test and the two E2E specs could not pass without them). No scope creep beyond what the plan's tests already required.

## Issues Encountered
- **Local environment**: this machine's `AI-avatar-vibe-coding/backend/.venv` has a broken `pip` shebang pointing at a sibling repo's venv, and its own `python3` lacks `slowapi`. Worked around by invoking the sibling venv's `python3`/`uvicorn` binaries directly while `cd`'d into this project's `backend/` directory (correct cwd-relative import resolution). No project files changed for this — pure local dev-environment workaround.
- **Stale sibling dev servers**: an earlier session had left the *sibling* `AI-Coach-vibe-coding` repo's `uvicorn`/`vite` dev servers running on ports 8000/5173. Playwright's `reuseExistingServer: true` silently reused them, producing misleading E2E failures (redirect to `/login`, wrong app's login form) that had nothing to do with this plan's code. Killed those stale processes before re-running; all failures disappeared.
- **Flaky one-off**: `auth.setup.ts`'s "authenticate as admin" setup test timed out once against a cold-started backend (first-request DB init/seed contention); passed on immediate retry. Unrelated to this plan's changes — pre-existing setup fixture, out of scope.

## Human Checkpoint Outcome

Task 2 (`checkpoint:human-verify`, blocking) was run against a live dev instance (backend on `:8000`, frontend on `:5173`, both started and health-checked by the executor). The user confirmed all 6 verification steps passed:

1. No-login landing on `/` with no redirect to a login screen.
2. Digital human speaks the answer aloud in sync with the on-screen transcript.
3. Sources panel renders structurally separate from the transcript, with working citation links.
4. Unrelated question produces the fixed refusal phrase and the neutral "no matching source" empty state (not error-styled).
5. Denying microphone permission shows the guidance dialog with a working text-input fallback.
6. Network tab confirmed no `Authorization: Bearer` header on any `/public/avatar/*` request — only `X-Anon-Session`.

**Resume signal:** "approved" (all 6 checks passed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 32 (anonymous-grounded-avatar-q-a) is now fully proven end-to-end: unit, integration, E2E, and human-verified voice/security checks all green.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were intentionally left untouched this plan per explicit instruction; they still reflect state from plans 01-04 and will need a separate update pass to reflect Plan 05's completion.
- Ready for Phase 33 to build on the anonymous avatar foundation (public session/chat/webrtc endpoints, audit logging, and the E2E test patterns established here).

---
*Phase: 32-anonymous-grounded-avatar-q-a*
*Completed: 2026-08-01*

## Self-Check: PASSED
All claimed files verified present on disk; commit `33ff1b0` verified present in git history.
