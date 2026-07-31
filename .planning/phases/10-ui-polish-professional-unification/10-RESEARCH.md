# Phase 10: UI Polish & Professional Unification - Research

**Researched:** 2026-03-28
**Domain:** Frontend UI/UX polish, CSS theming, page transitions, design system consistency
**Confidence:** HIGH

## Summary

Phase 10 is a comprehensive UI overhaul across the entire frontend application. The codebase already has a solid foundation: 30 shadcn/ui base components, 14 shared domain components, 3 layout shells (auth, user, admin), 8 user pages, 8 admin pages, and a CSS custom property-based design token system with light/dark mode support. The core work is: (1) implementing an accent color theme picker system, (2) auditing every page against its Figma prompt spec, (3) adding page transitions and navigation polish, (4) polishing demo seed data with BeiGene product names, and (5) building a splash screen.

The existing architecture is well-suited for this work. CSS custom properties (`--primary`, `--sidebar-primary`, etc.) already drive all component colors, so adding accent color themes requires only swapping a CSS class on `<html>` to override those variables. Dark mode already has a `.dark` class selector with custom property overrides. The shadcn/ui + Tailwind v4 + CSS custom properties stack means theme changes propagate automatically to all components.

**Primary recommendation:** Implement a 3-layer approach: (1) global theme system (accent colors + dark/light mode), (2) layout and navigation polish (breadcrumbs, active states, sidebar grouping, transitions), (3) per-page audit against Figma prompts with demo data polish. No new heavy dependencies needed -- CSS custom properties, the existing Skeleton component, and sonner toasts cover all requirements.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Design source of truth is the 12 Figma prompt docs in `docs/figma-prompts/` -- audit each page against its corresponding prompt spec
- **D-02:** Pixel-close match to Figma prompts -- spacing, colors, layout structure, component choices all aligned strictly
- **D-03:** Both light and dark modes must be polished and consistent across all pages
- **D-04:** Full typography audit across all pages -- headings, body, labels, captions all use consistent sizes and weights per Figma spec (Inter + Noto Sans SC)
- **D-05:** All shared components have ONE canonical global style -- no page-level overrides. Button is Button everywhere. Controlled via shadcn/ui variants (primary/secondary/ghost etc.)
- **D-06:** Spacing matches Figma prompts exactly -- use whatever spacing values the Figma specs specify
- **D-07:** Subtle transitions (150-200ms ease) on hover/focus/page transitions -- professional but not flashy
- **D-08:** Users can select different accent color themes -- multiple brand color options (e.g., Blue, Teal, Purple) in addition to light/dark toggle
- **D-09:** Theme picker is a small color-swatch dropdown in the header bar, next to the language switcher -- always accessible on both user and admin layouts
- **D-10:** Claude picks 4-6 professional accent colors that work well with both light and dark modes. BeiGene Blue (#1E40AF) is the default.
- **D-11:** Context-dependent breadcrumbs: dashboard and top-level pages get title only; drill-down pages (scoring feedback, session detail) get breadcrumbs back to parent
- **D-12:** Active nav item gets bold text + left accent bar (admin sidebar) or bottom accent line (user top-nav) -- clear visual indicator
- **D-13:** Admin and user navigation share unified visual language -- same colors, active states, font sizes. Only layout differs (sidebar vs top-nav).
- **D-14:** Quick fade transition (150ms) when navigating between pages
- **D-15:** Admin sidebar uses grouped sections: Configuration (Azure Config, Settings), Content (HCP Profiles, Scenarios, Materials), Analytics (Dashboard, Reports, Users)
- **D-16:** Theme picker added to user top-nav header alongside language switcher. Also accessible from admin header.
- **D-17:** All pages get equal polish -- demo could visit any page
- **D-18:** Polished demo seed data with real BeiGene products (Zanubrutinib, Tislelizumab) and realistic HCP profiles for oncology/hematology
- **D-19:** Loading and empty states match whatever patterns are in the Figma prompt docs for each page
- **D-20:** Branded splash screen with BeiGene/AI Avatar logo on app startup before content loads
- **D-21:** Polished Sonner toasts consistently across all pages with proper success/error/warning variants, themed with accent colors
- **D-22:** Desktop, tablet, and mobile all get equal attention -- demo could happen on any device
- **D-23:** Mobile navigation follows behavior described in `docs/figma-prompts/01-login-and-layout.md`
- **D-24:** Training/coaching session multi-panel layout stacks vertically on mobile: HCP info on top, chat in middle, hints collapsible at bottom. Full-width.
- **D-25:** Standard Tailwind sizing for touch targets -- adequate by default

### Claude's Discretion
- Icon standardization: ensure consistent lucide-react sizing (16/20/24px) and stroke width, add custom SVGs only if needed for medical domain
- Accent color palette selection: pick 4-6 professional colors that work with light/dark modes
- Exact skeleton shimmer and loading state implementations per page
- Error boundary page styling
- Splash screen animation timing and design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Shared component library based on Figma Design System -- buttons, cards, inputs, charts, navigation as reusable components | Already exists (30 shadcn/ui + 14 shared). Polish needs: standardize variants, ensure consistent styling per D-05. Theme system makes all components accent-color-aware. |
| UI-02 | Login page and app layout shell from Figma -- sidebar navigation, header, responsive shell | Layouts exist but need: grouped admin sidebar (D-15), active nav indicator polish (D-12), breadcrumb improvements (D-11), theme picker in headers (D-09/D-16), page transition wrapper (D-14). |
| UI-03 | F2F HCP Training page from Figma -- chat area, HCP display, controls, coaching hints panel | Page exists. Audit against `04-f2f-coaching.md` for spacing, mobile stacking (D-24), panel proportions. |
| UI-04 | MR Dashboard from Figma -- score overview, recent sessions, skill radar chart | Page exists. Audit against `02-user-dashboard.md` for grid layout, stat card styling, mini chart placement. |
| UI-05 | Scenario Selection page from Figma -- scenario cards, filters, difficulty indicators | Page exists. Audit against `03-scenario-selection.md` for card grid, difficulty badges, filter bar layout. |
| UI-06 | Additional pages (admin, config, reports, session history) follow same design principles | 8 admin pages + 3 more user pages. Audit against prompts 06-11. Per D-17 all need equal polish. |
| UI-07 | All UI text externalized via react-i18next -- zh-CN and en-US supported from day 1 | Already implemented with 11 i18n namespaces. Polish: add any missing keys for new UI elements (theme picker, breadcrumbs, splash screen). |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4.0.0 | Utility CSS + `@theme inline` design tokens | Already in use, CSS custom property system is foundation for accent themes |
| sonner | ^2.0.7 | Toast notifications | Already installed, D-21 requires theming its variants with accent colors |
| class-variance-authority | ^0.7.1 | Component variant definitions | Already in use for Button and will be used to manage component variants |
| clsx + tailwind-merge | ^2.1.0 / ^2.5.0 | Conditional class composition via `cn()` | Already in use, central to component styling |
| lucide-react | ^0.460.0 | Icon library | Already in use, D-discretion requires size standardization |
| react-i18next | ^16.6.2 | i18n | Already in use, new keys needed for theme UI |

### NOT Needed (Explicit)
| Library | Why Not Needed |
|---------|----------------|
| framer-motion | D-14 specifies 150ms fade -- CSS `transition` + `@keyframes` is sufficient. No need for 40KB+ animation library for simple fades. |
| next-themes | Already removed in Phase 01. Theme system is pure CSS custom properties + localStorage. |
| @radix-ui/react-popover | Theme picker uses existing DropdownMenu component. |
| tailwindcss-animate | Tailwind v4 has built-in animation support via `@keyframes`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS fade transitions | framer-motion | framer-motion adds ~40KB for animations we can do with 10 lines of CSS. Use CSS. |
| Custom theme store | next-themes | next-themes is Next.js-oriented. We have a Vite + React app. Pure localStorage + CSS class toggle is simpler and already proven (auth store pattern). |

## Architecture Patterns

### Accent Color Theme System

The core pattern uses CSS custom property scoping. Each accent theme is a CSS class that overrides `--primary` and related variables.

**How it works:**
1. Define 4-6 theme classes in `index.css` (e.g., `.theme-blue`, `.theme-teal`, `.theme-purple`, `.theme-rose`, `.theme-amber`)
2. Each class overrides `--primary`, `--primary-foreground`, `--sidebar-primary`, `--chart-1`, and `--ring`
3. Both `:root` and `.dark` variants for each theme
4. A `useTheme` store (same `useSyncExternalStore` pattern as auth store) reads/writes `localStorage` and toggles the class on `document.documentElement`
5. Theme picker component renders color swatches in a DropdownMenu

**Recommended accent color palette (D-10):**

| Name | Light Primary | Dark Primary | Character |
|------|--------------|-------------|-----------|
| BeiGene Blue (default) | #1E40AF | #3B82F6 | Corporate trust, medical |
| Teal | #0D9488 | #2DD4BF | Modern healthcare |
| Purple | #7C3AED | #A78BFA | Innovation, premium |
| Rose | #BE185D | #F472B6 | Warm, approachable |
| Amber | #B45309 | #FBBF24 | Energy, optimism |

Each theme needs full variable set:
```css
.theme-teal {
  --primary: #0D9488;
  --primary-foreground: #FFFFFF;
  --sidebar-primary: #0D9488;
  --sidebar-primary-foreground: #FFFFFF;
  --chart-1: #0D9488;
  --ring: #0D9488;
}
.dark.theme-teal, .dark .theme-teal {
  --primary: #2DD4BF;
  --primary-foreground: #042F2E;
  --sidebar-primary: #2DD4BF;
  --chart-1: #2DD4BF;
  --ring: #2DD4BF;
}
```

### Theme Store Pattern

Follow the existing `useSyncExternalStore` pattern from `auth-store.ts`:

```typescript
// stores/theme-store.ts
type ThemeMode = "light" | "dark" | "system";
type AccentColor = "blue" | "teal" | "purple" | "rose" | "amber";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
}
```

Store reads from `localStorage`, writes to `localStorage`, and applies classes to `document.documentElement`:
- `.dark` class for dark mode
- `.theme-{accent}` class for accent color

### Page Transition Pattern (D-14)

Use CSS animation on route `<Outlet>` wrappers. No library needed.

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.page-enter {
  animation: fadeIn 150ms ease;
}
```

Wrap `<Outlet />` in layouts with a component that applies `page-enter` class when the route key changes. Use `useLocation().pathname` as the animation key.

### Breadcrumb Pattern (D-11)

Current admin layout has a path-segment breadcrumb. Needs improvement:
- Dashboard and top-level pages: show page title only (no breadcrumb trail)
- Drill-down pages (scoring/:sessionId, session detail): show `Parent > Current` breadcrumb
- Implementation: create a `Breadcrumb` shared component that reads route metadata

### Admin Sidebar Grouped Sections (D-15)

Current sidebar is a flat list of 9 items. Needs grouping:

```
Configuration
  - Azure Services
  - Settings
Content
  - HCP Profiles
  - Scenarios
  - Scoring Rubrics
  - Materials
Analytics
  - Dashboard
  - Reports
  - Users
```

Use a section header (small uppercase label, muted color) between groups.

### Recommended Project Structure for New Files

```
frontend/src/
  stores/
    theme-store.ts           # NEW: accent color + dark/light mode store
  components/
    shared/
      theme-picker.tsx       # NEW: color swatch dropdown
      breadcrumb.tsx         # NEW: context-dependent breadcrumb
      splash-screen.tsx      # NEW: branded loading screen
      page-transition.tsx    # NEW: fade wrapper for route outlets
    layouts/
      admin-layout.tsx       # MODIFIED: grouped sidebar, theme picker, breadcrumbs
      user-layout.tsx        # MODIFIED: active indicator, theme picker, breadcrumbs
      auth-layout.tsx        # MODIFIED: minimal (splash screen integration)
  styles/
    index.css                # MODIFIED: accent theme classes, page transition keyframes
  pages/
    [all existing pages]     # MODIFIED: audit against Figma prompts, fix spacing/layout
  App.tsx                    # MODIFIED: splash screen wrapper, sonner theme integration
```

### Anti-Patterns to Avoid
- **Per-page color overrides:** Do NOT use inline styles or page-specific CSS for primary colors. All color changes flow through CSS custom properties via the theme system.
- **Hardcoded hex colors in components:** Every color reference should use Tailwind's design token classes (`bg-primary`, `text-foreground`, etc.), never raw hex values. The existing sidebar has `style={{ backgroundColor: "#1E293B" }}` which should be replaced with `bg-sidebar` class.
- **Mixing animation libraries:** Do NOT add framer-motion for simple fades. CSS transitions are sufficient per D-07.
- **Breaking existing component APIs:** When polishing shared components, do NOT change their prop interfaces in ways that break existing page usage. Add new optional props if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast system | sonner (already installed) | D-21 requires themed toasts; sonner already has success/error/warning variants |
| Dark mode toggle | Manual class manipulation | `useSyncExternalStore` + `localStorage` + class on `<html>` | Proven pattern from auth-store, avoids flash-of-wrong-theme |
| Color picker UI | Custom color palette widget | DropdownMenu + colored circle buttons | Simple, accessible, already have DropdownMenu component |
| Loading skeletons | Per-page custom loaders | Existing `LoadingState` + `Skeleton` components | Already built with card/table/spinner variants |
| Empty states | Per-page custom empty views | Existing `EmptyState` component | Already built with title/body/action pattern |
| Icon library | Custom SVGs for common icons | lucide-react (already installed with 460+ icons) | Only add custom SVG for BeiGene logo / medical-specific icons |

**Key insight:** This phase is about consistency and polish, not building new features. The component primitives exist. The work is making them consistent across all pages, adding the theme system, and auditing against Figma specs.

## Common Pitfalls

### Pitfall 1: Flash of Unstyled Theme (FOUT)
**What goes wrong:** On page load, the app briefly shows the default theme before JavaScript applies the saved theme from localStorage.
**Why it happens:** React hydration/render happens after initial HTML paint.
**How to avoid:** Apply theme classes in a synchronous `<script>` tag in `index.html` (before React mounts), reading from localStorage. This is the same technique used to prevent dark mode flash.
**Warning signs:** Brief blue flash when user has selected teal theme.

### Pitfall 2: Hardcoded Colors in Existing Components
**What goes wrong:** Some existing components use hardcoded hex colors (e.g., `style={{ backgroundColor: "#1E293B" }}` in admin-layout.tsx) that don't respond to theme changes.
**Why it happens:** Early implementation used inline styles for speed.
**How to avoid:** Audit all components for inline `style` color properties and `className` strings containing raw color values. Replace with CSS custom property-backed Tailwind classes.
**Warning signs:** Elements that don't change color when switching themes.

### Pitfall 3: Dark Mode CSS Variable Gaps
**What goes wrong:** Some accent theme + dark mode combinations look bad because dark variants weren't defined for all CSS variables.
**Why it happens:** Each accent color needs both light AND dark variants for all overridden variables.
**How to avoid:** Define every accent theme in both `:root` and `.dark` contexts. Test all 5 accent colors in both modes = 10 visual checks minimum.
**Warning signs:** Low contrast text, invisible borders, or clashing colors in specific theme+mode combos.

### Pitfall 4: Sidebar Active State with Grouped Navigation
**What goes wrong:** Refactoring the flat sidebar items array into grouped sections breaks the active state detection.
**Why it happens:** The `location.pathname === item.path` comparison works for flat lists but can be disrupted by refactoring.
**How to avoid:** Keep the same `SidebarNavItem` component pattern, just wrap groups with section headers. Active state logic stays on individual items.
**Warning signs:** No item appears highlighted in the admin sidebar.

### Pitfall 5: TypeScript Strict Mode Violations
**What goes wrong:** New components or modified imports cause TypeScript compilation failures.
**Why it happens:** Project uses `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`.
**How to avoid:** Run `npx tsc -b` after every component change. Ensure all new props have explicit types, no unused imports.
**Warning signs:** `npm run build` fails on type check step.

### Pitfall 6: i18n Keys Not Added for Both Locales
**What goes wrong:** New UI elements (theme picker labels, breadcrumb labels) show raw keys instead of translated text.
**Why it happens:** Adding keys to en-US but forgetting zh-CN (or vice versa).
**How to avoid:** Always add new keys to both `public/locales/en-US/` and `public/locales/zh-CN/` locale files simultaneously.
**Warning signs:** `t("someKey")` rendering as literal "someKey" text.

### Pitfall 7: Responsive Regression During Desktop Polish
**What goes wrong:** Fixing desktop layout to match Figma specs breaks mobile/tablet views.
**Why it happens:** Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) might get overridden or removed during layout changes.
**How to avoid:** Always check mobile (375px), tablet (768px), and desktop (1440px) viewports after every page change per D-22.
**Warning signs:** Overlapping elements, horizontal scroll, or truncated content on narrow viewports.

## Code Examples

### Accent Theme CSS Variables

```css
/* In index.css, after existing :root and .dark blocks */

/* Theme: Teal */
.theme-teal { --primary: #0D9488; --sidebar-primary: #0D9488; --chart-1: #0D9488; --ring: #0D9488; }
.dark.theme-teal { --primary: #2DD4BF; --sidebar-primary: #2DD4BF; --chart-1: #2DD4BF; --ring: #2DD4BF; }

/* Theme: Purple */
.theme-purple { --primary: #7C3AED; --sidebar-primary: #7C3AED; --chart-1: #7C3AED; --ring: #7C3AED; }
.dark.theme-purple { --primary: #A78BFA; --sidebar-primary: #A78BFA; --chart-1: #A78BFA; --ring: #A78BFA; }
```

### Theme Store (useSyncExternalStore Pattern)

```typescript
// stores/theme-store.ts
const THEME_STORAGE_KEY = "ai-coach-theme";
const ACCENT_STORAGE_KEY = "ai-coach-accent";

type ThemeMode = "light" | "dark";
type AccentColor = "blue" | "teal" | "purple" | "rose" | "amber";

function applyTheme(mode: ThemeMode, accent: AccentColor) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  // Remove all theme-* classes, then add the current one
  root.className = root.className.replace(/theme-\w+/g, "").trim();
  if (accent !== "blue") { // blue is default, no class needed
    root.classList.add(`theme-${accent}`);
  }
}
```

### Theme Picker Component

```typescript
// components/shared/theme-picker.tsx
const ACCENT_COLORS = [
  { name: "blue", color: "#1E40AF", label: "BeiGene Blue" },
  { name: "teal", color: "#0D9488", label: "Teal" },
  { name: "purple", color: "#7C3AED", label: "Purple" },
  { name: "rose", color: "#BE185D", label: "Rose" },
  { name: "amber", color: "#B45309", label: "Amber" },
] as const;

// Renders as: DropdownMenu with circular color swatches
// Also includes a light/dark mode toggle (Sun/Moon icon)
```

### Page Transition CSS

```css
/* In index.css */
@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-transition {
  animation: page-fade-in 150ms ease;
}
```

### Splash Screen Pattern

```typescript
// components/shared/splash-screen.tsx
// Shows BeiGene/AI Avatar logo centered with fade-in animation
// Auto-dismisses after 1.5s or when app finishes loading (whichever is later)
// Uses CSS animation, not a library
```

### Sonner Theme Integration

```typescript
// In App.tsx, pass dynamic theme to Toaster
<Toaster
  position="top-right"
  theme={themeMode === "dark" ? "dark" : "light"}
  toastOptions={{
    style: {
      "--normal-bg": "var(--popover)",
      "--normal-text": "var(--popover-foreground)",
      "--normal-border": "var(--border)",
      "--success-bg": "var(--primary)",
    } as React.CSSProperties,
  }}
/>
```

### index.html Theme Flash Prevention

```html
<!-- In frontend/index.html, before the React root -->
<script>
  (function() {
    var mode = localStorage.getItem('ai-coach-theme') || 'light';
    var accent = localStorage.getItem('ai-coach-accent') || 'blue';
    if (mode === 'dark') document.documentElement.classList.add('dark');
    if (accent !== 'blue') document.documentElement.classList.add('theme-' + accent);
  })();
</script>
```

### BeiGene Demo Seed Data Improvements

Current seed data already references Zanubrutinib and Tislelizumab. Needs enhancement:
- HCP profiles: Add Chinese names (e.g., `Dr. Zhang Wei (张维)`) alongside English
- Products: Use both English and Chinese names (`Zanubrutinib / 泽布替尼`)
- Hospitals: Use real BeiGene-relevant institutions
- Add 2-3 more HCP profiles to fill scenario grid (currently only 3 HCPs)
- Add conference-type scenarios (currently only F2F)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-themes for dark mode | CSS custom properties + localStorage | Tailwind v4 era | No dependency on Next.js; works with any React setup |
| Tailwind config-based themes | `@theme inline` CSS custom properties | Tailwind v4 (late 2024) | Theme variables defined in CSS, not tailwind.config.js |
| framer-motion for all animations | CSS `@keyframes` + `transition` | Performance focus trend | Lighter bundles, native browser performance for simple animations |
| Multiple CSS files for themes | CSS custom property scoping via classes | CSS spec maturity | Single stylesheet, class-toggled themes, zero JS overhead per repaint |

**Deprecated/outdated:**
- `@apply` in Tailwind v4 still works but `@theme inline` with CSS custom properties is preferred for design tokens
- `tailwind.config.js` theme extension is replaced by `@theme inline` block in CSS

## Open Questions

1. **Splash screen asset: BeiGene logo**
   - What we know: D-20 requires branded splash screen with BeiGene/AI Avatar logo
   - What's unclear: No BeiGene logo SVG/PNG exists in the repo. The current app uses a lightbulb SVG icon as a placeholder.
   - Recommendation: Create a professional SVG logo combining a lightbulb icon with "AI Avatar" text + "BeiGene" subtitle. Keep the existing icon style but make it larger and more refined for the splash screen.

2. **Admin sidebar collapse behavior with grouped sections**
   - What we know: Sidebar currently has a collapse toggle that hides text, showing icons only
   - What's unclear: When collapsed, should group headers disappear? Should there be separator lines between groups?
   - Recommendation: When collapsed, group headers disappear, and thin separator lines (1px, muted color) replace them between groups. This maintains visual grouping without text.

3. **Sonner toast position across layouts**
   - What we know: Currently `position="top-right"` globally in App.tsx
   - What's unclear: Whether full-screen coaching pages (training-session, conference-session, voice-session) need different toast positioning
   - Recommendation: Keep `top-right` globally. Full-screen pages have their own alert patterns already.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). This phase is purely frontend code/config changes. All required tools (Node.js 23.11.0, npm, TypeScript, Tailwind CSS v4) are already installed and verified working from prior phases.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct inspection of all 12 Figma prompt docs, 3 layout components, 30 UI components, 14 shared components, existing CSS design tokens, router config, App.tsx, seed data scripts
- `frontend/src/styles/index.css` -- verified existing CSS custom property architecture with light/dark mode support
- `frontend/package.json` -- verified all current dependency versions

### Secondary (MEDIUM confidence)
- Tailwind CSS v4 `@theme inline` pattern -- verified from existing codebase implementation
- `useSyncExternalStore` pattern -- verified from existing `auth-store.ts` implementation
- CSS `@keyframes` animation -- standard web platform feature, no version dependency

### Tertiary (LOW confidence)
- None -- all recommendations based on verified codebase patterns and standard web platform features

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified working in the codebase
- Architecture: HIGH - Theme system pattern (CSS custom properties + class toggle) is standard and verified working in production shadcn/ui projects; existing codebase already uses this exact pattern for dark mode
- Pitfalls: HIGH - Based on direct codebase inspection (found hardcoded colors, identified dark mode variable gaps, verified TypeScript strict mode settings)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- no external dependency changes expected)

## Project Constraints (from CLAUDE.md)

**Must follow:**
- TypeScript `strict: true` with `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`
- Path alias `@/` for all imports from `src/`
- `cn()` utility for conditional class composition
- TanStack Query hooks per domain, no inline `useQuery` in components
- No Redux -- TanStack Query for server state, lightweight store for UI state
- `npm ci` not `npm install`
- Pre-commit: `npx tsc -b` and `npm run build` must pass
- Conventional commits: `feat:`, `fix:`, `style:` prefixes
- shadcn/ui component pattern: Radix primitives + Tailwind styling + forwardRef + cn() + displayName
- i18n: react-i18next with namespace-based translation files, all UI text externalized
- Design tokens via CSS custom properties in `@theme inline` block
- Font: Inter (EN) + Noto Sans SC (CN)
- Ruff lint + format for any backend changes (seed data)
- No new dependencies unless absolutely necessary (this phase needs zero new npm packages)
