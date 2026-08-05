---
status: awaiting_human_verify
trigger: "Investigate issue: persona-hcp-foundry-alignment — Avatar Persona admin page still not aligned with HCP profile page and Azure AI Foundry portal design. Three gaps: (1) Foundry-portal voice-mode layout parity (gear Configure button opening right-side Configuration panel) on BOTH HCP and Persona pages; (2) Persona editor missing Foundry features HCP has (Knowledge/Foundry IQ); (3) Persona must be a real Foundry agent, synced like HCP (Agent Synced card, Agent ID, version, Force re-sync, View in Azure Portal)."
created: 2026-08-04T00:00:00Z
updated: 2026-08-05T18:20:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Increment H (pull voice-live config back from latest Foundry agent version) DELIVERED.
Backend: agent_sync_service.py gained _decode_voice_live_metadata (de-chunks .1/.2 suffix keys,
json.loads, requires enabled=="true" + {"session": dict}), pull_voice_live_metadata (reads
agent.versions["latest"]["metadata"] + definition.model), _apply_persona_voice_name (writes zh-CN
or sole-locale voice_map slot, refuses to guess with 2+ non-zh-CN locales), and
apply_voice_live_session_to_profile (exact inverse of build_voice_live_metadata onto HcpProfile OR
AvatarPersona inline columns; audited mapping-by-mapping: rate str<->float playback_speed,
phrase_list join/splitlines, "auto-detect"<->"auto", llm_interim_response<->"llm", null-when-off
conventions). New endpoints: POST /hcp-profiles/{id}/agent/pull-voice-config and
POST /admin/avatar-personas/{id}/agent/pull-voice-config (admin-only, require synced agent,
refresh agent_version from Foundry). Frontend: usePullVoiceConfigHcpProfile /
usePullVoiceConfigAvatarPersona hooks, "Pull from Agent" (Download icon) button in both
agent-status sections gated on synced && !isNew, form re-seed after pull (HCP via useEffect +
invalidation; persona via extracted personaToFormState() called in mutation onSuccess), 4 new i18n
keys x 5 locales (es-* genuinely translated).
test: ruff clean; full pytest 2996 passed / 2 failed (both known [REAL] live-Azure flakes),
coverage 90.48% >= 89% gate; tsc -b clean; vitest 2802 passed / 1 known login flake; REAL E2E in
browser against live Foundry: persona Lisa pull -> 200, agent_version 2->"3",
proactive_engagement:true pulled; HCP Dr. Wang Fang pull -> 200, agent_version "15",
voice_live_model "gpt-5.4-mini", voice_name zh-CN-XiaoxiaoMultilingualNeural.
next_action: awaiting human confirmation before archiving this session to resolved/. Deferred
follow-up: user's "使用相同的UI 组件" (Fluent UI) question — re-raise options after this ships.

---

hypothesis: Increment G (4 Foundry Configuration-panel parity gaps: speech recognition/
transcription model, language auto-detect toggle, Speech input Advanced settings, Speech output
Advanced settings extensions) APPLIED, frontend-only (backend was already 100% complete from a
prior session). Fully wired into ConfigurationPanel + both callers (voice-avatar-tab.tsx for HCP,
persona-editor.tsx for Persona), plus hcp-profile-editor.tsx's zod schema/defaults/reset. Fixed 9
pre-existing test files whose mock HcpProfile/AvatarPersona literals became type-incomplete after
the new required interface fields; fixed 1 real behavioral test regression (voice-avatar-tab.test.tsx
asserting the now-removed showAutoDetectOption prop) and 1 test-selector ambiguity regression
(persona-editor.test.tsx's single "Advanced settings" getByText became ambiguous once the panel
gained a second, identically-labeled collapsible); fixed 1 i18n locale-parity regression (4 new
speechRecognitionModel option labels were byte-identical to en-US in all 3 es-* locales, and the
15-entry untranslated-whitelist cap was already full, so translated them with a "(transcripción)"
qualifier instead of whitelisting). Added 30 new tests to configuration-panel.test.tsx covering all
9 new prop pairs. test: full gate run (tsc -b, build, vitest, targeted configuration-panel suite).
expecting: zero new regressions beyond the 1 pre-existing unrelated login.test.tsx failure (already
documented in Evidence 2026-08-04T22:30:00Z, reconfirmed untouched this session).
next_action: awaiting human browser verification of the 4 new Configuration-panel fields on both
HCP and Persona editors before archiving this session to resolved/.

