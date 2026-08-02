---
phase: 35
slug: clean-avatar-ui-legacy-coach-hiding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
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
| (filled by planner) | | | AVUI-01 / AVUI-02 | | Flag is UI-visibility only, not an access-control boundary | unit/E2E | see plans | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New E2E chrome-absence assertion for AVUI-01 (`anonymous-avatar-qa.spec.ts` extension or new `avatar-ui-clean.spec.ts`)
- [ ] `backend/tests/test_config_api.py` — `mock_settings.feature_legacy_coach_nav_enabled` added to every full mock_settings construction
- [ ] `frontend/src/components/layouts/user-layout.test.tsx` — mock update (`legacy_coach_nav_enabled: true`) + new flag=false absence test case
- [ ] Pre-change full E2E baseline capture (one run, record pass/fail list)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual "decluttered" impression of avatar page on real devices | AVUI-01 | Aesthetic judgment beyond selector assertions | Open `/` on desktop + mobile viewport; confirm only header, avatar, transcript, input bar, sources panel are visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
