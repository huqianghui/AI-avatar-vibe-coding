# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
AI-avatar-vibe-coding/
├── .claude/                # Claude Code agent configs and GSD tooling
├── .github/
│   ├── scripts/            # Automation scripts (wiki gen, project sync)
│   └── workflows/          # CI/CD workflows (ci.yml, sync-wiki.yml, sync-project.yml)
├── .planning/
│   └── codebase/           # GSD codebase analysis documents (this file lives here)
├── backend/
│   ├── alembic/
│   │   └── versions/       # Alembic migration scripts (empty)
│   ├── app/
│   │   ├── api/            # FastAPI routers, one per domain (empty)
│   │   ├── data/           # Static/seed data files (empty)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic v2 request/response schemas (empty)
│   │   ├── services/       # Business logic
│   │   │   └── agents/     # AI coaching adapter subsystem
│   │   │       └── adapters/  # Concrete AI provider adapters
│   │   ├── utils/          # Shared utilities (exceptions, pagination)
│   │   ├── config.py       # pydantic-settings configuration
│   │   ├── database.py     # Async SQLAlchemy engine + session factory
│   │   ├── dependencies.py # FastAPI DI: get_db (get_current_user TODO)
│   │   └── main.py         # FastAPI app, lifespan, CORS, health check
│   ├── scripts/            # DB init/seed scripts (empty)
│   ├── tests/              # pytest test suite
│   ├── Dockerfile          # Single-stage Python 3.11 image
│   └── pyproject.toml      # Dependencies, tool config (ruff, pytest)
├── frontend/
│   ├── e2e/                # Playwright E2E tests
│   ├── public/             # Static assets served as-is
│   ├── src/
│   │   ├── api/            # Axios client with JWT interceptor
│   │   ├── components/
│   │   │   ├── coach/      # AI coaching domain components (empty)
│   │   │   └── shared/     # Reusable UI components (empty)
│   │   ├── contexts/       # React contexts for agent routing (empty)
│   │   ├── hooks/          # TanStack Query hooks per domain (empty)
│   │   ├── lib/            # Utility functions (cn helper)
│   │   ├── pages/          # Route-level page components (empty)
│   │   ├── stores/         # Auth store (empty)
│   │   ├── styles/         # Design tokens + Tailwind theme
│   │   └── types/          # TypeScript type definitions (empty)
│   ├── Dockerfile          # Multi-stage: Node build -> nginx serve
│   ├── nginx.conf          # Production reverse proxy + SPA config
│   ├── package.json        # Dependencies and scripts
│   ├── tsconfig.json       # TypeScript strict mode config
│   └── vite.config.ts      # Vite + React + Tailwind + API proxy
├── docs/
│   ├── plans/              # Implementation plans (empty)
│   ├── specs/              # Module specifications (empty)
│   ├── requirements.md     # Business requirements
│   ├── requirements-cn.md  # Business requirements (Chinese)
│   ├── best-practices.md   # Engineering patterns reference
│   ├── capgemini-ai-coach-solution.md    # Solution overview
│   └── capgemini-ai-coach-solution-cn.md # Solution overview (Chinese)
├── wiki/                   # Auto-synced to GitHub Wiki
│   ├── Home.md
│   ├── Architecture.md
│   ├── Dev-Onboarding.md
│   ├── Roadmap.md
│   ├── Changelog.md
│   └── _Sidebar.md
├── infra/                  # Azure deployment scripts (empty)
├── pdf/                    # Reference PDFs and images
├── CLAUDE.md               # Engineering handbook (master reference)
├── docker-compose.yml      # Local dev orchestration
└── .gitignore
```

## Directory Purposes

**`backend/app/api/`:**
- Purpose: FastAPI router modules, one file per domain
- Contains: Router files (e.g., `auth.py`, `sessions.py`, `scoring.py`, `hcp_profiles.py`)
- Key files: Currently empty `__init__.py` only
- New routers must be registered in `backend/app/main.py` via `app.include_router()`

**`backend/app/models/`:**
- Purpose: SQLAlchemy 2.0 declarative ORM models
- Contains: Model classes that inherit from `Base` and use `TimestampMixin`
- Key files: `backend/app/models/base.py` (Base declarative class + TimestampMixin), `backend/app/models/__init__.py` (re-exports)
- All models MUST be imported in `__init__.py` so Alembic can discover them

**`backend/app/schemas/`:**
- Purpose: Pydantic v2 request/response schemas
- Contains: Schema classes for API validation and serialization
- Key files: Currently empty `__init__.py` only
- Must use `model_config = ConfigDict(from_attributes=True)` for ORM compatibility

**`backend/app/services/`:**
- Purpose: Business logic layer, AI adapter orchestration
- Contains: Service functions/classes, AI coaching adapter subsystem
- Key files: `backend/app/services/agents/base.py`, `backend/app/services/agents/registry.py`

**`backend/app/services/agents/`:**
- Purpose: AI coaching adapter framework (strategy pattern)
- Contains: Base class, registry, and concrete adapter implementations
- Key files:
  - `backend/app/services/agents/base.py` -- `BaseCoachingAdapter`, `CoachRequest`, `CoachEvent`, `CoachEventType`
  - `backend/app/services/agents/registry.py` -- `AdapterRegistry` singleton
  - `backend/app/services/agents/adapters/mock.py` -- `MockCoachingAdapter`

**`backend/app/utils/`:**
- Purpose: Shared cross-cutting utilities
- Contains: Exception classes, pagination helper
- Key files: `backend/app/utils/exceptions.py`, `backend/app/utils/pagination.py`

**`backend/tests/`:**
- Purpose: pytest test suite (unit + integration)
- Contains: Test files, shared fixtures in `conftest.py`
- Key files: `backend/tests/conftest.py` (in-memory SQLite, async client fixture)

**`frontend/src/api/`:**
- Purpose: Typed Axios HTTP client for backend communication
- Contains: Client configuration with interceptors
- Key files: `frontend/src/api/client.ts`

**`frontend/src/components/shared/`:**
- Purpose: Reusable UI components (buttons, inputs, modals, cards)
- Contains: React components used across multiple pages
- Key files: Empty -- awaiting implementation

**`frontend/src/components/coach/`:**
- Purpose: AI coaching-specific UI components (chat interface, scoring panel)
- Contains: Domain-specific components for the coaching experience
- Key files: Empty -- awaiting implementation

**`frontend/src/hooks/`:**
- Purpose: TanStack Query hooks organized by domain
- Contains: Custom hooks wrapping `useQuery`/`useMutation` per API domain
- Key files: Empty -- awaiting implementation

**`frontend/src/pages/`:**
- Purpose: Route-level page components
- Contains: One component per route (Dashboard, TrainingSession, ScenarioConfig, etc.)
- Key files: Empty -- awaiting implementation

**`frontend/src/stores/`:**
- Purpose: Lightweight client-side state (auth only)
- Contains: Auth store for JWT token and user info
- Key files: Empty -- awaiting implementation

**`frontend/src/contexts/`:**
- Purpose: React Context providers for cross-component state
- Contains: Agent routing context
- Key files: Empty -- awaiting implementation

**`frontend/src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: Domain type interfaces matching backend schemas
- Key files: Empty -- awaiting implementation

