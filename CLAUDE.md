# CLAUDE.md — AI Coach Platform Engineering Handbook

> This is the **single source of truth** for HOW to develop on this project.
> For WHAT to build → `docs/specs/`, for WHY → `docs/requirements.md`

---

## 🚨 最高优先级要求 (Top Priority Rule)

**当有多个需求时，必须严格按照以下流程逐一实现：**

1. **逐个实现** — 一次只做一个需求，不要并行处理多个需求
2. **单元测试 100% 覆盖** — 每个需求的代码必须有完整的 unit test 覆盖（pytest for backend, vitest/jest for frontend）
3. **Playwright E2E 测试** — 从主要 user story 角度编写 E2E 测试，覆盖核心用户故事线
4. **测试全部通过后才能提交** — 确保所有 unit test 和 E2E test 通过
5. **Commit & Push** — 每个需求完成后立即 commit 并 push 到 GitHub
6. **开始下一个需求** — 上一个需求完全提交后，才开始下一个
7. **保持提交记录** — 每个需求必须有独立的 commit 记录，commit message 清晰描述该需求

**流程图：**
```
需求1 → 实现 → Unit Test (100%) → E2E Test → All Pass → Commit → Push → 需求2 → ...
```

**违反此规则的行为：**
- ❌ 同时开始多个需求的代码修改
- ❌ 跳过测试直接提交
- ❌ 多个需求合并为一个 commit
- ❌ 测试未通过就 push

---

## Document Hierarchy (No-Overlap Principle)

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Engineering Ops | `CLAUDE.md` (this file) | HOW to develop, coding standards, gotchas |
| Requirements | `docs/requirements.md` | Business requirements & acceptance criteria |
| Specifications | `docs/specs/` | Module specs (GIVEN/WHEN/THEN) |
| Plans | `docs/plans/` | Implementation plans with tasks |
| Architecture | `wiki/Architecture.md` | System design, data flows, diagrams |
| External | `README.md` | Quick start, overview, API reference |

---

## Project Structure

```
AI-avatar-vibe-coding/
├── .github/
│   ├── workflows/          # CI/CD (ci.yml, sync-wiki.yml, sync-project.yml)
│   └── scripts/            # Automation scripts (wiki gen, project sync)
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (one per domain)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic v2 request/response schemas
│   │   ├── services/       # Business logic + AI adapters
│   │   ├── utils/          # Shared utilities (exceptions, pagination)
│   │   ├── config.py       # pydantic-settings configuration
│   │   ├── database.py     # Async SQLAlchemy engine + session
│   │   ├── dependencies.py # DI: get_db, get_current_user
│   │   └── main.py         # FastAPI app, lifespan, CORS
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest (unit + integration)
│   ├── scripts/            # init_db.py, seed_data.py
│   ├── pyproject.toml      # Dependencies + tool config
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/            # Typed axios API client
│   │   ├── components/
│   │   │   ├── shared/     # Reusable UI components
│   │   │   └── coach/      # AI coaching components
│   │   ├── contexts/       # React contexts (agent routing)
│   │   ├── hooks/          # TanStack Query hooks
│   │   ├── pages/          # Route-level page components
│   │   ├── stores/         # Auth store
│   │   ├── types/          # TypeScript type definitions
│   │   ├── lib/            # Utility functions (cn)
│   │   └── styles/         # Design tokens + Tailwind config
│   ├── e2e/                # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── vite.config.ts
│   └── Dockerfile
├── docs/
│   ├── requirements.md     # Business requirements
│   ├── specs/              # Module specifications
│   ├── plans/              # Implementation plans
│   └── best-practices.md   # Engineering patterns reference
├── wiki/                   # Auto-synced to GitHub Wiki
├── infra/                  # Azure deployment scripts
├── docker-compose.yml
└── CLAUDE.md               # This file
```

---

## Tech Stack

### Backend
- **Python 3.11+** with async throughout
- **FastAPI** (ASGI, lifespan, dependency injection)
- **SQLAlchemy 2.0** async with aiosqlite (dev) / PostgreSQL (prod)
- **Alembic** for database migrations
- **Pydantic v2** for all schemas
- **pydantic-settings** for configuration
- **python-jose + passlib[bcrypt]** for JWT auth
- **pytest + pytest-asyncio** for testing

