---
phase: 32-anonymous-grounded-avatar-q-a
verified: 2026-08-01T08:18:27Z
status: gaps_found
score: 5/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Anonymous grounded Q&A is usable in a real/fresh deployment (an admin can configure which agent/KB/avatar the public page uses)"
    status: failed
    reason: >
      CONTEXT.md locks the decision "公共知识库绑定由 Admin 界面配置 ... 复用 Phase 17
      的 KB 列表/选择 UI；不用环境变量硬编码" (admin-UI-configured PublicKnowledgeConfig,
      reusing Phase 17's KB selector — never env-var hardcoded). No plan in 32-01..05
      implemented this. `PublicKnowledgeConfig` (backend/app/models/public_knowledge_config.py)
      is only ever instantiated in test files — there is no admin API endpoint
      (no `/api/v1/public-knowledge-config*` route exists anywhere in
      backend/app/api/), no admin UI page/component, and no seed script that
      creates or activates a row. `get_active_public_config()` fails closed
      with 404 if no row is `is_active=True`. On a fresh database, every
      `/public/avatar/session`, `/public/avatar/chat`, and
      `/public/avatar/webrtc/session` call to the resolver 404s — the entire
      anonymous avatar feature is inert until someone manually inserts a DB
      row outside the application. The Plan-05 human checkpoint that verified
      the live flow necessarily relied on such a manual, undocumented DB
      write, not a supported operator path.
    artifacts:
      - path: backend/app/services/public_knowledge_config_service.py
        issue: "Only a read resolver (get_active_public_config) exists — no create/update/activate function or admin route anywhere in the codebase"
      - path: backend/app/models/public_knowledge_config.py
        issue: "PublicKnowledgeConfig(...) is constructed nowhere outside test files (backend/tests/test_*); confirmed via repo-wide grep"
    missing:
      - "Admin API endpoint(s) (e.g. GET/POST/PUT under /api/v1/public-knowledge-config) to create, edit, and activate a PublicKnowledgeConfig row"
      - "Admin UI page reusing Phase 17's KB list/selection component, per the locked CONTEXT.md decision"
      - "At minimum, a documented seed/setup script if the admin-UI portion is intentionally deferred"
---

# Phase 32: Anonymous Grounded Avatar Q&A Verification Report

