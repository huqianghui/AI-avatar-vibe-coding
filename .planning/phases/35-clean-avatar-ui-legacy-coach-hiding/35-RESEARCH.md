# Phase 35: Clean Avatar UI & Legacy Coach Hiding - Research

**Researched:** 2026-08-02
**Domain:** React Router v7 nav/route composition + existing feature-flag config plumbing (no new external dependencies)
**Confidence:** HIGH (codebase-verified — this research is almost entirely direct code reading, not library research)

## Summary

This phase has two independent halves. **AVUI-01** (clean avatar UI) is **~90% already satisfied** by Phase 32/33 work: `avatar-page.tsx` is a standalone route (not wrapped by `UserLayout`/`AdminLayout`), already renders only a minimal header (login button/badge), `AvatarView`, `VoiceTranscript`, `AvatarInputBar`, and a structurally-separate `SourcesPanel` (desktop: right column with `border-l`; mobile: bottom `Sheet`). `avatar-page.test.tsx` already has extensive tests proving the answer text and citations are never concatenated (ANON-03), and that no CRM/preference content leaks into the personalized view (PERS guard tests). This phase's AVUI-01 work is primarily a verification/polish pass, not new construction.

**AVUI-02** (hide legacy coach nav) has a ready-made mechanism to reuse: this codebase already has a full feature-flag pipeline — `Settings.feature_*_enabled: bool` (pydantic-settings, `backend/app/config.py`) → `GET /api/v1/config/features` (`backend/app/api/config.py`) → `useFeatureFlags()` (`frontend/src/hooks/use-config.ts`, TanStack Query) → `ConfigContext`/`useConfig()` (`frontend/src/contexts/config-context.tsx`). Adding one new boolean flag and gating `UserLayout`'s `navItems` array (`frontend/src/components/layouts/user-layout.tsx`) is the entire mechanical change — no new library, no new pattern.

The codebase's E2E suite is unusually defensive: nearly every test that clicks a nav link first guards with `if ((await link.count()) > 0)`. This means hiding `UserLayout`'s coach nav items will **not** break `navigation.spec.ts` or `admin-navigation.spec.ts` — those tests silently no-op when the link is absent. The one unit test that WILL need deliberate updating is `frontend/src/components/layouts/user-layout.test.tsx`'s "renders all desktop navigation items" test, which currently asserts unconditional rendering — this is expected, in-scope work, not an accidental break.

**Primary recommendation:** Add `feature_legacy_coach_nav_enabled: bool = False` to `Settings` (backend) and thread it through the existing `/config/features` → `FeatureFlags` → `useConfig()` pipeline; gate only `UserLayout`'s `navItems` (dashboard/training/history/reports) behind it. Do **not** touch `AdminLayout`'s sidebar, do **not** change `GuestRoute`/`login.tsx` post-login redirect targets, and do **not** wrap `AvatarPage` in any layout — all three are load-bearing for existing green tests (see Common Pitfalls).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AVUI-01 | avatar 页面仅展示数字人 + 文档链接信息 — 语音内容与文档来源视觉分离 | `avatar-page.tsx` already meets this structurally (see Architecture Patterns → "Avatar Page Is Already Standalone"). Research maps exact remaining polish items and the test file that already locks in the separation contract. |
| AVUI-02 | 旧 coach 功能导航入口通过 feature flag 隐藏（代码与路由保留，现有测试不破坏） | Research identifies the exact reusable flag pipeline, the exact nav array to gate (`UserLayout.navItems`), the exact E2E tests that are safe (guarded) vs. the one unit test that needs deliberate update, and the exact backend/frontend files to touch. |

</phase_requirements>

## Standard Stack

No new libraries are needed for this phase. Reuse exactly what exists:

### Core (existing, reused)
| Library | Version | Purpose | Why Standard (here) |
|---------|---------|---------|--------------|
| pydantic-settings | >=2.5.0 | Backend `Settings.feature_*_enabled` flags | Already the sole config mechanism in `backend/app/config.py`; 5 existing `feature_*_enabled` flags follow this exact pattern |
| FastAPI | >=0.115.0 | `GET /api/v1/config/features` | Existing, auth-gated (`get_current_user`), already returns a `FeatureFlags` Pydantic model consumed by the frontend |
| @tanstack/react-query v5 | ^5.60.0 | `useFeatureFlags()` hook | Existing hook (`frontend/src/hooks/use-config.ts`), 10-min `staleTime`, `enabled: isAuthenticated` |
| React Context | React 18 built-in | `ConfigContext`/`useConfig()` | Existing global flag access point (`frontend/src/contexts/config-context.tsx`) already wraps the whole app inside `QueryClientProvider` |
| React Router v7 | ^7.0.0 | Nav/route composition | Existing `createBrowserRouter` in `frontend/src/router/index.tsx`; `AvatarPage` is already a top-level route sibling to the guarded `/user`/`/admin` trees, not nested under either layout |

