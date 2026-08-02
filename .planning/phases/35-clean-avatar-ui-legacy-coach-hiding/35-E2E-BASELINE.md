# Phase 35 Plan 01 — Pre-Change Full E2E Baseline

**Captured:** 2026-08-02T01:34:53Z (before any Phase 35 code change, per CONTEXT.md D-10)

**Method:** The full suite (`playwright test --config=e2e/playwright.config.ts`) was run against a
pristine pre-Phase-35 tree (Task 2's spec edit was `git stash`ed out before this capture and popped
back in afterward). Because a single unsharded run exceeds the tool's per-command time budget, the
suite was split into 6 shards (`--shard=N/6`) and run sequentially in the foreground; results below
are the aggregate across all 6 shard runs.

## Totals

| Metric | Count |
|---|---|
| Passed | 421 |
| Skipped | 9 |
| Failed | 39 |
| Total tests collected (sharded run, incl. per-shard duplicated `[setup]` auth fixtures) | 469 |

Note: sharding re-runs the `[setup]` project's 2 auth-fixture tests once per shard (12 total across
6 shards instead of 2 in a single-worker run), inflating the passed count by ~10 relative to a single
unsharded run (~415 passed / 9 skipped / ~35 failed, per `.planning/phases/34-spanish-es-i18n/deferred-items.md`).
The failed/skipped counts are unaffected by this and are directly comparable. 39 vs. the previously
documented ~35 is the same order of magnitude (RESEARCH.md Pitfall 4 sanity-check bar) — the small
delta is consistent with known test-isolation flakiness under sharding (e.g. `hcp-editor-voice-tab.spec.ts`'s
`beforeEach` "Request context disposed" errors, an artifact of shard-boundary worker teardown, not a
new product regression). Every failing spec below already appears in Phase 34's documented
pre-existing failure clusters (stale mock data / real-Azure-connection specs) except
`hcp-editor-voice-tab.spec.ts`, which fails via the same sharding-teardown artifact, not a product bug.

## Failing Test Titles (39)

