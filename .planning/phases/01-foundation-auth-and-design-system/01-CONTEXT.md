# Phase 1: Foundation, Auth, and Design System - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A running application with login, responsive layout shell, shared component library, i18n framework, and pluggable architecture for all AI services — the scaffold everything else builds on. Covers desktop, tablet, mobile, and Teams Tab via responsive web. WeChat Mini Program is deferred to a future phase.

</domain>

<decisions>
## Implementation Decisions

### Component Library Approach
- **D-01:** Adapt Figma Make generated code into the project — extract components from `figma-make/Design System for SaaS/` and `figma-make/Design Login and Layout Shell/`, adapt to match project conventions (path aliases, Tailwind v4 design tokens, i18n). Keep `figma-make/` as reference, not as runtime code.
- **D-02:** Component library is shadcn/ui-based (Radix primitives) — already present in Figma Make exports. Adapt rather than rebuild.
- **D-03:** Components organized as `components/ui/` (generic primitives: Button, Card, Input, Tabs, etc.) + `components/coach/`, `components/admin/` (domain-specific composites). Matches existing directory structure.

### Design Tokens
- **D-04:** Figma Make design tokens take priority over existing `frontend/src/styles/index.css` values — Figma design is the source of truth. Primary Blue #1E40AF, Inter + Noto Sans SC fonts, 8px radius cards.

### Role-based Layouts
- **D-05:** Two layout shells — User gets top-nav layout, Admin gets sidebar layout. Same shared components in both, different arrangements. Adapted from Figma Make Layout Shell code.

### Platform Targets
- **D-06:** Phase 1 delivers responsive web covering desktop, tablet, mobile, and Teams Tab (iframe). WeChat Mini Program requires a separate frontend — deferred to future phase. Backend REST API contracts serve all clients.

### Modular Architecture
- **D-07:** Frontend and backend both fully modular — reusable components, domain-specific hooks, service layer separation. Follow best practices using superpowers skills (TDD, planning, code review).

### Claude's Discretion
- Auth flow: JWT in localStorage (Axios client already configured), python-jose + passlib for backend, simple username/password login, role-based route protection via React Router guards
- App shell: Adapt directly from Figma Make Layout Shell — user top-nav (64px, logo + nav links + language switcher + avatar) and admin sidebar (240px, dark blue #1E293B, collapsible)
- i18n: react-i18next with namespace-based translation files (`common.json`, `auth.json`, etc.), persist language preference in localStorage, zh-CN + en-US from day 1
- Feature toggles: Config-driven via pydantic-settings backend + Vite env vars frontend, mock providers work without Azure credentials
- Responsive breakpoints: Mobile-first, hamburger menu on mobile for both layouts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System & UI
- `docs/figma-prompts/00-design-system.md` — Component inventory, color scheme, typography, design tokens spec
- `docs/figma-prompts/01-login-and-layout.md` — Login page layout, User shell, Admin shell, responsive specs
- `docs/figma-design-brief.md` — Overall design direction, page inventory, role definitions
- `figma-make/Design System for SaaS/` — Generated shadcn/ui component library (source of truth for component adaptation)
- `figma-make/Design Login and Layout Shell/` — Generated login page and layout shells (source of truth for page adaptation)

### Requirements & Architecture
- `docs/requirements.md` — Full business requirements with acceptance criteria
- `docs/best-practices.md` — Engineering patterns reference
- `docs/capgemini-ai-coach-solution.md` — Reference solution overview (Capgemini AI Avatar for AWS, adapted to Azure)

### Existing Code Patterns
- `backend/app/services/agents/base.py` — BaseCoachingAdapter ABC, CoachRequest, CoachEvent (adapter pattern reference)
- `backend/app/services/agents/registry.py` — AdapterRegistry singleton (pluggable provider pattern reference)
- `backend/app/config.py` — pydantic-settings configuration pattern
- `frontend/src/api/client.ts` — Axios client with JWT interceptor (auth integration point)
- `frontend/src/styles/index.css` — Current design tokens (to be updated with Figma Make values)
- `frontend/src/lib/utils.ts` — cn() utility for conditional class composition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseCoachingAdapter` + `AdapterRegistry` + `MockCoachingAdapter`: Pluggable AI adapter pattern already implemented — extend for STT/TTS/Avatar adapters
- `cn()` utility in `frontend/src/lib/utils.ts`: clsx + tailwind-merge for conditional classes — use in all components
- Axios client with JWT interceptor in `frontend/src/api/client.ts`: Auth token management ready
- `TimestampMixin` in `backend/app/models/base.py`: UUID + timestamps for all ORM models
- `AppException` hierarchy in `backend/app/utils/exceptions.py`: Structured error responses
- `PaginatedResponse` in `backend/app/utils/pagination.py`: Generic pagination envelope

### Established Patterns
- Async everywhere (backend): `async def`, `AsyncSession`, `await` — no sync DB calls
- Tailwind CSS v4 with `@theme inline` design tokens — not Tailwind config file
- Pydantic v2 schemas with `ConfigDict(from_attributes=True)`
- FastAPI dependency injection via `Depends()`

### Integration Points
- `backend/app/main.py`: Router registration (currently empty — add auth, health routers)
- `backend/app/dependencies.py`: `get_current_user` TODO — implement for auth
- `frontend/src/pages/`: Empty — add Login, Dashboard placeholder, Admin pages
- `frontend/src/hooks/`: Empty — add TanStack Query hooks per domain (useAuth, etc.)
- `frontend/src/stores/`: Empty — add auth store (JWT + user info)

</code_context>

<specifics>
## Specific Ideas

- User wants Figma Make as the primary design reference — components generated by Figma Make are the source of truth
- "整套UI需要有组件模块，相同的组件需要复用" — complete UI with component modules, same components reused across the system
- "其他的功能也需要模块化" — all functionality should be modular, not just UI
- "遵循最佳实践，使用superpowers里面的skill" — follow best practices using superpowers skills for development workflow
- Frontend-backend separation is non-negotiable — clean REST API contracts

</specifics>

<deferred>
## Deferred Ideas

- WeChat Mini Program (微信小程序) — requires separate frontend, deferred to post-v1. Backend API supports it via shared REST contracts.
- Teams Bot integration — post-MVP, responsive web + Teams Tab iframe covers initial need
- Per-region theming/branding — not needed for v1, responsive layout handles screen size adaptation

</deferred>

---

*Phase: 01-foundation-auth-and-design-system*
*Context gathered: 2026-03-24*