**No installation required** — this phase adds zero new npm/pip packages.

**Version verification:** N/A — no new packages. Existing versions confirmed via `backend/pyproject.toml` and `frontend/package.json` reads during this research session `[VERIFIED: codebase]`.

## Architecture Patterns

### Pattern 1: Existing Feature-Flag Pipeline (reuse verbatim for AVUI-02)

**What:** A 4-layer flag pipeline already exists end-to-end. Verified by reading all 4 layers directly:

1. `backend/app/config.py` — `Settings` class, e.g. `feature_avatar_enabled: bool = False` (5 existing flags, all default `False` — "Feature toggles default to False for zero-config local dev" per `[Phase 01]` decision in STATE.md).
2. `backend/app/api/config.py` — `GET /config/features` reads `get_settings()` plus optional DB service-config overrides (`config_service.get_config(db, "azure_avatar")` etc. for some flags; others, like `feature_conference_enabled`, are env-only with **no** DB override — this is the precedent to follow for a nav-visibility flag, since it needs no runtime Azure-service-active check).
3. `frontend/src/hooks/use-config.ts` — `useFeatureFlags(isAuthenticated)`, TanStack Query, `queryKey: ["config", "features"]`, `enabled: isAuthenticated`.
4. `frontend/src/contexts/config-context.tsx` — `ConfigProvider` wraps the whole app in `App.tsx`; `defaultFlags` (all conservative/off) are served pre-auth or pre-fetch; `useConfig()` is the consumption point.

**When to use:** Any UI-visibility toggle that should be centrally configurable without a redeploy of frontend code. This is exactly AVUI-02's need.

**Example (the exact 4 edits needed):**
```python
# backend/app/config.py — add alongside the other 5 feature_* flags
feature_legacy_coach_nav_enabled: bool = False  # AVUI-02: hidden by default
```
```python
# backend/app/api/config.py — add to both FeatureFlags model and get_features()
class FeatureFlags(BaseModel):
    ...
    legacy_coach_nav_enabled: bool

async def get_features(...):
    ...
    return ConfigResponse(
        features=FeatureFlags(
            ...
            legacy_coach_nav_enabled=settings.feature_legacy_coach_nav_enabled,
        ),
        ...
    )
```
```typescript
// frontend/src/types/config.ts
export interface FeatureFlags {
  ...
  legacy_coach_nav_enabled: boolean;
}
```
```typescript
// frontend/src/contexts/config-context.tsx — defaultFlags
const defaultFlags: FeatureFlags = {
  ...
  legacy_coach_nav_enabled: false,
};
```
```tsx
// frontend/src/components/layouts/user-layout.tsx
const { legacy_coach_nav_enabled } = useConfig();
// ... in JSX, gate both the desktop <nav> map and the mobile Sheet <nav> map:
{legacy_coach_nav_enabled && navItems.map((item) => ...)}
```
*(Source: direct read of `backend/app/config.py`, `backend/app/api/config.py`, `frontend/src/hooks/use-config.ts`, `frontend/src/contexts/config-context.tsx`, `frontend/src/components/layouts/user-layout.tsx` — all `[VERIFIED: codebase]`)*

### Pattern 2: Avatar Page Is Already Standalone (AVUI-01 baseline)

**What:** `AvatarPage` (`frontend/src/pages/avatar-page.tsx`, 339 lines) is mounted directly at `{ path: "/", element: <AvatarPage /> }` in `router/index.tsx` — **outside** both `ProtectedRoute`/`UserLayout` and `AdminRoute`/`AdminLayout`. It renders its own minimal `<header>` (title span + login button or badge/email), then a 2-column grid: left column = `AvatarView` + `VoiceTranscript` + `AvatarInputBar`; right column (desktop, `md:` breakpoint) = `SourcesPanel` behind a `border-l border-border`; on mobile, `SourcesPanel` is a bottom `Sheet` triggered by a floating button. This is already the "digital human + distinct document-links panel, no other clutter" shape AVUI-01 asks for.