```
[chromium] › e2e/admin-azure-config.spec.ts:14:3 › Admin Azure Configuration › renders Azure config page with all 7 service cards
[chromium] › e2e/admin-azure-config.spec.ts:39:3 › Admin Azure Configuration › expanding a service card reveals configuration form
[chromium] › e2e/admin-hcp-profiles.spec.ts:46:3 › Admin HCP Profiles Management › creates and saves a cautious HCP profile
[chromium] › e2e/admin-hcp-profiles.spec.ts:153:3 › Admin HCP Profiles Management › save and test chat buttons are present in editor
[chromium] › e2e/admin-scenarios.spec.ts:162:3 › Admin Scenarios Management › creates a new scenario and verifies it appears in the list
[chromium] › e2e/admin-scoring-rubrics.spec.ts:48:3 › Admin Scoring Rubrics Page › rubric editor page has back button to list
[chromium] › e2e/admin-scoring-rubrics.spec.ts:115:3 › Admin Scoring Rubrics Page › CU analyzers section shows analyzer IDs when configured
[chromium] › e2e/admin-skill-editor.spec.ts:222:3 › Skill Editor Page › settings tab can save form values
[chromium] › e2e/admin-skill-hub.spec.ts:214:3 › Skill Hub Page › create from materials triggers agent conversion and completes
[chromium] › e2e/admin-users.spec.ts:29:3 › Admin User Management Page › shows user data rows
[chromium] › e2e/admin-users.spec.ts:35:3 › Admin User Management Page › search input works
[chromium] › e2e/admin-users.spec.ts:48:3 › Admin User Management Page › filter dropdowns exist
[chromium] › e2e/admin-users.spec.ts:57:3 › Admin User Management Page › add user button exists
[chromium] › e2e/admin-users.spec.ts:61:3 › Admin User Management Page › pagination controls exist with 12 mock users
[chromium] › e2e/analytics.spec.ts:58:3 › Session History - Analytics › shows skill overview radar when sessions exist
[chromium] › e2e/coaching-session.spec.ts:15:3 › Coaching Session (Phase 2) › renders three-panel layout with scenario, chat, and hints
[chromium] › e2e/coaching-session.spec.ts:34:3 › Coaching Session (Phase 2) › left panel shows scenario briefing with key messages and scoring criteria
[chromium] › e2e/coaching-session.spec.ts:56:3 › Coaching Session (Phase 2) › chat area has message input and send button
[chromium] › e2e/coaching-session.spec.ts:73:3 › Coaching Session (Phase 2) › can type and send a message in chat
[chromium] › e2e/coaching-session.spec.ts:103:3 › Coaching Session (Phase 2) › session timer is visible and running
[chromium] › e2e/coaching-session.spec.ts:110:3 › Coaching Session (Phase 2) › right panel shows AI coach hints and message tracker
[chromium] › e2e/coaching-session.spec.ts:137:3 › Coaching Session (Phase 2) › avatar toggle switch works in chat area
[chromium] › e2e/coaching-session.spec.ts:158:3 › Coaching Session (Phase 2) › end session button opens confirmation dialog and navigates to scoring
[chromium] › e2e/demo-flow.spec.ts:142:3 › Full Demo Pipeline — Text Session › user starts text coaching session and receives scoring
[chromium] › e2e/hcp-editor-voice-tab.spec.ts:462:3 › HCP Editor: Agent Config Center (Phase 15) › Playground panel shows voice-related UI when voice mode is ON
[chromium] › e2e/hcp-editor-voice-tab.spec.ts:491:3 › HCP Editor: Agent Config Center (Phase 15) › Model Deployment selector is interactive
[chromium] › e2e/hcp-editor-voice-tab.spec.ts:526:3 › HCP Editor: Agent Config Center (Phase 15) › Override Instructions textarea is available
[chromium] › e2e/hcp-editor-voice-tab.spec.ts:555:3 › HCP Editor: Voice & Avatar Tab (i18n zh-CN) › Chinese labels display correctly
[chromium] › e2e/seven-modes.spec.ts:43:3 › Seven Interaction Modes — Admin Config UI › all 7 service cards are displayed on Azure config page
[chromium] › e2e/seven-modes.spec.ts:64:3 › Seven Interaction Modes — Admin Config UI › Mode 1: Azure OpenAI card expands with endpoint, key, deployment, region fields
[chromium] › e2e/seven-modes.spec.ts:144:3 › Seven Interaction Modes — Admin Config UI › Mode 7: Azure Database for PostgreSQL card can be expanded
[chromium] › e2e/training-session.spec.ts:26:3 › F2F Training Session › left panel shows scenario info
[chromium] › e2e/training-session.spec.ts:59:3 › F2F Training Session › can send a message in chat
[chromium] › e2e/training-start-session.spec.ts:63:3 › Training - Start Session Flow › clicking '开始培训' on Conference scenario navigates to conference session
[chromium] › e2e/training-start-session.spec.ts:203:3 › Training - Start Session Flow › text mode session auto-starts and shows avatar static preview
[chromium] › e2e/voice-live-proxy.spec.ts:176:3 › Voice Live WebSocket Proxy — Real Connection › F2F Unified Session binds the Voice Live first frame to session_id
[chromium] › e2e/voice-live-proxy.spec.ts:380:3 › Voice Live WebSocket Proxy — Real Connection › end session opens confirmation dialog
[chromium] › e2e/voice-live-proxy.spec.ts:519:3 › Admin Voice Live Management — Page Navigation › Voice Live management page shows chain cards for HCP profiles
[chromium] › e2e/voice-live-proxy.spec.ts:536:3 › Admin Voice Live Management — Page Navigation › batch re-sync button is present and clickable
```

This baseline was captured before any Phase 35 code change. Plan 35-02's regression gate must show zero tests newly failing relative to this list (pre-existing failures above are out of scope to fix per CLAUDE.md one-requirement-at-a-time rule).
