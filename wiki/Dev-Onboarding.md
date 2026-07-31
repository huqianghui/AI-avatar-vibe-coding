# Developer Onboarding

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 20+ | Frontend runtime |
| Docker | Latest | Containerized development |
| Git | Latest | Version control |

## Quick Start

### Option 1: Local Development

```bash
# Clone
git clone https://github.com/huqianghui/AI-avatar-vibe-coding.git
cd AI-avatar-vibe-coding

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
python scripts/init_db.py
python scripts/seed_data.py
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm ci
npm run dev
# → http://localhost:5173
```

### Option 2: Docker

```bash
docker-compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

### Default Credentials
| User | Email | Password |
|------|-------|----------|
| Admin | admin@aicoach.com | admin123 |
| Test MR | mr@aicoach.com | test123 |

## Pre-Commit Checklist

**MUST pass before every commit:**

```bash
# Backend
cd backend
ruff check .           # Lint
ruff format --check .  # Format
pytest -v              # Tests

# Frontend
cd frontend
npx tsc -b             # Type check
npm run build          # Build
```

## Key Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Engineering Handbook | `CLAUDE.md` | Coding standards, gotchas |
| Requirements | `docs/requirements.md` | Business requirements |
| Best Practices | `docs/best-practices.md` | Patterns reference |
| API Docs | http://localhost:8000/docs | Interactive Swagger UI |

## Project Structure Overview

See [Architecture](Architecture) for detailed system design.

```
backend/app/
├── api/       # Add new routers here
├── models/    # Add new ORM models here
├── schemas/   # Add request/response schemas here
├── services/  # Add business logic here
└── utils/     # Shared utilities

frontend/src/
├── pages/           # Add new pages here
├── components/shared/ # Add reusable components here
├── hooks/           # Add TanStack Query hooks here
└── api/             # Add API client methods here
```

## Common Tasks

### Add a new API endpoint
1. Create model in `backend/app/models/`
2. Create schema in `backend/app/schemas/`
3. Create service in `backend/app/services/`
4. Create router in `backend/app/api/`
5. Register router in `backend/app/api/router.py`
6. Create Alembic migration: `alembic revision --autogenerate -m "add X"`
7. Write tests in `backend/tests/`

### Add a new frontend page
1. Create page in `frontend/src/pages/`
2. Create API hook in `frontend/src/hooks/`
3. Add route in router config
4. Write E2E test in `frontend/e2e/`
