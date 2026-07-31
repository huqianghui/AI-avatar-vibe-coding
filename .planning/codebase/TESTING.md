# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Backend Runner:**
- **pytest** >= 8.3.0 with **pytest-asyncio** >= 0.24.0
- Config: `backend/pyproject.toml` `[tool.pytest.ini_options]`
- `asyncio_mode = "auto"` -- all async test functions run automatically without `@pytest.mark.asyncio`
- Global test timeout: 60 seconds (via `pytest-timeout`)

**Backend Assertion Library:**
- Built-in Python `assert` statements (pytest rewrites)

**Frontend E2E Runner:**
- **Playwright** >= 1.48.0
- Config: `frontend/e2e/playwright.config.ts`

**Frontend E2E Assertion Library:**
- Playwright built-in `expect()` API

**Run Commands:**
```bash
# Backend - all tests
cd backend && pytest -v

# Backend - with coverage (CI mode)
cd backend && pytest tests/ -v \
  --junitxml=test-results/junit.xml \
  --html=test-results/report.html \
  --self-contained-html \
  --cov=app \
  --cov-report=html:test-results/coverage \
  --cov-report=xml:test-results/coverage.xml

# Frontend E2E - all tests
cd frontend && npx playwright test --config=e2e/playwright.config.ts

# Frontend E2E - with reporter
cd frontend && npx playwright test --config=e2e/playwright.config.ts --reporter=list,html
```

## Test File Organization

**Backend Location:**
- Separate `backend/tests/` directory (not co-located with source)
- Config: `testpaths = ["tests"]` in `pyproject.toml`

**Backend Naming:**
- Pattern: `test_<module_or_feature>.py`
- Examples: `test_health.py`, `test_mock_adapter.py`, `test_schema_integrity.py`

**Backend Structure:**
```
backend/
├── tests/
│   ├── __init__.py           # Empty (marks as package)
│   ├── conftest.py           # Shared fixtures (DB, HTTP client)
│   ├── test_health.py        # Health endpoint tests
│   ├── test_mock_adapter.py  # MockCoachingAdapter unit tests
│   └── test_schema_integrity.py  # ORM/migration drift detection
```

**Frontend E2E Location:**
- Separate `frontend/e2e/` directory
- Config file lives alongside tests: `frontend/e2e/playwright.config.ts`

**Frontend E2E Naming:**
- Pattern: `<feature>.spec.ts`
- Example: `health.spec.ts`

**Frontend E2E Structure:**
```
frontend/
├── e2e/
│   ├── playwright.config.ts  # Playwright config
│   └── health.spec.ts        # Health check E2E tests
```

## Test Structure

**Backend - Async Test Functions (no class wrappers):**
```python
"""Health check endpoint tests."""


async def test_health_check(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
```

Key patterns:
- Module-level docstring describing the test file scope
- Bare `async def test_*()` functions (no test classes, no `self`)
- Fixture injection via parameter names: `client`, `setup_db`
- Assertions use plain `assert` with comparison operators
- Response JSON parsed via `response.json()` and checked field-by-field

**Backend - Unit Tests (direct instantiation):**
```python
"""Tests for the MockCoachingAdapter."""

from app.services.agents.adapters.mock import MockCoachingAdapter
from app.services.agents.base import CoachEventType, CoachRequest


async def test_mock_adapter_execute():
    adapter = MockCoachingAdapter()
    request = CoachRequest(
        session_id="test-session",
        message="Tell me about the safety profile of this drug.",
    )

    events = []
    async for event in adapter.execute(request):
        events.append(event)

    # Should have TEXT, SUGGESTION, and DONE events
    assert len(events) == 3
    assert events[0].type == CoachEventType.TEXT
    assert events[1].type == CoachEventType.SUGGESTION
    assert events[2].type == CoachEventType.DONE
    assert "Mock HCP Response" in events[0].content
```

Key patterns:
- Direct class instantiation for unit tests (no mocking framework)
- Dataclass construction for test inputs: `CoachRequest(session_id=..., message=...)`
- Async iteration collected into list for assertion
- Comments before assert blocks explaining expected behavior

