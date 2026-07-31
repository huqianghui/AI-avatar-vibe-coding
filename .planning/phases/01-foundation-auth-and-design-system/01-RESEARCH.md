# Phase 1: Foundation, Auth, and Design System - Research

**Researched:** 2026-03-24
**Domain:** Full-stack foundation (FastAPI auth, React design system, i18n, pluggable AI adapters)
**Confidence:** HIGH

## Summary

Phase 1 establishes the complete application scaffold: backend JWT authentication with User/Admin roles, frontend React SPA with login page and two responsive layout shells (user top-nav, admin sidebar), a shared component library adapted from Figma Make generated code (shadcn/ui + Radix primitives), react-i18next for zh-CN/en-US internationalization, and an extended pluggable adapter pattern for all AI services (LLM, STT, TTS, Avatar).

The project has a strong starting position. The backend already has: async SQLAlchemy with session management, FastAPI with lifespan/CORS/exception handling, a working adapter pattern (`BaseCoachingAdapter` + `AdapterRegistry` + `MockCoachingAdapter`), pydantic-settings configuration, test infrastructure with in-memory SQLite. The frontend has: Vite 6 + Tailwind CSS v4 configured, Axios client with JWT interceptor, `cn()` utility, `@/` path alias. What is missing: all ORM models, schemas, API routers, React entry point (`index.html`, `main.tsx`, `App.tsx`), any pages/components, routing, i18n, and the React app shell itself.

The Figma Make exports in `figma-make/` provide a complete set of shadcn/ui components and layout shells that need adaptation (import paths, design token alignment, i18n integration) rather than writing from scratch. The adaptation work is the largest frontend effort; the backend auth is standard FastAPI/JWT pattern.

**Primary recommendation:** Adapt Figma Make components into `frontend/src/components/ui/`, build backend auth (User model + JWT endpoints + role middleware), wire up React Router with auth guards, integrate react-i18next from day 1, and extend the existing adapter registry pattern to cover STT/TTS/Avatar service categories.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Adapt Figma Make generated code into the project -- extract components from `figma-make/Design System for SaaS/` and `figma-make/Design Login and Layout Shell/`, adapt to match project conventions (path aliases, Tailwind v4 design tokens, i18n). Keep `figma-make/` as reference, not as runtime code.
- **D-02:** Component library is shadcn/ui-based (Radix primitives) -- already present in Figma Make exports. Adapt rather than rebuild.
- **D-03:** Components organized as `components/ui/` (generic primitives: Button, Card, Input, Tabs, etc.) + `components/coach/`, `components/admin/` (domain-specific composites). Matches existing directory structure.
- **D-04:** Figma Make design tokens take priority over existing `frontend/src/styles/index.css` values -- Figma design is the source of truth. Primary Blue #1E40AF, Inter + Noto Sans SC fonts, 8px radius cards.
- **D-05:** Two layout shells -- User gets top-nav layout, Admin gets sidebar layout. Same shared components in both, different arrangements. Adapted from Figma Make Layout Shell code.
- **D-06:** Phase 1 delivers responsive web covering desktop, tablet, mobile, and Teams Tab (iframe). WeChat Mini Program requires a separate frontend -- deferred to future phase. Backend REST API contracts serve all clients.
- **D-07:** Frontend and backend both fully modular -- reusable components, domain-specific hooks, service layer separation.

