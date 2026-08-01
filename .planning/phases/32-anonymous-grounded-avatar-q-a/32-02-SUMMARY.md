---
phase: 32-anonymous-grounded-avatar-q-a
plan: 02
subsystem: api
tags: [fastapi, jwt, jose, httpx, azure-ai-search, slowapi, asyncio, avatar]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a plan 01
    provides: AnonymousAvatarSession/AvatarInteractionLog/PublicKnowledgeConfig ORM models, Alembic migration b35a_add_anonymous_avatar_tables, dual-key limiter_ip/limiter_session (_KeyedLimiterProxy over one shared slowapi Limiter), anon_session_ttl_minutes/anon_rate_limit_* Settings fields
provides:
  - Anonymous session token issuance/verification (DB row is source of truth for expiry/revocation, not just the JWT exp claim)
  - get_anonymous_session FastAPI dependency — a new unauthenticated trust boundary distinct from JWT auth
  - POST /public/avatar/session (no login, no client-supplied identifier)
  - retrieve_citations() — direct Azure AI Search retrieve REST client with strict full-field citation gating, capped at 3
  - handle_anonymous_turn() — concurrent agent-chat + citation-retrieval orchestrator, fixed-template refusal on zero hits, one audit-log row per turn
  - get_active_public_config() — fail-closed (404) resolver for the single active PublicKnowledgeConfig row
  - POST /public/avatar/chat — dual-key (IP + session) rate-limited grounded Q&A endpoint
affects: [32-03-anonymous-grounded-avatar-q-a, 32-04-anonymous-grounded-avatar-q-a, 32-05-anonymous-grounded-avatar-q-a]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-query 'shadow retrieval': asyncio.gather() runs the existing Agent chat stream (spoken/text answer) concurrently with a direct AI Search retrieve REST call (structured citations) in the same turn"
    - "Strict full-field citation gate: a citation is only valid if title AND url AND page are all present; any partial match is silently dropped before it ever reaches the API response (zero-fabrication-risk design)"
    - "Refusal-on-zero-hits, not score-cutoff: refusal triggers on zero full-field citations (a search no-hit), not a relevance-score threshold, because score-field availability on the live knowledge source is unverified"
    - "Optional Header(None, ...) + explicit unauthorized() check instead of Header(..., ...), so a missing auth header raises the project's structured 401 rather than FastAPI's generic 422 request-validation error"
    - "Fail-closed server-side config resolution: get_active_public_config() 404s if no PublicKnowledgeConfig row is active — an anonymous visitor never gets a default/fallback agent or KB"

key-files:
  created:
    - backend/app/services/anonymous_session_service.py
    - backend/app/services/avatar_search_service.py
    - backend/app/services/avatar_service.py
    - backend/app/services/public_knowledge_config_service.py
    - backend/app/schemas/public_avatar.py
    - backend/app/api/public_avatar.py
    - backend/scripts/verify_knowledge_source_fields.py
    - backend/tests/test_public_avatar_api.py
    - backend/tests/test_avatar_search_service.py
    - backend/tests/test_avatar_service.py
  modified:
    - backend/app/dependencies.py
    - backend/app/utils/exceptions.py
    - backend/app/main.py
    - backend/app/api/__init__.py

key-decisions:
  - "Refusal threshold = zero full-field citations from retrieve_citations() (a search no-hit), not a relevance-score cutoff — score-field availability on the live KB is unverified (32-RESEARCH.md Pitfall 1); this is the safer, zero-fabrication-risk reading of the locked 'strict full-field citation' + 'no-match refusal' decisions"
  - "get_anonymous_session declares the X-Anon-Session header as optional (Header(None, ...)) and raises unauthorized() explicitly on None, rather than Header(..., ...) which produces FastAPI's generic 422 — a missing session is an auth failure (401), not a malformed request, per Task 3's explicit behavior requirement"
  - "No client-suppliable agent_id/kb_name/hcp_profile_id field exists anywhere in ChatRequest — the server always resolves the single active PublicKnowledgeConfig row via get_active_public_config(), which fails closed with 404 if none is configured"

patterns-established:
  - "Service-layer citation gating: any dropped-field filtering for AI Search results happens in the service (avatar_search_service.py), never in the router or schema layer"
  - "One AvatarInteractionLog row per handle_anonymous_turn() call, written before the function returns, regardless of success/refusal branch"

requirements-completed: [ANON-01, ANON-02, ANON-03, ANON-05]

