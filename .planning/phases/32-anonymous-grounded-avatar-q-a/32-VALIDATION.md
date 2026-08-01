---
phase: 32
slug: anonymous-grounded-avatar-q-a
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (backend) / Playwright 1.48+ (frontend E2E) / tsc -b (frontend types) |
| **Config file** | backend/pyproject.toml / frontend/playwright.config.ts |
| **Quick run command** | `cd backend && pytest -x -q tests/` |
| **Full suite command** | `cd backend && pytest -v && cd ../frontend && npx tsc -b && npx playwright test --config=e2e/playwright.config.ts` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest -x -q tests/`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | ANON-01..05 | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Live-index spike: verify Foundry IQ knowledge source `sourceDataFields` contain title + URL + page number (blocks citation implementation approach)
- [ ] slowapi dual-limiter smoke test: confirm IP-key + session-key stacked limiters work on one route
- [ ] `backend/tests/test_public_avatar.py` — stubs for ANON-01..05 (anonymous session, rate limit, audit log)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Avatar speaks answer aloud via WebRTC | ANON-04 | Real Azure Voice Live media stream cannot be asserted in CI | Open `/` in browser, ask a question, confirm avatar audio + synced text |
| Voice input via microphone | ANON-01 | Requires real mic permission + audio capture | Grant mic permission, speak a question, confirm transcription + answer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
