# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**AI / LLM Services:**
- Azure OpenAI - Primary AI coaching engine for HCP training conversations
  - SDK/Client: `openai >=1.50.0` (Azure OpenAI compatible)
  - Auth: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
  - Config: `backend/app/config.py` (Settings class fields)

- Anthropic Claude - Alternative AI coaching engine
  - SDK/Client: `anthropic >=0.40.0`
  - Auth: `ANTHROPIC_API_KEY`
  - Config: `backend/app/config.py`

- OpenAI (Direct) - Alternative AI coaching engine
  - SDK/Client: `openai >=1.50.0`
  - Auth: `OPENAI_API_KEY`
  - Config: `backend/app/config.py`

**Voice / Speech Services:**
- Azure Speech Services - Speech-to-text (ASR) and text-to-speech for voice coaching
  - SDK/Client: Not yet imported (env vars configured, implementation pending)
  - Auth: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
  - Config: `backend/app/config.py`

**AI Adapter Architecture:**
- Abstract base: `backend/app/services/agents/base.py` - `BaseCoachingAdapter` ABC
- Registry pattern: `backend/app/services/agents/registry.py` - `AdapterRegistry` singleton
- Mock adapter: `backend/app/services/agents/adapters/mock.py` - Development/testing without credentials
- Real AI adapters (Azure OpenAI, Anthropic, OpenAI) are not yet implemented; only the mock adapter exists
- Adapters yield streaming `CoachEvent` objects (text, audio, score, suggestion, error, done)
- Request model: `CoachRequest` with session_id, message, mode (text/audio), scenario_context, hcp_profile, scoring_criteria

## Data Storage

**Databases:**
- SQLite (development) via aiosqlite
  - Connection: `DATABASE_URL=sqlite+aiosqlite:///./ai_coach.db`
  - Client: SQLAlchemy 2.0 async (`backend/app/database.py`)
  - Session management: `AsyncSessionLocal` with auto-commit/rollback
  - ORM base: `backend/app/models/base.py` - `Base` (DeclarativeBase) + `TimestampMixin` (UUID pk, created_at, updated_at)

- PostgreSQL (production) via asyncpg
  - Connection: `DATABASE_URL` env var (format: `postgresql+asyncpg://...`)
  - Client: Same SQLAlchemy async engine, driver swapped via connection string
  - Optional dependency group: `pip install -e ".[postgresql]"` installs `asyncpg` and `psycopg2-binary`

- In-memory SQLite (testing)
  - Connection: `sqlite+aiosqlite:///:memory:` (`backend/tests/conftest.py`)
  - Fresh database per test via `setup_db` autouse fixture

**Migrations:**
- Alembic >=1.13.0 (`backend/alembic/`)
  - Versions directory: `backend/alembic/versions/` (currently empty - no migrations yet)
  - Tables currently created via `Base.metadata.create_all` in app lifespan (`backend/app/main.py`)

**File Storage:**
- Local filesystem only (no cloud storage integration detected)
- Backend data directory: `/app/data/` created in Dockerfile

**Caching:**
- None (no Redis, Memcached, or application-level caching detected)
- `@lru_cache` used only for settings singleton (`backend/app/config.py`)

## Authentication & Identity

**Auth Provider:**
- Custom JWT implementation (no third-party auth provider)
  - Token library: `python-jose[cryptography]` for JWT encode/decode
  - Password hashing: `passlib[bcrypt]`
  - Settings: `SECRET_KEY`, `ALGORITHM` (HS256), `ACCESS_TOKEN_EXPIRE_MINUTES` (1440 = 24h) in `backend/app/config.py`
  - Dependency: `get_current_user` planned but not yet implemented (`backend/app/dependencies.py` has TODO)
  - Frontend: JWT stored in `localStorage`, attached via Axios request interceptor (`frontend/src/api/client.ts`)
  - Auto-redirect: 401 responses trigger token removal and redirect to `/login` (Axios response interceptor)

## Monitoring & Observability

**Health Checks:**
- Backend: `GET /api/health` returns `{"status": "healthy", "service": "AI Avatar Platform"}` (`backend/app/main.py`)
- Frontend (nginx): `GET /health` returns static JSON health response (`frontend/nginx.conf`)
- Docker healthchecks: Both Dockerfiles include `HEALTHCHECK` instructions

