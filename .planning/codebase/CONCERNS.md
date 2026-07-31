# Codebase Concerns

**Analysis Date:** 2026-03-24

## Tech Debt

**Authentication Not Implemented:**
- Issue: The entire auth layer is stubbed out. `backend/app/dependencies.py` contains only a TODO comment for `get_current_user`. No JWT token generation, no login endpoint, no user model exists. The `secret_key` and JWT settings in `backend/app/config.py` (lines 16-18) are configured but unused.
- Files: `backend/app/dependencies.py`, `backend/app/config.py`
- Impact: All API endpoints are completely unprotected. Any client can access any endpoint without authentication. This blocks all user-specific features: personal dashboards, role-based access, audit trails (NFR-1), and training path personalization (FR-7.5).
- Fix approach: Implement User model, auth router with login/register endpoints, JWT token generation/validation, and a `get_current_user` dependency. Wire it into all protected routes via FastAPI's `Depends()`.

**No Domain Models Exist:**
- Issue: Beyond `Base` and `TimestampMixin` in `backend/app/models/base.py`, zero domain models have been created. The architecture wiki (`wiki/Architecture.md`) documents 8 key domain models (User, HCPProfile, Scenario, Session, Conversation, Assessment, TrainingMaterial, Report) but none are implemented.
- Files: `backend/app/models/__init__.py`, `backend/app/models/base.py`
- Impact: The entire application has no data persistence capability. No training sessions, no scenarios, no scoring, no reports can be stored. This is the foundational blocker for all functional requirements.
- Fix approach: Create model files in `backend/app/models/` following the `TimestampMixin` pattern. Import all models in `backend/app/models/__init__.py` so Alembic can discover them. Generate initial migration.

**No API Routers Exist:**
- Issue: `backend/app/api/__init__.py` is empty (0 bytes). No routers are registered. The only endpoint is the health check in `backend/app/main.py`. The `api_prefix` setting (`/api/v1`) in `backend/app/config.py` is defined but never used to mount any router.
- Files: `backend/app/api/__init__.py`, `backend/app/main.py`
- Impact: The backend cannot serve any business functionality. The frontend API client (`frontend/src/api/client.ts`) targets `/api/v1` but nothing responds there.
- Fix approach: Create routers in `backend/app/api/` (one per domain: auth, sessions, scenarios, hcp_profiles, scoring, reports). Mount them under `settings.api_prefix` in `backend/app/main.py`.

**No Alembic Configuration:**
- Issue: The `backend/alembic/` directory exists with an empty `versions/` folder, but there is no `alembic.ini` or `alembic/env.py` file. Alembic cannot run migrations.
- Files: `backend/alembic/` (missing `alembic.ini`, `alembic/env.py`)
- Impact: Database schema changes cannot be managed properly. The app currently uses `Base.metadata.create_all` in the lifespan handler (`backend/app/main.py` line 19), which bypasses migration tracking entirely. This violates the project's own "NEVER modify schema without an Alembic migration" rule in CLAUDE.md.
- Fix approach: Run `alembic init alembic` from `backend/`, configure `alembic.ini` with the database URL, update `env.py` to import all models and use async engine. Generate the initial migration.

**Frontend Is a Skeleton:**
- Issue: The frontend has only 3 source files: `frontend/src/api/client.ts` (API client), `frontend/src/lib/utils.ts` (cn utility), and `frontend/src/styles/index.css` (design tokens). There is no `App.tsx`, no `main.tsx`, no `index.html`, no pages, no components, no routing, no state management, no hooks, and no types. All directories under `frontend/src/` (pages, components/coach, components/shared, hooks, stores, contexts, types) are empty.
- Files: `frontend/src/` (nearly all subdirectories empty)
- Impact: The frontend application cannot render anything. The build will likely fail since there is no entry point. The CI pipeline's `tsc -b && npm run build` step will break.
- Fix approach: Create `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx` with React Router setup, and begin implementing page components.

**Missing Backend Scripts:**
- Issue: `backend/scripts/` directory is empty. The CI pipeline (`e2e-test` job in `.github/workflows/ci.yml` lines 83-85) references `python scripts/init_db.py` and `python scripts/seed_data.py`, which do not exist.
- Files: `backend/scripts/` (empty), `.github/workflows/ci.yml` lines 83-85
- Impact: The E2E test job in CI will fail. Local development quick-start instructions in CLAUDE.md reference these scripts but they cannot be run.
- Fix approach: Create `backend/scripts/init_db.py` (initialize database with Alembic or create_all) and `backend/scripts/seed_data.py` (insert sample scenarios, HCP profiles, test users).

