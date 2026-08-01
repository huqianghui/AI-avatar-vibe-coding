---
phase: 33-personalized-crm-excel-avatar
plan: 05
subsystem: api
tags: [fastapi, sqlalchemy, responses-api, idor, personalization, developer-role]

# Dependency graph
requires:
  - phase: 33-01
    provides: "personalization_sanitizer.py sanitization primitives (via 33-04's build_personalization_context)"
  - phase: 33-04
    provides: "PersonalizedAvatarSession model, get_owned_session() IDOR gate, POST /avatar/session, build_personalization_context()"
provides:
  - "agent_chat_service.py optional personalization_context kwarg -- prepended as a developer-role input item ahead of the user's message"
  - "handle_personalized_turn() -- the personalized mirror of handle_anonymous_turn, forwarding the built context into the agent call"
  - "POST /api/v1/avatar/chat -- the actual personalized Q&A endpoint, IDOR-gated pre-agent-call"
affects: [33-06, 33-07, 33-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second labeled input-item segment (role=developer) prepended ahead of the user's turn in the Responses API `input` list -- never a rewrite of the hosted Agent's own server-side instructions (D-05/D-06)"
    - "Empty-string personalization_context (D-08) collapses to byte-identical single-item input -- no special-casing needed anywhere downstream of Task 1's change"
    - "handle_personalized_turn mirrors handle_anonymous_turn exactly (concurrent agent-stream + citation-retrieval via asyncio.gather, refusal-on-zero-citations, single audit-log write) but tags AvatarInteractionLog with user_id/personalized_session_id instead of session_id/ip_address"

key-files:
  created:
    - backend/app/services/personalized_avatar_service.py
    - backend/tests/test_personalized_avatar_service.py
  modified:
    - backend/app/services/agent_chat_service.py
    - backend/tests/test_agent_chat_service.py
    - backend/app/api/personalized_avatar.py
    - backend/tests/test_personalized_avatar_api.py

key-decisions:
  - "Architecture deviation from 33-RESEARCH.md's Pattern 2 (flagged in the plan itself, not silent): D-05's structured injection is implemented as a second `developer`-role Responses-API input item, not a manually-built system-prompt string -- the real Phase 32 integration point (hosted Prompt Agent via agent_reference) has no manually-assembled system prompt anywhere in the call path"
  - "Test mocks for stream_agent_response use MagicMock (not AsyncMock) with a side_effect returning an async generator -- stream_agent_response is called synchronously and returns an async iterator, it is never itself awaited"

patterns-established:
  - "The 3-file wiring chain (agent_chat_service optional kwarg -> orchestrator forwards it -> route resolves session+config then calls orchestrator) is now the template for any future authenticated avatar surface needing personalization"

requirements-completed: [PERS-02]

# Metrics
duration: ~10min
completed: 2026-08-01
---

# Phase 33 Plan 05: Personalized Avatar Chat Turn Summary

**Wires 33-04's session + injection-context building blocks into an actual authenticated chat turn by prepending a `developer`-role Responses-API input item ahead of the user's message, adding `handle_personalized_turn()`, and exposing the IDOR-gated `POST /api/v1/avatar/chat`.**

## Performance

- **Duration:** ~10 min (task execution)
- **Started:** 2026-08-01T11:59:58Z
- **Completed:** 2026-08-01T12:07:00Z (last task commit)
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `agent_chat_service.py`'s `_build_openai_request`/`chat_with_agent`/`stream_agent_response` accept an optional `personalization_context` kwarg, prepended as a `{"role": "developer", ...}` input item ahead of the user's message when non-empty; omitting it (or passing `""`) leaves `input` byte-identical to the pre-change shape -- the existing `test_stream_agent_response_uses_exact_reference_and_orders_events` regression assertion passes unmodified.
- `handle_personalized_turn()` in the new `personalized_avatar_service.py` mirrors `handle_anonymous_turn` exactly for the concurrent agent-stream + citation-retrieval + refusal-gating + audit-log shape, but calls `build_personalization_context(db, user.id)` first and forwards its result into `stream_agent_response(..., personalization_context=...)`, and writes `AvatarInteractionLog.user_id`/`personalized_session_id` instead of `session_id`/`ip_address`.
- `POST /api/v1/avatar/chat` added to the existing `personalized_avatar.py` router: `get_owned_session()` runs before any agent call or citation retrieval (T-33-09), then the server-resolved active `PublicKnowledgeConfig` row (never client-suppliable) drives `handle_personalized_turn`.

## Task Commits

Each task was committed atomically (`--no-verify`, per parallel-worktree convention -- orchestrator validates hooks later):

1. **Task 1: agent_chat_service.py -- optional personalization_context input item** - `4b81f3e` (test+feat, TDD)
2. **Task 2: handle_personalized_turn orchestrator** - `a4bf2b4` (test+feat, TDD)
3. **Task 3: POST /avatar/chat route (IDOR-gated)** - `1016109` (test+feat, TDD)

_Note: TDD tasks each combine RED+GREEN into a single atomic commit per the established plan convention; all three tasks were verified RED (new/added tests written and confirmed failing on missing implementation) before the implementation was added and the tests turned GREEN._

## Files Created/Modified
- `backend/app/services/agent_chat_service.py` - added `personalization_context: str | None = None` parameter to `_build_openai_request`, `chat_with_agent`, `stream_agent_response`; prepends a `developer`-role input item when non-empty
- `backend/tests/test_agent_chat_service.py` - 5 new tests: no-arg regression guard, developer-role prepend, empty-string no-op, `chat_with_agent` forwarding
- `backend/app/services/personalized_avatar_service.py` - `handle_personalized_turn()` -- personalized Q&A orchestrator
- `backend/tests/test_personalized_avatar_service.py` - 5 tests: context forwarding, D-08 empty-string forwarding, exactly-one audit row tagged with `user_id`/`personalized_session_id`, refusal on zero citations, degrade-to-refusal on agent/citation failure
- `backend/app/api/personalized_avatar.py` - added `POST /chat` route (IDOR-gated via `get_owned_session`, rate-limited via `limiter_user`)
- `backend/tests/test_personalized_avatar_api.py` - 3 new tests: 200 for the owning user, 404 pre-agent-call for a foreign `session_id` (agent mock asserted `assert_not_awaited`), 401 on missing auth

## Decisions Made
- Followed the plan's own flagged architecture deviation from 33-RESEARCH.md's Pattern 2: implemented D-05's "结构化模板段落注入" as a second labeled Responses-API `input` item (`role="developer"`) rather than a manually-built system-prompt string, since the actual codebase's anonymous flow has no such string anywhere in its call path -- the hosted Agent's instructions live server-side in Foundry.
- Used `MagicMock(side_effect=...)` (not `AsyncMock`) for mocking `stream_agent_response` in tests that needed to assert on call kwargs, since the function itself is a plain (non-async) call that returns an async generator -- it is `async for`-iterated, never `await`ed directly. `AsyncMock` produced an un-awaited-coroutine warning and a stale mocked-return value on the first attempt; corrected to `MagicMock` mirroring `test_avatar_service.py`'s existing pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ruff format needed on new orchestrator + its test file**
- **Found during:** Task 2
- **Issue:** `ruff format --check` flagged both `personalized_avatar_service.py` and `test_personalized_avatar_service.py` as needing reformatting (line-wrapping on a few long lines/dict literals) immediately after they were written.
- **Fix:** Ran `ruff format` on both files; re-ran the 5-test suite to confirm all tests still passed after reformat (all 5 passed).
- **Files modified:** `backend/app/services/personalized_avatar_service.py`, `backend/tests/test_personalized_avatar_service.py`
- **Verification:** `ruff check .`/`ruff format --check .` clean on both files; 5/5 tests passing post-reformat.
- **Committed in:** `a4bf2b4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking lint/format).
**Impact on plan:** Mechanical formatting only, no logic change; consistent with the same class of deviation documented in 33-04's SUMMARY.

## Issues Encountered
- None beyond the documented lint auto-fix above.
- Targeted verification run (`pytest tests/test_agent_chat_service.py tests/test_personalized_avatar_service.py tests/test_personalized_avatar_api.py -v --no-cov`): **27 passed, 6 skipped** (the 6 skips are the pre-existing real-Azure-credential integration tests in `test_agent_chat_service.py`, unaffected by this plan). No cross-file interference.
- Adjacent-suite spot-check (`test_avatar_service.py`, `test_public_avatar_api.py`, `test_personalized_session_service.py`, `test_personalization_injection_service.py`): **30 passed** -- confirms this plan's `agent_chat_service.py` signature change did not regress the anonymous flow or 33-04's session/injection services.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- The phase's owned success criterion -- "the answer reflects that user's CRM context/preferences" -- is now mechanically true end-to-end: `POST /api/v1/avatar/chat` resolves an owned session, builds the sanitized personalization context, and forwards it into the actual Azure AI Foundry Responses API call as a labeled `developer`-role segment.
- Frontend wiring (chat UI calling this endpoint) and any remaining PERS-03 (`UserPreference` model) work can proceed independently -- `personalization_injection_service.py`'s `_load_preferences()` will start succeeding automatically with zero changes to this plan's files once that model exists.
- No blockers.

## Self-Check: PASSED

Files verified on disk:
- FOUND: backend/app/services/personalized_avatar_service.py
- FOUND: backend/tests/test_personalized_avatar_service.py
- FOUND: backend/app/services/agent_chat_service.py
- FOUND: backend/tests/test_agent_chat_service.py
- FOUND: backend/app/api/personalized_avatar.py
- FOUND: backend/tests/test_personalized_avatar_api.py

Commits verified in `git log`:
- FOUND: 4b81f3e (Task 1)
- FOUND: a4bf2b4 (Task 2)
- FOUND: 1016109 (Task 3)

`git diff --stat f12db99..HEAD` confirmed to match the plan's declared 6-file/673-insertion footprint exactly.

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*
