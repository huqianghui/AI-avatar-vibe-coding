---
phase: 32-anonymous-grounded-avatar-q-a
plan: 01
subsystem: infra
tags: [sqlalchemy, alembic, slowapi, fastapi, rate-limiting, avatar, database]

# Dependency graph
requires: []
provides:
  - AnonymousAvatarSession, AvatarInteractionLog, PublicKnowledgeConfig ORM models + real Alembic migration (b35a_add_anonymous_avatar_tables)
  - Dual-key (per-IP, per-anonymous-session) rate limiting infra with empirically proven independent enforcement
  - Structured RATE_LIMITED 429 handler (project error shape + Retry-After header)
  - Config-driven anon_session_ttl_minutes and anon_rate_limit_* Settings fields
affects: [32-02-anonymous-grounded-avatar-q-a, 32-03-anonymous-grounded-avatar-q-a, 32-04-anonymous-grounded-avatar-q-a, 32-05-anonymous-grounded-avatar-q-a]

# Tech tracking
tech-stack:
  added: ["slowapi>=0.1.10"]
  patterns:
    - "_KeyedLimiterProxy: presents independent-looking `.limit()` decorators bound to different key_funcs while sharing one slowapi Limiter instance underneath"
    - "Hand-written Alembic migrations when autogenerate output includes unrelated pre-existing schema drift out of scope for the current plan"

key-files:
  created:
    - backend/app/models/anonymous_avatar_session.py
    - backend/app/models/avatar_interaction_log.py
    - backend/app/models/public_knowledge_config.py
    - backend/alembic/versions/b35a_add_anonymous_avatar_tables.py
    - backend/app/services/rate_limit.py
    - backend/tests/test_avatar_models.py
    - backend/tests/test_rate_limiting.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/main.py
    - backend/app/config.py
    - backend/pyproject.toml

key-decisions:
  - "Hand-wrote the Alembic migration instead of committing the autogenerate output, because autogenerate also proposed unrelated changes to scenarios/score_details/system_enums (pre-existing drift, out of this plan's scope)"
  - "limiter_ip and limiter_session share one underlying slowapi Limiter instance (via a thin _KeyedLimiterProxy) rather than being two independent Limiter() instances as the plan's action template literally showed, because slowapi's auto-check gates on a per-request shared flag, not a per-instance flag -- stacking two real independent instances silently disables the inner one's check"

patterns-established:
  - "_KeyedLimiterProxy pattern for any future route needing multiple independently-keyed rate limits stacked on one endpoint"
  - "Nullable FK with ondelete=SET NULL for audit-log tables that must outlive their parent session row (AvatarInteractionLog.session_id -> AnonymousAvatarSession)"

requirements-completed: [ANON-01, ANON-05]

# Metrics
duration: ~2h (includes root-causing an undocumented slowapi limitation; exact start time not captured due to a context-compaction continuation mid-session)
completed: 2026-08-01
---

# Phase 32 Plan 01: Anonymous Avatar Foundations Summary

**Three new ORM models + Alembic migration for anonymous avatar sessions/logs/config, plus a dual-key (IP + session) slowapi rate limiter with a from-scratch fix for a real slowapi multi-instance auto-check bug, proven independent by a 6-test empirical suite.**

## Performance

- **Duration:** ~2h (session included a context-compaction continuation; exact start timestamp not captured)
- **Completed:** 2026-08-01T04:01:04Z
- **Tasks:** 2/2 completed
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments

- Three new SQLAlchemy models (`AnonymousAvatarSession`, `AvatarInteractionLog`, `PublicKnowledgeConfig`) backing anonymous grounded avatar Q&A, with a hand-written Alembic migration that adds exactly the 3 new tables + index (no unrelated schema drift)
- Root-caused and fixed a real slowapi limitation that would have silently broken dual-key rate limiting in production: stacking `.limit()` decorators from two different `Limiter()` instances on the same route only ever checks the outermost instance, because slowapi's auto-check gates on a shared per-request flag rather than a per-instance one
- Delivered a fix that preserves the plan's exact intended public API (`limiter_ip`, `limiter_session`, `get_anon_session_key`) while making both key spaces genuinely, independently enforced in production
- Structured `429 RATE_LIMITED` JSON response with `Retry-After` header replacing slowapi's default plain-text body (T-32-02)
- Config-driven session TTL and per-endpoint rate-limit thresholds, all typed/defaulted/env-overridable in `Settings`