### Frontend
- **React 18+** with TypeScript strict mode
- **Vite 6+** with Tailwind CSS v4
- **TanStack Query v5** for server state
- **React Router v7** for routing
- **Axios** with typed API layer
- **Playwright** for E2E testing

### Infrastructure
- **Docker** with multi-stage builds
- **nginx** for frontend serving + API proxy
- **Azure Container Apps** for deployment
- **GitHub Actions** for CI/CD

---

## Local Development

### Prerequisites
- Python 3.11+, Node 20+, Docker (optional)

### Quick Start
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
python scripts/init_db.py
python scripts/seed_data.py
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm ci
cp .env.example .env
npm run dev
```

### Docker
```bash
docker-compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

---

## Pre-Commit Checklist (MUST PASS)

Before every commit, run:

```bash
# Backend
cd backend
ruff check .          # Lint
ruff format --check . # Format check
pytest -v             # Tests

# Frontend
cd frontend
npx tsc -b            # Type check
npm run build         # Build check
```

CI will reject PRs that fail these checks.

---

## Coding Standards

### Python
- **Async everywhere**: `async def`, `await`, `AsyncSession`
- **Pydantic v2** schemas: use `model_config = ConfigDict(from_attributes=True)`
- **Exception raisers** must use `-> NoReturn` type annotation
- **Route ordering**: Static paths (`/defaults`, `/refresh`) BEFORE parameterized (`/{id}`)
- **Create returns 201**, Delete returns 204
- **Service layer** holds business logic, routers only handle HTTP
- **No raw SQL** — use SQLAlchemy ORM or Alembic migrations

### TypeScript
- **`strict: true`** — no `any` types, no unused variables
- **TanStack Query hooks** per domain, no inline `useQuery` in components
- **Path alias** `@/` for all imports from `src/`
- **Barrel exports** for component directories (`index.ts`)
- **`cn()` utility** for conditional class composition (clsx + tailwind-merge)
- **No Redux** — use TanStack Query for server state, lightweight store for auth

### General
- **English** for commits, code comments, docstrings
- **Chinese** for user-facing UI text (if applicable)
- **Conventional commits** encouraged: `feat:`, `fix:`, `docs:`, `test:`, `ci:`

---

## Database Rules

1. **NEVER** modify the database schema without an Alembic migration
2. **NEVER** delete the database file to "fix" schema issues
3. **Schema changes** → `alembic revision --autogenerate -m "description"` → `alembic upgrade head`
4. All models **MUST** use `TimestampMixin` (UUID id + created_at + updated_at)
5. Test database uses **in-memory SQLite** — production uses PostgreSQL

---

## API Design Rules

1. All routes under `/api/v1/` prefix
2. Structured error responses: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
3. Generic pagination: `{"items": [...], "total": N, "page": 1, "page_size": 20, "total_pages": N}`
4. Authentication via JWT Bearer token
5. CORS configured per environment

---

## AI Coach Domain Rules

1. **Training Sessions** have a lifecycle: `created → in_progress → completed → scored`
2. **Scoring** is multi-dimensional — never return a single score without breakdown
3. **HCP profiles** include: name, specialty, personality, knowledge background, perspective
4. **Conversations** are immutable once completed — only scoring/feedback can be added
5. **Voice records** must respect retention policies (auto-delete per config)
6. **All coaching interactions** must be auditable (traceable training paths)

---

## Gotcha List (Lessons Learned)

| # | Gotcha | Solution |
|---|--------|----------|
| 1 | SQLite doesn't support `ALTER COLUMN` | Use batch operations in Alembic |
| 2 | `async with` required for all DB sessions | Never use bare `get_db()` |
| 3 | Static routes must come before `/{id}` | FastAPI matches first route |
| 4 | `npm ci` not `npm install` in CI | Ensures reproducible builds |
| 5 | Playwright needs `--config=e2e/playwright.config.ts` | Default config path differs |
| 6 | CORS must include frontend dev port | Missing = silent auth failures |
| 7 | Alembic `env.py` must import all models | Missing = incomplete migrations |
| 8 | `pydantic-settings` reads `.env` only if configured | Add `model_config = {"env_file": ".env"}` |
| 9 | FastAPI lifespan replaces `@app.on_event` | Use `@asynccontextmanager` pattern |
| 10 | Azure OIDC needs `id-token: write` permission | Missing = deployment auth failure |

