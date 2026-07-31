# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Layered monorepo with REST API backend and SPA frontend

**Key Characteristics:**
- Strict separation between frontend (React SPA) and backend (FastAPI ASGI)
- Backend follows a layered architecture: Router -> Schema -> Service -> Model -> Database
- AI coaching logic is abstracted via an adapter/strategy pattern with a singleton registry
- Communication between frontend and backend is REST + WebSocket over `/api/` prefix
- Frontend proxies API calls through Vite dev server (dev) or nginx reverse proxy (prod)
- Async throughout the backend (async SQLAlchemy, async FastAPI handlers)

## Layers

**HTTP / Router Layer:**
- Purpose: Accept HTTP requests, validate input via Pydantic schemas, delegate to services, return responses
- Location: `backend/app/api/`
- Contains: FastAPI router modules, one per domain (auth, sessions, scoring, HCP profiles)
- Depends on: Schema layer, Service layer, Dependencies (`get_db`, `get_current_user`)
- Used by: Frontend API client, external consumers
- Note: Currently `backend/app/api/__init__.py` is empty -- no routers are implemented yet. The `backend/app/main.py` does not include any router registrations.

**Schema / Validation Layer:**
- Purpose: Define request/response data shapes using Pydantic v2
- Location: `backend/app/schemas/`
- Contains: Pydantic BaseModel subclasses with `ConfigDict(from_attributes=True)`
- Depends on: Nothing (pure data definitions)
- Used by: Router layer for request validation and response serialization
- Note: Currently `backend/app/schemas/__init__.py` is empty -- no schemas defined yet.

**Service / Business Logic Layer:**
- Purpose: Encapsulate domain business logic, orchestrate AI adapters, handle training session lifecycle
- Location: `backend/app/services/`
- Contains: Service classes/functions, AI coaching adapter framework
- Depends on: Model layer, AI adapter subsystem, external AI SDKs
- Used by: Router layer
- Note: Currently only the agent adapter subsystem is implemented.

**AI Adapter Subsystem:**
- Purpose: Provide a pluggable interface for multiple AI providers (Claude, Azure OpenAI, GPT-4, Mock)
- Location: `backend/app/services/agents/`
- Contains: Abstract base class, adapter registry (singleton), concrete adapter implementations
- Depends on: AI provider SDKs (openai, anthropic)
- Used by: Service layer
- Key files:
  - `backend/app/services/agents/base.py` -- `BaseCoachingAdapter` ABC, `CoachRequest`, `CoachEvent`, `CoachEventType`
  - `backend/app/services/agents/registry.py` -- `AdapterRegistry` singleton with `register()`, `get()`, `discover()`
  - `backend/app/services/agents/adapters/mock.py` -- `MockCoachingAdapter` for dev/test

**Model / ORM Layer:**
- Purpose: Define database tables and relationships via SQLAlchemy 2.0 declarative models
- Location: `backend/app/models/`
- Contains: ORM model classes inheriting from `Base` and using `TimestampMixin`
- Depends on: SQLAlchemy, `backend/app/models/base.py` for `Base` and `TimestampMixin`
- Used by: Service layer, Alembic migrations
- Note: Currently only `Base` and `TimestampMixin` are defined. No domain models (User, Session, etc.) exist yet.

**Database / Persistence Layer:**
- Purpose: Manage async database connections and sessions
- Location: `backend/app/database.py`
- Contains: Async engine creation, session factory, `get_db()` dependency
- Depends on: `backend/app/config.py` for `database_url`
- Used by: Dependencies layer, test fixtures
- Pattern: `async with AsyncSessionLocal() as session` with auto-commit/rollback

**Dependency Injection Layer:**
- Purpose: Provide FastAPI dependency injection callables
- Location: `backend/app/dependencies.py`
- Contains: Re-exports `get_db` from database module
- Depends on: Database layer
- Used by: Router layer via `Depends()`
- Note: `get_current_user` is not yet implemented (marked as TODO).

**Configuration Layer:**
- Purpose: Centralize application settings using pydantic-settings
- Location: `backend/app/config.py`
- Contains: `Settings` class (reads from `.env`), `get_settings()` with `@lru_cache`
- Depends on: Environment variables / `.env` file
- Used by: All backend layers