## Task Commits

Each task was committed atomically (`--no-verify`, per parallel-execution instructions; hooks are validated by the orchestrator after all parallel agents complete):

1. **Task 1: Anonymous avatar models + migration** - `9ac10c7` (feat)
2. **Task 2: Dual-key rate limiter + structured 429 handler** - `40e78d4` (feat)

**Plan metadata:** committed separately after this summary (see below)

## Files Created/Modified

- `backend/app/models/anonymous_avatar_session.py` - `AnonymousAvatarSession(Base, TimestampMixin)`: server-issued session, source of truth for expiry/quota
- `backend/app/models/avatar_interaction_log.py` - `AvatarInteractionLog(Base, TimestampMixin)`: audit trail with nullable `session_id` (`ondelete=SET NULL`)
- `backend/app/models/public_knowledge_config.py` - `PublicKnowledgeConfig(Base, TimestampMixin)`: admin-managed singleton config (agent/knowledge base/avatar per language)
- `backend/app/models/__init__.py` - re-exports the 3 new models via `__all__`
- `backend/alembic/versions/b35a_add_anonymous_avatar_tables.py` - hand-written migration (`down_revision=a34a_session_agent_pin`, the actual head); creates only the 3 new tables + FK index
- `backend/app/services/rate_limit.py` - `limiter_ip`, `limiter_session`, `get_anon_session_key`, `_KeyedLimiterProxy` (dual-key rate limiting infra, see Deviations)
- `backend/app/main.py` - registers `app.state.limiter`, `RateLimitExceeded` exception handler with structured 429 body + `Retry-After`
- `backend/app/config.py` - adds `anon_session_ttl_minutes`, `anon_rate_limit_session_create`, `anon_rate_limit_chat_ip`, `anon_rate_limit_chat_session`, `anon_rate_limit_webrtc_ip`, `anon_rate_limit_webrtc_session`
- `backend/pyproject.toml` - adds `slowapi>=0.1.10` dependency
- `backend/tests/test_avatar_models.py` - 4 tests: model defaults, nullable-FK survival, migration-applied schema shape
- `backend/tests/test_rate_limiting.py` - 6 tests: single-limiter enforcement, per-key bucket isolation, both required dual-key-independence directions, structured 429 body/headers

## Decisions Made

1. **Alembic migration hand-written, not autogenerated.** `alembic revision --autogenerate` produced a migration that also dropped/recreated an unrelated `scenarios` FK constraint and added `NOT NULL` to several pre-existing `score_details`/`system_enums` columns — drift unrelated to this plan. Deleted the autogenerated file and hand-wrote a migration containing only the 3 new tables + index, per the scope-boundary principle (don't fix unrelated pre-existing issues in this plan).
2. **`limiter_ip`/`limiter_session` share one underlying `Limiter` instance.** See Deviations below — this was a correctness requirement (Rule 1), not a stylistic choice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] slowapi silently disables the inner Limiter instance when two different `Limiter()` instances are stacked on one route**