**Verified separation:** `avatar-page.tsx`'s `handleSend` callback puts `data.answer` into the transcript bubble and `data.citations` into `SourcesPanel` — never concatenated (module docstring cites "AI Avatar Domain Rule #6" from `CLAUDE.md`). `avatar-page.test.tsx` (lines 164-198) has a dedicated test: *"submitting a question sends only the answer to the transcript and only citations to SourcesPanel"*, plus a PERS-02 guard test (line 542): *"renders no CRM field, preference tag, or match-status content anywhere on the page"*.

**What's NOT yet verified/covered (candidate polish scope for this phase):**
- No E2E test currently makes an explicit *negative* assertion like "no nav/sidebar/admin chrome is present on `/`" — worth adding one line to `anonymous-avatar-qa.spec.ts` or a new spec (e.g. `expect(page.locator("nav")).toHaveCount(0)` on `/`) to lock in the "no clutter" criterion as regression-proof, since AVUI-01 is a *visual* requirement and the current test suite proves data-separation, not chrome-absence.
- The header's visible title (`t("sourcesPanel.title")`) reuses the *sources panel's* translation key as the page's leading label — functionally harmless (both should say "Sources"/similar) but worth a sanity check that this isn't a copy-paste artifact confusing the header's actual identity element.

### Anti-Patterns to Avoid
- **Wrapping `AvatarPage` in `UserLayout` or a new shared layout to "unify chrome":** Don't. It is intentionally a bare top-level route (see module docstring: "public route (not `ProtectedRoute`-wrapped)"). Wrapping it would reintroduce exactly the coach-nav clutter AVUI-01 is trying to avoid, and would require it to sit inside `ProtectedRoute`, breaking anonymous access (ANON-01).
- **Changing `GuestRoute`/`login.tsx` redirect targets (`/user/dashboard`, `/admin/dashboard`) to `/` "to make the avatar the default landing experience":** Don't, in this phase. `frontend/e2e/routing.spec.ts` has unguarded, direct assertions — `"authenticated user on /login is redirected to dashboard"` expects `toHaveURL(/\/user\/dashboard/)`. Changing the redirect target breaks this test outright (no `if count() > 0` guard exists for a `toHaveURL` assertion). AVUI-02's literal wording is "hide nav **entries**", not "change default landing page" — treat any redirect-target change as out of scope / a separate future decision (see Open Questions).
- **Gating `AdminLayout`'s sidebar items with the same flag:** Don't, without an explicit decision (see Open Questions). `frontend/e2e/voice-live-proxy.spec.ts` line 489 has an **unguarded** assertion — `"admin sidebar shows Voice Live link"` calls `await expect(voiceLiveLink).toBeVisible(...)` directly, no `if count() > 0`. Hiding that admin nav item would break this test today. Admin's sidebar (`azureServices`, `voiceLive`, `crmData`, `hcpProfiles`, `scenarios`, `scoringRubrics`, `materials`, `skillHub`, `prompts`, `dashboard`, `reports`, `users`) is a mix of platform-config-for-everything (Azure services, CRM data, prompts) and coach-specific data (HCP profiles, scenarios, scoring rubrics) — see Open Questions for the scoping decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature-flag delivery from backend to frontend | A new config endpoint, a new React hook, a new context, localStorage-based flags, or a `.env`-read-in-frontend approach | The existing `Settings` → `/config/features` → `useFeatureFlags()` → `ConfigContext` pipeline | It's fully built, tested (`test_config_api.py`), and already the sole flag-delivery mechanism in the app — a second mechanism would create two sources of truth |
| Nav-link visibility guard for E2E tests | New "wait and skip if hidden" helper utilities | The existing `if ((await link.count()) > 0) { ...click... }` idiom already used in `navigation.spec.ts` / `admin-navigation.spec.ts` | Consistency; this idiom is already the codebase's established defensive pattern for optional UI, don't introduce a second style |
| Structural answer/citation separation | A new "response renderer" abstraction | The existing `handleSend` pattern in `avatar-page.tsx` (`data.answer` → transcript state, `data.citations` → `citations` state, never joined) | Already correct and tested; this phase should verify, not rearchitect |

**Key insight:** This phase's entire technical surface is "gate one existing array behind one new existing-pattern flag, and verify one already-mostly-correct page." Any solution that introduces a new state-management library, a new flag-storage mechanism, or a new layout abstraction is over-engineering relative to what's already present.

## Common Pitfalls