**Utility Layer:**
- Purpose: Shared cross-cutting utilities
- Location: `backend/app/utils/`
- Contains:
  - `backend/app/utils/exceptions.py` -- `AppException` hierarchy (`NotFoundException`, `ValidationException`, `ConflictException`) and helper raisers (`not_found()`, `bad_request()`)
  - `backend/app/utils/pagination.py` -- Generic `PaginatedResponse[T]` Pydantic model with `create()` factory

**Frontend API Layer:**
- Purpose: Typed HTTP client for backend communication
- Location: `frontend/src/api/`
- Contains: `frontend/src/api/client.ts` -- Axios instance with JWT interceptor and 401 redirect
- Depends on: Axios, localStorage for JWT token
- Used by: TanStack Query hooks (planned in `frontend/src/hooks/`)

**Frontend Component Layer:**
- Purpose: UI components organized by domain and reusability
- Location: `frontend/src/components/`
- Contains:
  - `frontend/src/components/shared/` -- Reusable UI components (empty, placeholder)
  - `frontend/src/components/coach/` -- AI coaching domain components (empty, placeholder)
- Depends on: React, design tokens from `frontend/src/styles/index.css`
- Used by: Page components

**Frontend State Layer:**
- Purpose: Client-side state management
- Location: `frontend/src/stores/` (auth), `frontend/src/contexts/` (agent routing), `frontend/src/hooks/` (server state)
- Contains: Empty placeholder directories -- no implementations yet
- Pattern (planned): TanStack Query for server state, lightweight store for auth, React Context for agent routing

**Frontend Pages Layer:**
- Purpose: Route-level page components
- Location: `frontend/src/pages/`
- Contains: Empty placeholder directory -- no page implementations yet
- Depends on: Component layer, hooks, stores

## Data Flow

**API Request Flow (Backend):**

1. HTTP request arrives at FastAPI app (`backend/app/main.py`)
2. CORS middleware processes the request
3. Request is routed to the appropriate router in `backend/app/api/`
4. Router validates input using Pydantic schemas from `backend/app/schemas/`
5. Router injects dependencies (`get_db`, `get_current_user`) via FastAPI `Depends()`
6. Router delegates to service functions in `backend/app/services/`
7. Service interacts with ORM models in `backend/app/models/` via `AsyncSession`
8. Response is serialized back through Pydantic schema and returned

**AI Avataring Interaction Flow:**

1. Client sends a coaching request (text or audio)
2. Service layer constructs a `CoachRequest` with session context, HCP profile, and scoring criteria
3. Service retrieves the appropriate adapter from `AdapterRegistry.get(name)`
4. Adapter's `execute()` method is called, returning an `AsyncIterator[CoachEvent]`
5. Events are streamed back (types: `TEXT`, `AUDIO`, `SCORE`, `SUGGESTION`, `ERROR`, `DONE`)
6. Service persists conversation and scoring data

**Frontend -> Backend Communication:**

1. Frontend API client (`frontend/src/api/client.ts`) sends requests to `/api/v1/...`
2. In development: Vite dev server proxies `/api` to `http://localhost:8000` (`frontend/vite.config.ts`)
3. In production: nginx reverse proxy forwards `/api/` to backend container (`frontend/nginx.conf`)
4. JWT token is automatically attached via Axios request interceptor
5. 401 responses trigger automatic redirect to `/login`

**State Management (Planned):**
- Server state: TanStack Query v5 hooks in `frontend/src/hooks/` per domain
- Auth state: Lightweight store in `frontend/src/stores/` (JWT token + user info in localStorage)
- UI state: React local state + Context in `frontend/src/contexts/` for agent routing

## Key Abstractions

**BaseCoachingAdapter:**
- Purpose: Strategy pattern interface for swappable AI providers
- Examples: `backend/app/services/agents/base.py`, `backend/app/services/agents/adapters/mock.py`
- Pattern: Abstract base class with `execute()` returning `AsyncIterator[CoachEvent]`
- New adapters implement `BaseCoachingAdapter` and register via `AdapterRegistry.register()`

**AdapterRegistry:**
- Purpose: Singleton that manages available AI coaching adapters at runtime
- Examples: `backend/app/services/agents/registry.py`
- Pattern: Singleton with `register()`, `get()`, `list_available()`, `discover()` (async availability check)
- Access via module-level `registry` instance

**CoachEvent / CoachRequest:**
- Purpose: Domain value objects for coaching interactions
- Examples: `backend/app/services/agents/base.py`
- Pattern: Dataclasses representing the input/output contract for all coaching adapters
- `CoachEventType` enum: `TEXT`, `AUDIO`, `SCORE`, `SUGGESTION`, `ERROR`, `DONE`

