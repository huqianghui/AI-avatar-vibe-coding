# Phase 10: UI Polish & Professional Unification - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive UI overhaul for professional appearance and consistency across all pages — unified design language, clear page hierarchy, intuitive navigation, and polished visual details for BeiGene customer demo presentations. Follows a 3-layer UI architecture: (1) project-level global consistency, (2) tech stack constraint consistency, (3) per-page local UI matching functionality.

</domain>

<decisions>
## Implementation Decisions

### Visual Consistency
- **D-01:** Design source of truth is the 12 Figma prompt docs in `docs/figma-prompts/` — audit each page against its corresponding prompt spec
- **D-02:** Pixel-close match to Figma prompts — spacing, colors, layout structure, component choices all aligned strictly
- **D-03:** Both light and dark modes must be polished and consistent across all pages
- **D-04:** Full typography audit across all pages — headings, body, labels, captions all use consistent sizes and weights per Figma spec (Inter + Noto Sans SC)
- **D-05:** All shared components have ONE canonical global style — no page-level overrides. Button is Button everywhere. Controlled via shadcn/ui variants (primary/secondary/ghost etc.)
- **D-06:** Spacing matches Figma prompts exactly — use whatever spacing values the Figma specs specify
- **D-07:** Subtle transitions (150-200ms ease) on hover/focus/page transitions — professional but not flashy

### Color Theme System
- **D-08:** Users can select different accent color themes — multiple brand color options (e.g., Blue, Teal, Purple) in addition to light/dark toggle
- **D-09:** Theme picker is a small color-swatch dropdown in the header bar, next to the language switcher — always accessible on both user and admin layouts
- **D-10:** Claude picks 4-6 professional accent colors that work well with both light and dark modes. BeiGene Blue (#1E40AF) is the default.

### Page Hierarchy & Navigation
- **D-11:** Context-dependent breadcrumbs: dashboard and top-level pages get title only; drill-down pages (scoring feedback, session detail) get breadcrumbs back to parent
- **D-12:** Active nav item gets bold text + left accent bar (admin sidebar) or bottom accent line (user top-nav) — clear visual indicator
- **D-13:** Admin and user navigation share unified visual language — same colors, active states, font sizes. Only layout differs (sidebar vs top-nav).
- **D-14:** Quick fade transition (150ms) when navigating between pages
- **D-15:** Admin sidebar uses grouped sections: Configuration (Azure Config, Settings), Content (HCP Profiles, Scenarios, Materials), Analytics (Dashboard, Reports, Users)
- **D-16:** Theme picker added to user top-nav header alongside language switcher. Also accessible from admin header.

### Demo Presentation
- **D-17:** All pages get equal polish — demo could visit any page
- **D-18:** Polished demo seed data with real BeiGene products (Zanubrutinib/泽布替尼, Tislelizumab/替雷利珠单抗) and realistic HCP profiles for oncology/hematology
- **D-19:** Loading and empty states match whatever patterns are in the Figma prompt docs for each page
- **D-20:** Branded splash screen with BeiGene/AI Avatar logo on app startup before content loads
- **D-21:** Polished Sonner toasts consistently across all pages with proper success/error/warning variants, themed with accent colors

### Responsive Polish
- **D-22:** Desktop, tablet, and mobile all get equal attention — demo could happen on any device
- **D-23:** Mobile navigation follows behavior described in `docs/figma-prompts/01-login-and-layout.md`
- **D-24:** Training/coaching session multi-panel layout stacks vertically on mobile: HCP info on top, chat in middle, hints collapsible at bottom. Full-width.
- **D-25:** Standard Tailwind sizing for touch targets — adequate by default

### Claude's Discretion
- Icon standardization: ensure consistent lucide-react sizing (16/20/24px) and stroke width, add custom SVGs only if needed for medical domain
- Accent color palette selection: pick 4-6 professional colors that work with light/dark modes
- Exact skeleton shimmer and loading state implementations per page
- Error boundary page styling
- Splash screen animation timing and design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System & UI Specs
- `docs/figma-prompts/00-design-system.md` — Component inventory, color scheme, typography, design tokens spec
- `docs/figma-prompts/01-login-and-layout.md` — Login page layout, User shell, Admin shell, responsive specs, mobile nav behavior
- `docs/figma-prompts/02-user-dashboard.md` — User dashboard layout, stat cards, session list
- `docs/figma-prompts/03-scenario-selection.md` — Scenario cards, filters, difficulty indicators
- `docs/figma-prompts/04-f2f-coaching.md` — F2F training session page, chat area, HCP display, panels
- `docs/figma-prompts/05-conference-mode.md` — Conference presentation page layout
- `docs/figma-prompts/06-scoring-feedback.md` — Scoring report, dimension breakdown
- `docs/figma-prompts/07-session-history.md` — Session history list, filters
- `docs/figma-prompts/08-admin-dashboard-users.md` — Admin dashboard, user management
- `docs/figma-prompts/09-admin-hcp-scenarios.md` — HCP profile and scenario management
- `docs/figma-prompts/10-admin-azure-settings.md` — Azure config card layout
- `docs/figma-prompts/11-admin-materials-reports.md` — Training materials, admin reports

### Design Tokens
- `frontend/src/styles/index.css` — Current design tokens, CSS custom properties, light/dark mode variables

### Existing Components
- `frontend/src/components/ui/` — 30 shadcn/ui base components
- `frontend/src/components/shared/` — 14 domain-specific shared components
- `frontend/src/components/coach/` — Coaching session components
- `frontend/src/components/layouts/` — Admin layout, user layout, auth layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 30 shadcn/ui components in `components/ui/` (Button, Card, Dialog, Sheet, Skeleton, Sonner, etc.)
- 14 shared domain components in `components/shared/` (StatCard, SessionItem, ActionCard, HCPProfileCard, ChatBubble, etc.)
- Coaching components in `components/coach/` (CenterPanel, ChatArea, HintsPanel, ScenarioCard, etc.)
- `cn()` utility for conditional class composition (clsx + tailwind-merge)
- Design tokens already defined in `index.css` with light/dark mode support
- LanguageSwitcher component already exists in shared/

### Established Patterns
- Tailwind CSS v4 with `@theme inline` design tokens
- shadcn/ui component pattern (Radix primitives + Tailwind styling)
- CSS custom properties for theming (--primary, --sidebar, --chart-N, etc.)
- i18n via react-i18next with namespace-based translation files
- TanStack Query v5 for server state

### Integration Points
- `frontend/src/styles/index.css` — where theme CSS variables live
- `frontend/src/components/layouts/` — layout shells that need nav updates
- `frontend/src/pages/` — 8 user pages + 8 admin pages to audit
- `backend/scripts/seed_data.py` — seed data for demo polish
- Router configuration for page transition animations

</code_context>

<specifics>
## Specific Ideas

- 3-layer UI architecture: (1) project-level global consistency, (2) tech stack constraint consistency, (3) per-page local UI matching its specific functionality
- Users should be able to select different color accent themes from the header bar
- BeiGene-specific demo data with real drug names (Zanubrutinib/泽布替尼, Tislelizumab/替雷利珠单抗)
- Branded splash screen on app startup

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ui-polish-professional-unification*
*Context gathered: 2026-03-28*