### Pitfall 1: `MagicMock()`-based backend test breaks silently when a new Pydantic field is added
**What goes wrong:** `backend/tests/test_config_api.py`'s `test_get_features_with_auth_returns_200` builds `mock_settings = MagicMock()` and explicitly sets each flag attribute (`mock_settings.feature_avatar_enabled = False`, etc.) before patching `get_settings`. If `feature_legacy_coach_nav_enabled` is added to the `FeatureFlags`/`ConfigResponse` Pydantic response model but the test's `MagicMock` is not updated to set that attribute, `MagicMock()` will auto-generate a `Mock` object for the unset attribute, and Pydantic validation of `FeatureFlags(legacy_coach_nav_enabled=<Mock object>)` will raise a validation error (not a silent pass).
**Why it happens:** `MagicMock()` auto-creates attributes on access, but those auto-created attributes are `Mock` instances, not booleans — Pydantic's `bool` field validation rejects them.
**How to avoid:** When adding the new flag field, update `test_config_api.py`'s existing `mock_settings.feature_*` assignment block to also set `mock_settings.feature_legacy_coach_nav_enabled = False` (or `True`, per the specific test's intent) in every test in that file that constructs a full `mock_settings`.
**Warning signs:** `pytest` failure with a Pydantic `ValidationError` mentioning the new field name, pointing at `ConfigResponse(...)` construction in `backend/app/api/config.py`.

### Pitfall 2: Existing unit test asserts unconditional nav rendering — must be deliberately updated, not "kept green by accident"
**What goes wrong:** `frontend/src/components/layouts/user-layout.test.tsx`'s `vi.mock("@/contexts/config-context", ...)` mock currently returns a flags object with no `legacy_coach_nav_enabled` key at all, and the test `"renders all desktop navigation items"` asserts `dashboard`/`training`/`history`/`reports` are always present. Once `UserLayout` is changed to gate `navItems` on `legacy_coach_nav_enabled`, that mocked `useConfig()` will return `undefined` for the new key (falsy) — the gated render becomes `false && ...` — and this **existing** test will fail (nav items won't render).
**Why it happens:** The test's mock predates the flag; JS objects don't require exhaustive keys, so `undefined` is a valid (falsy) return for an unlisted property.
**How to avoid:** This is intentional, in-scope work per CLAUDE.md's "100% unit test coverage per requirement" rule — update the mock to include `legacy_coach_nav_enabled: true` for the existing "shows nav" test, and add a **new** test case with `legacy_coach_nav_enabled: false` asserting the items are *absent* (`queryByText` / `not.toBeInTheDocument()`). Do not treat this as an accidental break to avoid; it is the exact unit-test coverage AVUI-02 requires.
**Warning signs:** `vitest` failure on `expect(screen.getAllByText("dashboard").length).toBeGreaterThanOrEqual(1)` after the `UserLayout` gating change lands, before the test mock is updated.

### Pitfall 3: Guarded vs. unguarded E2E assertions — know which is which before touching any nav array
**What goes wrong:** Assuming "the E2E suite is defensive everywhere" and skipping a spec-by-spec check before hiding a nav link. Verified during this research: `frontend/e2e/voice-live-proxy.spec.ts` line 489 (`"admin sidebar shows Voice Live link"`) is **unguarded** — a direct `toBeVisible()` with no `count() > 0` check. In contrast, `frontend/e2e/navigation.spec.ts`, `frontend/e2e/admin-navigation.spec.ts`, and `frontend/e2e/admin-scoring.spec.ts` consistently guard nav-link clicks with `if ((await link.count()) > 0)`.
**Why it happens:** The guarded pattern was adopted inconsistently across spec files written at different times; it is not a universal rule enforced by lint/CI.
**How to avoid:** Before gating any nav array behind the new flag, `grep -rn "getByRole(\"link\"" frontend/e2e/` for every spec touching that layout, and manually classify each hit as guarded (safe) or unguarded (must stay visible, or the spec must be updated in the same commit). This research's classification for the current codebase (2026-08-02): only `UserLayout`'s `navItems` (dashboard/training/history/reports) are safe to gate today; `AdminLayout`'s sidebar has at least one unguarded dependency (`voiceLiveLink`) and should not be gated by the same flag without first auditing/updating `voice-live-proxy.spec.ts`.
**Warning signs:** A previously-green `npm run test:e2e` run turning a guarded-looking test red — check whether the specific assertion that failed was actually inside the `if` block (safe) or outside it (real break).