**No Lockfile for Frontend:**
- Issue: `package-lock.json` is missing from the `frontend/` directory. The CI pipeline uses `npm ci` which requires a lockfile.
- Files: `frontend/` (missing `package-lock.json`), `.github/workflows/ci.yml` line 57 (caches from `frontend/package-lock.json`)
- Impact: `npm ci` will fail in CI. Local installs with `npm install` produce non-deterministic builds. CI cache for npm dependencies will miss.
- Fix approach: Run `npm install` once locally in `frontend/` to generate `package-lock.json` and commit it.

**Only Mock AI Adapter Implemented:**
- Issue: The adapter registry pattern (`backend/app/services/agents/`) is well-designed but only the mock adapter exists at `backend/app/services/agents/adapters/mock.py`. The architecture documents Claude, Azure OpenAI, and GPT-4 adapters but none are implemented. The mock adapter is never registered with the global `registry` instance.
- Files: `backend/app/services/agents/adapters/mock.py`, `backend/app/services/agents/registry.py`
- Impact: No real AI coaching functionality is available. The adapter is not wired into any endpoint or service layer. The registry singleton in `backend/app/services/agents/registry.py` line 34 is instantiated but `registry.register()` is never called.
- Fix approach: Register the mock adapter in the app lifespan. Implement at least one production adapter (Azure OpenAI is likely first given the config settings). Create a service layer function that uses the registry to route requests.

**Lifespan Uses create_all Instead of Migrations:**
- Issue: `backend/app/main.py` line 19 calls `Base.metadata.create_all` directly on startup. This bypasses Alembic entirely and will not apply column changes, index additions, or constraint modifications to existing databases.
- Files: `backend/app/main.py` lines 17-19
- Impact: Schema drift between what the code expects and what the database contains. Works for fresh databases but fails for any incremental schema evolution.
- Fix approach: Replace `create_all` with `alembic upgrade head` called programmatically or via subprocess. Keep `create_all` only for test fixtures.

## Known Bugs

**CI E2E Pipeline Will Fail:**
- Symptoms: The `e2e-test` job in `.github/workflows/ci.yml` will fail at the "Initialize database" step because `backend/scripts/init_db.py` and `backend/scripts/seed_data.py` do not exist.
- Files: `.github/workflows/ci.yml` lines 81-85, `backend/scripts/` (empty)
- Trigger: Any push or PR to `main` branch that reaches the e2e-test stage.
- Workaround: None. The scripts must be created.

**Frontend Build Will Fail:**
- Symptoms: `tsc -b` and `npm run build` will fail because there is no application entry point (`main.tsx`, `App.tsx`, `index.html`).
- Files: `frontend/` (missing entry points)
- Trigger: Running `npm run build` or the `frontend-test` CI job.
- Workaround: None. The entry point files must be created.

**AdapterRegistry Singleton Shares State Across Tests:**
- Symptoms: The `AdapterRegistry` uses a class-level `_adapters` dict and `__new__` singleton pattern (`backend/app/services/agents/registry.py` lines 7-14). Registered adapters persist across test cases because the singleton is never reset.
- Files: `backend/app/services/agents/registry.py`
- Trigger: Multiple test cases that register different adapters.
- Workaround: Manually clear `registry._adapters` in test teardown. Better fix: add a `reset()` method or use dependency injection instead of a module-level singleton.

## Security Considerations

**Hardcoded JWT Secret Key:**
- Risk: `backend/app/config.py` line 16 sets `secret_key: str = "change-me-in-production"`. If a `.env` file is not provided or the `SECRET_KEY` variable is not set, the application runs with this known default secret. An attacker could forge valid JWT tokens.
- Files: `backend/app/config.py` line 16
- Current mitigation: The `.env.example` file contains the same default. There is no validation that the secret key has been changed.
- Recommendations: Add a startup check in the lifespan handler that raises an error if `secret_key` equals the default value when `debug` is `False`. Use `secrets.token_urlsafe(32)` as the example value.

**No Rate Limiting:**
- Risk: No rate limiting middleware is configured on any endpoint. Once auth endpoints exist, brute-force password attacks are trivially possible. AI adapter calls (which consume paid API quota) can be abused.
- Files: `backend/app/main.py`
- Current mitigation: None.
- Recommendations: Add `slowapi` or a custom middleware for rate limiting. Apply stricter limits to auth endpoints and AI adapter endpoints.