---

## CI Pipeline Overview

```
Push/PR → backend-test → frontend-test → e2e-test → deploy (main only)
                                                   ↓
Push → sync-wiki (wiki content changes)
Push → sync-project (plan file changes)
```

See `.github/workflows/` for full configurations.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**AI Coach Platform — BeiGene**

A production AI coaching platform for BeiGene (百济神州) that trains Medical Representatives (MRs) through AI-simulated HCP interactions. MRs practice F2F calls and conference presentations with digital Healthcare Professionals, receive multi-dimensional scoring, and track their improvement over time. Built on Azure PaaS services with i18n support for global deployment (China + Europe).

**Core Value:** MRs can practice realistic conversations with AI-powered digital HCPs and receive immediate, multi-dimensional feedback to improve their communication skills and product knowledge — anytime, without needing a real HCP or trainer.

### Constraints

- **Cloud**: Azure PaaS only (no AWS) — Azure OpenAI, Speech, Avatar, Content Understanding, PostgreSQL
- **i18n**: Must support Chinese + English from day 1, i18n framework required for European expansion
- **Compliance**: Per-region deployment to satisfy data residency regulations (China, EU)
- **Auth**: Simple user/admin for MVP, architecture must support Azure AD (Entra ID) later
- **Budget**: Azure AI Avatar is premium — implement as configurable option, fall back to Azure Speech TTS
- **Frontend**: Must be responsive — same app works on desktop, tablet, mobile, and Teams Tab
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.11+ - Backend API, business logic, AI integrations (`backend/`)
- TypeScript 5.6+ - Frontend SPA with strict mode enabled (`frontend/`)
- SQL - Database schemas via SQLAlchemy ORM and Alembic migrations (`backend/alembic/`)
- Bash - CI/CD scripts and infrastructure automation (`.github/scripts/`)
- CSS - Tailwind v4 with custom design tokens (`frontend/src/styles/index.css`)
## Runtime
- Python 3.11+ (CPython)
- ASGI server: Uvicorn with `[standard]` extras (uvloop, httptools)
- Base image: `python:3.11-slim` (`backend/Dockerfile`)
- Node.js 20 (used for build and dev server)
- Base image: `node:20-slim` for build, `nginx:alpine` for serving (`frontend/Dockerfile`)
- pip with setuptools (backend) - uses `pyproject.toml`
- npm (frontend) - uses `package.json` + `package-lock.json`
- Lockfile: `package-lock.json` present for frontend; backend relies on pinned ranges in `pyproject.toml`
## Frameworks
- FastAPI >=0.115.0 - ASGI web framework with dependency injection, lifespan events (`backend/app/main.py`)
- React 18.3+ - Frontend UI library (`frontend/package.json`)
- React Router v7 - Client-side routing (`frontend/package.json` - `react-router-dom ^7.0.0`)
- SQLAlchemy 2.0+ (async) - Database ORM with `AsyncSession` (`backend/app/database.py`)
- Alembic >=1.13.0 - Database migrations (`backend/alembic/`)
- aiosqlite >=0.20.0 - Async SQLite driver for development
- asyncpg >=0.29.0 - Async PostgreSQL driver for production (optional dep group `[postgresql]`)
- pytest >=8.3.0 + pytest-asyncio >=0.24.0 - Backend unit/integration tests (`backend/tests/`)
- pytest-cov >=5.0.0 - Code coverage reporting
- pytest-html >=4.1.0 - HTML test reports
- pytest-timeout >=2.2.0 - Test timeout enforcement (60s default)
- Playwright >=1.48.0 - E2E browser testing (`frontend/e2e/`)
- Vite 6+ - Frontend build tool and dev server (`frontend/vite.config.ts`)
- Tailwind CSS v4 - Utility-first CSS with `@tailwindcss/vite` plugin
- Ruff >=0.6.0 - Python linter and formatter (replaces black + isort + flake8)
## Key Dependencies
- `openai >=1.50.0` - OpenAI and Azure OpenAI API client for AI coaching (`backend/pyproject.toml`)
- `anthropic >=0.40.0` - Anthropic Claude API client for AI coaching (`backend/pyproject.toml`)
- `python-jose[cryptography] >=3.3.0` - JWT token creation/verification (`backend/pyproject.toml`)
- `passlib[bcrypt] >=1.7.4` - Password hashing (`backend/pyproject.toml`)
- `pydantic-settings >=2.5.0` - Environment-based configuration (`backend/app/config.py`)
- `@tanstack/react-query ^5.60.0` - Server state management, caching, mutations (`frontend/package.json`)
- `axios ^1.7.0` - HTTP client with interceptors for JWT auth (`frontend/src/api/client.ts`)
- `lucide-react ^0.460.0` - Icon library (`frontend/package.json`)
- `react-markdown ^9.0.0` + `rehype-raw ^7.0.0` - Markdown rendering (likely for AI responses)
- `clsx ^2.1.0` + `tailwind-merge ^2.5.0` - Conditional CSS class composition via `cn()` utility (`frontend/src/lib/utils.ts`)
- `httpx >=0.27.0` - Async HTTP client, also used for testing via `ASGITransport` (`backend/tests/conftest.py`)
- `python-multipart >=0.0.9` - File upload support for FastAPI
- `websockets >=13.0` - WebSocket support (for real-time coaching interactions)
## Configuration
- Config class: `backend/app/config.py` - `Settings` with `model_config = {"env_file": ".env"}`
- Singleton pattern: `get_settings()` with `@lru_cache` decorator
- Template: `backend/.env.example`
- Required env vars:
- Build-time via Vite: `VITE_API_BASE_URL` (set in Dockerfile ARG, defaults to `http://localhost:8000`)
- Dev proxy: Vite proxies `/api` requests to backend at `http://localhost:8000` (`frontend/vite.config.ts`)
- `backend/pyproject.toml` - Python build, dependency groups (`[dev]`, `[postgresql]`, `[all]`), tool configs
- `frontend/vite.config.ts` - Vite with React plugin, Tailwind CSS v4 plugin, `@/` path alias
- `frontend/tsconfig.json` - Strict TypeScript: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`
- Ruff configured in `backend/pyproject.toml`: target py311, line-length 100, rules E/F/I/W/UP, double quotes
- TypeScript strict mode: `frontend/tsconfig.json` with `noUncheckedIndexedAccess: true`
## Platform Requirements
- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized dev via `docker-compose.yml`)
- No external database required for dev (SQLite with aiosqlite)
- Azure Container Apps (backend + frontend as separate containers)
- Azure Container Registry (ACR) for image storage
- PostgreSQL database (via `asyncpg` driver, optional dependency group)
- nginx (Alpine) serving frontend static files with API reverse proxy
- Azure OpenAI / Anthropic / OpenAI API keys for AI coaching features
- Azure Speech Services for voice/ASR features
- `backend/Dockerfile` - Single-stage, `python:3.11-slim`, healthcheck via urllib
- `frontend/Dockerfile` - Multi-stage: `node:20-slim` (build) then `nginx:alpine` (serve)
- `docker-compose.yml` - Development compose with backend (port 8000) + frontend (port 5173)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use `snake_case.py` for all module files: `config.py`, `database.py`, `dependencies.py`
- Package `__init__.py` files re-export key symbols with `__all__`
- Test files prefixed with `test_`: `test_health.py`, `test_mock_adapter.py`
- `snake_case` for all functions and methods: `get_settings()`, `get_db()`, `is_available()`
- Async functions use `async def` universally -- no sync alternatives
- Factory/creator class methods: `PaginatedResponse.create()`
- Exception helper functions as shorthand raisers: `not_found()`, `bad_request()`
- `PascalCase` for all classes: `Settings`, `AppException`, `BaseCoachingAdapter`
- Mixins suffixed with `Mixin`: `TimestampMixin`
- Abstract base classes suffixed with `Adapter` or `Base`: `BaseCoachingAdapter`
- Enums use `PascalCase` with `UPPER_CASE` members: `CoachEventType.TEXT`
- `snake_case` for variables and parameters: `session_id`, `scoring_criteria`
- Module-level singletons in lowercase: `settings = get_settings()`, `registry = AdapterRegistry()`
- Constants follow `UPPER_CASE`: `TEST_DATABASE_URL`
- Use `camelCase.ts` for utility and API files: `client.ts`, `utils.ts`
- Use `camelCase.spec.ts` for E2E test files: `health.spec.ts`
- Config files use `kebab-case` with extensions: `vite.config.ts`, `playwright.config.ts`
- `camelCase` for all functions: `cn()`
- Export `default` for singleton API client (`export default apiClient`)
- `PascalCase` for interfaces and types (planned, not yet populated in `src/types/`)
- Import types with `type` keyword when type-only: `import { type ClassValue } from "clsx"`
- `snake_case` for Python packages: `app/services/agents/adapters/`
- `kebab-case` for frontend directories: `src/components/shared/`, `src/components/coach/`
## Code Style
- Tool: **Ruff** (format + lint combined)
- Config: `backend/pyproject.toml` `[tool.ruff]` section
- Line length: **100** characters
- Quote style: **double quotes**
- Target version: **Python 3.11**
- Run: `ruff format --check .` (check), `ruff format .` (fix)
- Tool: **Ruff**
- Rule sets enabled: `E` (pycodestyle errors), `F` (pyflakes), `I` (isort), `W` (warnings), `UP` (pyupgrade)
- isort config: `known-first-party = ["app"]`
- Run: `ruff check .` (check), `ruff check --fix .` (fix)
- No ESLint or Prettier configured -- TypeScript compiler (`tsc -b`) is the sole code quality gate
- `tsconfig.json` enforces:
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Design tokens defined via CSS custom properties in `@theme inline` block at `frontend/src/styles/index.css`
- Color scales: `primary`, `success`, `warning`, `danger`, `neutral` (each with numeric stops)
- Typography: `--font-sans` (Inter + Noto Sans SC), `--font-mono` (JetBrains Mono)
- Spacing/radius: `--radius-sm` through `--radius-xl`
## Import Organization
- Use `from X import Y` form (not bare `import X`)
- Use `collections.abc` for abstract types: `from collections.abc import AsyncIterator, AsyncGenerator`
- Use `typing` for type constructs: `from typing import Any, NoReturn, Generic, TypeVar`
- TypeScript: `@/` maps to `./src/` (configured in `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`)
## Error Handling
- Base: `AppException` extends `HTTPException` -- defined in `backend/app/utils/exceptions.py`
- Subclasses: `NotFoundException(404)`, `ValidationException(422)`, `ConflictException(409)`
- Each carries: `status_code`, `code` (string constant), `message`, `details`
- Use `-> NoReturn` type annotation on functions that always raise
- `not_found(message)` and `bad_request(message)` as shorthand raisers
- Example: `def not_found(message: str = "Resource not found") -> NoReturn:`
- Registered on `app` in `backend/app/main.py` via `@app.exception_handler(AppException)`
- Returns structured JSON: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- `get_db()` in `backend/app/database.py` uses try/except with rollback
- Pattern: `yield session` -> `await session.commit()` on success, `await session.rollback()` on exception
- Axios response interceptor in `frontend/src/api/client.ts`
- 401 responses: clear `access_token` from localStorage, redirect to `/login`
- All other errors: propagate via `Promise.reject(error)` for TanStack Query to handle
## Logging
- SQLAlchemy echo mode controlled by `settings.debug` in `backend/app/database.py`
- No structured logging middleware currently set up
## Comments
- Module-level docstrings on test files: `"""Health check endpoint tests."""`
- Docstrings on abstract base classes and mixins: `"""Abstract base for AI coaching adapters."""`
- Inline `# TODO:` comments for planned but unimplemented work
- Inline comments for non-obvious configuration: `# In-memory SQLite for test isolation`
- Triple double-quoted strings: `"""Description."""`
- Short single-line docstrings for classes and methods
- Multi-line docstrings for test conftest files explaining purpose and approach
- Prefix with `# TODO:` followed by description
- Found in: `backend/app/main.py` (seed initial data), `backend/app/dependencies.py` (add auth dependency)
## Function Design
- ALL backend functions are `async def` -- no sync database or service functions
- Async generators use `AsyncGenerator[T, None]` return type (for `get_db`)
- Async iterators use `AsyncIterator[T]` return type (for adapter `execute`)
- Use dataclasses for complex request objects: `CoachRequest` in `backend/app/services/agents/base.py`
- Use Pydantic `BaseModel` for API schemas
- Default values on dataclass fields: `mode: str = "text"`, `hcp_profile: dict | None = None`
- Use modern union syntax: `dict | None` (not `Optional[dict]`)
- Route handlers return dicts or Pydantic models
- Generators use `yield` within `async with` context
- Factory methods return class instances: `PaginatedResponse.create()`
## Module Design
- Use `__all__` in `__init__.py` for explicit public API: `__all__ = ["Base", "TimestampMixin"]`
- Re-export key symbols from submodules in package `__init__.py`
- `backend/app/models/__init__.py` re-exports `Base` and `TimestampMixin`
- `backend/app/dependencies.py` re-exports `get_db` with `__all__`
- Frontend directories (`components/shared/`, `components/coach/`) are structured for barrel exports but not yet populated
- `Settings`: `@lru_cache` on `get_settings()` in `backend/app/config.py`
- `AdapterRegistry`: `__new__` override for singleton in `backend/app/services/agents/registry.py`
## Configuration Pattern
- `pydantic-settings` `BaseSettings` class in `backend/app/config.py`
- Reads from `.env` file via `model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}`
- All settings have defaults (safe for local dev without `.env`)
- Singleton via `@lru_cache` on `get_settings()`
- Access: `settings = get_settings()` at module level
- Vite environment variables (`VITE_*` prefix) for build-time config
- Runtime API base URL: hardcoded `/api/v1` in `frontend/src/api/client.ts`
- Vite dev server proxies `/api` to `http://localhost:8000`
## API Design Conventions
- All routes under `/api/v1/` prefix (configured via `settings.api_prefix`)
- Health check at `/api/health` (outside versioned prefix)
- Static routes before parameterized routes (e.g., `/defaults` before `/{id}`)
- 200: Successful GET/PUT
- 201: Successful POST (create)
- 204: Successful DELETE
- 404/422/409: Error responses via exception hierarchy
- Success: domain-specific JSON or `PaginatedResponse` wrapper
- Error: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- Pagination: `{"items": [...], "total": N, "page": 1, "page_size": 20, "total_pages": N}`
## Frontend Component Conventions
- Server state: TanStack Query v5 (no Redux)
- Auth state: lightweight store (planned in `frontend/src/stores/`)
- Agent routing: React context (planned in `frontend/src/contexts/`)
- No inline `useQuery` in components -- use domain-specific hooks from `frontend/src/hooks/`
- Tailwind CSS v4 utility classes
- Conditional class composition via `cn()` from `frontend/src/lib/utils.ts`
- Design tokens as CSS custom properties, not Tailwind config (v4 `@theme inline` pattern)
- Single axios client instance: `frontend/src/api/client.ts`
- Auto-attaches JWT Bearer token from localStorage
- 30-second timeout on all requests
- Domain-specific API modules planned in `frontend/src/api/`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Strict separation between frontend (React SPA) and backend (FastAPI ASGI)
- Backend follows a layered architecture: Router -> Schema -> Service -> Model -> Database
- AI coaching logic is abstracted via an adapter/strategy pattern with a singleton registry
- Communication between frontend and backend is REST + WebSocket over `/api/` prefix
- Frontend proxies API calls through Vite dev server (dev) or nginx reverse proxy (prod)
- Async throughout the backend (async SQLAlchemy, async FastAPI handlers)
## Layers
- Purpose: Accept HTTP requests, validate input via Pydantic schemas, delegate to services, return responses
- Location: `backend/app/api/`
- Contains: FastAPI router modules, one per domain (auth, sessions, scoring, HCP profiles)
- Depends on: Schema layer, Service layer, Dependencies (`get_db`, `get_current_user`)
- Used by: Frontend API client, external consumers
- Note: Currently `backend/app/api/__init__.py` is empty -- no routers are implemented yet. The `backend/app/main.py` does not include any router registrations.
- Purpose: Define request/response data shapes using Pydantic v2
- Location: `backend/app/schemas/`
- Contains: Pydantic BaseModel subclasses with `ConfigDict(from_attributes=True)`
- Depends on: Nothing (pure data definitions)
- Used by: Router layer for request validation and response serialization
- Note: Currently `backend/app/schemas/__init__.py` is empty -- no schemas defined yet.
- Purpose: Encapsulate domain business logic, orchestrate AI adapters, handle training session lifecycle
- Location: `backend/app/services/`
- Contains: Service classes/functions, AI coaching adapter framework
- Depends on: Model layer, AI adapter subsystem, external AI SDKs
- Used by: Router layer
- Note: Currently only the agent adapter subsystem is implemented.
- Purpose: Provide a pluggable interface for multiple AI providers (Claude, Azure OpenAI, GPT-4, Mock)
- Location: `backend/app/services/agents/`
- Contains: Abstract base class, adapter registry (singleton), concrete adapter implementations
- Depends on: AI provider SDKs (openai, anthropic)
- Used by: Service layer
- Key files:
- Purpose: Define database tables and relationships via SQLAlchemy 2.0 declarative models
- Location: `backend/app/models/`
- Contains: ORM model classes inheriting from `Base` and using `TimestampMixin`
- Depends on: SQLAlchemy, `backend/app/models/base.py` for `Base` and `TimestampMixin`
- Used by: Service layer, Alembic migrations
- Note: Currently only `Base` and `TimestampMixin` are defined. No domain models (User, Session, etc.) exist yet.
- Purpose: Manage async database connections and sessions
- Location: `backend/app/database.py`
- Contains: Async engine creation, session factory, `get_db()` dependency
- Depends on: `backend/app/config.py` for `database_url`
- Used by: Dependencies layer, test fixtures
- Pattern: `async with AsyncSessionLocal() as session` with auto-commit/rollback
- Purpose: Provide FastAPI dependency injection callables
- Location: `backend/app/dependencies.py`
- Contains: Re-exports `get_db` from database module
- Depends on: Database layer
- Used by: Router layer via `Depends()`
- Note: `get_current_user` is not yet implemented (marked as TODO).
- Purpose: Centralize application settings using pydantic-settings
- Location: `backend/app/config.py`
- Contains: `Settings` class (reads from `.env`), `get_settings()` with `@lru_cache`
- Depends on: Environment variables / `.env` file
- Used by: All backend layers
- Purpose: Shared cross-cutting utilities
- Location: `backend/app/utils/`
- Contains:
- Purpose: Typed HTTP client for backend communication
- Location: `frontend/src/api/`
- Contains: `frontend/src/api/client.ts` -- Axios instance with JWT interceptor and 401 redirect
- Depends on: Axios, localStorage for JWT token
- Used by: TanStack Query hooks (planned in `frontend/src/hooks/`)
- Purpose: UI components organized by domain and reusability
- Location: `frontend/src/components/`
- Contains:
- Depends on: React, design tokens from `frontend/src/styles/index.css`
- Used by: Page components
- Purpose: Client-side state management
- Location: `frontend/src/stores/` (auth), `frontend/src/contexts/` (agent routing), `frontend/src/hooks/` (server state)
- Contains: Empty placeholder directories -- no implementations yet
- Pattern (planned): TanStack Query for server state, lightweight store for auth, React Context for agent routing
- Purpose: Route-level page components
- Location: `frontend/src/pages/`
- Contains: Empty placeholder directory -- no page implementations yet
- Depends on: Component layer, hooks, stores
## Data Flow
- Server state: TanStack Query v5 hooks in `frontend/src/hooks/` per domain
- Auth state: Lightweight store in `frontend/src/stores/` (JWT token + user info in localStorage)
- UI state: React local state + Context in `frontend/src/contexts/` for agent routing
## Key Abstractions
- Purpose: Strategy pattern interface for swappable AI providers
- Examples: `backend/app/services/agents/base.py`, `backend/app/services/agents/adapters/mock.py`
- Pattern: Abstract base class with `execute()` returning `AsyncIterator[CoachEvent]`
- New adapters implement `BaseCoachingAdapter` and register via `AdapterRegistry.register()`
- Purpose: Singleton that manages available AI coaching adapters at runtime
- Examples: `backend/app/services/agents/registry.py`
- Pattern: Singleton with `register()`, `get()`, `list_available()`, `discover()` (async availability check)
- Access via module-level `registry` instance
- Purpose: Domain value objects for coaching interactions
- Examples: `backend/app/services/agents/base.py`
- Pattern: Dataclasses representing the input/output contract for all coaching adapters
- `CoachEventType` enum: `TEXT`, `AUDIO`, `SCORE`, `SUGGESTION`, `ERROR`, `DONE`
- Purpose: Structured error responses with code, message, and details
- Examples: `backend/app/utils/exceptions.py`
- Pattern: Custom HTTPException subclasses with convenience raiser functions (`not_found()`, `bad_request()`)
- Global exception handler in `backend/app/main.py` converts to `{"code": "...", "message": "...", "details": {...}}`
- Purpose: Generic paginated response envelope
- Examples: `backend/app/utils/pagination.py`
- Pattern: Generic Pydantic model with `create()` class method for auto-calculating `total_pages`
- Purpose: Provide UUID primary key and automatic created_at/updated_at timestamps
- Examples: `backend/app/models/base.py`
- Pattern: Mixin class added to all ORM models via multiple inheritance
- Fields: `id` (String(36) UUID), `created_at` (server_default=now), `updated_at` (onupdate=now)
- Purpose: Centralized, typed configuration with env var loading
- Examples: `backend/app/config.py`
- Pattern: pydantic-settings `BaseSettings` with `@lru_cache` singleton accessor `get_settings()`
## Entry Points
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app` command
- Responsibilities: Creates FastAPI app, configures CORS, registers global exception handler, manages lifespan (table creation on startup, engine disposal on shutdown), serves `/api/health` endpoint
- Note: No routers are currently included -- only the health check endpoint exists
- Location: `frontend/index.html` (not yet created -- placeholder)
- Triggers: Vite dev server (`npm run dev`) or nginx serving built SPA
- Responsibilities: Bootstraps React app, sets up routing, provides query client
- Location: `backend/scripts/init_db.py` (referenced in CI but not yet present in scripts/)
- Triggers: Manual execution or CI pipeline
- Responsibilities: Initialize database schema
- Location: `backend/scripts/seed_data.py` (referenced in CI but not yet present in scripts/)
- Triggers: Manual execution or CI pipeline
- Responsibilities: Populate database with initial/test data
- Location: `backend/alembic/` (directory exists but no `env.py` or migrations yet)
- Triggers: `alembic upgrade head`, `alembic revision --autogenerate`
- Responsibilities: Schema versioning and migration
- Location: `.github/workflows/ci.yml`
- Triggers: Push to main, pull requests to main
- Responsibilities: Backend lint/test, frontend typecheck/build, E2E tests (Playwright), deploy to Azure Container Apps
## Error Handling
- All application errors extend `AppException` (which extends FastAPI's `HTTPException`) in `backend/app/utils/exceptions.py`
- Specialized exceptions: `NotFoundException` (404), `ValidationException` (422), `ConflictException` (409)
- Convenience raiser functions with `-> NoReturn` annotation: `not_found()`, `bad_request()`
- Global exception handler in `backend/app/main.py` converts `AppException` to JSON: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- Database sessions auto-rollback on exception in `backend/app/database.py` `get_db()` generator
- Frontend Axios interceptor in `frontend/src/api/client.ts` handles 401 by clearing token and redirecting to `/login`
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