---

hypothesis: Increment F (Interim response + Proactive engagement parity) CONFIRMED root cause
found via E2E: HCP-side round-trip silently dropped both new fields on GET/PUT responses. Cause
was a router-local duplicate response schema `HcpProfileOut` in app/api/hcp_profiles.py (separate
from, and drifted out of sync with, app/schemas/hcp_profile.py's HcpProfileResponse) that was
missing the 4 new columns entirely -- FastAPI's response_model filtering silently stripped them
from every HCP GET/POST/PUT response body, so the frontend form's `profile.interim_response_enabled
?? false` reset to the false/llm/500 defaults on every reload even though the PUT itself persisted
correctly to the DB. Personas were unaffected (avatar_personas.py imports AvatarPersonaOut directly
from app/schemas/avatar_persona.py, no local duplicate). Fixed by adding the 4 fields to the local
HcpProfileOut class. test: added a new Playwright test to hcp-editor-voice-tab.spec.ts (toggle
interim response ON + static type + 750ms threshold, toggle proactive engagement ON, save, PUT
200, re-navigate, re-open Configuration panel, assert both switches still checked and threshold
still 750) -- this is what surfaced the bug (failed before the hcp_profiles.py fix, on the
`toBeChecked()` assertion after reload). expecting: after the HcpProfileOut fix, GET
/hcp-profiles/{id} includes proactive_engagement/interim_response_* with the persisted values, and
the new E2E test passes on rerun. next_action: rerun the new E2E test alone to confirm the fix,
then rerun the full hcp-editor-voice-tab + admin-avatar-personas Playwright suite, then full
backend pytest, then commit.

---

hypothesis: Increment E CONFIRMED and FIXED (new bug found post-D): agents synced to Azure AI
Foundry showed "Voice mode" OFF because build_voice_live_metadata emitted camelCase keys (an
older/classic-portal format the new portal's toggle doesn't recognize) and personas were fully
skipped by a hasattr(profile, "voice_live_model") gate. Rewrote build_voice_live_metadata to emit
the official snake_case Voice Live Agents quickstart schema with every field explicit, chunked via
the official .1/.2/... suffix convention when >512 chars, and dispatch to a new
resolve_voice_config_for_persona() for AvatarPersona instances (avatar always enabled, voice from
persona.voice_map). Verified live against real Foundry for one HCP (Dr-Wang-Fang) and one persona
(Lisa) — both now carry correct, non-empty, snake_case voice-live metadata.
test: Live re-sync + metadata re-fetch against real Foundry (see Evidence 2026-08-05T10:45:00Z);
unit tests rewritten/added for snake_case format, chunking, persona dispatch, clear path.
expecting: microsoft.voice-live.configuration JSON is snake_case, all fields present (explicit
null for disabled noise/echo), chunked correctly if oversized, and identical in shape for both
HcpProfile and AvatarPersona profiles.
next_action: |
  Increment E DONE and fully gate-confirmed: live Foundry re-verification passed for both an HCP
  and a persona; a stale-test regression discovered mid-gate-run in a third test file
  (test_hcp_agent_sync_integration.py) was fixed; final full backend pytest run is clean modulo 3
  unrelated live-Azure-network flakes (see Resolution.verification). Remaining step: create the
  single commit for Increment E (fix(sync): store Voice Live config in official chunked metadata
  format; include personas), delete no further throwaway scripts (already deleted), then report.
  All 4 prior increments (A/B/C/D) still DONE:
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

- timestamp: 2026-08-05T00:00:00Z
  checked: Human verification of the gear "Configuration" panel (语音和数字人配置) found
  two follow-up gaps: (1) the speech-output voice dropdown had zero Spanish voices, and
  (2) voice options never filtered by the selected recognition language (an en-US voice
  stayed pickable/visible after switching to es-ES, and vice versa). Root cause:
  `VOICE_NAME_OPTIONS` in `frontend/src/lib/voice-constants.ts` had no `locale` field and
  no Spanish entries, and every voice Select (ConfigurationPanel, vl-instance-dialog.tsx,
  vl-instance-editor.tsx) unconditionally rendered the full unfiltered list.
  found: Fixed frontend-only. Added 6 Azure standard neural Spanish voices (es-ES-Elvira/
  Alvaro, es-MX-Dalia/Jorge, es-US-Paloma/Alonso) with a `locale` field on every
  VOICE_NAME_OPTIONS entry and a `multilingual` flag on zh-CN-XiaoxiaoMultilingualNeural;
  added `voiceOptionsForLanguage(language)` (auto/unrecognized locale -> all options,
  otherwise locale match + multilingual). Wired into ConfigurationPanel's voice Select
  (keeping an out-of-locale saved voice visible via a fallback SelectItem so it's never
  silently dropped) and identically into vl-instance-dialog.tsx + vl-instance-editor.tsx
  keyed off `form.recognition_language`. Updated RECOGNITION_LANGUAGES (used by the VL
  instance dialog/editor) to drop ja-JP/ko-KR and add es-ES/es-MX/es-US, matching the
  3-language (zh-CN/en-US/es-*) requirement. Added the 6 new voice i18n keys +
  langSpanishSpain/Mexico/US to all 5 admin.json locale files; kept the Spanish voice
  proper-noun labels in zh-CN/en-US identical ("Elvira (ES-ES)" etc.) but had to give the
  3 es-* locale files a translated country-name parenthetical ("Elvira (España)" etc.)
  instead of a byte-identical string, because `src/i18n/locale-parity.test.ts` enforces
  es-* values differ from en-US unless whitelisted, and the untranslated-whitelist
  guardrail was already at its 15-entry cap.
  implication: Updated hcp-editor-voice-tab.spec.ts's language+voice E2E test (it
  previously selected es-ES language then an English "Andrew" voice, which the new
  filtering now correctly hides) to select "Elvira" instead — this is the filtering
  feature working as intended, not a regression. All gates green: `npx tsc -b` clean,
  `npm run build` succeeds, full `npx vitest run` 2750/2751 passed (the 1 failure is the
  pre-existing documented `login.test.tsx` flake, unrelated). Playwright: full run of the
  3 named specs 22/23 passed, the 1 failure (a `beforeEach` API-login timeout in an
  unrelated pre-existing knowledge-base test) reproduced as passing in isolation (3/3,
  5.7s vs the 30s timeout) confirming it's an environment flake, not caused by this
  change. Committed as `0a305c2 feat(voice): add Spanish voices and filter voice list by
  recognition language`.

- timestamp: 2026-08-05T10:00:00Z
  checked: Increment E (new bug, post-D): agents synced to Azure AI Foundry (new portal) show
  "Voice mode" toggle OFF, and voice/avatar settings never appear in the Foundry agent, for both
  HCP profiles and Avatar Personas. Empirically diagnosed via a throwaway script
  (`_diag_voice_metadata.py`, deleted before commit) calling `agent_sync_service._get_project_client`/
  `get_project_endpoint` to fetch real agent metadata for `Dr-Wang-Fang`, `Dr-Li-Mei`, and `Lisa`.
  found: (1) `Dr-Wang-Fang` (a stale agent, last synced before commit `5e03905`) had a non-standard
  chunked format: `.chunk_N` keys + a `{"chunked":true,...}` JSON-pointer wrapper -- git archaeology
  (`git log -S "totalChunks"`) confirmed `5e03905` removed exactly this scheme after it broke the
  (old) Foundry Portal's Voice mode toggle. (2) `Dr-Zhang-Wei` (freshly synced same day, i.e. the
  TRUE current-code baseline) had `microsoft.voice-live.enabled: "true"` plus a small, non-chunked,
  camelCase JSON blob with several fields OMITTED (to stay under the 512-char limit) -- confirming
  the CURRENT (pre-fix) code emits camelCase with omitted defaults, not the chunked scheme from (1).
  (3) `Lisa` (persona) had ZERO `microsoft.voice-live.*` keys at all -- confirms the
  `hasattr(profile, "voice_live_model")` gate in `sync_agent_for_profile` was silently skipping
  `build_voice_live_metadata` entirely for every persona (AvatarPersona has no such column). (4) No
  agent in the project had been manually toggled via the portal's Voice-mode UI, so no 100%-authoritative
  ground-truth schema existed in the live project; proceeded on the officially-documented Microsoft
  Voice Live Agents quickstart schema (snake_case `session` keys: `voice`, `input_audio_transcription`,
  `turn_detection`, `input_audio_noise_reduction`, `input_audio_echo_cancellation`, `avatar`,
  `proactive_engagement`; oversized values chunked via official `.1`/`.2`/... key-suffix convention,
  not a custom wrapper).
  implication: Root cause is camelCase key casing (an older/classic-portal format) that the current
  (new) Foundry Portal's Voice mode toggle does not recognize, PLUS personas being fully excluded by
  a type-gate that assumed only `HcpProfile`-shaped objects ever reach `build_voice_live_metadata`.
  Re-introducing chunking (in the correct official `.1`/`.2` suffix format, NOT the wrapper scheme
  commit `5e03905` removed) is safe and is required now because emitting every field explicitly
  (no more omit-to-fit-512 hack) commonly exceeds the 512-char single-value limit.

- timestamp: 2026-08-05T10:45:00Z
  checked: Live re-verification after applying the fix (see Resolution.fix below) -- ran a real
  metadata-only re-sync (`agent_sync_service.update_agent_metadata_only`) against the live Foundry
  project for one HCP (`Dr-Wang-Fang`) and one persona (`Lisa`), then re-fetched each agent via
  `client.agents.get()` and inspected `agent.versions["latest"]["metadata"]` (NOT the top-level
  `agent.metadata` attribute -- see finding below).
  found: Both agents now carry `microsoft.voice-live.enabled: "true"` plus a `microsoft.voice-live.
  configuration` value whose JSON is `{"session": {"voice": {...}, "input_audio_transcription": {...},
  "turn_detection": {"type": "server_vad"}, "input_audio_noise_reduction": null,
  "input_audio_echo_cancellation": null, "avatar": {"character": "lisa", "style": "casual-sitting",
  "customized": false}, "proactive_engagement": true}}` -- fully snake_case, every field explicit
  (nulls shown, not omitted), matching the official quickstart schema exactly. Dr-Wang-Fang's config
  is 405 chars, Lisa's is 388 chars -- both fit in a single (unchunked) key for these particular
  profiles, but the oversized-config chunking path is separately covered by
  `test_build_voice_live_metadata_chunks_oversized_config` (synthetic long avatar_style/voice_name).
  Lisa's voice resolved to `en-US-AvaNeural` (her `voice_map` has no `zh-CN` entry, so
  `resolve_voice_config_for_persona`'s fallback correctly picked the first available locale entry)
  and `avatar.character`/`avatar.style` came from her own `character`/`style` columns -- confirms the
  persona dispatch branch works end-to-end against real Foundry, not just in mocked unit tests.
  ADDITIONAL FINDING (out of this ticket's scope, documented for future reference): the current
  `azure-ai-projects` SDK's `AgentDetails` object returned by `client.agents.get()` has NO top-level
  `.metadata` attribute -- `hasattr(agent, "metadata")` always evaluates False, so
  `update_agent_metadata_only`'s "fetch current metadata, strip old VL keys, merge" step always
  operates on an empty `current_metadata` dict in practice. This is currently harmless because (a)
  `create_version` fully replaces metadata rather than merging across versions (already established
  in this session), and (b) no other non-voice-live metadata keys are ever set on these agents today
  -- but it means that step's docstring ("removes old microsoft.voice-live.* keys") is not actually
  exercised; the correctness instead comes entirely from `create_version`'s full-replace semantics.
  The correct read path (used elsewhere, e.g. `get_agent_latest_version`) is
  `agent.versions["latest"]["metadata"]`, not `agent.metadata`.
  implication: Fix is verified working end-to-end against live Foundry for both an HCP profile and a
  persona. The SDK attribute-mismatch finding is a separate latent (currently benign) issue in
  `update_agent_metadata_only`'s read step, left unfixed as out-of-scope for this increment (no
  observable bug results from it today; flagging here so a future session doesn't need to
  re-discover it if non-voice-live metadata is ever introduced).

- timestamp: 2026-08-05T11:05:00Z
  checked: Full backend `pytest -q --no-cov -rf` run (background, ~918s) as the Step-4 gate for
  Increment E, BEFORE this entry was written.
  found: 7 failed, 2963 passed, 15 skipped. 6 of the 7 failures were real regressions I had missed:
  `tests/test_hcp_agent_sync_integration.py` (a separate integration-test file, not previously
  touched this increment) has its OWN copy of camelCase-format assertions for
  `build_voice_live_metadata` (`test_build_voice_live_metadata_basic`,
  `test_build_voice_live_metadata_with_noise_echo`, `test_build_voice_live_metadata_custom_voice`,
  and the real-ORM equivalents in `TestBuildVoiceLiveMetadataRealORM`) that predated this session's
  rewrite and were never updated when `test_agent_sync_service.py` was rewritten earlier in this
  increment. The 7th failure, `test_voice_live_websocket.py::TestRealAzureSessionConfig::
  test_real_transcription_model_azure_speech_accepted`, is unrelated (confirmed via
  `git diff --name-only` -- that file is untouched by this fix; re-ran the whole
  `TestRealAzureSessionConfig` class in isolation and a DIFFERENT sub-test failed that time
  (`test_real_connect_model_mode_session_config_accepted`), confirming genuine live-Azure-network
  flakiness rather than a deterministic regression from this change).
  implication: Fixed the 6 real regressions by updating `test_hcp_agent_sync_integration.py`'s
  assertions to the new snake_case/explicit-null format: `session["voice"]["type"]` is now asserted
  present (`"azure-standard"`) instead of asserted absent; `turnDetection`/`inputAudioNoiseReduction`/
  `inputAudioEchoCancellation`/`endOfUtteranceDetection` renamed to their snake_case equivalents
  (`turn_detection`, `input_audio_noise_reduction`, `input_audio_echo_cancellation`,
  `end_of_utterance_detection`); noise/echo assertions changed from "key not in session" to
  "value is None" (explicit null, not omitted). Re-ran the fixed file alone (25/25 passed), the 8
  targeted voice-live-metadata tests specifically (8/8 passed), and the full combined set of every
  directly-touched-domain test file (`test_hcp_agent_sync_integration.py` +
  `test_agent_sync_service.py` + `test_voice_live_instance_service.py` +
  `test_avatar_persona_service.py`) together -- 212/212 passed, zero failures. `ruff check` and
  `ruff format --check` on all touched files (including the newly-fixed test file) clean. A second
  full-suite background run was started to get a clean final gate count before committing.

- timestamp: 2026-08-05T16:25:00Z
  checked: Increment G test/build/i18n gates after applying the 4 Foundry Configuration-panel
  parity features (speech recognition/transcription model select, language auto-detect toggle,
  Speech input Advanced settings [EOU/noise/echo/phrase list], Speech output Advanced settings
  extensions [voice temperature/playback speed/custom lexicon URL]) to `configuration-panel.tsx`
  and both callers (`voice-avatar-tab.tsx`, `persona-editor.tsx`) in a prior session segment.
  found: (1) 9 pre-existing test files had type-incomplete `HcpProfile`/`AvatarPersona` mock
  literals once the new fields became required interface members — fixed by inserting the missing
  fields (`speech_recognition_model`, `eou_detection`, `noise_suppression`, `echo_cancellation`,
  `phrase_list`, `voice_temperature`, `playback_speed`, `custom_lexicon_url`, plus
  `auto_detect_language` for the 3 AvatarPersona-typed files) at each genuine `: HcpProfile`/
  `: AvatarPersona`-typed literal (carefully distinguishing these from `expect.objectContaining(...)`
  partial matchers and unrelated payload objects, which do NOT type-check against the full
  interface and needed no changes). `npx tsc -b` and `npm run build` both clean after all 9 fixes.
  (2) The full vitest suite (run only after the targeted `configuration-panel.test.tsx` run passed
  55/55) surfaced 3 additional real regressions the targeted run missed: a stale
  `voice-avatar-tab.test.tsx` assertion on the removed `showAutoDetectOption` prop (should assert
  the new `autoDetectLanguage`/`onAutoDetectLanguageChange` props instead); an ambiguous
  `persona-editor.test.tsx` `getByText("...advancedSettings")` selector, now matching TWO elements
  because `ConfigurationPanel` gained a second, identically-labeled "Advanced settings" collapsible
  (Speech input's `inputAdvancedOpen` alongside Speech output's pre-existing `advancedOpen`) —
  fixed via `getAllByText(...)[1]` targeting the second-rendered (Speech output) one, where
  `proactiveEngagement` lives; and an i18n `locale-parity.test.ts` failure because the 4 new
  `speechRecognitionModel*` option labels were byte-identical between en-US and all 3 es-* locales,
  while `untranslated-whitelist.ts` was already at its hard-capped 15 entries (enforced by a
  separate guardrail test) so whitelisting was not available — fixed by translating the 4 labels
  with an appended `" (transcripción)"` qualifier, following the established
  `azureConfig.services.openai`-style precedent for brand/product names needing a translated
  descriptor rather than a byte-identical or whitelisted string.
  implication: All fixes were pre-existing-test/i18n-guardrail regressions caused by the new
  required fields and new UI structure, not defects in the Increment G feature implementation
  itself. After the 3 fixes, full vitest re-run: 221 files passed / 1 failed (2783/2784 tests),
  the sole failure being the already-documented pre-existing unrelated `login.test.tsx` flake
  (confirmed untouched via `git status --porcelain` on `login.tsx`/`login.test.tsx`). Added 30 new
  tests to `configuration-panel.test.tsx` (55/55 total) covering all 9 new prop pairs: hidden-by-
  default, rendered-when-provided, callback-wiring for each, the two new collapsible-expand
  behaviors, and the auto-detect-hides-language-select UX behavior.

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

  Increment E (new bug, post-D) — APPLIED. Root cause: `build_voice_live_metadata` emitted
    camelCase metadata keys (an older/classic-portal format) that the current Foundry Portal's
    Voice mode toggle does not recognize, PLUS a `hasattr(profile, "voice_live_model")` gate that
    silently skipped voice-live metadata entirely for every persona. Fix:
    - `agent_sync_service.build_voice_live_metadata(profile)` rewritten to emit the OFFICIAL
      Microsoft Voice Live Agents quickstart format: `{"session": {snake_case keys: voice,
      input_audio_transcription, turn_detection, input_audio_noise_reduction,
      input_audio_echo_cancellation, avatar, proactive_engagement}}`, every field included
      explicitly (explicit `null` for disabled noise/echo, not omitted), oversized values chunked
      via the existing (previously-unused) `_chunk_metadata_value()` helper using the official
      `.1`/`.2`/... key-suffix convention -- NOT the custom `.chunk_N`/wrapper scheme a prior
      session (commit `5e03905`) had already found broke the old portal.
    - Now dispatches internally via `isinstance(profile, AvatarPersona)` to either
      `resolve_voice_config()` (HcpProfile's inline voice-mode columns, unchanged) or a new
      `resolve_voice_config_for_persona()` (added to `voice_live_instance_service.py`) --
      resolves voice from the persona's per-locale `voice_map` (zh-CN preferred, else first
      locale, else global default), avatar from the persona's own `character`/`style` columns,
      avatar always enabled. Both resolvers return the same dict shape, so `build_voice_live_metadata`
      needs no branching beyond the dispatch itself.
    - `sync_agent_for_profile` in `agent_sync_service.py`: removed the
      `has_voice_config = hasattr(profile, "voice_live_model")` gate; `build_voice_live_metadata`
      is now called unconditionally for every profile (HCP or persona) since the dispatch lives
      inside the function itself.

  Increment G (frontend, 4 Foundry Configuration-panel parity gaps) — APPLIED. Backend was already
    100% complete from a prior session segment (migration k44a_add_speech_recognition_advanced_config
    added 8 columns to both hcp_profiles/avatar_personas; a separate migration added
    auto_detect_language to avatar_personas only — zero backend files touched this segment,
    confirmed via grep). Frontend work:
    - `configuration-panel.tsx` gained 9 new optional prop pairs, each gated by the established
      `showX = x !== undefined && onXChange !== undefined` presence pattern: `speechRecognitionModel`/
      `onSpeechRecognitionModelChange` (Select: azure-speech/whisper-1/gpt-4o-transcribe/
      gpt-4o-mini-transcribe/gpt-4o-transcribe-diarize/mai-transcribe-1); `autoDetectLanguage`/
      `onAutoDetectLanguageChange` (Switch replacing/supplementing the old `showAutoDetectOption`
      boolean-presence prop — hides the concrete language Select when true); `eouDetection`/
      `onEouDetectionChange`, `noiseSuppression`/`onNoiseSuppressionChange`, `echoCancellation`/
      `onEchoCancellationChange`, `phraseList`/`onPhraseListChange` (all inside a new, independent
      Speech-input "Advanced settings" collapsible, `inputAdvancedOpen` state — separate from the
      pre-existing Speech-output "Advanced settings" collapsible, `advancedOpen` state, which now
      also gained `voiceTemperature`/`onVoiceTemperatureChange`, `playbackSpeed`/
      `onPlaybackSpeedChange`, `customLexiconUrl`/`onCustomLexiconUrlChange`).
    - Wired into both callers (`voice-avatar-tab.tsx` for HCP, `persona-editor.tsx` for Persona)
      and into `hcp-profile-editor.tsx`'s zod schema/defaults/reset for the 8 HCP-side fields.
    - This segment's work (test/i18n fixup, no feature-logic changes): fixed 9 pre-existing test
      files with type-incomplete mock literals (see Evidence 2026-08-05T16:25:00Z for the full
      list and rationale); fixed 1 stale-assertion regression in `voice-avatar-tab.test.tsx`; fixed
      1 selector-ambiguity regression in `persona-editor.test.tsx`; fixed 1 i18n locale-parity
      regression across `es-ES`/`es-MX`/`es-US` `admin.json` (translated 4 `speechRecognitionModel*`
      labels with a `" (transcripción)"` qualifier instead of whitelisting, since the
      untranslated-whitelist was already at its hard 15-entry cap); added 30 new tests to
      `configuration-panel.test.tsx` covering all 9 new prop pairs.
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
  Increment E: `ruff check .` + `ruff format --check .` clean on all touched files. Live-Foundry
  re-verification (see Evidence 2026-08-05T10:45:00Z): both an HCP (Dr-Wang-Fang) and a persona
  (Lisa) now carry correct, non-empty, snake_case `microsoft.voice-live.*` metadata after a real
  re-sync. Unit tests: added `test_build_voice_live_metadata_dispatches_to_persona_config`
  (persona dispatch), rewrote the snake_case/chunking assertions in `test_agent_sync_service.py`
  and `test_voice_live_instance_service.py`. A first full-suite gate run (see Evidence
  2026-08-05T11:05:00Z) surfaced 6 real regressions in a THIRD, previously-unmodified file,
  `test_hcp_agent_sync_integration.py`, which had its own stale camelCase-format assertions for
  `build_voice_live_metadata` predating this increment's rewrite — fixed by updating those 6
  assertions to the new snake_case/explicit-null format (see Evidence 2026-08-05T11:05:00Z for the
  full list and rationale). Final full backend `pytest -q --no-cov -rf` run (after the fix):
  2967/2970 passed, 15 skipped, 28 deselected; the 3 failures
  (`test_agent_sync_service.py::test_real_three_profiles_sync`,
  `test_voice_live_websocket.py::TestRealAzureSessionConfig::test_real_transcription_model_azure_speech_accepted`,
  `test_voice_live_websocket.py::TestRealVoiceLiveIntegration::test_real_model_mode_english_voice_accepted`)
  are all `[REAL]`-tagged live-Azure-network integration tests, none overlapping with the prior
  run's failure set, none touched by this diff (confirmed via `git diff --name-only`), and
  `test_real_three_profiles_sync` reproduced as passing in isolation (42s) — confirmed as live
  network flakiness, not a regression. Combined regression run of every directly-touched-domain
  test file (`test_hcp_agent_sync_integration.py` + `test_agent_sync_service.py` +
  `test_voice_live_instance_service.py` + `test_avatar_persona_service.py`): 212/212 passed.
  Increment G: backend already verified complete in the prior session segment (no backend gate
  re-run this segment — zero backend files touched, confirmed via grep). Frontend: `npx tsc -b`
  clean (zero errors after fixing all 9 type-incomplete test-mock files); `npm run build` succeeds
  (only pre-existing "chunks larger than 500kB" advisory warnings, unrelated). Targeted
  `npx vitest run src/components/admin/configuration-panel.test.tsx`: 55/55 passed (25 pre-existing
  + 30 new). Full `npx vitest run`: 221 files passed / 1 failed (2783/2784 tests) — the 1 failure
  is the pre-existing, already-documented, unrelated `login.test.tsx` navigate-target-mismatch
  flake (confirmed via `git status --porcelain` showing zero modifications to `login.tsx`/
  `login.test.tsx` this session).
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
  - backend/app/services/agent_sync_service.py (Increment E: snake_case format, .1/.2 chunking,
    persona dispatch, removed hasattr gate)
  - backend/app/services/voice_live_instance_service.py (Increment E: new
    resolve_voice_config_for_persona)
  - backend/tests/test_agent_sync_service.py (Increment E: snake_case/chunking/persona-dispatch
    test rewrites)
  - backend/tests/test_voice_live_instance_service.py (Increment E: new persona-resolver tests)
  - backend/tests/test_hcp_agent_sync_integration.py (Increment E: fixed 6 stale camelCase-format
    assertions to match the new snake_case/explicit-null format)
  - backend/alembic/versions/k44a_add_speech_recognition_advanced_config.py (Increment G, prior
    segment: 8 new columns on hcp_profiles/avatar_personas)
  - frontend/src/components/admin/configuration-panel.tsx (Increment G: 9 new prop pairs)
  - frontend/src/components/admin/configuration-panel.test.tsx (Increment G: 30 new tests)
  - frontend/src/components/admin/voice-avatar-tab.tsx (Increment G: wired new props; this segment
    fixed a stale showAutoDetectOption assertion in its test)
  - frontend/src/components/admin/voice-avatar-tab.test.tsx (Increment G: fixed stale
    showAutoDetectOption assertion)
  - frontend/src/pages/admin/persona-editor.tsx (Increment G: wired new props)
  - frontend/src/pages/admin/persona-editor.test.tsx (Increment G: fixed MOCK_PERSONA type
    completeness + ambiguous Advanced-settings getByText selector)
  - frontend/src/pages/admin/hcp-profile-editor.tsx (Increment G: zod schema/defaults/reset
    extension for the 8 new HCP-side fields)
  - frontend/src/components/admin/agent-status-section.test.tsx (Increment G: type-completeness fix)
  - frontend/src/components/admin/hcp-editor.test.tsx (Increment G: type-completeness fix)
  - frontend/src/components/admin/hcp-list.test.tsx (Increment G: type-completeness fix, 2 occurrences)
  - frontend/src/components/admin/hcp-table.test.tsx (Increment G: type-completeness fix)
  - frontend/src/pages/admin/hcp-profile-editor.test.tsx (Increment G: type-completeness fix)
  - frontend/src/pages/admin/vl-instance-editor.test.tsx (Increment G: type-completeness fix)
  - frontend/src/components/admin/persona-agent-status-section.test.tsx (Increment G:
    type-completeness fix)
  - frontend/src/hooks/use-avatar-personas.test.ts (Increment G: type-completeness fix)
  - frontend/src/pages/admin/voice-live-management.test.tsx (Increment G, prior segment:
    type-completeness fix)
  - frontend/public/locales/es-ES/admin.json (Increment G: translated 4 speechRecognitionModel*
    labels)
  - frontend/public/locales/es-MX/admin.json (Increment G: translated 4 speechRecognitionModel*
    labels)
  - frontend/public/locales/es-US/admin.json (Increment G: translated 4 speechRecognitionModel*
    labels)