# Metrics
duration: ~25min (this session's continuation; Task 1 was completed in a prior session of the same plan)
completed: 2026-08-01
---

# Phase 32 Plan 02: Anonymous Grounded Avatar Q&A Summary

**Anonymous session-token trust boundary plus a dual-query grounded Q&A endpoint (`POST /public/avatar/chat`) that runs the Agent chat stream concurrently with a direct Azure AI Search `retrieve` REST call, strictly gates citations on title+url+page completeness, and always returns the fixed refusal template on zero search hits.**

## Performance

- **Duration:** ~25 min (this continuation session covered Task 2 commit + all of Task 3; Task 1 was completed and committed in a prior session)
- **Completed:** 2026-08-01
- **Tasks:** 3
- **Files modified:** 14 (10 created, 4 modified)

## Accomplishments
- Anonymous visitors can obtain a session token with zero login and zero client-supplied identifier (`POST /public/avatar/session`), backed by a DB row (not just the JWT `exp` claim) as the source of truth for expiry/revocation
- Grounded Q&A turns run the Agent chat stream and a direct AI Search `retrieve` call concurrently via `asyncio.gather()`, with citations strictly gated on full-field completeness (title+url+page) and capped at 3
- Zero-hit questions always return the fixed multilingual refusal template and `citations=[]`, never a fabricated answer — proven regardless of what text the Agent itself produced
- Every chat turn (success or refusal) writes exactly one `AvatarInteractionLog` audit row
- `POST /public/avatar/chat` is dual-key (IP + session) rate limited and resolves the agent/KB exclusively server-side via a fail-closed `get_active_public_config()` — no request field can override which agent or knowledge base is used

## Task Commits

1. **Task 1: Anonymous session token service + get_anonymous_session dependency + POST /public/avatar/session** - `ee953b7` (feat)
2. **Task 2: Citation retrieval service + dual-query orchestrator with strict full-field gating and refusal logic** - `4bdab77` (feat)
3. **Task 3: POST /public/avatar/chat endpoint — dual-key rate limited, wired to orchestrator** - `527677f` (feat)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `backend/app/services/anonymous_session_service.py` - `create_anonymous_session()`, `verify_anonymous_token()`, `touch_session()` — JWT issuance/verification with the DB row as source of truth
- `backend/app/services/avatar_search_service.py` - `retrieve_citations()` — direct Azure AI Search `retrieve` REST client, strict full-field gate, capped at 3
- `backend/app/services/avatar_service.py` - `handle_anonymous_turn()` — concurrent agent-chat + citation-retrieval orchestrator, refusal logic, audit-log write
- `backend/app/services/public_knowledge_config_service.py` - `get_active_public_config()` — fail-closed 404 resolver for the single active `PublicKnowledgeConfig` row
- `backend/app/schemas/public_avatar.py` - `AnonymousSessionResponse`, `ChatRequest` (message, max_length=2000), `CitationOut`, `ChatResponse`
- `backend/app/api/public_avatar.py` - `POST /public/avatar/session`, `POST /public/avatar/chat` (dual rate-limited)
- `backend/app/dependencies.py` - `get_anonymous_session` dependency; fixed to raise structured 401 (not FastAPI's generic 422) on a missing `X-Anon-Session` header
- `backend/app/utils/exceptions.py` - `UnauthorizedException`/`unauthorized()` (first 401 exception class in the project)
- `backend/app/main.py` - mounts `public_avatar_router` with no `/api/v1` prefix (unauthenticated trust boundary)
- `backend/scripts/verify_knowledge_source_fields.py` - standalone diagnostic to confirm live KB `sourceData` shape (title/url/page) before relying on real citations
- `backend/tests/test_public_avatar_api.py` - 12 tests: session issuance/verification (5), session endpoint (2), chat endpoint (4: 200/401/422/429)
- `backend/tests/test_avatar_search_service.py` - 4 tests covering full-field gating, cap-at-3, empty/absent references
- `backend/tests/test_avatar_service.py` - 5 tests covering refusal-template precedence, audit-log writes, no client override of agent/KB identifiers

## Decisions Made
- Refusal threshold = zero full-field citations (search no-hit), not a relevance-score cutoff — score-field availability on the live knowledge source is unverified, so this is the safer zero-fabrication-risk interpretation of the locked design decisions
- `get_anonymous_session` uses `Header(None, ...)` + explicit `unauthorized()` check rather than `Header(..., ...)`, so a missing session header is a 401 (auth failure) not a 422 (request validation error) — required by Task 3's explicit behavior spec
- `ChatRequest` has exactly one field (`message`); the agent/KB is always resolved server-side via `get_active_public_config()`, which fails closed (404) if no `PublicKnowledgeConfig` row is active

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `X-Anon-Session` header returned FastAPI's generic 422 instead of the project's structured 401**
- **Found during:** Task 3 (writing the `test_missing_session_header_returns_401_structured_error` test, which is an explicit behavior in the plan's Task 3 `<behavior>` block)
- **Issue:** `get_anonymous_session`'s original signature (`Header(..., alias="X-Anon-Session")`, from Task 1) makes the header required at the FastAPI/Pydantic validation layer, so a missing header short-circuits with a generic `422 Unprocessable Entity` before the dependency body ever runs — never reaching `verify_anonymous_token()`'s 401 logic. This directly contradicted Task 3's stated required behavior ("no X-Anon-Session header returns 401 with the project's structured error shape").
- **Fix:** Changed the parameter to `x_anon_session: str | None = Header(None, alias="X-Anon-Session")` and added an explicit `if x_anon_session is None: unauthorized("Missing anonymous session")` check at the top of the function body.
- **Files modified:** `backend/app/dependencies.py`
- **Verification:** `test_missing_session_header_returns_401_structured_error` passes; full `test_public_avatar_api.py` (12/12) and `test_auth.py` (25/25, confirming no regression to the shared `dependencies.py` module) both pass.
- **Committed in:** `527677f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness fix directly required by Task 3's own explicit behavior specification; no scope creep — only `get_anonymous_session` in `dependencies.py` was touched, and the fix was verified against the full existing auth test suite.

## Issues Encountered
None beyond the deviation above — all task-level `pytest`/`ruff` verification commands passed on first or second attempt.

## User Setup Required
None - no external service configuration required. (`verify_knowledge_source_fields.py` is an optional manual diagnostic against a live dev Azure AI Search resource, not a setup requirement.)

## Next Phase Readiness
- The full anonymous grounded Q&A backend path (session issuance → chat turn → citations/refusal → audit log) is complete and testable end-to-end via `POST /public/avatar/session` + `POST /public/avatar/chat`
- Later plans (voice, frontend, E2E) can now call directly into `handle_anonymous_turn()` and the `/public/avatar/*` routes
- No blockers identified for Plan 03+

---
*Phase: 32-anonymous-grounded-avatar-q-a*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 14 created/modified files confirmed present on disk; all 3 task commit hashes (`ee953b7`, `4bdab77`, `527677f`) confirmed present in `git log --all`.