**AppException Hierarchy:**
- Purpose: Structured error responses with code, message, and details
- Examples: `backend/app/utils/exceptions.py`
- Pattern: Custom HTTPException subclasses with convenience raiser functions (`not_found()`, `bad_request()`)
- Global exception handler in `backend/app/main.py` converts to `{"code": "...", "message": "...", "details": {...}}`

**PaginatedResponse[T]:**
- Purpose: Generic paginated response envelope
- Examples: `backend/app/utils/pagination.py`
- Pattern: Generic Pydantic model with `create()` class method for auto-calculating `total_pages`

**TimestampMixin:**
- Purpose: Provide UUID primary key and automatic created_at/updated_at timestamps
- Examples: `backend/app/models/base.py`
- Pattern: Mixin class added to all ORM models via multiple inheritance
- Fields: `id` (String(36) UUID), `created_at` (server_default=now), `updated_at` (onupdate=now)

**Settings:**
- Purpose: Centralized, typed configuration with env var loading
- Examples: `backend/app/config.py`
- Pattern: pydantic-settings `BaseSettings` with `@lru_cache` singleton accessor `get_settings()`

## Entry Points

**Backend Application:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app` command
- Responsibilities: Creates FastAPI app, configures CORS, registers global exception handler, manages lifespan (table creation on startup, engine disposal on shutdown), serves `/api/health` endpoint
- Note: No routers are currently included -- only the health check endpoint exists

**Frontend Application:**
- Location: `frontend/index.html` (not yet created -- placeholder)
- Triggers: Vite dev server (`npm run dev`) or nginx serving built SPA
- Responsibilities: Bootstraps React app, sets up routing, provides query client

**Database Initialization:**
- Location: `backend/scripts/init_db.py` (referenced in CI but not yet present in scripts/)
- Triggers: Manual execution or CI pipeline
- Responsibilities: Initialize database schema

**Database Seeding:**
- Location: `backend/scripts/seed_data.py` (referenced in CI but not yet present in scripts/)
- Triggers: Manual execution or CI pipeline
- Responsibilities: Populate database with initial/test data

**Alembic Migrations:**
- Location: `backend/alembic/` (directory exists but no `env.py` or migrations yet)
- Triggers: `alembic upgrade head`, `alembic revision --autogenerate`
- Responsibilities: Schema versioning and migration

**CI/CD Pipeline:**
- Location: `.github/workflows/ci.yml`
- Triggers: Push to main, pull requests to main
- Responsibilities: Backend lint/test, frontend typecheck/build, E2E tests (Playwright), deploy to Azure Container Apps

## Error Handling

**Strategy:** Structured exception hierarchy with global handler

**Patterns:**
- All application errors extend `AppException` (which extends FastAPI's `HTTPException`) in `backend/app/utils/exceptions.py`
- Specialized exceptions: `NotFoundException` (404), `ValidationException` (422), `ConflictException` (409)
- Convenience raiser functions with `-> NoReturn` annotation: `not_found()`, `bad_request()`
- Global exception handler in `backend/app/main.py` converts `AppException` to JSON: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- Database sessions auto-rollback on exception in `backend/app/database.py` `get_db()` generator
- Frontend Axios interceptor in `frontend/src/api/client.ts` handles 401 by clearing token and redirecting to `/login`

## Cross-Cutting Concerns

**Logging:** Not yet configured. No structured logging framework is in place. FastAPI's default logging applies.

**Validation:** Pydantic v2 schemas handle request/response validation at the router layer. SQLAlchemy column constraints at the model layer.

**Authentication:** JWT Bearer token strategy planned. `python-jose` + `passlib[bcrypt]` are dependencies. `get_current_user` dependency is TODO in `backend/app/dependencies.py`. Frontend stores token in `localStorage` and attaches via Axios interceptor.

**Database Migrations:** Alembic configured (directory exists at `backend/alembic/`) but no `env.py` or migration versions are present yet.

**CORS:** Configured in `backend/app/main.py` via `CORSMiddleware` with origins from `Settings.cors_origins` (default: `http://localhost:5173,http://localhost:3000`).

**API Versioning:** All routes planned under `/api/v1/` prefix (set in `backend/app/config.py` as `api_prefix`). Health check is at `/api/health` (unversioned).

---

*Architecture analysis: 2026-03-24*