**`frontend/src/lib/`:**
- Purpose: General utility functions
- Contains: Helper functions used across the frontend
- Key files: `frontend/src/lib/utils.ts` (`cn()` function for className composition)

**`frontend/src/styles/`:**
- Purpose: Design tokens and Tailwind CSS theme configuration
- Contains: CSS custom properties for colors, typography, spacing
- Key files: `frontend/src/styles/index.css` (Tailwind v4 theme with medical-professional color palette)

**`frontend/e2e/`:**
- Purpose: Playwright end-to-end tests
- Contains: E2E test specs and Playwright configuration
- Key files: `frontend/e2e/playwright.config.ts`, `frontend/e2e/health.spec.ts`

**`docs/`:**
- Purpose: Project documentation (requirements, specs, plans)
- Contains: Business requirements, module specs, implementation plans
- Key files: `docs/requirements.md`, `docs/best-practices.md`

**`wiki/`:**
- Purpose: GitHub Wiki content, auto-synced via `.github/workflows/sync-wiki.yml`
- Contains: Markdown files for wiki pages
- Key files: `wiki/Architecture.md`, `wiki/Dev-Onboarding.md`, `wiki/Roadmap.md`

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI application instance, lifespan manager, CORS, health check
- `backend/app/config.py`: Settings singleton (`get_settings()`)
- `frontend/src/api/client.ts`: Axios API client with JWT interceptor

**Configuration:**
- `backend/pyproject.toml`: Python dependencies, pytest config, ruff linting config
- `backend/app/config.py`: Runtime settings via pydantic-settings (reads `.env`)
- `frontend/package.json`: Node dependencies and npm scripts
- `frontend/tsconfig.json`: TypeScript strict mode, `@/` path alias
- `frontend/vite.config.ts`: Vite plugins (React, Tailwind), path alias, API proxy
- `docker-compose.yml`: Local dev orchestration (backend port 8000, frontend port 5173)

**Core Logic:**
- `backend/app/services/agents/base.py`: AI adapter base class and domain value objects
- `backend/app/services/agents/registry.py`: Adapter registry singleton
- `backend/app/services/agents/adapters/mock.py`: Mock adapter for dev/test
- `backend/app/database.py`: Async SQLAlchemy engine and session management
- `backend/app/utils/exceptions.py`: Structured error hierarchy
- `backend/app/utils/pagination.py`: Generic paginated response

**Testing:**
- `backend/tests/conftest.py`: Shared pytest fixtures (in-memory SQLite, async HTTP client)
- `backend/tests/test_health.py`: Health endpoint test
- `backend/tests/test_schema_integrity.py`: ORM model / migration drift detection
- `backend/tests/test_mock_adapter.py`: Mock coaching adapter tests
- `frontend/e2e/playwright.config.ts`: Playwright config (starts both backend and frontend)
- `frontend/e2e/health.spec.ts`: E2E health check and page load tests