**Phase Goal:** Anonymous visitors can converse with the digital human avatar (text + voice) without login and receive knowledge-grounded, sourced answers from official website content (Foundry IQ index), safely and without abuse/cost-exposure risk.
**Verified:** 2026-08-01T08:18:27Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, ANON-01..05)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visitor can open the avatar page without login and type a question | ✓ VERIFIED | `frontend/src/router/index.tsx:144` — `/` renders `<AvatarPage/>` with **no** `ProtectedRoute`/`GuestRoute` guard (was `Navigate to /login` pre-phase). `frontend/src/pages/avatar-page.tsx` composes session/chat hooks with no auth dependency. E2E `anonymous-avatar-qa.spec.ts` asserts no-login/no-redirect. Human checkpoint step 1 confirmed. |
| 2 | Answers grounded in Foundry IQ; refuse/fallback gracefully, never fabricate | ✓ VERIFIED | `backend/app/services/avatar_service.py::handle_anonymous_turn` — refusal triggers on zero full-field citations (`is_refusal = len(citations) == 0`), returns fixed template, never the raw agent text on refusal. Exception path (agent/search failure) also degrades to refusal rather than propagating a fabricated/partial answer. `test_avatar_service.py`, `test_avatar_search_service.py` pass (targeted run: 38/38 backend tests green). Caveat: refusal locale is hard-coded `zh-CN` regardless of UI language (code-review WR-01, non-blocking). |
| 3 | Each answer's source citation renders as a distinct UI element, not merged into the answer bubble | ✓ VERIFIED | `frontend/src/components/avatar/sources-panel.tsx` is a structurally separate sidebar; `avatar-page.tsx`'s `onSuccess` handler passes ONLY `data.answer` into the transcript segment and ONLY `data.citations` into `SourcesPanel` — no code path concatenates them. `avatar-page.test.tsx` (22 tests, part of 67/67 frontend suite run) asserts the transcript bubble text never contains a citation URL/title. E2E spec asserts structurally separate regions. |
| 4 | Visitor can hear the answer spoken by the Voice Live avatar (not text-only) | ✓ VERIFIED | `POST /public/avatar/webrtc/session` (`backend/app/api/public_avatar.py`) + `create_public_webrtc_session_config()` issue a real ephemeral Azure credential; `frontend/src/hooks/use-anonymous-voice-live.ts` drives a real WebRTC/RTCPeerConnection handshake. E2E `anonymous-avatar-voice.spec.ts` drives the real hook state machine to `connected` via faked transport. Human checkpoint step 2 confirmed audible, in-sync speech on a live instance. |
| 5 | Anonymous requests rate-limited/quota-capped + every turn audit-logged; no client-suppliable agent/profile identifier | ✓ VERIFIED | `ChatRequest`/`WebrtcSessionRequest` schemas have no `agent_id`/`kb_name`/profile field; agent/KB always resolved server-side via `get_active_public_config()`. Dual-key (`limiter_ip`+`limiter_session`) decorators on all 3 routes, proven independently enforced (`test_rate_limiting.py`). `handle_anonymous_turn` writes exactly one `AvatarInteractionLog` row per turn including on agent/search failure (`test_avatar_interaction_log.py`, 3/3 success/refusal/error cases). Caveat: `limiter_ip`'s key (`get_remote_address`) does not read `X-Forwarded-For`, so behind the project's real Azure Container Apps ingress the IP-keyed half likely collapses to one shared bucket (code-review WR-02, non-blocking for this verification but a real production risk already tracked). |
| 6 | The anonymous avatar feature is actually configurable/operable in a deployed environment (admin sets which agent/KB/avatar it uses) | ✗ FAILED | No admin API route, no admin UI, no seed script creates or activates a `PublicKnowledgeConfig` row anywhere outside test fixtures (repo-wide grep confirms `PublicKnowledgeConfig(` is only constructed in `backend/tests/*`). `get_active_public_config()` 404s with nothing to resolve. This contradicts CONTEXT.md's locked decision that this config is admin-UI-managed, reusing Phase 17's KB selector, "never env-var hardcoded." |