- **Found during:** Task 2, while implementing the plan's `<behavior>`-mandated test proving Pitfall 3 (independent dual-key enforcement)
- **Issue:** The plan's literal `<action>` template creates two plain `Limiter(key_func=...)` instances (`limiter_ip`, `limiter_session`) and expects both `.limit()` decorators, stacked on one route, to enforce independently. Empirically this does not happen: slowapi's `async_wrapper` gates its automatic rate-check on `request.state._rate_limiting_complete`, a flag shared across the *entire request*, not scoped per `Limiter` instance. The outermost decorator's wrapper runs its check first and sets the flag to `True`; the inner decorator's wrapper then sees the flag already `True` and skips its own check entirely — meaning the inner instance's registered limits are never evaluated. Proven with a scratch probe (`httpx.AsyncClient` + `ASGITransport(client=(ip, port))` to vary simulated client IP per request): a route decorated with `@limiter_ip.limit("2/minute")` then `@limiter_session.limit("2/minute")`, hit 4 times with a fixed `X-Anon-Session` header and 4 different IPs, returned `200` on all 4 requests — the session limiter's 2/minute cap never tripped despite the same session key being reused 4 times.
- **Fix:** Traced slowapi internals (`Limiter._check_request_limit`, `Limiter.__evaluate_limits`, `Limiter.limit`) and confirmed `.limit()` accepts an explicit `key_func` override and that `_route_limits[endpoint_name]` accumulates every `Limit` registered for an endpoint from the *same* `Limiter` instance, all evaluated together in one `__evaluate_limits()` pass. Rewrote `rate_limit.py` so `limiter_ip` **is** the single underlying `Limiter` instance, and `limiter_session` is a thin `_KeyedLimiterProxy` whose `.limit()` delegates to that same instance with `key_func=get_anon_session_key`. Both public names, and `get_anon_session_key`, keep the exact call-site shape the plan specifies (`@limiter_ip.limit(...)`, `@limiter_session.limit(...)`) — call sites in later plans (32-02/03) need no changes.
- **Files modified:** `backend/app/services/rate_limit.py`, `backend/app/main.py` (comment updated to explain the shared-instance design), `backend/tests/test_rate_limiting.py`
- **Verification:** Re-ran the same probe pattern against the fixed implementation — both directions (fixed session + 4 changing IPs; fixed IP + 4 changing sessions) now correctly return `200, 200, 429, 429`. Formalized as 3 tests in `test_rate_limiting.py` (`TestDualKeyIndependentEnforcement`), all passing.
- **Committed in:** `40e78d4` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary for correctness — the plan's own `<behavior>` section required exactly the independent-enforcement property that the literal `<action>` template would have failed to deliver. No scope creep: the public API (`limiter_ip`, `limiter_session`, `get_anon_session_key`) and all Settings/main.py wiring match the plan exactly; only the internal implementation of `rate_limit.py` changed.

## Issues Encountered

- **Full backend regression suite (2,718 tests) was infeasible to run to completion within this session** (projected ~60 min at observed throughput, well beyond a reasonable session-continuation window). Verified instead via: (1) `from app.main import app` imports cleanly and `app.state.limiter` is a live `Limiter` instance with all 187 routes intact; (2) a targeted 140-test run across `test_health.py`, `test_config_api.py`, `test_config_service.py`, `test_exceptions.py`, `test_avatar_models.py`, `test_rate_limiting.py`, `test_session_service.py`, `test_sessions_api.py`, `test_auth.py`, `test_azure_auth.py` — all 140 passed. This is a reasonable proxy given the changes are purely additive to `main.py`/`config.py` (new Settings fields with defaults, a new exception handler that only fires for `RateLimitExceeded`, which isn't wired into any production route in this plan) and cannot plausibly affect unrelated business-logic tests. Recommend a full `pytest --no-cov` run as part of any pre-merge CI gate.
- Alembic head assumption was initially wrong (`z33a_drop_hcp_voice_fields` instead of the actual head `a34a_session_agent_pin`) — caught via `alembic heads` before the migration was finalized; new revision correctly chains from the real head as `b35a_add_anonymous_avatar_tables`.
- `AsyncSession.get_bind()` returns the sync `Engine`, not an async-capable object — schema-inspection test fixed to use `await db_session.connection()` (an `AsyncConnection`) then `conn.run_sync(...)`.

## User Setup Required

None — no external service configuration required. `slowapi` was installed into the existing `.venv` automatically as part of Task 2.

## Next Phase Readiness

- Plans 32-02 through 32-05 can now depend on: the 3 new tables being present via a real, reversible migration; `limiter_ip`/`limiter_session` being genuinely independent and safe to stack on new anonymous-avatar routes exactly as documented; the `RATE_LIMITED` structured error shape; and all `anon_*` Settings fields for session TTL and per-endpoint thresholds.
- No blockers. One recommendation carried forward: any later plan that decorates a real production route with both `limiter_ip.limit(...)` and `limiter_session.limit(...)` should add at least one integration test proving both limits still trip independently on that specific route (the infra is proven generically here, but route-specific wiring — e.g. accidental `override_defaults` interactions — is cheap to regress-test).

---
*Phase: 32-anonymous-grounded-avatar-q-a*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 7 key files created verified present on disk; both task commits (`9ac10c7`, `40e78d4`) verified present in git log.