**CI/CD:**
- `.github/workflows/ci.yml`: Full pipeline (lint, test, build, E2E, deploy)
- `.github/workflows/sync-wiki.yml`: Auto-sync wiki content to GitHub Wiki
- `.github/workflows/sync-project.yml`: Sync plan files to GitHub project

**Deployment:**
- `backend/Dockerfile`: Single-stage Python 3.11 image with healthcheck
- `frontend/Dockerfile`: Multi-stage Node 20 build -> nginx alpine serve
- `frontend/nginx.conf`: SPA fallback, API reverse proxy, WebSocket support, static asset caching

## Naming Conventions

**Files (Backend Python):**
- Modules: `snake_case.py` (e.g., `base.py`, `mock.py`, `exceptions.py`, `pagination.py`)
- Test files: `test_<module>.py` (e.g., `test_health.py`, `test_mock_adapter.py`)
- Config/entry: descriptive singular name (`config.py`, `database.py`, `main.py`, `dependencies.py`)

**Files (Frontend TypeScript):**
- Utilities: `camelCase.ts` (e.g., `client.ts`, `utils.ts`)
- Components (planned): `PascalCase.tsx` for component files
- Hooks (planned): `use<Domain>.ts` (e.g., `useSessions.ts`)
- Types (planned): `camelCase.ts` or `<domain>.ts`

**Directories:**
- Backend: `snake_case` (e.g., `agents/`, `adapters/`)
- Frontend: `camelCase` or `lowercase` (e.g., `components/`, `hooks/`, `stores/`)
- Feature grouping: by domain, not by type (e.g., `components/coach/` not `components/buttons/`)

**Classes and Types:**
- Python classes: `PascalCase` (e.g., `BaseCoachingAdapter`, `MockCoachingAdapter`, `AppException`)
- Python functions: `snake_case` (e.g., `get_settings`, `not_found`, `get_db`)
- TypeScript functions: `camelCase` (e.g., `cn`)
- Enums: `PascalCase` class name, `UPPER_CASE` members (e.g., `CoachEventType.TEXT`)

## Where to Add New Code

**New API Domain (e.g., "sessions"):**
- Create router: `backend/app/api/sessions.py` with `router = APIRouter(prefix="/sessions", tags=["sessions"])`
- Create schemas: `backend/app/schemas/sessions.py` with request/response Pydantic models
- Create service: `backend/app/services/session_service.py` with business logic functions
- Create model: `backend/app/models/session.py` with SQLAlchemy ORM class inheriting `Base, TimestampMixin`
- Register router in `backend/app/main.py`: `app.include_router(router, prefix=settings.api_prefix)`
- Import model in `backend/app/models/__init__.py` so Alembic can discover it
- Create migration: `alembic revision --autogenerate -m "add sessions table"`
- Write tests: `backend/tests/test_sessions.py`

**New AI Avataring Adapter:**
- Create adapter: `backend/app/services/agents/adapters/<provider>.py`
- Implement `BaseCoachingAdapter` ABC (implement `execute()`, `is_available()`)
- Register in application startup or via import-time registration using `registry.register()`

**New Frontend Page:**
- Create page component: `frontend/src/pages/<PageName>Page.tsx`
- Create domain hook: `frontend/src/hooks/use<Domain>.ts` using TanStack Query
- Add API functions: extend `frontend/src/api/client.ts` or create domain-specific API file in `frontend/src/api/`
- Add route in the router configuration (when React Router is set up)

**New Frontend Component:**
- Reusable/shared: `frontend/src/components/shared/<ComponentName>.tsx`
- Domain-specific coaching: `frontend/src/components/coach/<ComponentName>.tsx`
- Export via barrel file: add `index.ts` in the component directory

**New Utility:**
- Backend: `backend/app/utils/<utility_name>.py`
- Frontend: `frontend/src/lib/<utilityName>.ts`

**New Test:**
- Backend unit/integration: `backend/tests/test_<module>.py`
- Frontend E2E: `frontend/e2e/<feature>.spec.ts`

## Special Directories

**`backend/alembic/`:**
- Purpose: Database migration scripts managed by Alembic
- Generated: Yes (via `alembic revision --autogenerate`)
- Committed: Yes -- migrations must be version-controlled
- Note: `env.py` and migration versions are not yet created

**`backend/app/data/`:**
- Purpose: Static data files (seed data, fixtures)
- Generated: No
- Committed: Yes
- Note: Currently empty

**`frontend/public/`:**
- Purpose: Static assets served as-is by Vite (favicon, manifest, etc.)
- Generated: No
- Committed: Yes

**`frontend/dist/` (not present yet):**
- Purpose: Vite production build output
- Generated: Yes (via `npm run build`)
- Committed: No (should be in `.gitignore`)

**`wiki/`:**
- Purpose: GitHub Wiki source files, auto-synced via CI
- Generated: Partially (some pages auto-generated by `.github/scripts/generate-wiki-pages.sh`)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD tooling analysis documents
- Generated: Yes (by codebase mapping agents)
- Committed: Yes

---

*Structure analysis: 2026-03-24*