**Score:** 5/6 truths verified (truth #6 derived from CONTEXT.md's locked decision, not literally itemized as a numbered ROADMAP bullet, but required for the other 5 to be exercisable outside a manually-seeded dev/test database).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/{anonymous_avatar_session,avatar_interaction_log,public_knowledge_config}.py` | 3 ORM models | ✓ VERIFIED | All exist, fields match SUMMARY claims, re-exported via `models/__init__.py` |
| `backend/alembic/versions/b35a_add_anonymous_avatar_tables.py` | Migration for the 3 tables | ✓ VERIFIED | Present, chains from real head `a34a_add_session_agent_pin`; `alembic heads` shows a single linear chain (no orphan branch) |
| `backend/app/services/rate_limit.py` | Dual-key limiter infra | ✓ VERIFIED | `limiter_ip`/`limiter_session`/`_KeyedLimiterProxy`; `test_rate_limiting.py` proves independent enforcement |
| `backend/app/api/public_avatar.py` | `/public/avatar/{session,chat,webrtc/session}` | ✓ VERIFIED | All 3 routes present, mounted in `main.py:179` with no `/api/v1` prefix, each `Depends(get_anonymous_session)` (except session-create) and dual-rate-limited |
| `backend/app/services/{avatar_service,avatar_search_service,anonymous_session_service,public_knowledge_config_service}.py` | Orchestrator + citation/session/config services | ✓ VERIFIED (content), ⚠️ **config service has no write path** | `avatar_service.py`/`avatar_search_service.py`/`anonymous_session_service.py` are substantive and wired; `public_knowledge_config_service.py` provides only a read resolver — see gap above |
| `frontend/src/pages/avatar-page.tsx` + `components/avatar/{sources-panel,avatar-input-bar,mic-permission-dialog}.tsx` | Public page composition | ✓ VERIFIED | Composed, wired to hooks, structural citation/answer separation confirmed by reading `handleSend`'s `onSuccess` |
| `frontend/src/api/public-avatar.ts`, `hooks/use-anonymous-{avatar-session,avatar-chat,voice-live}.ts` | Anonymous-only client + hooks | ✓ VERIFIED | Dedicated fetch client (no JWT axios singleton reuse); hooks wired into `avatar-page.tsx` |
| `frontend/e2e/anonymous-avatar-{qa,voice}.spec.ts` | Playwright E2E | ✓ VERIFIED | 201 + 228 lines, substantive (mocked routes + faked WebRTC transport), not stubs |
| Admin UI/API for `PublicKnowledgeConfig` | Per CONTEXT.md locked decision | ✗ MISSING | No route, no component, no script found anywhere in `backend/app/api/` or `frontend/src/pages|components/admin*` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `router/index.tsx` `/` | `AvatarPage` | Route element, no guard | ✓ WIRED | Confirmed by direct read |
| `avatar-page.tsx` chat mutation | `POST /public/avatar/chat` | `sendAnonymousChat` (fetch) | ✓ WIRED | `use-anonymous-avatar-chat.ts` → `public-avatar.ts` |
| `public_avatar.py::chat` | `handle_anonymous_turn` | Direct call | ✓ WIRED | Confirmed by direct read |
| `handle_anonymous_turn` | AI Search `retrieve` REST | `retrieve_citations()` via `asyncio.gather` | ✓ WIRED | Confirmed by direct read |
| `handle_anonymous_turn` | `AvatarInteractionLog` | `db.add()` + `db.commit()`, incl. exception path | ✓ WIRED | Confirmed by direct read + `test_avatar_interaction_log.py` |
| `public_avatar.py::webrtc_session` | `create_public_webrtc_session_config` | Direct call, `agent_id`/`voice` from `PublicKnowledgeConfig` | ✓ WIRED | Confirmed by direct read |
| **`get_active_public_config()`** | **Any row-creation path** | **None** | ✗ NOT_WIRED | No producer exists — resolver has nothing to resolve in a fresh DB |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend phase-32 targeted test suite | `pytest tests/test_avatar_models.py tests/test_rate_limiting.py tests/test_public_avatar_api.py tests/test_avatar_search_service.py tests/test_avatar_service.py tests/test_public_webrtc_session.py tests/test_avatar_interaction_log.py` | 38 passed | ✓ PASS |
| Frontend phase-32 targeted vitest suite | `vitest run` (7 files: session/chat/voice-live hooks, sources-panel, input-bar, avatar-page, public-avatar api) | 67 passed | ✓ PASS |
| Router mounting | `grep public_avatar_router app/main.py` | `app.include_router(public_avatar_router)` (no prefix, line 179) | ✓ PASS |
| PublicKnowledgeConfig producer exists | `grep -rn "PublicKnowledgeConfig(" backend/ (excl. tests/pycache)` | 0 matches outside model definition | ✗ FAIL (confirms gap) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| ANON-01 | 32-01, 32-02, 32-04 | 匿名访客无需登录即可打开 avatar 页面并以文本提问 | ✓ SATISFIED | Public `/` route, session+chat hooks, E2E, human checkpoint |
| ANON-02 | 32-02, 32-05 | 匿名回答基于官网内容知识库 grounding，仅用授权来源 | ✓ SATISFIED | `handle_anonymous_turn` grounding + refusal logic, tests |
| ANON-03 | 32-02, 32-04 | 每答附来源引用，与回答内容独立 UI 元素分离 | ✓ SATISFIED | `sources-panel.tsx` structural separation, mechanical data-flow proof |
| ANON-04 | 32-03 | 匿名访客可获得数字人语音回答 | ✓ SATISFIED | Anonymous WebRTC endpoint + hook, human checkpoint audible speech |
| ANON-05 | 32-01, 32-02, 32-05 | 限流 + 会话配额 + 交互审计日志 | ✓ SATISFIED | Dual-key limiter, audit log on every turn incl. failure path |

**Note:** `.planning/REQUIREMENTS.md`'s checkbox list (lines 13-17) still shows `[ ]` unchecked for ANON-01..05 despite `ROADMAP.md` marking Phase 32 complete and every plan's `requirements-completed` frontmatter listing them — this is a documentation-sync gap (informational), not a functional gap; recommend a follow-up doc update.

### Anti-Patterns Found

No TODO/FIXME/placeholder/"not implemented" strings found in any of the 13 core phase-32 backend/frontend files scanned. No stub return patterns (`return null`, empty handlers) found in the reviewed page/component/service files.

Carried forward from `32-REVIEW.md` (0 critical / 5 warnings / 3 info — all already documented, non-blocking for this verification):
- WR-01: refusal message hard-locked to zh-CN regardless of UI locale
- WR-02: `limiter_ip` key doesn't read `X-Forwarded-For` — collapses behind the real Azure ingress topology
- WR-03: `touch_session()` tested but never called from any real request path (dead code in production)
- WR-04: citation URLs have no scheme allowlist (backend or frontend) — `javascript:`/`data:` URI risk if the index is ever poisoned
- WR-05: anonymous WebRTC path has no fail-closed guard for an empty `agent_id` (unlike the authenticated D-08 gate)

### Human Verification Required

None outstanding — Plan 05's Task 2 checkpoint already covered all human-verifiable behaviors (audible speech, JWT absence, refusal styling, mic-denial fallback, sources-panel separation) and was approved (all 6 checks passed).

### Gaps Summary

Five of five ROADMAP-level success criteria (ANON-01 through ANON-05) are genuinely implemented, tested (38 backend + 67 frontend targeted tests, 8/8 Playwright, human checkpoint), and match their code-review findings (0 critical). However, goal-backward tracing from "anonymous visitors can ask questions and get grounded, spoken, sourced answers" surfaces one structural gap that sits upstream of all five: nothing in the codebase can create or activate the `PublicKnowledgeConfig` row that `get_active_public_config()` requires. CONTEXT.md explicitly locked this as an admin-UI-configured value ("不用环境变量硬编码"), but no plan (32-01 through 32-05) implemented that admin surface — no API route, no UI component, no seed script. On a fresh database/environment, every anonymous endpoint 404s until someone manually inserts a row outside the application, which is not a supported operator path and was evidently how the Plan-05 human checkpoint's live instance was made to work.

This looks like an intentional scope gap in planning (no plan ever picked up the admin-UI task named in CONTEXT.md's decisions) rather than a coding defect — it may be acceptable to defer to a fast-follow plan or an ops runbook. If that's the decision, add an override to this VERIFICATION.md's frontmatter documenting the deferral; otherwise, a closure plan should add: (1) an admin API endpoint (GET/POST/PUT) for `PublicKnowledgeConfig`, and (2) an admin UI page reusing Phase 17's KB selector, per the original locked decision.

**This looks intentional/deferrable.** To accept this deviation, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "Admin can configure the public knowledge base via UI (PublicKnowledgeConfig admin surface)"
    reason: "<why this is acceptable to ship without — e.g. deferred to a fast-follow plan, or a documented manual DB-seed runbook is the accepted interim path>"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

---

_Verified: 2026-08-01T08:18:27Z_
_Verifier: Claude (gsd-verifier)_
