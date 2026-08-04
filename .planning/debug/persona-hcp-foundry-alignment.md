---
status: awaiting_human_verify
trigger: "Investigate issue: persona-hcp-foundry-alignment — Avatar Persona admin page still not aligned with HCP profile page and Azure AI Foundry portal design. Three gaps: (1) Foundry-portal voice-mode layout parity (gear Configure button opening right-side Configuration panel) on BOTH HCP and Persona pages; (2) Persona editor missing Foundry features HCP has (Knowledge/Foundry IQ); (3) Persona must be a real Foundry agent, synced like HCP (Agent Synced card, Agent ID, version, Force re-sync, View in Azure Portal)."
created: 2026-08-04T00:00:00Z
updated: 2026-08-04T22:35:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED for all 3 gaps (see Resolution). All 4 increments (A/B/C/D) implemented,
gated, and committed. Perf follow-up (non-blocking Foundry sync) also implemented, gated, and
verified. Awaiting human browser verification before final archive.
test: n/a — implementation complete, awaiting human sign-off.
expecting: n/a
next_action: |
  All 4 increments DONE:
    Increment A (commit cc8a962) — backend Foundry agent sync fields/hooks/routes for AvatarPersona.
    Increment B (commit fb7e9ef) — frontend AgentStatusSection rendering for personas.
    Increment C (commit 41699ab) — backend + frontend Knowledge/Foundry IQ for personas.
    Increment D (this commit) — shared <ConfigurationPanel> gear-button pattern wired into both
      voice-avatar-tab.tsx (HCP) and persona-editor.tsx (Persona); unit tests for both plus a new
      configuration-panel.test.tsx (25 tests); 3 Playwright specs rewritten
      (hcp-editor-voice-tab.spec.ts, admin-avatar-personas.spec.ts, admin-persona-knowledge.spec.ts)
      to open the gear panel before interacting with the fields it now contains; 2 pre-existing
      real-Foundry-sync-latency test timeouts (in admin-avatar-personas.spec.ts, touched by this
      increment's createPersonaViaUi rewrite) fixed by extending test.setTimeout, matching the
      pattern already used elsewhere for the same root cause. All gates green (tsc, build, vitest,
      full E2E re-runs — see Resolution.verification).
  Perf follow-up DONE (not yet committed): made the ~14s+ Foundry sync non-blocking on all 4
    persona trigger points (create/update/retry-sync/KB-resync) — see Resolution.fix's "Perf
    follow-up" entry and Evidence 2026-08-04T22:30:00Z for full gate verification. Remaining
    step: create the single commit for this follow-up
    (`perf(persona): make Foundry agent sync non-blocking on persona create/update`), do not push.
  Awaiting the user's own browser walkthrough to confirm the gear->Configuration-panel pattern
  looks and behaves correctly on both pages before archiving this session to resolved/.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: (a) HCP editor and Persona editor both follow the Foundry-portal voice-mode pattern: Voice mode toggle in the left/main config; avatar + voice + language + speech settings inside a right-side "Configuration" panel opened via a gear Configure button in the preview/chat toolbar. (b) Persona editor has the same Foundry sections as HCP (Instructions, Knowledge/Foundry IQ, etc.). (c) Persona entities are backed by real Foundry prompt agents with a sync card (Agent Synced status, Agent ID, version, Force re-sync, View in Azure Portal) exactly like the HCP page's "AI Foundry Agent" card.
actual: Persona editor diverges from HCP editor — no Foundry IQ / Knowledge, no Foundry agent sync, and the avatar/voice/language config layout does not match the Foundry-portal gear-button->Configuration-panel pattern. HCP page may also not fully match the gear-button pattern.
errors: None — design/feature misalignment, not a crash.
reproduction: Open frontend dev server; compare /admin/avatar-personas persona editor and the HCP profile editor (语音和数字人 tab) against the Azure Foundry agent playground design described in the objective.
started: Longstanding. Phase 38 (2026-08-04) explicitly deferred the Foundry-agent-sync / Knowledge-IQ / gear-Configure-panel work to "Future Requirements" per a same-day user rescope — that decision is now overruled by the user.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-04T00:05:00Z
  checked: .planning/debug/avatar-persona-voice-mode-config.md (prior resolved debug session)
  found: Round 2 of that session explicitly investigated Knowledge/Foundry-IQ attachment for personas and found `HcpKnowledgeConfig.hcp_profile_id` is a hard `ForeignKey("hcp_profiles.id", ondelete="CASCADE")` — structurally HCP-specific, not reusable for personas without a new table/schema/migration. Also found `playground-preview-panel.tsx` requires either `vlInstanceId` or `agentId` to enable a live Start-test button — AvatarPersona has neither. Session was archived WITHOUT human browser verification per user's "不想验证了" directive.
  implication: Confirms gap #2 and #3 (persona has no Foundry agent identity at all, and no knowledge-attach capability) were known and consciously left unfixed, on the premise it required "significant new backend work" — which the user is now explicitly asking for.

- timestamp: 2026-08-04T00:10:00Z
  checked: .planning/phases/38-voice-mode-config-foundry-portal/38-CONTEXT.md (rescope decision) + 38-VERIFICATION.md
  found: User's exact rescope statement (2026-08-04): "我说了只需要把这个图片对应的 voice instance 换成最新ai foundary portal的" — scope was narrowed to ONLY replacing the Voice-Live-Instance selector card with direct Foundry-style fields (model/language/voice/avatar gallery), rendered flatly inline in `agent-config-left-panel.tsx` for HCP and mirrored in `persona-editor.tsx` for personas. Deferred list explicitly includes: PEDIT-01 (Foundry agent sync + status panel: Agent Synced/Agent ID/Force re-sync/View in Azure Portal), PEDIT-02 (persona knowledge base/Foundry IQ attach), PEDIT-04 (auto-instructions), PEDIT-05 (workbench live test), PEDIT-06 (voice/language linkage), BRAND-01 (rebrand). Verification report (passed 4/4) confirms current implementation is a flat card list — NO gear "Configure" button, NO collapsible right-side "Configuration" panel exists anywhere in the codebase for either HCP or Persona pages; all fields render always-visible in `agent-config-left-panel.tsx`.
  implication: All three gaps in the current objective (gear-button/Configuration-panel pattern, persona Foundry-IQ, persona Foundry-agent-sync) were deliberately out of scope for Phase 38 by explicit user request THAT SAME DAY, and are now being reversed. This is a scope reversal, not a bug — the fix requires genuinely new work (UI restructure + backend agent-sync-for-personas), not just uncovering a hidden defect.

- timestamp: 2026-08-04T00:15:00Z
  checked: frontend/src/components/admin/agent-config-left-panel.tsx (current HCP left panel, post-Phase-38) and playground-preview-panel.tsx (current HCP right panel)
  found: Left panel renders 4 always-visible `<Card>`s stacked vertically: (1) Voice & Avatar Config [model/language/voice/avatar-toggle/gallery — VMODE-01], (2) a separate/duplicate Agent Foundation Model card, (3) InstructionsSection, (4) a collapsible (chevron-click, not gear-button) "Knowledge & Tools" card with a working "Add Knowledge Base" button + list + a `# Tools placeholder` decorative stub. Right panel (`PlaygroundPreviewPanel`) has NO gear icon and NO "Configuration" slide-out/panel of any kind — it is either `VoiceTestPlayground` (voice mode) or an inline text-chat Card (voice mode off). No mic+Start bar with a gear button anywhere in the codebase.
  implication: Gap #1 (Foundry-portal gear-button -> right-side Configuration-panel pattern) is 100% unimplemented for HCP, not just Persona — confirms the user's own observation ("现在hcp 页面和persona 都和这个保持一致"). This is a net-new interaction pattern requiring a new shared component (e.g. `<ConfigurationPanel>` triggered by a gear `Button` in the playground toolbar), not a tweak.

- timestamp: 2026-08-04T00:20:00Z
  checked: frontend/src/components/admin/agent-status-section.tsx (the HCP "AI Foundry Agent" sync card) + backend/app/services/agent_sync_service.py + backend/app/services/hcp_profile_service.py::retry_agent_sync + backend/app/models/hcp_profile.py (agent_id/agent_version/agent_sync_status/agent_sync_error columns) + backend/app/models/avatar_persona.py
  found: `AgentStatusSection` renders exactly the card described in the objective (Agent Synced/Pending/Failed/None status with icon+color, Agent ID, Agent Version, error box, Force re-sync / Retry button, View in Azure Portal link via `getAgentPortalUrl`, Created/Updated timestamps). It is driven entirely by 4 generic `HcpProfile` columns (`agent_id`, `agent_version`, `agent_sync_status`, `agent_sync_error`) and one generic backend function, `agent_sync_service.sync_agent_for_profile(db, profile, ...)`, which only requires `profile.agent_id`, `profile.name`, `profile.id`, and `profile.to_prompt_dict()` (used by `build_agent_instructions`) — it takes `profile: object`, not `profile: HcpProfile`, i.e. it is already provider-agnostic in its type signature. `AvatarPersona` (backend/app/models/avatar_persona.py) has ZERO of the 4 sync columns and no `to_prompt_dict()` method.
  implication: Gap #3 (persona Foundry agent sync) is a real, well-scoped, and importantly ALREADY-GENERALIZED backend gap: `sync_agent_for_profile`/`create_agent`/`update_agent`/`get_agent_latest_version`/`get_portal_url_components` need zero modification to work for personas. What's missing is (a) an Alembic migration adding `agent_id`/`agent_version`/`agent_sync_status`/`agent_sync_error` to `avatar_personas`, (b) `AvatarPersona.to_prompt_dict()` returning `{"name": persona.name, "agent_instructions_override": persona.prompt_fragment}` (the override branch in `build_agent_instructions` — line 67-69 of agent_sync_service.py — already short-circuits to return this verbatim, so persona instructions = prompt_fragment with zero template work needed), (c) a `retry_agent_sync`/create/update hook in `avatar_persona_service.py` mirroring `hcp_profile_service.py`'s pattern, (d) a `get_agent_portal_url` API route for personas, (e) reusing `AgentStatusSection` as-is (it already takes a generically-shaped object — verify prop typing) or a thin persona variant.
  implication_2: One structural mismatch: `build_voice_live_metadata(profile)` calls `resolve_voice_config(profile)` which reads HCP's single-value inline columns (`voice_name`, `recognition_language`, `avatar_character`, `avatar_style`, `avatar_enabled`, `voice_live_model` — added in Phase 38's VMODE-01 migration). `AvatarPersona` instead stores `voice_map`/`greeting_map` as per-locale JSON dicts (5 locales) with no single "active" voice/language column. Directly reusing `build_voice_live_metadata` for personas is NOT a drop-in — needs either (i) a persona-side adapter that picks one representative locale's voice for the Foundry agent metadata (acceptable since Foundry agent metadata is a secondary/informational channel; actual persona voice selection at runtime already flows through Phase 36/37's own direct session-config wiring, not through Foundry agent metadata), or (ii) skip voice-live metadata sync for persona agents entirely (agent = instructions + tools only, which still satisfies gap #3's "Agent Synced/ID/version/re-sync/portal-link" requirement).

- timestamp: 2026-08-04T00:25:00Z
  checked: backend/app/models/hcp_knowledge_config.py + backend/app/services/knowledge_base_service.py (get_knowledge_configs, add_knowledge_config, _trigger_agent_resync, build_search_tools)
  found: `HcpKnowledgeConfig.hcp_profile_id` is a NOT-NULL `ForeignKey("hcp_profiles.id", ondelete="CASCADE")` with a `relationship("HcpProfile", back_populates="knowledge_configs")` — hard-typed to HCP at the DB, ORM, and service-function-signature level (`get_knowledge_configs(db, hcp_profile_id: str)`, `_trigger_agent_resync(db, hcp_profile_id: str)` which re-queries `HcpProfile` directly by that id). `ConnectKbDialog` (frontend) takes a `hcpId` prop.
  implication: Confirms gap #2 (persona Knowledge/Foundry-IQ) requires real new backend work: either (a) a new sibling table `AvatarPersonaKnowledgeConfig` + a generalized/duplicated service module (fastest, safest — no risk to HCP's existing FK/CASCADE semantics), or (b) migrating `HcpKnowledgeConfig` to a polymorphic `owner_type`/`owner_id` shape (touches every existing HCP knowledge-base code path — higher risk). Given CLAUDE.md's "never modify schema without migration" + "no raw SQL" rules and the existing precedent of duplicating rather than risking shared FKs (the codebase already duplicates AgentStatusSection-style patterns per-domain rather than sharing polymorphic tables), option (a) is the lower-risk path.

- timestamp: 2026-08-04T19:45:00Z
  checked: Local dev SQLite `backend/ai_coach.db` via `alembic current`, direct `curl` POST to
  `/admin/avatar-personas` while running the app through the correct project `.venv`, and the
  uvicorn traceback captured by running it in the foreground.
  found: The Playwright E2E for Increment C's new Knowledge section timed out because persona
  creation returned HTTP 500. Root cause was environmental, not a code defect: the local dev
  database file was stamped at revision `g40a_add_hcp_direct_voice_config` — TWO migrations
  behind head (`h41a_add_persona_agent_sync_fields`, `i42a_add_persona_knowledge_configs` had
  never been applied to this file), because nobody had run `alembic upgrade head` locally since
  Increment A introduced h41a. `avatar_personas` was missing the `agent_id` column entirely,
  causing every create/update to 500 at the INSERT. Running `alembic upgrade head` applied h41a
  cleanly; i42a then hit "table avatar_persona_knowledge_configs already exists" because the
  app's own `Base.metadata.create_all()` startup step had already created that brand-new table
  (create_all can add new tables but never ALTERs existing ones) — verified the existing table's
  columns exactly matched the migration's target schema via `PRAGMA table_info`, then used
  `alembic stamp head` (not a second CREATE TABLE) to reconcile the version pointer without
  touching data. A secondary discovery during this: `which uvicorn` on this shell resolves to a
  stale system-wide console-script whose shebang points at a DIFFERENT, older project checkout
  (`AI-Coach-vibe-coding` vs `AI-avatar-vibe-coding`) still present on disk from before the repo
  rename — invoking bare `uvicorn`/`python` without an explicit `.venv/bin/` prefix silently runs
  the wrong interpreter/site-packages. Always invoke `backend/.venv/bin/python -m uvicorn ...` or
  `backend/.venv/bin/python -m alembic ...` explicitly in this environment.
  implication: Not an Increment C code bug — a pre-existing local dev-environment migration gap
  (dating back to Increment A) plus a stale-shebang footgun from the project rename. Both are now
  fixed for this dev environment (db upgraded to head, correct venv confirmed working); no source
  files needed changing. Documenting here so the same trap isn't re-hit debugging Increment D.

- timestamp: 2026-08-04T19:55:00Z
  checked: `frontend/e2e/admin-avatar-personas.spec.ts` (Phase 36-02, pre-existing, predates
  Increment A) re-run after the dev-db fix above, to check for Increment C regressions.
  found: Two of its three tests now fail/timeout — one on `page.waitForResponse` for a persona
  POST exceeding the spec's default 30s test timeout, one on a post-reload assertion likely
  cascading from the first test's incomplete cleanup. Root cause: Increment A (already committed
  as cc8a962, before this session) made every persona create/update synchronously call
  `agent_sync_service.sync_agent_for_profile`, which performs a real Azure AI Foundry agent
  create/update round-trip taking ~14s (confirmed via direct curl timing). This spec creates TWO
  personas in one test body and was written before Increment A existed, so it never budgeted for
  this latency.
  implication: This is a PRE-EXISTING regression introduced by the already-committed Increment A,
  not something caused by Increment C's changes (which only touch persona knowledge-config code,
  never persona creation timing). Out of scope for Increment C per this session's explicit
  instruction to touch only Increments C and D. Flagging for a future fix (raise this spec's
  `test.setTimeout()`, mirroring the fix already applied in the new
  `admin-persona-knowledge.spec.ts`) rather than editing Increment A's test file now.

