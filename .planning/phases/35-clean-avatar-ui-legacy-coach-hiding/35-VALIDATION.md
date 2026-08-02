---
phase: 35
slug: clean-avatar-ui-legacy-coach-hiding
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
updated: 2026-08-02
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3+ (backend, asyncio_mode=auto) / vitest ^3.2.4 (frontend) / Playwright ^1.48.0 (E2E) |
| **Config file** | `backend/pyproject.toml` / `frontend/vite.config.ts` / `frontend/e2e/playwright.config.ts` |
| **Quick run command** | `cd backend && pytest tests/test_config_api.py -v` · `cd frontend && npx vitest run src/components/layouts/user-layout.test.tsx` |
| **Full suite command** | `cd backend && pytest -v` · `cd frontend && npm run test && npx tsc -b && npm run build` |
| **Estimated runtime** | quick ~20s · backend full ~180s · frontend full ~120s · full E2E ~40min (phase gate only) |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command for files touched
- **After every plan wave:** Full backend suite + full frontend unit suite + targeted E2E specs (`navigation.spec.ts`, `routing.spec.ts`, `anonymous-avatar-qa.spec.ts`)
- **Before `/gsd-verify-work`:** Full suite must be green; full E2E diffed against fresh pre-change baseline (~415/9/35) — zero newly-failing tests
- **Max feedback latency:** 300 seconds (E2E phase gate exempt, run once)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-T1 | 35-01 | 1 | AVUI-01 | T-35-01-02 | No secrets/PII captured in baseline artifact | E2E (baseline capture) | `cd frontend && npm run test:e2e -- --reporter=list` | ✅ spec files exist; baseline file created by this task | ✅ green |
| 35-01-T2 | 35-01 | 1 | AVUI-01 | T-35-01-01 | Chrome-absence assertion, test-only change, no new attack surface | unit + E2E | `cd frontend && npx vitest run src/pages/avatar-page.test.tsx && npx playwright test anonymous-avatar-qa.spec.ts --config=e2e/playwright.config.ts` | ✅ both files exist | ✅ green |
| 35-02-T1 | 35-02 | 2 | AVUI-02 | T-35-02-02, T-35-02-03 | New flag env-only, auth-gated endpoint unchanged; MagicMock/Pydantic bool pitfall fixed | unit (backend) | `cd backend && pytest tests/test_config_api.py -v` | ✅ all 3 files exist | ✅ green (3 passed) |
| 35-02-T2 | 35-02 | 2 | AVUI-02 | T-35-02-01 | UI-visibility-only gating at both render sites; not an access-control boundary | unit (frontend) | `cd frontend && npx vitest run src/components/layouts/user-layout.test.tsx` | ✅ all 4 files exist | ✅ green (9 passed) |
| 35-02-T3 | 35-02 | 2 | AVUI-01, AVUI-02 | T-35-02-01 | Zero newly-failing E2E tests vs. baseline; AdminLayout/redirects/routes untouched | unit + E2E (full regression) | `cd backend && pytest -v && cd ../frontend && npm run test && npx tsc -b && npm run build && npx playwright test navigation.spec.ts admin-navigation.spec.ts routing.spec.ts voice-live-proxy.spec.ts anonymous-avatar-qa.spec.ts --config=e2e/playwright.config.ts && npm run test:e2e` | ✅ all spec files exist | ✅ green (backend 2829 passed/15 skipped/90.11% cov; frontend 2609 passed, tsc+build clean; targeted 5-spec run 56 passed/4 baseline-matched failed; full 6-shard E2E: zero newly-failing tests vs. 35-01 baseline — 34 failures observed, all present in baseline's 39; the 5 baseline failures not reproduced are the documented hcp-editor-voice-tab.spec.ts sharding-teardown flake) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] New E2E chrome-absence assertion for AVUI-01 (`anonymous-avatar-qa.spec.ts` extension) — assigned to 35-01-T2
- [x] `backend/tests/test_config_api.py` — `mock_settings.feature_legacy_coach_nav_enabled` added to every full mock_settings construction — assigned to 35-02-T1
- [x] `frontend/src/components/layouts/user-layout.test.tsx` — mock update (`legacy_coach_nav_enabled: true`) + new flag=false absence test case — assigned to 35-02-T2
- [x] Pre-change full E2E baseline capture (one run, record pass/fail list) — assigned to 35-01-T1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Visual "decluttered" impression of avatar page on real devices | AVUI-01 | Aesthetic judgment beyond selector assertions | Open `/` on desktop + mobile viewport; confirm only header, avatar, transcript, input bar, sources panel are visible |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (35-01 has 2 tasks both verified; 35-02 has 3 tasks all verified)
- [x] Wave 0 covers all MISSING references (baseline capture, mock_settings, user-layout mock — all assigned to concrete tasks above)
- [x] No watch-mode flags (all commands use `run`/one-shot forms, never `--watch` or `vitest` without `run`)
- [x] Feedback latency < 300s (per-task commands are quick; full E2E is the explicit phase-gate exception, run once per plan)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete — all 5 tasks across 35-01/35-02 verified green during `/gsd-execute-phase` (2026-08-02). Full backend + frontend unit suites pass; zero E2E tests newly-failing relative to the 35-01 pre-change baseline.