**Frontend E2E - Playwright describe/test blocks:**
```typescript
import { test, expect } from "@playwright/test";

test.describe("Health Checks", () => {
  test("backend health endpoint responds", async ({ request }) => {
    const response = await request.get("http://localhost:8000/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  test("frontend loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AI Avatar/);
  });
});
```

Key patterns:
- `test.describe()` groups related tests
- Destructure Playwright fixtures: `{ request }`, `{ page }`
- API tests use `request` fixture; UI tests use `page` fixture
- `expect().toBeTruthy()` for boolean checks, `expect().toBe()` for exact matches

## Fixtures and Setup

**Backend Database Fixture (`backend/tests/conftest.py`):**
```python
# In-memory SQLite for test isolation
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

Key patterns:
- `autouse=True` on `setup_db` -- every test gets a fresh database automatically
- Tables created before and dropped after EACH test (full isolation)
- In-memory SQLite: fast, no filesystem cleanup needed

**Backend HTTP Client Fixture (`backend/tests/conftest.py`):**
```python
@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI endpoints."""
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
```

Key patterns:
- FastAPI dependency override injects test database session
- `httpx.AsyncClient` with `ASGITransport` (no real HTTP server needed)
- Base URL `http://test` (arbitrary, only used for request building)
- Overrides cleared after test via `app.dependency_overrides.clear()`

**Backend Engine Cleanup (`backend/tests/conftest.py`):**
```python
@pytest.fixture(autouse=True, scope="session")
async def dispose_engine():
    """Dispose test engine at session end to prevent process hang."""
    yield
    await test_engine.dispose()
```

Key pattern:
- Session-scoped fixture disposes async engine to prevent process hang on exit

**Frontend E2E Web Servers (`frontend/e2e/playwright.config.ts`):**
```typescript
webServer: [
    {
      command: "cd ../backend && uvicorn app.main:app --port 8000",
      port: 8000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "cd .. && npm run dev",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
],
```

Key patterns:
- Playwright auto-starts both backend and frontend servers
- `reuseExistingServer` only in local dev (not CI)
- 30-second timeout for server startup

## Mocking

**Framework:** No mocking framework (no `unittest.mock`, no `pytest-mock`). Tests use:

1. **FastAPI Dependency Overrides** for database injection:
   ```python
   app.dependency_overrides[get_db] = override_get_db
   ```

2. **Mock Adapter Pattern** for AI services -- a real `MockCoachingAdapter` class exists at `backend/app/services/agents/adapters/mock.py`:
   ```python
   class MockCoachingAdapter(BaseCoachingAdapter):
       name = "mock"
       async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
           yield CoachEvent(type=CoachEventType.TEXT, content="[Mock HCP Response]...")
           yield CoachEvent(type=CoachEventType.SUGGESTION, content="...")
           yield CoachEvent(type=CoachEventType.DONE, content="")
       async def is_available(self) -> bool:
           return True
   ```

**What to Mock:**
- Database sessions: override `get_db` dependency
- AI service adapters: use `MockCoachingAdapter` instead of real API adapters
- Auth dependencies (planned): will override `get_current_user`

**What NOT to Mock:**
- SQLAlchemy ORM operations: test against in-memory SQLite
- FastAPI routing and middleware: test through full ASGI transport
- Pydantic validation: test with real request/response schemas

## Coverage

**Requirements:** No minimum coverage threshold enforced, but coverage is collected and reported.

**Generate Coverage:**
```bash
cd backend && pytest tests/ -v \
  --cov=app \
  --cov-report=html:test-results/coverage \
  --cov-report=xml:test-results/coverage.xml
```

**View Coverage:**
```bash
# HTML report
open backend/test-results/coverage/index.html

# XML report (for CI integration)
cat backend/test-results/coverage.xml
```

**CI Coverage:**
- Coverage collected in `backend-test` CI job
- HTML and XML reports uploaded as GitHub Actions artifacts under `backend-test-results`

## Test Types

**Unit Tests:**
- Scope: Individual classes and functions in isolation
- Location: `backend/tests/test_mock_adapter.py`
- Pattern: Direct instantiation, no HTTP layer, no database
- Example: Testing `MockCoachingAdapter.execute()`, `MockCoachingAdapter.is_available()`

**Integration Tests:**
- Scope: Full HTTP request through FastAPI app stack (routing + middleware + database)
- Location: `backend/tests/test_health.py`
- Pattern: `httpx.AsyncClient` with `ASGITransport`, in-memory database
- Example: `GET /api/health` returns 200 with expected JSON

**Schema Integrity Tests:**
- Scope: Verify ORM models match database schema (catch migration drift)
- Location: `backend/tests/test_schema_integrity.py`
- Pattern: Introspect `Base.metadata.tables` after `create_all`
- Purpose: Fail if a developer adds a model column but forgets the Alembic migration

**E2E Tests (Playwright):**
- Scope: Full stack (frontend + backend running as real servers)
- Location: `frontend/e2e/health.spec.ts`
- Pattern: Playwright launches browsers, hits real URLs
- Browser: Chromium only (single project)
- Viewport: 1440x900
- CI: 2 retries, screenshot on failure, trace on first retry
- Local: 0 retries, list reporter

**No frontend unit tests:**
- No Jest, Vitest, or React Testing Library configured
- No `*.test.ts` or `*.test.tsx` files exist
- Frontend validation relies solely on TypeScript compiler checks + E2E tests

## CI Test Pipeline

**Pipeline Order (from `.github/workflows/ci.yml`):**
```
backend-test  ──┐
                 ├──> e2e-test ──> deploy (main only)
frontend-test ──┘
```

**backend-test job:**
1. `ruff check .` (lint)
2. `ruff format --check .` (format check)
3. `pytest tests/ -v` with coverage and HTML reporting
4. Upload `backend/test-results/` as artifact

**frontend-test job:**
1. `npx tsc -b` (TypeScript type check)
2. `npm run build` (Vite production build)
3. No unit test step (none configured)

**e2e-test job (depends on both above):**
1. Install backend + frontend
2. Initialize database (`scripts/init_db.py`, `scripts/seed_data.py`)
3. Install Playwright Chromium
4. Run `npx playwright test --config=e2e/playwright.config.ts`
5. Upload `frontend/playwright-report/` as artifact

## Common Patterns

**Async Testing (no decorator needed):**
```python
# asyncio_mode = "auto" in pyproject.toml means no @pytest.mark.asyncio needed
async def test_something():
    result = await some_async_function()
    assert result == expected
```

**API Endpoint Testing:**
```python
async def test_endpoint(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["field"] == "value"
```

**Async Iterator Testing:**
```python
async def test_async_iterator():
    events = []
    async for event in adapter.execute(request):
        events.append(event)
    assert len(events) == expected_count
    assert events[0].type == ExpectedType
```

**Schema Integrity Testing:**
```python
async def test_all_models_have_tables(setup_db):
    declared_tables = set(Base.metadata.tables.keys())
    assert len(declared_tables) >= 0
```

**E2E API Testing (Playwright):**
```typescript
test("api endpoint responds", async ({ request }) => {
    const response = await request.get("http://localhost:8000/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.field).toBe("value");
});
```

**E2E Page Testing (Playwright):**
```typescript
test("page loads correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Expected Title/);
});
```

## Adding New Tests

**New Backend Test File:**
1. Create `backend/tests/test_<feature>.py`
2. Add module docstring: `"""Tests for <feature>."""`
3. Import fixtures from conftest automatically (e.g., `client`, `setup_db`)
4. Write `async def test_<scenario>():` functions
5. No need for `@pytest.mark.asyncio` (auto mode)

**New Backend Fixture:**
1. Add to `backend/tests/conftest.py`
2. Use `@pytest.fixture` decorator
3. Use `async def` for async fixtures
4. Use `autouse=True` if it should apply to all tests

**New E2E Test File:**
1. Create `frontend/e2e/<feature>.spec.ts`
2. Import `{ test, expect }` from `@playwright/test`
3. Group with `test.describe("<Feature>", () => { ... })`
4. Use `{ page }` for UI tests, `{ request }` for API tests
5. Run with `npx playwright test --config=e2e/playwright.config.ts`

---

*Testing analysis: 2026-03-24*