**Error Tracking:**
- None (no Sentry, Datadog, or similar service integrated)
- Custom exception hierarchy: `AppException` -> `NotFoundException`, `ValidationException`, `ConflictException` (`backend/app/utils/exceptions.py`)
- Global FastAPI exception handler returns structured `{"code", "message", "details"}` responses

**Logs:**
- Default Python/uvicorn logging only
- SQLAlchemy echo mode: enabled when `DEBUG=true` (`backend/app/database.py`)
- No structured logging framework (no loguru, structlog, etc.)

## CI/CD & Deployment

**Hosting:**
- Azure Container Apps (backend + frontend as separate container apps)
- Azure Container Registry (ACR) for Docker image storage
- Deployment triggered on push to `main` branch after all tests pass

**CI Pipeline:** `.github/workflows/ci.yml`
- Trigger: Push/PR to `main`
- Jobs (sequential with dependencies):
  1. `backend-test` - Python 3.11, ruff lint + format check, pytest with coverage
  2. `frontend-test` - Node 20, TypeScript type check, Vite build
  3. `e2e-test` (needs backend-test + frontend-test) - Full stack with Playwright (Chromium)
  4. `deploy` (needs e2e-test, main only) - Azure OIDC login, ACR build + push, Container Apps update

**Additional Workflows:**
- `.github/workflows/sync-wiki.yml` - Syncs `wiki/` and `docs/` content to GitHub Wiki on push to main
- `.github/workflows/sync-project.yml` - Syncs `docs/plans/` and `docs/specs/` to GitHub Project board

**Azure Authentication:**
- OIDC (federated credentials): `id-token: write` permission required
- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- Variables: `ACR_NAME`, `RESOURCE_GROUP`

## Environment Configuration

**Required env vars (backend):**
- `DATABASE_URL` - Async SQLAlchemy connection string
- `SECRET_KEY` - JWT signing secret (MUST change from default in production)
- `CORS_ORIGINS` - Comma-separated allowed origins

**Optional env vars (backend - AI features):**
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI service endpoint
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT` - Azure OpenAI model deployment name
- `ANTHROPIC_API_KEY` - Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key
- `AZURE_SPEECH_KEY` - Azure Speech Services key
- `AZURE_SPEECH_REGION` - Azure Speech Services region

**Optional env vars (frontend):**
- `VITE_API_BASE_URL` - Backend API URL (build-time, Dockerfile ARG)

**Secrets location:**
- `.env` files (local development, gitignored)
- `.env.example` template: `backend/.env.example`
- GitHub Secrets (CI/CD): Azure credentials for deployment
- GitHub Variables (CI/CD): `ACR_NAME`, `RESOURCE_GROUP`, `PROJECT_NUMBER`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## WebSocket Support

**Real-time Communication:**
- `websockets >=13.0` dependency installed (`backend/pyproject.toml`)
- Vite dev proxy configured with `ws: true` for WebSocket passthrough (`frontend/vite.config.ts`)
- nginx reverse proxy configured with WebSocket upgrade headers (`frontend/nginx.conf`)
- No WebSocket endpoints implemented yet (infrastructure is ready)

## Integration Maturity Summary

| Integration | Status | Files |
|------------|--------|-------|
| Azure OpenAI | Configured, not implemented | `backend/app/config.py`, no adapter |
| Anthropic Claude | Configured, not implemented | `backend/app/config.py`, no adapter |
| OpenAI (Direct) | Configured, not implemented | `backend/app/config.py`, no adapter |
| Azure Speech | Configured, not implemented | `backend/app/config.py` |
| Mock AI Adapter | Implemented | `backend/app/services/agents/adapters/mock.py` |
| SQLite (dev) | Fully working | `backend/app/database.py` |
| PostgreSQL (prod) | Driver available, not tested | Optional dep in `backend/pyproject.toml` |
| JWT Auth | Partially implemented | Config in place, `get_current_user` is TODO |
| WebSocket | Infrastructure ready | Proxy configs done, no endpoints |
| Azure Container Apps | CI/CD configured | `.github/workflows/ci.yml` |
| GitHub Wiki Sync | Implemented | `.github/workflows/sync-wiki.yml` |
| GitHub Project Sync | Implemented | `.github/workflows/sync-project.yml` |

---

*Integration audit: 2026-03-24*
