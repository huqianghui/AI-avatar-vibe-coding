---
phase: 10-ui-polish-professional-unification
plan: 01
subsystem: ui
tags: [css-themes, tailwind-v4, localStorage, useSyncExternalStore, splash-screen, sonner, i18n]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: CSS custom property design tokens, auth-store useSyncExternalStore pattern, sonner toast component
provides:
  - 5 accent color theme CSS classes (blue default, teal, purple, rose, amber) with light+dark variants
  - Theme store with mode/accent persistence via localStorage
  - Flash prevention synchronous script in index.html
  - SplashScreen branded component with auto-dismiss animation
  - Page transition CSS keyframe animation
  - Sonner toast dynamic theme wiring
  - i18n keys for theme picker and empty/error states
affects: [10-02, 10-03, 10-04, 10-05, 10-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [CSS class-based theme switching, useSyncExternalStore for UI state, synchronous localStorage theme flash prevention]

key-files:
  created:
    - frontend/src/stores/theme-store.ts
    - frontend/src/components/shared/splash-screen.tsx
  modified:
    - frontend/src/styles/index.css
    - frontend/index.html
    - frontend/src/App.tsx
    - frontend/src/components/shared/index.ts
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/zh-CN/common.json

key-decisions:
  - "Blue is default accent (no CSS class needed); 4 other themes use .theme-{name} class on html element"
  - "SplashScreen renders outside QueryClientProvider since it has no data dependencies"
  - "AppContent wrapper component created to use useThemeStore hook inside component tree"

patterns-established:
  - "Theme CSS override pattern: .theme-{name} class overrides --primary, --primary-foreground, --sidebar-primary, --sidebar-primary-foreground, --chart-1, --ring"
  - "Theme store follows same useSyncExternalStore + localStorage pattern as auth-store"
  - "Flash prevention via synchronous script in index.html before React mounts"

requirements-completed: [UI-01, UI-07]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 10 Plan 01: Theme System Foundation Summary

**5 accent color themes with CSS variable overrides, theme store with localStorage persistence, flash prevention script, branded splash screen, and Sonner toast dynamic theming**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T15:41:19Z
- **Completed:** 2026-03-28T15:44:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 5 accent color themes (blue, teal, purple, rose, amber) with full light+dark CSS variable overrides for --primary, --sidebar-primary, --chart-1, --ring
- Theme store with useSyncExternalStore pattern providing mode/accent state and setters with localStorage persistence
- Synchronous flash prevention script in index.html prevents flash of wrong theme on page load
- Branded splash screen with AI Avatar lightbulb icon, app name, and BeiGene subtitle with fade-in/fade-out animation
- Sonner toasts dynamically themed with light/dark mode from theme store
- Page transition fadeIn keyframe animation defined and ready for use
- i18n keys added for theme picker labels, empty states, and error states in both en-US and zh-CN

## Task Commits

Each task was committed atomically:

1. **Task 1: Accent color theme CSS + theme store + index.html flash prevention** - `e35ad7b` (feat)
2. **Task 2: Splash screen component + App.tsx integration + Sonner theme wiring** - `9c8de26` (feat)

## Files Created/Modified
- `frontend/src/styles/index.css` - Added 4 accent theme CSS class blocks with light+dark variants, page-fade-in keyframes, splash screen keyframes
- `frontend/src/stores/theme-store.ts` - Theme state management with useSyncExternalStore, localStorage persistence, applyTheme function
- `frontend/index.html` - Synchronous script reading ai-coach-theme and ai-coach-accent from localStorage before React mounts
- `frontend/public/locales/en-US/common.json` - Added theme picker, splash screen, empty state, and error state i18n keys
- `frontend/public/locales/zh-CN/common.json` - Added matching zh-CN translations for all new i18n keys
- `frontend/src/components/shared/splash-screen.tsx` - Branded splash screen with auto-dismiss (1.5s fade-out start, 1.8s removal)
- `frontend/src/App.tsx` - Integrated SplashScreen, wired Sonner with dynamic theme from useThemeStore
- `frontend/src/components/shared/index.ts` - Added SplashScreen to barrel export

## Decisions Made
- Blue is the default accent color (no CSS class needed); other themes use `.theme-{name}` on document.documentElement
- SplashScreen renders outside QueryClientProvider since it has no data dependencies and should show immediately
- Created AppContent wrapper component to use useThemeStore hook inside the component tree (hooks must be inside components)
- Splash screen uses the same lightbulb SVG icon from user-layout.tsx header, enlarged to 40px

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree lacked node_modules; ran `npm ci` to install dependencies before verification. Pre-existing issue, not caused by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Theme system foundation is complete and ready for Plan 02 (theme picker component, navigation polish)
- All CSS variables, theme store exports, and i18n keys are in place for downstream plans
- SplashScreen and page transition animation ready for use in layout components

## Self-Check: PASSED

All created files verified present. Both task commits verified in git log.

---
*Phase: 10-ui-polish-professional-unification*
*Completed: 2026-03-28*