### Claude's Discretion
- Auth flow: JWT in localStorage (Axios client already configured), python-jose + passlib for backend, simple username/password login, role-based route protection via React Router guards
- App shell: Adapt directly from Figma Make Layout Shell -- user top-nav (64px, logo + nav links + language switcher + avatar) and admin sidebar (240px, dark blue #1E293B, collapsible)
- i18n: react-i18next with namespace-based translation files (`common.json`, `auth.json`, etc.), persist language preference in localStorage, zh-CN + en-US from day 1
- Feature toggles: Config-driven via pydantic-settings backend + Vite env vars frontend, mock providers work without Azure credentials
- Responsive breakpoints: Mobile-first, hamburger menu on mobile for both layouts

### Deferred Ideas (OUT OF SCOPE)
- WeChat Mini Program -- requires separate frontend, deferred to post-v1
- Teams Bot integration -- post-MVP
- Per-region theming/branding -- not needed for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Pluggable adapter pattern for all AI services (LLM, STT, TTS, Avatar) | Extend existing `BaseCoachingAdapter` + `AdapterRegistry` to support service categories; create base adapters per service type |
| ARCH-02 | Component-based, configurable features with feature toggles | Backend: pydantic-settings `Settings` class with feature flags; Frontend: Vite env vars + config context |
| ARCH-03 | Backend dependency injection -- any service replaceable with mock | FastAPI `Depends()` pattern already in place; extend with auth dependencies, adapter DI |
| ARCH-04 | Shared design system component library from Figma | Adapt shadcn/ui components from `figma-make/Design System for SaaS/` into `frontend/src/components/ui/` |
| ARCH-05 | Azure service connections configurable per environment | Extend `backend/app/config.py` Settings with per-service config sections; no hardcoded endpoints |
| AUTH-01 | User login with username/password | FastAPI `/api/v1/auth/login` endpoint + User ORM model + passlib bcrypt hashing |
| AUTH-02 | Session persists across browser refresh via JWT | JWT stored in localStorage, Axios interceptor already attaches Bearer token |
| AUTH-03 | Two roles (User/Admin) with role-based route protection | User model `role` field (enum), React Router auth guards, backend role-checking dependency |
| AUTH-04 | Auth module uses DI -- ready for Azure AD/Teams SSO later | Abstract auth interface, concrete username/password implementation, swappable via DI |
| UI-01 | Shared component library (buttons, cards, inputs, charts, navigation) | shadcn/ui components from Figma Make adapted with project conventions |
| UI-02 | Login page and app layout shell from Figma | Adapt `figma-make/Design Login and Layout Shell/` -- Login.tsx, UserLayout.tsx, AdminLayout.tsx |
| UI-07 | All UI text externalized via react-i18next (zh-CN + en-US) | react-i18next with namespace JSON files, `useTranslation` hook in all components |
| PLAT-01 | i18n framework integrated from day 1 | react-i18next + i18next + i18next-browser-languagedetector; namespace files per domain |
| PLAT-02 | Responsive web design (desktop, tablet, mobile, Teams Tab) | Tailwind responsive utilities, mobile-first, Figma Make layouts already have responsive patterns |
| PLAT-04 | Per-region deployment -- single codebase, per-region config | pydantic-settings per-environment `.env` files; `region` config field; conditional service selection |
| PLAT-05 | Voice interaction mode configurable per deployment and session | Config field `voice_mode: text_only | stt_tts | realtime | voice_live`; feature toggle pattern |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Key directives that constrain all implementation:

- **Async everywhere** in backend: `async def`, `await`, `AsyncSession` -- no sync DB calls
- **Pydantic v2** schemas with `model_config = ConfigDict(from_attributes=True)`
- **Route ordering**: Static paths before parameterized paths
- **Create returns 201**, Delete returns 204
- **Service layer** holds business logic; routers only handle HTTP
- **No raw SQL** -- SQLAlchemy ORM or Alembic migrations only
- **TypeScript strict mode**: `strict: true`, no `any`, no unused variables, `noUncheckedIndexedAccess: true`
- **TanStack Query hooks** per domain, no inline `useQuery`
- **`@/` path alias** for all imports from `src/`
- **`cn()` utility** for conditional class composition
- **No Redux** -- TanStack Query for server state, lightweight store for auth
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`
- **NEVER modify DB schema without Alembic migration**
- **All routes under `/api/v1/` prefix**
- **Structured error responses**: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- **Pre-commit checks**: `ruff check .`, `ruff format --check .`, `pytest -v` (backend); `npx tsc -b`, `npm run build` (frontend)
- **Ruff**: line-length 100, double quotes, target py311
- **Docker**: multi-stage builds, `python:3.11-slim` backend, `node:20-slim` build + `nginx:alpine` serve frontend

## Standard Stack

### Core (Backend -- Already in pyproject.toml)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 (installed: 0.115.0) | ASGI web framework | Already configured with lifespan, CORS, exception handler |
| SQLAlchemy 2.0 (async) | >=2.0.35 | ORM with AsyncSession | Already configured with aiosqlite |
| Alembic | >=1.13.0 | Database migrations | Required by CLAUDE.md -- never modify schema without migration |
| python-jose[cryptography] | >=3.3.0 (installed: 3.3.0) | JWT token creation/verification | Standard FastAPI auth library |
| passlib[bcrypt] | >=1.7.4 (installed: 1.7.4) | Password hashing | bcrypt is the standard for password storage |
| pydantic-settings | >=2.5.0 (installed: 2.5.2) | Environment-based configuration | Already configured in `backend/app/config.py` |
| pytest + pytest-asyncio | >=8.3.0 / >=0.24.0 | Testing | Already configured with in-memory SQLite fixtures |

### Core (Frontend -- Already in package.json unless noted)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.3.0 | UI framework | Already in package.json |
| React Router DOM | ^7.0.0 (latest: 7.13.2) | Client-side routing | Already in package.json, Figma Make uses same |
| TanStack Query | ^5.60.0 | Server state management | Already in package.json, CLAUDE.md mandates |
| Axios | ^1.7.0 | HTTP client | Already configured with JWT interceptor |
| Tailwind CSS v4 | ^4.0.0 | Utility-first CSS | Already configured with @tailwindcss/vite plugin |
| lucide-react | ^0.460.0 | Icons | Already in package.json, Figma Make uses same |

### New Dependencies Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-i18next | 16.6.2 (latest) | React i18n hooks/components | All UI text externalization (PLAT-01, UI-07) |
| i18next | 25.10.5 (latest) | Core i18n framework | Required peer dependency of react-i18next |
| i18next-browser-languagedetector | 8.2.1 (latest) | Auto-detect browser language | Initial language selection |
| i18next-http-backend | 3.0.2 (latest) | Load translations from JSON files | Lazy-load namespace translation files |
| @radix-ui/react-slot | 1.2.4 (latest) | Slot component for composition | Required by shadcn/ui Button (asChild pattern) |
| @radix-ui/react-dropdown-menu | 2.1.16 (latest) | Dropdown menu primitive | User menu, language switcher |
| @radix-ui/react-dialog | 1.1.15 (latest) | Dialog/modal primitive | Used by shadcn/ui Sheet, Dialog |
| @radix-ui/react-avatar | (latest) | Avatar primitive | User avatar in nav |
| @radix-ui/react-label | (latest) | Form label primitive | Form components |
| @radix-ui/react-separator | (latest) | Separator primitive | UI dividers |
| @radix-ui/react-tooltip | (latest) | Tooltip primitive | Icon tooltips |
| @radix-ui/react-navigation-menu | (latest) | Navigation menu primitive | Top nav component |
| @radix-ui/react-checkbox | (latest) | Checkbox primitive | Login "Remember me" |
| @radix-ui/react-select | (latest) | Select primitive | Language switcher dropdown |
| @radix-ui/react-switch | (latest) | Switch/toggle primitive | Feature toggles UI |
| class-variance-authority | 0.7.1 (latest) | Variant class generation | shadcn/ui Button, Badge variant patterns |
| sonner | 2.0.7 (latest) | Toast notifications | User feedback (login success/error) |
| vaul | 1.1.2 (latest) | Drawer component | Mobile responsive sheet/drawer |

**Installation (frontend new deps):**
```bash
cd frontend
npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend
npm install @radix-ui/react-slot @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-avatar @radix-ui/react-label @radix-ui/react-separator @radix-ui/react-tooltip @radix-ui/react-navigation-menu @radix-ui/react-checkbox @radix-ui/react-select @radix-ui/react-switch
npm install class-variance-authority sonner vaul
```

**Note:** Only install Radix primitives actually used by Phase 1 components. The full Figma Make package.json lists many more (accordion, tabs, popover, etc.) -- add those in later phases when their components are needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-jose | PyJWT | python-jose already in pyproject.toml and handles JWS/JWE; PyJWT is lighter but would be a needless change |
| localStorage JWT | httpOnly cookie | Cookies are more secure (XSS-resistant) but Axios client already configured for localStorage; CONTEXT.md locks this decision |
| react-i18next | next-intl, FormatJS | react-i18next is the de-facto React i18n library with namespace support; CONTEXT.md locks this choice |
| Radix UI primitives | Headless UI, Ark UI | Figma Make already generates shadcn/ui (Radix-based) components; switching would mean rewriting all components |

## Architecture Patterns

### Recommended Project Structure (Phase 1 additions)

```
backend/
  app/
    api/
      __init__.py
      auth.py               # POST /login, POST /refresh, GET /me
    models/
      __init__.py
      base.py               # (exists) Base + TimestampMixin
      user.py               # NEW: User ORM model
    schemas/
      __init__.py
      auth.py               # NEW: LoginRequest, TokenResponse, UserResponse
      user.py               # NEW: UserCreate, UserUpdate, UserRead
    services/
      auth.py               # NEW: authenticate_user, create_token, hash_password
      agents/
        base.py             # (exists) BaseCoachingAdapter
        registry.py          # (exists) AdapterRegistry
        adapters/
          mock.py            # (exists) MockCoachingAdapter
        stt/
          base.py            # NEW: BaseSTTAdapter (speech-to-text)
          mock.py            # NEW: MockSTTAdapter
        tts/
          base.py            # NEW: BaseTTSAdapter (text-to-speech)
          mock.py            # NEW: MockTTSAdapter
        avatar/
          base.py            # NEW: BaseAvatarAdapter
          mock.py            # NEW: MockAvatarAdapter
    dependencies.py          # (extend) get_current_user, require_role("admin")
    config.py                # (extend) feature flags, voice mode, region config

frontend/
  public/
    locales/
      en-US/
        common.json          # Shared UI text
        auth.json            # Login page text
        nav.json             # Navigation labels
      zh-CN/
        common.json
        auth.json
        nav.json
  src/
    components/
      ui/                    # Adapted from figma-make/Design System for SaaS/
        button.tsx
        card.tsx
        input.tsx
        label.tsx
        badge.tsx
        separator.tsx
        dropdown-menu.tsx
        avatar.tsx
        checkbox.tsx
        select.tsx
        switch.tsx
        tooltip.tsx
        skeleton.tsx
        sheet.tsx
        dialog.tsx
        form.tsx
        sonner.tsx           # Toast
        index.ts             # Barrel export
      shared/
        language-switcher.tsx
        loading-state.tsx
        empty-state.tsx
      layouts/
        user-layout.tsx      # Adapted from figma-make UserLayout
        admin-layout.tsx     # Adapted from figma-make AdminLayout
        auth-layout.tsx      # Login page wrapper
    pages/
      login.tsx              # Adapted from figma-make Login
      user/
        dashboard.tsx        # Placeholder
      admin/
        dashboard.tsx        # Placeholder
      not-found.tsx
    hooks/
      use-auth.ts            # TanStack Query: login mutation, refresh, me query
    stores/
      auth-store.ts          # JWT token + user info in localStorage
    contexts/
      auth-context.tsx       # AuthProvider + useAuth hook
    types/
      auth.ts                # User, LoginRequest, TokenResponse types
      config.ts              # FeatureFlags, AppConfig types
    i18n/
      index.ts               # i18next init + config
      types.ts               # Type-safe namespace keys (optional)
    lib/
      utils.ts               # (exists) cn()
      config.ts              # Runtime feature flag reader
    router/
      index.tsx              # Route definitions with auth guards
      auth-guard.tsx         # ProtectedRoute, AdminRoute components
    App.tsx                  # Root component: providers (Query, i18n, Auth, Router)
    main.tsx                 # ReactDOM.createRoot entry point
  index.html                 # Vite HTML entry
```

### Pattern 1: JWT Authentication Flow

**What:** Standard FastAPI JWT auth with role-based access control
**When to use:** All authenticated endpoints

Backend flow:
```python
# backend/app/services/auth.py
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
```

Backend dependency:
```python
# backend/app/dependencies.py
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Decode JWT, query user from DB, raise 401 if invalid
    ...

def require_role(role: str):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise AppException(403, "FORBIDDEN", "Insufficient permissions")
        return user
    return role_checker
```

### Pattern 2: React Auth Guard with Router

**What:** Role-based route protection using React Router layout routes
**When to use:** All protected pages

```typescript
// router/auth-guard.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function ProtectedRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== "admin") return <Navigate to="/user/dashboard" replace />;
  return <Outlet />;
}
```

### Pattern 3: i18n with Namespace-Based Translation Files

**What:** react-i18next initialized with lazy-loaded namespace JSON files
**When to use:** All UI text

```typescript
// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en-US",
    supportedLngs: ["en-US", "zh-CN"],
    defaultNS: "common",
    ns: ["common", "auth", "nav"],
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
```

Usage in components:
```typescript
import { useTranslation } from "react-i18next";