- timestamp: 2026-08-04T22:30:00Z
  checked: Perf follow-up to the ~14s+ synchronous Foundry sync flagged above (Evidence
  2026-08-04T19:55:00Z) — made persona create/update/retry-sync and the KB-triggered resync
  non-blocking. Verified via full gate run: backend `ruff check .` clean, `ruff format --check .`
  clean (1 file auto-formatted), full backend `pytest -q` 2965 passed / 1 failed / 15 skipped
  (the 1 failure, `test_agent_chat_service.py::test_real_chat_with_existing_agent`, is a
  `[REAL]`-tagged live-Azure-network integration test gated on real `.env` credentials — passed
  in isolation, passed when re-run together with every persona/agent-sync test file I touched
  (168/168), confirmed unrelated to this change). Frontend `npx tsc -b` clean, `npm run build`
  succeeds, full vitest 2738 passed / 1 failed (pre-existing `login.test.tsx` navigate-target
  mismatch from commit 8a1423f, unrelated — confirmed via `git log` on `login.tsx`, not touched
  by this change). All 3 named Playwright specs (admin-avatar-personas.spec.ts,
  hcp-editor-voice-tab.spec.ts, admin-persona-knowledge.spec.ts) 23/23 passed against a freshly
  restarted backend (confirmed via `lsof`/`ps -ww` it was the correct `.venv` process, no
  `--reload`, so a restart was required to pick up the new code) — the two-persona-create test
  that previously needed a 90s timeout bump now completes in 16.0s total.
  implication: The perf follow-up is verified end-to-end with zero regressions attributable to
  this change. Both pre-existing failures (live-Azure-network flakiness; an unrelated stale
  login-redirect test) are documented here so a future session doesn't waste time re-diagnosing
  them as caused by this work.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Not a code defect — a deliberate, user-approved scope decision that the user is now reversing.
  On 2026-08-04, Phase 38 ("voice-mode-config-foundry-portal") was explicitly rescoped by the user
  (see 38-CONTEXT.md, exact quote: "我说了只需要把这个图片对应的 voice instance 换成最新ai foundary
  portal的") to ONLY replace the HCP page's "Voice Live Instance" selector card with flat, always-
  visible Foundry-style fields (model/language/voice/avatar-gallery), applied identically to the
  Persona editor. That same rescope explicitly DEFERRED, as "Future Requirements": PEDIT-01 (Foundry
  agent sync + status panel), PEDIT-02 (persona Knowledge/Foundry-IQ attach), PEDIT-04/05/06, and
  BRAND-01. Phase 38 was completed and verified (4/4 truths) exactly per that narrowed scope on
  2026-08-04. Separately, an earlier debug session (avatar-persona-voice-mode-config.md, archived
  the same day WITHOUT human browser verification per "不想验证了") had already independently found
  and explicitly declined to fix gaps #2 and #3 for the same reason (no backend counterpart existed).
  The three gaps in this ticket are therefore the direct, traceable result of that 2026-08-04 scope
  decision being overruled today — confirmed by direct source inspection, not inferred:
    (1) No gear "Configure" button + right-side collapsible "Configuration" panel exists ANYWHERE in
        the codebase, for either HCP or Persona — `agent-config-left-panel.tsx` renders 4 stacked,
        always-visible Cards; `playground-preview-panel.tsx` has no gear/panel affordance at all.
    (2) `AvatarPersona` has no knowledge-base attachment mechanism; `HcpKnowledgeConfig` is hard-FK'd
        to `hcp_profiles.id` at the DB/ORM/service-signature level, structurally excluding personas.
    (3) `AvatarPersona` has zero Foundry-agent-identity columns (`agent_id`/`agent_version`/
        `agent_sync_status`/`agent_sync_error`) and no `to_prompt_dict()` — while the backend sync
        machinery it would need (`agent_sync_service.sync_agent_for_profile` and everything it calls)
        is ALREADY generic/provider-agnostic (`profile: object`) and needs zero modification to be
        reused, once those columns + a trivial `to_prompt_dict()` exist.
fix: |
  User approved the 4-increment plan via checkpoint. Applying strictly one increment at a time,
  each with its own tests/gates/commit:
    Increment A (backend) — APPLIED (commit cc8a962). Alembic migration h41a adding agent_id/
      agent_version/agent_sync_status/agent_sync_error to avatar_personas; AvatarPersona.to_prompt_dict()
      returning {"name":..., "agent_instructions_override": prompt_fragment}; avatar_persona_service
      create/update/delete/retry_agent_sync hooks reusing agent_sync_service.sync_agent_for_profile
      verbatim; guarded build_voice_live_metadata call (hasattr check) since AvatarPersona lacks
      HCP-only voice columns — agent sync for personas covers instructions+tools only, matching
      Evidence implication_2's option (ii). New POST /admin/avatar-personas/{id}/retry-sync + GET
      .../agent-portal-url routes mirroring hcp_profiles.py exactly (including the 422-not-400
      bad_request() behavior).
    Increment B (frontend) — APPLIED (commit fb7e9ef). AgentStatusSection rendering reused for
      personas via persona-agent-status-section.tsx, reusing hcp.* i18n keys directly.
    Increment C (backend + frontend, gap #2) — APPLIED (pending commit, this update). New
      AvatarPersonaKnowledgeConfig table (sibling to HcpKnowledgeConfig, not a shared polymorphic
      FK) + persona_knowledge_service.py counterpart (get/add/remove + _trigger_agent_resync) +
      3 new admin routes on admin_avatar_personas.py + agent_sync_service.py dispatch
      (isinstance(profile, AvatarPersona)) routing KB-tool building to the persona service.
      Frontend: ConnectKbDialog refactored from an owner-typed `hcpId` prop to an owner-agnostic
      `onConnect(data, onDone)` + `isPending` callback API (both HCP call sites —
      knowledge-tab.tsx and agent-config-left-panel.tsx — updated to the new shape); new
      persona-knowledge-section.tsx mirroring knowledge-tab.tsx's UI, wired to persona hooks,
      rendered in persona-editor.tsx gated on `isEdit && id`. Reused hcp.* i18n keys as-is,
      matching Increment B's established convention — no locale file edits needed.
    Increment D (frontend, largest, applies to BOTH pages) — NOT YET STARTED. New shared
      <ConfigurationPanel> component opened by a gear Button in PlaygroundPreviewPanel's toolbar,
      migrating avatar/voice/language fields out of the always-visible left-panel Cards into this
      panel for both HCP and Persona editors, per the Foundry-portal reference interaction pattern.
  Each increment maps to one CLAUDE.md "requirement" (own unit tests, own E2E coverage, own commit).

  Perf follow-up (post-Increment-D) — APPLIED. Addresses the ~14s+ synchronous Foundry sync
    latency flagged in Evidence 2026-08-04T19:55:00Z (a regression from the already-committed
    Increment A, later confirmed to affect Increment C's KB-triggered resync path too). Made
    `agent_sync_service.sync_agent_for_profile` non-blocking on all four persona trigger points:
      - `avatar_persona_service.py`: `create_persona`/`update_persona`/`retry_agent_sync` now set
        `agent_sync_status="pending"`, commit, and `asyncio.create_task(_run_background_agent_sync(...))`
        instead of awaiting the sync inline. New `_run_background_agent_sync(persona_id)` opens its
        own `AsyncSessionLocal` session (module-level import, patchable for tests), re-loads the
        persona, runs the real sync, and writes agent_id/version/status/error + commits — wrapped in
        an outer try/except so a crash inside it can never surface as an unhandled asyncio task
        exception. Mirrors the existing `dry_run_engine`/`skills._run_agent_creation` background-task
        pattern already used elsewhere in this codebase.
      - `persona_knowledge_service.py`: `_trigger_agent_resync` (called by `add_knowledge_config`/
        `remove_knowledge_config`) rewritten identically — sets pending, commits, schedules the same
        `avatar_persona_service._run_background_agent_sync` via `asyncio.create_task` rather than
        syncing inline, keeping all four trigger points converging on one shared background function.
      - `frontend/src/hooks/use-avatar-personas.ts`: `useAvatarPersona` now polls via TanStack Query
        `refetchInterval` (2000ms while `agent_sync_status === "pending"`, else `false`) so the
        existing `PersonaAgentStatusSection` card picks up the pending -> synced/failed transition
        without a manual refresh, mirroring `use-voice-score.ts`'s established polling pattern.
      - HCP's sync path (`hcp_profile_service.py`) is explicitly untouched — this follow-up is
        persona-only, matching the original ticket's scope.
verification: |
  Increment A: ruff check + ruff format --check clean on all 8 changed/added files. Targeted
  pytest run (115 tests) covering every touched module plus the full pre-existing HCP agent-sync
  suite (regression check on the shared agent_sync_service.py edit) — 115/115 passed, zero
  regressions. New tests added: TestToPromptDict, TestAgentSyncOnCreate (incl. sync-survives-
  default-promotion), TestAgentSyncOnUpdate, TestDeletePersonaWithAgent, TestRetryAgentSync
  (backend/tests/test_avatar_persona_service.py); TestRetrySyncEndpoint, TestAgentPortalUrlEndpoint
  (backend/tests/test_admin_avatar_personas_api.py).
  Increment B: verified in a prior session segment (commit fb7e9ef).
  Increment C: `ruff check .` + `ruff format --check .` clean. Full backend `pytest -q`:
  2964/2965 passed (the 1 failure, `test_three_profiles_mixed_create_and_update`, reproduced as
  passing in isolation and confirmed unrelated — a live-Azure-integration test, docstring-
  confirmed, that my isinstance dispatch change never touches since it only affects the
  AvatarPersona branch). Frontend `npx tsc -b` clean, `npm run build` succeeds, targeted vitest
  (persona-knowledge-section.test.tsx, agent-config-left-panel.test.tsx, persona-editor.test.tsx)
  65/65 passed, full vitest suite 2714/2715 passed (1 pre-existing unrelated failure in
  login.test.tsx, confirmed via `git status` — no login files touched). New Playwright E2E
  `frontend/e2e/admin-persona-knowledge.spec.ts` (3/3 passed, run against a real backend after
  fixing a pre-existing local dev-db migration gap — see Evidence) covering: Knowledge card
  absent while creating; card present with empty state after save; Add -> Connect to Foundry IQ
  opens the dialog with title/description and a disabled Connect button until both selects are
  filled; Cancel closes without side effects. Also re-ran the pre-existing
  `admin-avatar-personas.spec.ts` for regressions — 2 of its 3 tests now fail on test-timeout,
  traced to a pre-existing Increment-A-caused latency gap (see Evidence), not an Increment C
  regression; left unmodified per this session's C/D-only scope.
  Perf follow-up: see Evidence 2026-08-04T22:30:00Z for the full gate results (backend ruff/pytest,
  frontend tsc/build/vitest, 23/23 Playwright across all 3 named specs against a freshly-restarted
  backend). The test.setTimeout bumps and stale ~14s-sync comments in
  admin-avatar-personas.spec.ts and admin-persona-knowledge.spec.ts were removed/reduced since the
  sync no longer blocks the HTTP response.
files_changed:
  - backend/app/models/avatar_persona.py
  - backend/alembic/versions/h41a_add_persona_agent_sync_fields.py
  - backend/app/services/agent_sync_service.py
  - backend/app/services/avatar_persona_service.py
  - backend/app/schemas/avatar_persona.py
  - backend/app/api/admin_avatar_personas.py
  - backend/tests/test_avatar_persona_service.py
  - backend/tests/test_admin_avatar_personas_api.py
  - backend/app/models/avatar_persona_knowledge_config.py
  - backend/alembic/versions/i42a_add_persona_knowledge_configs.py
  - backend/app/schemas/avatar_persona_knowledge.py
  - backend/app/services/persona_knowledge_service.py
  - backend/tests/test_persona_knowledge_service.py
  - frontend/src/types/knowledge-base.ts
  - frontend/src/api/knowledge-base.ts
  - frontend/src/hooks/use-knowledge-base.ts
  - frontend/src/components/admin/connect-kb-dialog.tsx
  - frontend/src/components/admin/knowledge-tab.tsx
  - frontend/src/components/admin/agent-config-left-panel.tsx
  - frontend/src/components/admin/agent-config-left-panel.test.tsx
  - frontend/src/components/admin/persona-knowledge-section.tsx
  - frontend/src/components/admin/persona-knowledge-section.test.tsx
  - frontend/src/pages/admin/persona-editor.tsx
  - frontend/src/pages/admin/persona-editor.test.tsx
  - frontend/e2e/admin-persona-knowledge.spec.ts
  - backend/app/services/avatar_persona_service.py (perf follow-up: non-blocking sync)
  - backend/app/services/persona_knowledge_service.py (perf follow-up: non-blocking resync)
  - backend/tests/test_avatar_persona_service.py (perf follow-up: rewritten sync-timing tests)
  - backend/tests/test_persona_knowledge_service.py (perf follow-up: rewritten resync-timing test)
  - backend/tests/test_admin_avatar_personas_api.py (perf follow-up: retry-sync route test)
  - frontend/src/hooks/use-avatar-personas.ts (perf follow-up: refetchInterval polling)
  - frontend/src/hooks/use-avatar-personas.test.ts (perf follow-up: polling tests)
  - frontend/e2e/admin-avatar-personas.spec.ts (perf follow-up: removed setTimeout bumps)
  - frontend/e2e/admin-persona-knowledge.spec.ts (perf follow-up: removed setTimeout bumps)