**CORS Allows All Methods and Headers:**
- Risk: `backend/app/main.py` lines 36-37 set `allow_methods=["*"]` and `allow_headers=["*"]`. This is overly permissive for production.
- Files: `backend/app/main.py` lines 32-38
- Current mitigation: `cors_origins` is at least configurable and defaults to localhost only.
- Recommendations: Restrict `allow_methods` to `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]` and `allow_headers` to specific required headers (`Authorization`, `Content-Type`).

**localStorage for JWT Tokens (XSS Vulnerability):**
- Risk: `frontend/src/api/client.ts` line 13 reads the token from `localStorage.getItem("access_token")`. Tokens stored in localStorage are accessible to any JavaScript running on the page, making them vulnerable to XSS attacks.
- Files: `frontend/src/api/client.ts` lines 13-14
- Current mitigation: None.
- Recommendations: Use HttpOnly cookies for token storage instead of localStorage. Configure the backend to set tokens as HttpOnly, Secure, SameSite cookies.

**No Input Validation on AI Adapter:**
- Risk: `CoachRequest` in `backend/app/services/agents/base.py` accepts arbitrary strings for `message`, `scenario_context`, and dicts for `hcp_profile` and `scoring_criteria` with no validation. Prompt injection attacks could manipulate the AI adapter behavior.
- Files: `backend/app/services/agents/base.py` lines 24-30
- Current mitigation: None.
- Recommendations: Add Pydantic validation schemas for AI requests with max lengths, content filtering, and structured types instead of raw dicts.

## Performance Bottlenecks

**SQLite for Production Risk:**
- Problem: The default `DATABASE_URL` in `backend/app/config.py` line 13 is SQLite (`sqlite+aiosqlite:///./ai_coach.db`). SQLite has single-writer concurrency limitations.
- Files: `backend/app/config.py` line 13, `backend/app/database.py`
- Cause: SQLite is appropriate for development but will bottleneck under concurrent write operations in production (multiple MRs training simultaneously).
- Improvement path: The PostgreSQL dependency group exists in `backend/pyproject.toml` lines 36-39. Ensure production deployments always use PostgreSQL via the `DATABASE_URL` environment variable.

**No Connection Pooling Configuration:**
- Problem: `create_async_engine` in `backend/app/database.py` line 9 is called with no pool configuration parameters (`pool_size`, `max_overflow`, `pool_pre_ping`).
- Files: `backend/app/database.py` lines 9-12
- Cause: Default pool settings may be insufficient for production load.
- Improvement path: Add `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True` for PostgreSQL. Add `connect_args={"check_same_thread": False}` for SQLite.

**Adapter Discovery Runs Sequentially:**
- Problem: `AdapterRegistry.discover()` in `backend/app/services/agents/registry.py` lines 25-30 calls `is_available()` sequentially for each adapter. With multiple adapters checking remote service health, this accumulates latency.
- Files: `backend/app/services/agents/registry.py` lines 25-30
- Cause: Sequential `await` in a for loop.
- Improvement path: Use `asyncio.gather()` to check all adapter availability concurrently.

## Fragile Areas

**Singleton AdapterRegistry Pattern:**
- Files: `backend/app/services/agents/registry.py`
- Why fragile: The `__new__` singleton with class-level `_adapters` dict is shared globally. It is difficult to test in isolation, cannot be reset between tests without accessing private state, and breaks in multiprocessing scenarios (e.g., Gunicorn workers each get a separate singleton).
- Safe modification: Use FastAPI's dependency injection system instead. Create the registry in the lifespan handler and store it in `app.state`. Inject via `Depends()`.
- Test coverage: Only the mock adapter has tests. The registry itself has no dedicated tests.

**Settings Cache via lru_cache:**
- Files: `backend/app/config.py` lines 37-39
- Why fragile: `@lru_cache` on `get_settings()` means the settings object is created once and cached forever. Tests that need to override settings (different database URL, different secret) cannot easily do so without clearing the cache.
- Safe modification: Use `get_settings.cache_clear()` in test fixtures. Alternatively, use FastAPI `Depends(get_settings)` pattern and override in tests via `app.dependency_overrides`.
- Test coverage: `backend/tests/conftest.py` overrides `get_db` but does not override settings, relying on defaults.

**Database Session Auto-Commit:**
- Files: `backend/app/database.py` lines 21-28
- Why fragile: The `get_db` generator auto-commits on successful yield and auto-rolls-back on exception. If a route handler performs multiple logical operations, a failure partway through leaves a partially committed state because the commit happens after the entire request, not per-operation.
- Safe modification: Consider explicit `session.commit()` calls in service functions for multi-step operations, with the auto-commit as a safety net for simple CRUD.
- Test coverage: The same pattern is replicated in `backend/tests/conftest.py` lines 26-33 for test sessions.