### Pitfall 4: "Existing tests continue to work" must be interpreted against the documented 35-test pre-existing-failure baseline, not a hypothetical 100%-green baseline
**What goes wrong:** Treating any red test in a full `npm run test:e2e` run as evidence AVUI-02 broke something.
**Why it happens:** Per `.planning/phases/34-spanish-es-i18n/deferred-items.md`'s addendum (2026-08-02), the full suite currently runs **415 passed / 9 skipped / 35 failed**, and every one of the 35 is independently triaged as pre-existing (stale-mock-data assertions in `admin-users.spec.ts`, `seven-modes.spec.ts`, `coaching-session.spec.ts`, etc., plus 4 real-Azure-connection specs in `voice-live-proxy.spec.ts` that cannot pass without live credentials) — none touch any file Phase 34 modified.
**How to avoid:** Before starting AVUI-02 work, run the full E2E suite once to (re-)capture the current pass/fail baseline (expect ~415/9/35, but re-verify — the number may drift slightly as `main` moves). After AVUI-02 changes, the delta must be **zero newly-failing tests** relative to that fresh baseline, not "35 or fewer failures." Any test that flips from pass→fail specifically because of a nav-hiding change is this phase's responsibility to fix or the phase's scope to narrow — any test that was already in the 35 stays out of scope (do not attempt to fix stale-mock-data or real-Azure specs as a side effect of this phase, per CLAUDE.md's one-requirement-at-a-time rule).
**Warning signs:** A verification report that says "35 tests still failing" without diffing *which* 35 against the pre-change baseline list.

### Pitfall 5: FastAPI trailing-slash 307 auth-loss bug (pre-existing gotcha, relevant if adding any new route)
**What goes wrong:** Registering a new backend route with a trailing slash (`@router.get("/")`) instead of empty string (`@router.get("")`) causes a 307 redirect that strips the `Authorization` header, triggering the frontend's 401 interceptor to clear auth and redirect to `/login`.
**Why it happens:** Documented in `frontend/e2e/admin-navigation.spec.ts`'s own docstring as a previously-fixed regression; also CLAUDE.md Gotcha #3 territory (route ordering) and Gotcha #6 (CORS/auth interplay).
**How to avoid:** This phase is not expected to add new backend routes (the flag is read-only via the existing `/config/features` endpoint), but if any admin UI toggle for the flag is added later, follow the existing `@router.get("")`/`@router.put("")` convention used throughout `backend/app/api/`.
**Warning signs:** A new admin page silently losing auth and bouncing to `/login` after a save action.

## Code Examples

### The exact nav array to gate (AVUI-02 target)
```typescript
// Source: frontend/src/components/layouts/user-layout.tsx (verified read, lines 36-41)
const navItems = [
  { path: "/user/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { path: "/user/training", labelKey: "training", icon: GraduationCap },
  { path: "/user/history", labelKey: "history", icon: History },
  { path: "/user/reports", labelKey: "reports", icon: BarChart },
] as const;
```
This array is rendered twice in the same file: once in the desktop `<nav>` (line 85) and once in the mobile `Sheet`'s `<nav>` (line 156). Both render sites must be gated together — gating only one leaves a mobile/desktop inconsistency.

### The existing guarded-click idiom to preserve (do not replace with a different pattern)
```typescript
// Source: frontend/e2e/navigation.spec.ts, lines 18-22 (verified read)
const dashboardLink = page.getByRole("link", { name: /dashboard/i });
if ((await dashboardLink.count()) > 0) {
  await dashboardLink.first().click();
  await expect(page).toHaveURL(/\/user\/dashboard/);
}
```

### The existing structural-separation contract to preserve in AvatarPage (do not merge these two state updates)
```typescript
// Source: frontend/src/pages/avatar-page.tsx, handleSend (lines 208-227, verified read)
chatMutation.mutate(message, {
  onSuccess: (data: ChatResponse) => {
    const assistantSegment: TranscriptSegment = {
      ...
      // Structural separation: ONLY the answer text goes into the
      // transcript bubble -- never citation title/url.
      content: data.answer,
      ...
    };
    setTranscript((prev) => [...prev, assistantSegment]);
    ...
    setCitations(data.citations);
  },
});
```

## Runtime State Inventory

Not applicable — this is a UI-visibility/feature-flag phase, not a rename/refactor/migration phase. No stored data, live-service config, OS-registered state, secrets, or build artifacts reference "coach nav" or "avatar UI" by name in a way that a code-only change would leave stale. `[VERIFIED: codebase — no data model, migration, or external-service config touches this phase's surface]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AVUI-02's "旧 coach 功能导航入口" scope is limited to `UserLayout`'s top nav (dashboard/training/history/reports) and does **not** include `AdminLayout`'s sidebar | Architecture Patterns → Anti-Patterns; Open Questions | If the intended scope is broader (e.g., also hiding coach-specific admin sidebar items like HCP Profiles/Scenarios/Scoring Rubrics), the plan under-delivers on AVUI-02 and a follow-up phase/plan-check correction is needed. No CONTEXT.md exists for this phase yet to confirm — flagging for discuss-phase or planner discretion. |
| A2 | Post-login redirect targets (`/user/dashboard`, `/admin/dashboard` in `GuestRoute`/`login.tsx`) should remain unchanged in this phase | Architecture Patterns → Anti-Patterns | If a future decision wants logged-in personalized-avatar users to land on `/` instead, this phase's minimal-diff approach would need revisiting alongside `routing.spec.ts` updates. Low risk since AVUI-02's literal wording doesn't require this. |
| A3 | No admin-facing UI toggle for the new flag is needed this phase (env-var/Settings-only is sufficient, following the `feature_conference_enabled` precedent which also has no DB/admin-UI override) | Standard Stack; Common Pitfalls | If the user/PM expects an in-app admin toggle (like the `azure_avatar`/DB-backed flags), this phase's scope is smaller than expected and would need a follow-up plan for the settings.tsx UI + i18n strings across 5 locales. |

**If confirming A1 with the user/discuss-phase is not possible before planning**, the RECOMMENDED default is: gate `UserLayout` only, leave `AdminLayout` untouched, and log the admin-sidebar question as a phase-level open item for CLEAN-01 (the future "delete coach code" milestone) rather than attempting a partial admin hide now.

## Open Questions

1. **Does AVUI-02's "旧 coach 功能导航入口" include `AdminLayout`'s coach-specific sidebar items (HCP Profiles, Scenarios, Scoring Rubrics, Skill Hub), or only `UserLayout`'s top nav?**
   - What we know: `UserLayout`'s 4 nav items (dashboard/training/history/reports) are unambiguously "coach" (HCP-roleplay training flow) reachable by regular end users — the phase's stated goal ("avatar experience presents a decluttered UI") most directly targets what a non-admin user sees. `AdminLayout`'s sidebar mixes coach-specific admin data (HCP Profiles, Scenarios, Scoring Rubrics) with platform-wide config needed by the *new* avatar features too (Azure Services, CRM Data, Voice Live, Prompts) — several of which existing E2E tests (`voice-live-proxy.spec.ts`) unguardedly assert must stay visible.
   - What's unclear: Whether the requirement's success criteria (roadmap: "Users no longer see legacy coach navigation entries in the app nav") intends "app nav" to include the admin operator's sidebar, which is arguably not something end-users (the requirement's stated audience) ever see anyway (admin-only, role-gated).
   - Recommendation: Default to `UserLayout`-only scope (Assumption A1). This is the minimal-risk interpretation, is fully supported by every success criterion's wording ("Users no longer see... in the app nav" — end users don't have admin access), and avoids the one confirmed unguarded-test conflict. Confirm with the user during `/gsd-discuss-phase` or note it as a plan-check flag if that step is skipped.

2. **Should there be an admin-configurable UI toggle for the new flag, or is a `Settings` env var (redeploy-to-change) sufficient for this POC phase?**
   - What we know: The codebase has precedent for both patterns — env-only (`feature_conference_enabled`, no DB override) and DB/admin-UI-configurable (`azure_avatar`, `azure_speech_stt`, etc., toggled via the admin Azure-config pages). Adding an admin UI toggle would require new i18n strings in `admin.json` across 5 locales (feasible, not blocked by the 15/15 untranslated-whitelist cap since a normal phrase like "Show Legacy Coach Navigation" is genuinely translatable, not a bare-cognate collision).
   - What's unclear: Whether this POC-stage phase needs runtime toggle-ability without a backend redeploy, or whether a one-time env var flip (matching how `feature_conference_enabled` already works) is acceptable.
   - Recommendation: Default to env-var-only (Assumption A3) for this phase — simpler, zero new i18n surface, consistent with the `feature_conference_enabled` precedent for a flag that isn't tied to an Azure service's live availability. Revisit if the user wants admin self-service control.

3. **Does `AvatarPage`'s header title (`t("sourcesPanel.title")` used as the page's leading label) need correction, or is reusing the Sources-panel translation key intentional?**
   - What we know: Line 257 of `avatar-page.tsx` renders `<span className="text-sm font-semibold">{t("sourcesPanel.title")}</span>` as the header's leading text — this is the *sources panel's own* title key ("Sources" or similar), not a distinct "page title"/brand key.
   - What's unclear: Whether this was intentional minimalism (no separate branded page title needed) or an unnoticed copy-paste from `SourcesPanel`'s own `<h2>{t("sourcesPanel.title")}</h2>` (line 46 of `sources-panel.tsx`).
   - Recommendation: Low-priority cosmetic check during AVUI-01 polish; not blocking. If changed, it's a one-line i18n-key swap with no test impact (no test currently asserts on this exact header text-content by string match, per `avatar-page.test.tsx`'s test list).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 8.3.0+ / pytest-asyncio (asyncio_mode=auto), config in `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Backend coverage gate | `--cov=app --cov-fail-under=89` (existing `addopts`, not this phase's to raise) |
| Frontend unit framework | vitest ^3.2.4, `npm run test` (backend `test:coverage` for coverage) |
| E2E framework | Playwright ^1.48.0, config `frontend/playwright.config.ts` / `e2e/playwright.config.ts`, run via `npm run test:e2e` |
| Quick backend run | `cd backend && pytest tests/test_config_api.py tests/test_config_service.py -v` |
| Quick frontend run | `cd frontend && npx vitest run src/components/layouts/user-layout.test.tsx src/contexts/config-context.test.tsx` |
| Full backend suite | `cd backend && pytest -v` |
| Full frontend suite | `cd frontend && npm run test && npm run build && npx tsc -b` |
| Full E2E suite | `cd frontend && npm run test:e2e` (expect baseline ~415 passed / 9 skipped / ~35 pre-existing failures — re-verify fresh before starting, per Pitfall 4) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AVUI-02 | `GET /config/features` returns new `legacy_coach_nav_enabled` field reflecting `Settings` | unit (backend) | `pytest backend/tests/test_config_api.py -k test_get_features -x` | ✅ file exists, needs new assertion + mock update (Pitfall 1) |
| AVUI-02 | `UserLayout` renders nav items when flag is `true`, hides them when `false` | unit (frontend) | `npx vitest run frontend/src/components/layouts/user-layout.test.tsx` | ✅ file exists, needs mock update + new test case (Pitfall 2) |
| AVUI-02 | Hiding nav does not break existing guarded nav-click E2E specs | E2E (regression) | `npx playwright test navigation.spec.ts admin-navigation.spec.ts --config=e2e/playwright.config.ts` | ✅ files exist, expected to stay green unmodified per Pitfall 3's classification |
| AVUI-02 | Underlying coach routes remain reachable by direct URL regardless of flag | E2E | `npx playwright test routing.spec.ts --config=e2e/playwright.config.ts` | ✅ exists, must stay green with zero changes |
| AVUI-01 | Avatar page renders only digital human + input + transcript + sources panel, no coach chrome | E2E (new assertion recommended) | New test or extension of `anonymous-avatar-qa.spec.ts`: `await expect(page.locator("nav")).toHaveCount(0)` on `/` | ❌ Wave 0 gap — no current test asserts chrome-absence explicitly |
| AVUI-01 | Answer/citation structural separation (regression guard) | unit + E2E | `npx vitest run frontend/src/pages/avatar-page.test.tsx`; `npx playwright test anonymous-avatar-qa.spec.ts personalized-avatar-qa.spec.ts` | ✅ already exists and passes today — verify only |

### Sampling Rate
- **Per task commit:** relevant unit test file(s) for the file(s) touched (e.g. `npx vitest run src/components/layouts/user-layout.test.tsx`)
- **Per wave merge:** full frontend unit suite + full backend suite + the specific E2E spec files listed above (not the full E2E suite, to keep iteration fast)
- **Phase gate:** Full E2E suite (`npm run test:e2e`), diffed against the pre-change baseline (Pitfall 4) — zero *new* failures required, pre-existing 35 are out of scope to fix here

### Wave 0 Gaps
- [ ] New E2E assertion for AVUI-01 "no coach chrome on `/`" — add to `frontend/e2e/anonymous-avatar-qa.spec.ts` or a new `avatar-ui-clean.spec.ts`
- [ ] `backend/tests/test_config_api.py` — every test constructing a full `mock_settings` needs `feature_legacy_coach_nav_enabled` added once the field exists (Pitfall 1)
- [ ] `frontend/src/components/layouts/user-layout.test.tsx` — mock update + new "hidden when flag false" test case (Pitfall 2)
- [ ] Pre-change E2E baseline capture (`npm run test:e2e` once, before any code change, to confirm current ~415/9/35 split hasn't drifted since 2026-08-01)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing JWT bearer auth (`python-jose` + `passlib[bcrypt]`) — this phase touches nothing here |
| V3 Session Management | no (unchanged) | N/A |
| V4 Access Control | **yes — but as a negative/clarifying control** | The new flag is **UI-visibility only**. It must NOT be implemented as, or mistaken for, an access-control boundary. The real authorization boundary for coach routes remains `ProtectedRoute`/`AdminRoute` (`frontend/src/router/auth-guard.tsx`) and backend `get_current_user`/`require_role()` dependencies — both explicitly unchanged and untouched by this phase. Hiding a nav *link* does not and must not restrict the underlying *route*; AVUI-02 explicitly requires routes to remain reachable ("代码与路由保留"). |
| V5 Input Validation | no new input surface | The flag is a static boolean read from `Settings`/env, no user-supplied value |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for {this phase's stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Security-through-obscurity misconception (hiding a nav link ≠ removing access) | Elevation of Privilege (if misapplied) | Document explicitly (as above) that this flag is cosmetic; any actual access restriction, should it ever be desired, must go through the existing `ProtectedRoute`/`AdminRoute`/`require_role()` guards, not the nav-visibility flag. No code change needed here beyond not conflating the two. |
| `/config/features` endpoint already requires auth (`get_current_user`) | Information Disclosure | Already mitigated — unauthenticated/anonymous avatar visitors never see any flag payload (`useFeatureFlags(isAuthenticated)` has `enabled: isAuthenticated`, and anonymous users get client-side `defaultFlags` only). No change needed; verify this remains true after adding the new field. |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `frontend/src/pages/avatar-page.tsx` (339 lines, full read) — AVUI-01 baseline structure
- `frontend/src/pages/avatar-page.test.tsx` (test names enumerated, ~40 tests) — existing AVUI-01/ANON-03/PERS-02 coverage
- `frontend/src/components/avatar/sources-panel.tsx` (full read) — structural-separation implementation
- `frontend/src/components/layouts/user-layout.tsx` (full read) — AVUI-02 target nav array
- `frontend/src/components/layouts/admin-layout.tsx` (full read) — AdminLayout sidebar composition, out-of-scope analysis
- `frontend/src/components/layouts/user-layout.test.tsx` (full read) — Pitfall 2 evidence
- `frontend/src/router/index.tsx` (full read) — route tree, confirms `AvatarPage` is standalone
- `frontend/src/router/auth-guard.tsx` (full read) — `GuestRoute`/`ProtectedRoute`/`AdminRoute` redirect targets
- `frontend/src/pages/login.tsx` (grep) — post-login `navigate()` targets
- `frontend/src/contexts/config-context.tsx`, `frontend/src/hooks/use-config.ts`, `frontend/src/types/config.ts` (full reads) — existing flag pipeline
- `backend/app/config.py`, `backend/app/api/config.py` (full reads) — existing `feature_*_enabled` pattern
- `backend/tests/test_config_api.py` (partial read) — Pitfall 1 evidence
- `frontend/e2e/navigation.spec.ts`, `frontend/e2e/admin-navigation.spec.ts`, `frontend/e2e/routing.spec.ts`, `frontend/e2e/voice-live-proxy.spec.ts` (targeted reads/greps) — guarded-vs-unguarded classification (Pitfall 3, Anti-Patterns)
- `frontend/e2e/training-session.spec.ts`, `frontend/e2e/admin-scoring.spec.ts`, `frontend/e2e/anonymous-avatar-qa.spec.ts` (targeted reads) — additional guard-pattern confirmation and AVUI-01 E2E coverage baseline
- `.planning/phases/34-spanish-es-i18n/deferred-items.md` (full read) — pre-existing 35-failure E2E baseline, Pitfall 4
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (full/targeted reads) — requirement text, phase goal, prior decisions
- `.planning/config.json` (full read) — `nyquist_validation: true`, no `security_enforcement` key (treated as enabled)
- `backend/pyproject.toml` (targeted read) — pytest config confirmation
- `frontend/package.json` (targeted read) — vitest/Playwright script confirmation

### Secondary (MEDIUM confidence)
- None — no WebSearch/Context7 lookups were needed; this phase's entire technical surface is internal to the already-read codebase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, 100% verified by direct file reads of the exact versions/config already in use
- Architecture: HIGH — every claim about existing structure (route tree, layout composition, flag pipeline) is a direct file read, not inference
- Pitfalls: HIGH — every pitfall is grounded in a specific file/line read this session (test mock patterns, guard idioms, the one unguarded E2E assertion found)
- Open questions (admin-sidebar scope, toggle UI vs. env-var): MEDIUM — these are genuine interpretation gaps in the requirement text, not knowledge gaps; recommendations are given but need discuss-phase/user confirmation for full confidence

**Research date:** 2026-08-02
**Valid until:** 30 days (stable — internal codebase research, not dependent on external library release cadence; re-verify the E2E baseline (Pitfall 4) immediately before execution regardless, since it can drift with any intervening `main` commit)
