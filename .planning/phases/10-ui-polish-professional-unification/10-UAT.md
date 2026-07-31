---
status: partial
phase: 10-ui-polish-professional-unification
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md, 10-06-SUMMARY.md
started: 2026-03-31T10:00:00Z
updated: 2026-03-31T11:30:00Z
---

## Current Test

[testing paused — 13 UI items skipped, switching to system-level functional testing]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running servers. Start backend and frontend from scratch. Backend boots without errors, health check returns OK. Frontend loads showing splash screen then login page.
result: issue
reported: "GET /api/v1/azure-config/services returns 500 — sqlite3.OperationalError: no such column: service_configs.is_master. Alembic migration f09a (unified AI Foundry config) was not applied to local SQLite DB."
severity: blocker
fix: "Stamped alembic at a1b2c3d4e5f6, then ran `alembic upgrade head` to apply f09a migration. is_master column now present."

### 2. Accent Color Theme Switching
expected: After login, open the ThemePicker in the header. 5 color swatches (blue, teal, purple, rose, amber) are visible. Clicking each swatch changes the primary accent color across the entire UI immediately.
result: pass

### 3. Light/Dark Mode Toggle
expected: In the ThemePicker, a Sun/Moon toggle switches between light and dark mode. Background, text, cards, and surfaces all adapt. No hardcoded colors remain visible.
result: pass

### 4. Theme Persistence Across Reload
expected: Select a non-default theme (e.g., purple + dark mode). Refresh the page. The theme is retained with no flash of the default blue/light theme.
result: pass

### 5. Branded Splash Screen
expected: On fresh page load, a splash screen with the AI Avatar lightbulb icon, app name, and "BeiGene" subtitle appears, then fades out smoothly (~1.5s).
result: skipped
reason: User switching to system-level functional testing

### 6. Admin Sidebar Grouped Sections
expected: Login as admin. The sidebar shows 3 grouped sections (Configuration, Content, Analytics) with section headers. The active page has a left accent bar indicator.
result: skipped
reason: User switching to system-level functional testing

### 7. Breadcrumb Navigation
expected: Navigate to a drill-down admin page (e.g., edit an HCP profile). A breadcrumb trail shows parent > current. Top-level pages show title only.
result: skipped
reason: User switching to system-level functional testing

### 8. Page Transition Animations
expected: Navigate between pages. A subtle fade-in animation plays on each route change.
result: skipped
reason: User switching to system-level functional testing

### 9. Professional 404 Page
expected: Navigate to a non-existent route (e.g., /nonexistent). A styled 404 page shows with the lightbulb icon, "Page Not Found" text, and a "Return to Dashboard" link.
result: skipped
reason: User switching to system-level functional testing

### 10. Azure Config Page Layout
expected: Admin > Azure Config shows a master config card with highlighted border, and service cards in a 2-column grid with rounded status dot indicators. Skeleton loading appears while data loads.
result: skipped
reason: User switching to system-level functional testing

### 11. Azure Config Save & Connection Test
expected: On the Azure Config page, enter or modify configuration values and click Save. The configuration saves successfully without error. A success toast appears. Connection test passes.
result: issue
reported: "Connection test fails with gpt-5.4-mini model: Error code 400 — Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."
severity: blocker
fix: "Replaced max_tokens with max_completion_tokens in connection_tester.py and azure_openai.py adapter"

### 12. User Dashboard Responsive Stats
expected: User dashboard shows 4 stat cards in a responsive grid. On desktop: 4 columns. Cards use bg-card styling and adapt to dark mode.
result: skipped
reason: User switching to system-level functional testing

### 13. Session History Mobile View
expected: On the session history page, resize to mobile width. The table converts to a card-based list layout.
result: skipped
reason: User switching to system-level functional testing

### 14. Training Session Mobile Layout
expected: Open an F2F training session on mobile width. Side panels collapse, a compact HCP info bar appears at top, and hints toggle appears at bottom.
result: skipped
reason: User switching to system-level functional testing

### 15. Scoring Feedback Dark Mode
expected: View a scoring feedback page in dark mode. All sections are wrapped in bg-card containers, SVG ring charts use stroke-muted, no hardcoded light-only colors.
result: skipped
reason: User switching to system-level functional testing

### 16. Admin Skeleton Loading States
expected: On admin dashboard, before data loads, stat cards and chart areas show skeleton placeholders instead of blank space.
result: skipped
reason: User switching to system-level functional testing

### 17. Bilingual Seed Data
expected: Login as admin, view HCP profiles. 5 bilingual HCP profiles appear with Chinese+English names, real hospital affiliations, and BeiGene-relevant specialties. View scenarios: 4 BeiGene-branded scenarios with bilingual titles.
result: skipped
reason: User switching to system-level functional testing

### 18. Sonner Toasts Theme Adaptation
expected: Trigger a toast notification (e.g., save a config). The toast matches the current dark/light mode and accent color theme.
result: skipped
reason: User switching to system-level functional testing

## Summary

total: 18
passed: 3
issues: 3
pending: 0
skipped: 13
blocked: 0

## Gaps

- truth: "Backend boots without errors, Azure config API works on cold start"
  status: fixed
  reason: "User reported: GET /api/v1/azure-config/services returns 500 — no such column: service_configs.is_master"
  severity: blocker
  test: 1
  root_cause: "Alembic migration f09a (adding is_master column) was never applied to local SQLite DB — init_db.py created tables via create_all without Alembic tracking"
  fix: "Stamped alembic at a1b2c3d4e5f6, ran alembic upgrade head"

- truth: "Azure OpenAI connection test and chat completion work with newer models (gpt-5.4-mini)"
  status: fixed
  reason: "User reported: Connection failed: Error code 400 — Unsupported parameter 'max_tokens', use 'max_completion_tokens' instead"
  severity: blocker
  test: 11
  root_cause: "OpenAI API deprecated max_tokens in favor of max_completion_tokens for newer models. connection_tester.py and azure_openai.py adapter both used the old parameter."
  fix: "Replaced max_tokens with max_completion_tokens in connection_tester.py (line 48) and azure_openai.py (line 80), updated test assertion"

- truth: "AI Foundry config persists across server restarts and re-login"
  status: fixed
  reason: "User reported: 再次登录的时候，之前配置的AI Foundry的配置，在页面上不见了"
  severity: blocker
  test: 11
  root_cause: "ENCRYPTION_KEY not set in .env — each server restart generates a new random Fernet key, making previously encrypted configs undecryptable"
  fix: "Added stable ENCRYPTION_KEY to .env, added graceful error handling in decrypt_value(), auto-persist key on first generation"