## Scaling Limits

**SQLite Single-Writer:**
- Current capacity: One concurrent write at a time.
- Limit: Multiple simultaneous training sessions writing conversation records will queue behind a single writer lock.
- Scaling path: Switch to PostgreSQL (dependency group already defined in `backend/pyproject.toml`).

**No WebSocket Infrastructure:**
- Current capacity: WebSocket support is referenced in `frontend/vite.config.ts` proxy config (line 19) and `frontend/nginx.conf` (lines 25-26), but no WebSocket endpoints exist in the backend.
- Limit: Real-time streaming of AI coaching responses (as designed in the adapter's `AsyncIterator[CoachEvent]` pattern) cannot be delivered to the frontend without WebSocket or SSE endpoints.
- Scaling path: Implement a WebSocket endpoint in the backend that consumes `adapter.execute()` events and streams them to the client.

## Dependencies at Risk

**python-jose:**
- Risk: The `python-jose` package (`backend/pyproject.toml` line 18) has had infrequent maintenance. The PyJWT package is the more actively maintained alternative in the Python ecosystem.
- Impact: Potential security vulnerabilities if JWT-related CVEs are not patched promptly.
- Migration plan: Replace `python-jose` with `PyJWT` (drop-in for most JWT operations). Update import statements from `jose` to `jwt`.

## Missing Critical Features

**No Frontend Entry Point:**
- Problem: There is no `index.html`, `main.tsx`, or `App.tsx`. The frontend cannot render anything.
- Blocks: All user-facing functionality. The application is not usable by end users.

**No Service Layer:**
- Problem: `backend/app/services/__init__.py` is empty. No business logic service classes exist beyond the coaching adapter abstraction.
- Blocks: Cannot implement any domain operations (create session, score interaction, generate report). Routers would have to embed business logic directly, violating the layered architecture.

**No Pydantic Schemas:**
- Problem: `backend/app/schemas/__init__.py` is empty. No request/response schemas exist.
- Blocks: Cannot define API contracts. No request validation beyond what FastAPI provides by default.

**No Frontend .env.example:**
- Problem: `frontend/.env.example` does not exist. CLAUDE.md quick-start instructions say `cp .env.example .env` for the frontend, but the file is missing.
- Blocks: Developers do not know what environment variables the frontend needs (e.g., `VITE_API_BASE_URL`).

## Test Coverage Gaps

**Zero Domain Logic Tests:**
- What's not tested: No domain models, no service functions, no API endpoints beyond health check. The only backend tests cover: health endpoint (1 test), mock adapter (3 tests), and schema integrity of an empty schema (2 tests).
- Files: `backend/tests/` (3 test files, 6 total tests)
- Risk: As domain code is added, there is no baseline to catch regressions. The schema integrity test (`backend/tests/test_schema_integrity.py` line 22) passes vacuously with `assert len(declared_tables) >= 0` which is always true.
- Priority: High -- tests should be written alongside each new model, service, and router.

**No Frontend Tests:**
- What's not tested: There are no unit tests for the frontend. No component tests, no hook tests, no integration tests. Only 2 E2E tests exist in `frontend/e2e/health.spec.ts` (health check + page load).
- Files: `frontend/e2e/health.spec.ts` (2 tests total)
- Risk: Frontend UI regressions will go undetected. As components are built, testing infrastructure (Vitest or similar) needs to be added.
- Priority: Medium -- add Vitest config and component testing utilities as components are created.

**E2E Tests Cannot Currently Run:**
- What's not tested: The Playwright config (`frontend/e2e/playwright.config.ts`) references starting the backend and frontend as web servers, but the frontend has no entry point to serve. The "frontend loads" test expects a title matching `/AI Avatar/` but no HTML page exists.
- Files: `frontend/e2e/playwright.config.ts`, `frontend/e2e/health.spec.ts`
- Risk: The E2E safety net is non-functional. CI will fail at the e2e-test stage.
- Priority: High -- fix once the frontend entry point is created.

**Schema Integrity Test Is Vacuous:**
- What's not tested: `backend/tests/test_schema_integrity.py` line 22 asserts `len(declared_tables) >= 0`, which is mathematically always true (including when there are zero tables). The test provides zero verification value.
- Files: `backend/tests/test_schema_integrity.py` line 22
- Risk: Schema drift between models and migrations will not be caught.
- Priority: Medium -- change assertion to `> 0` once the first domain model is added, and add actual Alembic migration comparison logic.

---

*Concerns audit: 2026-03-24*
