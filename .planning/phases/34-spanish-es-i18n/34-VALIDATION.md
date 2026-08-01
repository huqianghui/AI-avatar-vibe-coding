---
phase: 34
slug: spanish-es-i18n
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) / pytest + pytest-asyncio (backend, `--cov-fail-under=89`) / Playwright (E2E) |
| **Config file** | `frontend/vite.config.ts`, `backend/pyproject.toml`, `frontend/e2e/playwright.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run src/i18n/locale-parity.test.ts` · `cd backend && pytest tests/test_public_webrtc_session.py tests/test_avatar_service.py -v` |
| **Full suite command** | `cd frontend && npm test` · `cd backend && pytest -v` · `cd frontend && npm run test:e2e` |
| **Estimated runtime** | ~120 seconds (unit) + E2E |

---

## Sampling Rate

- **After every task commit:** Run the quick unit test file(s) touched by the task
- **After every plan wave:** Run full frontend vitest + backend pytest + `npx tsc -b` + `ruff check . && ruff format --check .`
- **Before `/gsd-verify-work`:** Full suite must be green including `npm run test:e2e`
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-xx | TBD | TBD | LANG-01 | — | 5-locale key parity + non-empty + interpolation + untranslated (whitelist) across 16 namespaces | unit | `npx vitest run src/i18n/locale-parity.test.ts` | ❌ W0 | ⬜ pending |
| 34-xx | TBD | TBD | LANG-01 | — | supportedLngs = 5 locales in D-10 order | unit | `npx vitest run src/i18n/index.test.ts` | ✅ (update) | ⬜ pending |
| 34-xx | TBD | TBD | LANG-01 | — | switcher renders 5 options | unit | `npx vitest run src/components/shared/language-switcher.test.tsx` | ❌ W0 | ⬜ pending |
| 34-xx | TBD | TBD | LANG-01 | — | es-* switch renders translated UI, no missing-key fallback | e2e | `npm run test:e2e -- language-switcher-es.spec.ts` | ❌ W0 | ⬜ pending |
| 34-xx | TBD | TBD | LANG-02 | — | WebrtcSessionRequest accepts es-ES/es-MX/es-US (no 422) | unit | `pytest tests/test_public_webrtc_session.py -x` | ✅ (add cases) | ⬜ pending |
| 34-xx | TBD | TBD | LANG-02 | — | REFUSAL_TEMPLATES es-* entries returned per locale | unit | `pytest tests/test_avatar_service.py tests/test_personalized_avatar_service.py -x` | ✅ (add cases) | ⬜ pending |
| 34-xx | TBD | TBD | LANG-02 | — | D-07 locale-aware voice fallback (not en-US-AvaNeural) | unit | `pytest tests/test_public_webrtc_session.py -x` | ✅/partial | ⬜ pending |
| 34-xx | TBD | TBD | LANG-02 | — | es-* voice session negotiation E2E (mocked) | e2e | `npm run test:e2e -- anonymous-avatar-voice-es.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/i18n/locale-parity.test.ts` — global 5-locale/16-namespace parity test (D-04/D-05)
- [ ] Untranslated-detection whitelist (D-03) — constant/file consumed by parity test
- [ ] `frontend/e2e/language-switcher-es.spec.ts` — E2E language switch to each es-* variant
- [ ] `frontend/e2e/anonymous-avatar-voice-es.spec.ts` — es-* voice path E2E (reuse existing mock helpers)
- [ ] Existence checks at execution time: `language-switcher.test.tsx`, dedicated `test_voice_live_webrtc.py`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real es-* neural voice audio quality via live Azure Voice Live | LANG-02 | Real WebRTC/Azure connection not available in CI; E2E uses mocks | Open `/`, switch to es-ES/es-MX/es-US, ask a question, confirm avatar speaks with the corresponding accent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