function LoginPage() {
  const { t } = useTranslation("auth");
  return <h1>{t("title")}</h1>; // Reads from auth.json
}
```

### Pattern 4: Pluggable Service Adapter Extension

**What:** Extend existing `BaseCoachingAdapter` pattern to STT, TTS, Avatar service categories
**When to use:** All AI service integrations

```python
# backend/app/services/agents/stt/base.py
from abc import ABC, abstractmethod

class BaseSTTAdapter(ABC):
    """Abstract base for Speech-to-Text adapters."""
    name: str = ""

    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str = "zh-CN") -> str:
        """Transcribe audio to text."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        ...
```

Each service category (STT, TTS, Avatar) follows the same `Base + Registry + Mock` pattern as the existing coaching adapter. The `AdapterRegistry` can be extended to a `ServiceRegistry` that manages multiple registries by category.

### Pattern 5: Feature Toggle Configuration

**What:** Config-driven feature availability using pydantic-settings + Vite env vars
**When to use:** All optional features (Avatar, voice modes, etc.)

```python
# backend/app/config.py (additions)
class Settings(BaseSettings):
    # ... existing fields ...

    # Feature toggles
    feature_avatar_enabled: bool = False
    feature_voice_enabled: bool = False
    feature_realtime_voice_enabled: bool = False

    # Voice mode: "text_only" | "stt_tts" | "realtime" | "voice_live"
    default_voice_mode: str = "text_only"

    # Region
    region: str = "global"  # "global" | "china" | "eu"

    # Azure Avatar (optional premium)
    azure_avatar_endpoint: str = ""
    azure_avatar_key: str = ""
```

Frontend reads config from backend API and/or Vite env vars:
```typescript
// Environment-specific via Vite
const FEATURE_FLAGS = {
  avatarEnabled: import.meta.env.VITE_FEATURE_AVATAR === "true",
  voiceEnabled: import.meta.env.VITE_FEATURE_VOICE === "true",
};
```

### Pattern 6: Figma Make Component Adaptation

**What:** Copy shadcn/ui components from `figma-make/` to `frontend/src/components/ui/`, adapt imports
**When to use:** All UI components in Phase 1

Adaptation checklist per component:
1. Copy `.tsx` file from `figma-make/Design System for SaaS/src/app/components/ui/`
2. Change `import { cn } from "./utils"` to `import { cn } from "@/lib/utils"`
3. Verify Tailwind v4 CSS variable names match project `index.css` (align with Figma Make `theme.css`)
4. Add i18n where component has user-visible text
5. Ensure TypeScript strict compliance (`noUnusedLocals`, `noUnusedParameters`)
6. Export from barrel `index.ts`

### Anti-Patterns to Avoid

- **Inline translations:** Never hardcode Chinese/English strings in components. Always use `t("key")` from react-i18next.
- **Sync database calls:** All backend functions must be `async def`. Never use synchronous SQLAlchemy patterns.
- **Direct role checks in components:** Use `AdminRoute`/`ProtectedRoute` guards at the router level, not `{user.role === "admin" && <Component />}` in components.
- **Hardcoded Azure endpoints:** All service URLs, keys, and regions must come from `Settings` -- never inline strings.
- **Custom cn() in UI components:** Figma Make components have their own `utils.ts` with an identical `cn()`. Replace all imports to use the project's `@/lib/utils`.
- **Installing all Radix packages at once:** Only install Radix primitives needed by Phase 1 components. The Figma Make package.json lists 20+ Radix packages, but many are for later phases.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | `passlib.context.CryptContext(schemes=["bcrypt"])` | Timing-safe comparison, automatic salt, migration support |
| JWT tokens | Manual token string building | `python-jose` `jwt.encode()` / `jwt.decode()` | Standard JOSE claims, expiry handling, algorithm verification |
| Form validation (frontend) | Custom validation logic | react-hook-form (already in Figma deps) or native HTML5 validation | Error state management, field-level validation, accessibility |
| Component variants | Conditional className strings | `class-variance-authority` (`cva()`) | Type-safe variants, consistent pattern, used by all shadcn/ui |
| Toast notifications | Custom toast component | `sonner` | Stacking, auto-dismiss, accessible, already in Figma deps |
| Dropdown menus | Custom `useState` + positioning | `@radix-ui/react-dropdown-menu` | Focus management, keyboard navigation, screen reader support |
| Language detection | Manual `navigator.language` parsing | `i18next-browser-languagedetector` | Checks localStorage, navigator, querystring, cookie in priority order |
| Mobile drawer/sheet | Custom sliding panel | `vaul` (Drawer) or Radix `Sheet` | Touch gestures, backdrop, animation, accessibility |
| Date/time formatting | Custom formatters | `Intl.DateTimeFormat` or `date-fns` | Locale-aware formatting for zh-CN and en-US |

**Key insight:** Every UI primitive (dropdown, dialog, tooltip, checkbox) must come from Radix UI via the shadcn/ui wrappers. Building custom versions loses accessibility (focus trapping, keyboard nav, ARIA attributes) and wastes time when the Figma Make exports already provide these.

## Common Pitfalls

### Pitfall 1: Figma Make cn() Import Path Mismatch
**What goes wrong:** Figma Make components import `cn` from `"./utils"` (relative path). Project convention uses `"@/lib/utils"`.
**Why it happens:** Figma Make generates self-contained apps with local utility files.
**How to avoid:** When adapting each component, search-and-replace `from "./utils"` with `from "@/lib/utils"`. Delete `components/ui/utils.ts` -- use only `lib/utils.ts`.
**Warning signs:** TypeScript compilation errors about missing `./utils` module.

### Pitfall 2: Tailwind v4 Design Token Naming Collision
**What goes wrong:** Figma Make's `theme.css` uses shadcn/ui naming (`--background`, `--foreground`, `--primary`, `--card`) while the existing project `index.css` uses `--color-primary-500` etc. Both use `@theme inline` but with different variable names.
**Why it happens:** Two design token systems were created independently.
**How to avoid:** Replace the existing `frontend/src/styles/index.css` with the Figma Make `theme.css` as the foundation (per decision D-04), then layer in the medical-themed color values (primary blue #1E40AF, etc.) and font stacks (Inter + Noto Sans SC). The shadcn/ui semantic naming (`--primary`, `--card`, `--muted`) is required for all adapted components to work.
**Warning signs:** Components render with wrong colors or no styling; Tailwind classes like `bg-primary` don't match expected blue.

### Pitfall 3: i18next Namespace Not Loaded Before Render
**What goes wrong:** Components using `useTranslation("auth")` show raw keys (`auth.title`) instead of translated text.
**Why it happens:** With `i18next-http-backend`, namespace JSON files load asynchronously. If the component renders before the namespace loads, it shows keys.
**How to avoid:** Wrap the app with `<Suspense fallback={<LoadingState />}>` and configure i18next to work with React Suspense: `react: { useSuspense: true }`. Or preload critical namespaces in i18n init.
**Warning signs:** Flash of translation keys on page load, especially on slow networks.

### Pitfall 4: FastAPI Route Order -- Static Before Parameterized
**What goes wrong:** `GET /api/v1/users/me` matches `GET /api/v1/users/{id}` instead.
**Why it happens:** FastAPI matches routes in declaration order. If `/{id}` is declared before `/me`, "me" is treated as an id.
**How to avoid:** Always declare static routes (`/me`, `/refresh`, `/defaults`) before parameterized routes (`/{id}`). This is documented in CLAUDE.md Gotcha #3.
**Warning signs:** 404 or wrong handler executing for `/me`, `/refresh` endpoints.

### Pitfall 5: bcrypt Version Incompatibility
**What goes wrong:** `passlib` with `bcrypt>=4.1.0` raises `AttributeError: module 'bcrypt' has no attribute '__about__'`.
**Why it happens:** passlib has not been updated to support bcrypt 4.1+. The internal version check code accesses `bcrypt.__about__.__version__` which was removed.
**How to avoid:** Pin `bcrypt<4.1.0` in pyproject.toml, or use `passlib[bcrypt]` which typically manages this. If issues arise, use `bcrypt==4.0.1` explicitly. Alternatively, use `CryptContext(schemes=["bcrypt"], deprecated="auto")` which handles this gracefully in current passlib releases.
**Warning signs:** Import errors or AttributeError when hashing passwords.

### Pitfall 6: SQLite ALTER COLUMN Limitation in Alembic
**What goes wrong:** Alembic migration fails with `OperationalError` when trying to alter a column in SQLite.
**Why it happens:** SQLite does not support `ALTER COLUMN`. CLAUDE.md Gotcha #1.
**How to avoid:** Use Alembic batch operations for SQLite: `with op.batch_alter_table('users') as batch_op: batch_op.alter_column(...)`. Configure Alembic env.py with `render_as_batch=True` for SQLite.
**Warning signs:** Migration errors in development (SQLite); no issue in production (PostgreSQL).

### Pitfall 7: CORS Missing Frontend Dev Port
**What goes wrong:** Login API calls from frontend fail silently with no error in network tab.
**Why it happens:** CORS not configured for the frontend dev server port. CLAUDE.md Gotcha #6.
**How to avoid:** Ensure `cors_origins` in Settings includes `http://localhost:5173`. The Vite dev proxy at `/api` should bypass CORS, but direct API calls need it. Already configured in `config.py` default value.
**Warning signs:** Browser console shows CORS errors; API requests blocked.

### Pitfall 8: Alembic env.py Missing Model Imports
**What goes wrong:** `alembic revision --autogenerate` generates empty migrations -- no table changes detected.
**Why it happens:** Alembic env.py does not import ORM model modules, so `Base.metadata` has no tables registered. CLAUDE.md Gotcha #7.
**How to avoid:** In `alembic/env.py`, import all model modules: `from app.models.user import User`. Or import the models package `__init__.py` that re-exports them all.
**Warning signs:** Auto-generated migration has no `op.create_table()` calls despite new models.

## Code Examples

### User ORM Model

```python
# backend/app/models/user.py
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(20), default="user")  # "user" or "admin"
    is_active: Mapped[bool] = mapped_column(default=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="zh-CN")
```

### Auth Pydantic Schemas

```python
# backend/app/schemas/auth.py
from pydantic import BaseModel, ConfigDict

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    preferred_language: str
```

### Auth Router

```python
# backend/app/api/auth.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth import authenticate_user, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, request.username, request.password)
    token = create_access_token(data={"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    return user
```

### Frontend Auth Store (Lightweight)

```typescript
// src/stores/auth-store.ts
interface AuthState {
  token: string | null;
  user: User | null;
}

// Simple store using module-level state + subscription pattern
// Or use zustand if preferred -- but keep lightweight per CLAUDE.md
let state: AuthState = {
  token: localStorage.getItem("access_token"),
  user: null,
};

const listeners = new Set<() => void>();

export function useAuthStore() {
  // React 18 useSyncExternalStore pattern
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function setAuth(token: string, user: User) {
  localStorage.setItem("access_token", token);
  state = { token, user };
  listeners.forEach((l) => l());
}

export function clearAuth() {
  localStorage.removeItem("access_token");
  state = { token: null, user: null };
  listeners.forEach((l) => l());
}
```

### i18n Translation File Structure

```json
// public/locales/en-US/auth.json
{
  "title": "AI Avatar",
  "email": "Email",
  "password": "Password",
  "rememberMe": "Remember me",
  "signIn": "Sign In",
  "signingIn": "Signing in...",
  "loginFailed": "Invalid username or password",
  "copyright": "2026 AI Avatar Platform"
}
```

```json
// public/locales/zh-CN/auth.json
{
  "title": "AI 教练",
  "email": "邮箱",
  "password": "密码",
  "rememberMe": "记住我",
  "signIn": "登录",
  "signingIn": "登录中...",
  "loginFailed": "用户名或密码错误",
  "copyright": "2026 AI 教练平台"
}
```

### Adapted Button Component (from Figma Make)

```typescript
// src/components/ui/button.tsx
// Adapted from figma-make/Design System for SaaS/src/app/components/ui/button.tsx
// Changes: import path for cn(), removed data-slot (optional)
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";  // CHANGED: was "./utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// ... rest identical to Figma Make version
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind CSS v3 config file | Tailwind CSS v4 `@theme inline` CSS vars | Jan 2025 | Design tokens in CSS, not JS config |
| shadcn/ui v0 (class merger) | shadcn/ui latest (data-slot pattern) | 2025 | Components use `data-slot` attributes for CSS targeting |
| React Router v6 | React Router v7 | Late 2024 | `Component` prop instead of `element`, `createBrowserRouter` |
| passlib + bcrypt 3.x | passlib + bcrypt 4.x | 2024 | Potential version incompatibility (see Pitfall 5) |
| i18next JSON v3 format | i18next JSON v4 format | 2023 | Flat keys preferred over nested objects |
| OAuth2PasswordRequestForm | Custom LoginRequest schema | Current | Either works; custom schema is cleaner for non-form-based API clients |

**Deprecated/outdated:**
- `@app.on_event("startup")` / `@app.on_event("shutdown")`: Replaced by `lifespan` asynccontextmanager in FastAPI (already used in project)
- `Optional[X]`: Use `X | None` syntax (Python 3.10+, project targets 3.11)
- `tailwind.config.js`: Not used in Tailwind CSS v4; all config via CSS `@theme inline`

## Open Questions

1. **Alembic env.py does not exist yet**
   - What we know: The `backend/alembic/` directory exists with a `versions/` subdirectory but no `env.py`, `alembic.ini`, or script template
   - What's unclear: Whether Alembic was initialized and files were deleted, or it was never initialized
   - Recommendation: Run `alembic init alembic` to generate the configuration, then customize `env.py` to use async engine and import all models. Also create `alembic.ini` in the backend root.

2. **Frontend entry point files missing**
   - What we know: `index.html`, `src/main.tsx`, `src/App.tsx` do not exist. The frontend has no runnable app yet.
   - What's unclear: Whether there was a deliberate decision to defer these or they were simply never created
   - Recommendation: Create these as part of the first task. They are prerequisite to all other frontend work.

3. **Auth store implementation choice**
   - What we know: CLAUDE.md says "lightweight store for auth, no Redux". Options: React Context, zustand, useSyncExternalStore, or simple module state.
   - What's unclear: Whether to add zustand as a dependency or use a zero-dependency approach
   - Recommendation: Use React Context + `useState` for the auth provider since it is the simplest zero-dependency approach. If more stores are needed in later phases, add zustand then.

4. **Seed data for development**
   - What we know: `backend/scripts/seed_data.py` is referenced in CLAUDE.md Quick Start but does not exist. Phase 1 needs at least one admin and one user account for development/testing.
   - What's unclear: What the seed data format should look like
   - Recommendation: Create `seed_data.py` that inserts a default admin (admin/admin123) and user (user/user123) with hashed passwords.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Backend | Yes | 3.11.9 | -- |
| Node.js | Frontend | Yes | 23.11.0 | -- |
| npm | Frontend deps | Yes | 11.8.0 | -- |
| pip | Backend deps | Yes | 24.0 | -- |
| Docker | Optional dev | Not checked | -- | Local dev without Docker |
| PostgreSQL | Production DB | Not needed for dev | -- | SQLite + aiosqlite |

**Missing dependencies with no fallback:** None -- all required tools are available.

**Missing dependencies with fallback:** Docker is not checked but is not required for local development (SQLite is the dev database).

## Sources

### Primary (HIGH confidence)
- Project codebase: `backend/app/config.py`, `backend/app/main.py`, `backend/app/services/agents/` -- existing patterns verified by direct code reading
- Figma Make exports: `figma-make/Design System for SaaS/`, `figma-make/Design Login and Layout Shell/` -- component structure and dependencies verified
- `figma-make/Design System for SaaS/package.json` -- dependency versions verified against npm registry
- `CLAUDE.md` -- all project constraints and coding conventions
- `docs/figma-prompts/00-design-system.md`, `docs/figma-prompts/01-login-and-layout.md` -- design specifications

### Secondary (MEDIUM confidence)
- npm registry: Package versions verified via `npm view` for react-i18next (16.6.2), i18next (25.10.5), i18next-browser-languagedetector (8.2.1), i18next-http-backend (3.0.2), @radix-ui/react-slot (1.2.4), class-variance-authority (0.7.1), react-router-dom (7.13.2), sonner (2.0.7), vaul (1.1.2), tailwind-merge (3.5.0)
- pip installed packages: Verified python-jose (3.3.0), passlib (1.7.4), FastAPI (0.115.0), pydantic-settings (2.5.2)

### Tertiary (LOW confidence)
- bcrypt version incompatibility with passlib: Based on training data knowledge of a known issue in 2024. Should verify current state of passlib compatibility before implementation. If issues arise, pin bcrypt version.
- Web search was unavailable during research. All library API patterns are based on training knowledge and should be verified against official documentation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in project dependencies or verified via npm/pip registries. No speculative recommendations.
- Architecture: HIGH -- Patterns extend existing codebase patterns (adapter, DI, config). Figma Make components inspected directly.
- Pitfalls: MEDIUM -- Some pitfalls from training data (bcrypt compat), others verified from CLAUDE.md gotchas. Web search unavailable for latest community reports.
- Code examples: MEDIUM -- Based on standard library patterns and existing code. Should be validated against latest API docs during implementation.

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days -- stable ecosystem, no fast-moving dependencies)
