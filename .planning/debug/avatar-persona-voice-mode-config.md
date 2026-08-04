---
status: resolved
trigger: "Investigate and implement issue: avatar-persona-voice-mode-config — replace voice-live-instance persona config form at /admin/avatar-personas with a Foundry-agent-playground voice-mode-style config, reusing HCP page elements/design already in this codebase."
created: 2026-08-03T00:00:00Z
updated: 2026-08-04T00:00:00Z
resolution_note: "Committed without in-browser human verification per user decision 2026-08-04 (不想验证了。直接提交修改). Manual verification deferred to after Phase 38 (voice-mode-config-foundry-portal) completes — debug rebuild + VMODE changes will be verified together. All automated gates green: tsc -b, 39 vitest tests (persona-editor 32 + use-avatar-personas 7)."
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (see Resolution, revised after HCP-parity pivot). First round of human verification returned "NOT yet confirmed fixed" — the user clarified the real design reference is the HCP profile editor's actual "语音和数字人" tab (agent-config-left-panel.tsx), not just the abstract Foundry screenshot, and asked that the previously-omitted Model selector / Instructions / Knowledge sections be checked against backend support and reused where genuinely possible, with any real gaps explicitly reported rather than faked. Investigation completed; persona-editor.tsx restructured into Card-per-section layout mirroring agent-config-left-panel.tsx, adding a genuinely-functional (though non-persisted, matching HCP's own current limitation) Model Deployment selector and a disabled Start button with an explanatory tooltip. Re-verified tsc/vitest/build all green.
test: n/a — implementation phase complete for this round.
expecting: n/a
next_action: User manually exercises create + edit flows at /admin/avatar-personas in a running dev server, confirms the Card-based layout (Identity / Character & Avatar / Speech / Model Deployment / Instructions cards + disabled Start button) matches expectations, then this session is archived.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: /admin/avatar-personas persona configuration form looks and works like the AI Foundry agent voice-mode config, reusing the HCP page elements/design in this repo. Reference screenshot showed: Model selector, Voice mode toggle, Instructions textarea, Tools section, Knowledge (Foundry IQ) section with Add button, collapsed Memory/Guardrail; center avatar preview with Chat/YAML/Call tabs and mic Start button; right Configuration panel with Language dropdown (zh-CN + Auto-detect + Advanced), Speech output Voice dropdown (e.g. "Xiaoxiao Multilingual" Female) + Create custom voice + Advanced, Interim response toggle, Proactive engagement toggle, Avatar toggle with character gallery (Lisa/Harry/Nia/Camila/Gabrielle/Matteo), More avatars button, Reset button.
actual: The current /admin/avatar-personas page configures personas via voice live instance fields, and does not match the HCP-style / Foundry voice-mode layout.
errors: None — this is a redesign/refactor request, not a crash.
reproduction: Open http://localhost:5173/admin/avatar-personas (frontend dev server, admin route).
started: Existing design; user decided on 2026-08-03 to replace it.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-03T00:30:00Z
  checked: frontend/src/pages/admin/vl-instance-editor.tsx (voice-live instance editor) vs. frontend/src/components/admin/persona-dialog.tsx (old persona modal)
  found: The voice-live-instance editor already implements the exact Foundry-agent-playground "voice mode" layout the user wants (two-pane: left scrollable config sections, right static/live avatar preview; header back-button + title + enabled switch; sectioned config body; avatar grid with All/Photo/Video filter tabs and thumbnail-fallback-to-initials; bottom Save/Reset action bar) as a full page at its own route, whereas personas were still configured via a cramped `<Dialog>` modal (`persona-dialog.tsx`).
  implication: Reuse the vl-instance-editor's structural pattern wholesale for a new `persona-editor.tsx` full page instead of inventing new layout, and delete the old dialog.

- timestamp: 2026-08-03T00:45:00Z
  checked: Foundry agent-playground reference screenshot fields vs. `AvatarPersona` backend model/schema (character, style, voice_map, greeting_map, prompt_fragment, enabled, is_default)
  found: Several Foundry voice-mode fields (Model selector, Tools, Knowledge/Foundry-IQ attach, Memory, Guardrail, live interactive Start-call test button) have no backend counterpart on `AvatarPersona` at all.
  implication: Per explicit user instruction, these fields must be omitted entirely from the new editor rather than faked with placeholder UI — the new page only surfaces fields that map to real `AvatarPersona` columns (name, character/style avatar picker, per-locale voice + greeting, prompt_fragment, enabled, is_default).

- timestamp: 2026-08-03T01:00:00Z
  checked: `AvatarPersona.voice_map` / `greeting_map` are `Record<locale, value>` dictionaries across 5 locales (zh-CN, en-US, es-ES, es-MX, es-US), but the Foundry screenshot shows a single active-language Voice dropdown
  found: A literal 1:1 port of the screenshot would only support one locale, which conflicts with the platform's mandatory 3-language (in practice 5-locale) requirement (CLAUDE.md "AI Avatar Domain Rules" #5).
  implication: Compromise design: one `activeLocale` Select drives one Voice Select + one Greeting Textarea at a time (matching the Foundry screenshot's single-field-per-concept look), plus a read-only Badge-chip row (`configuredLocales`) surfacing which locales already have overrides — satisfies both the visual reference and the real multi-locale requirement.

- timestamp: 2026-08-03T01:15:00Z
  checked: `useAvatarPersona(id)` hook — did not exist before this task; only `useAvatarPersonas()` (list) existed in `frontend/src/hooks/use-avatar-personas.ts`
  found: Backend route `GET /admin/avatar-personas/{persona_id}` and `avatarPersonasApi.get(id)` client method already existed and were unused by the frontend.
  implication: No backend changes needed at all — added a single-persona TanStack Query hook (`useAvatarPersona`) mirroring `useVoiceLiveInstance(id)`'s pattern, wired to the existing endpoint.

- timestamp: 2026-08-03T01:30:00Z
  checked: `frontend/e2e/admin-avatar-personas.spec.ts`'s `createPersonaViaUi` helper (old modal-based flow: `page.getByRole("dialog")`, `dialog.locator("#persona-greeting-en-US")`, `dialog.locator("#persona-prompt-fragment")`, `expect(dialog).not.toBeVisible()`)
  found: The old dialog's per-locale greeting id (`#persona-greeting-en-US`) and prompt-fragment id (`#persona-prompt-fragment`) had no equivalent in the new full-page editor's Textareas (neither had an `id` attribute at all), and the success flow no longer closes a dialog — it navigates (replace) to `/admin/avatar-personas/:id/edit`.
  implication: Added stable `id="persona-editor-greeting"` / `id="persona-editor-prompt-fragment"` to the new editor's Textareas, and rewrote `createPersonaViaUi` to: navigate to the list page, click "Create Persona", wait for the `/new` route, fill fields via the new ids, click "Save Persona", wait for the POST response, wait for the edit-route navigation, then `page.goto` back to the list page so the caller's row-based (`data-persona-id`) assertions still work immediately after each call.

- timestamp: 2026-08-03T01:45:00Z
  checked: Full frontend `npx vitest run` (2671 tests) after all changes
  found: 2670 passed, 1 pre-existing unrelated failure (`src/pages/login.test.tsx` — expects navigate to `/user/dashboard`, actual `/`). Verified via `git stash` + re-run + `git stash pop` that this exact failure exists identically on `main` before any of this task's changes (introduced by a separate prior commit "fix(auth): validate token via /me before redirecting away from /login").
  implication: Zero regressions introduced by this task; the one failure is out of scope and pre-dates this work.

- timestamp: 2026-08-03T01:50:00Z
  checked: `npx tsc -b` and `npm run build` after all changes (including the final `id`-attribute + E2E-spec edits)
  found: Both completed with zero errors (build's only warning is the pre-existing large-chunk-size advisory, unrelated to this change).
  implication: The full change set is type-safe and production-buildable.

- timestamp: 2026-08-03T02:00:00Z
  checked: User's checkpoint response — clarified the real design reference is the HCP profile editor's actual "语音和数字人" tab in this repo, not just the abstract Foundry screenshot. Located it: `hcp-profile-editor.tsx` → `<Tabs>` "基本信息"/"语音和数字人" → `voice-avatar-tab.tsx` renders `<AgentConfigLeftPanel>` (left) + `<PlaygroundPreviewPanel>` (right, the "工作台").
  found: `agent-config-left-panel.tsx` has 4 numbered Card sections: (1) VL Instance Summary [to be replaced for personas], (2) Model Deployment via `<AgentFoundationModelSelect>`, (3) `<InstructionsSection>` (auto-gen + override), (4) Knowledge & Tools collapsible.
  implication: Investigate each of sections 2-4 individually against the `AvatarPersona` backend model to determine genuine reusability vs. fabrication, per explicit user instruction to report gaps rather than fake functionality.

- timestamp: 2026-08-03T02:05:00Z
  checked: `agent-foundation-model-select.tsx` + `use-agent-foundation-models.ts` + `api/agent-foundation-models.ts` (Model Deployment section's implementation)
  found: Fully generic — calls `GET /agent-foundation-models` with zero parameters, no HCP/profile scoping whatsoever. Also confirmed via the component's own code comment (D-14) that even on the HCP page this selector is "informational only... local UI state only; not persisted to any hcp_profile field" — i.e. HCP profiles do not persist this value either.
  implication: Safe to reuse as-is for personas with zero backend changes. Non-persistence is not a persona-specific gap — it matches the HCP page's own current (accepted) limitation, so it is honest to include with the same "informational only" framing rather than a fabricated capability.

- timestamp: 2026-08-03T02:10:00Z
  checked: `instructions-section.tsx` (auto-generate half) and `backend/app/models/avatar_persona.py`
  found: "自动生成指令" calls `previewInstructions(form.getValues(), signal)`, which generates instruction text from HCP-only profile fields (`personality_type`, `specialty`, `expertise_areas`, etc.). `AvatarPersona` has none of these fields — only `name`, `character`, `style`, `voice_map`, `greeting_map`, `prompt_fragment`, `enabled`, `is_default`.
  implication: The auto-generate half cannot be genuinely ported — there is no source data to generate from, on either the frontend or backend. Only the manual-override half (a free-text instructions field) has a real persona-side counterpart: `prompt_fragment`. Kept the existing Instructions/prompt_fragment card as-is; explicitly did not add a fake "auto-generate" button with no backing data.

- timestamp: 2026-08-03T02:15:00Z
  checked: `backend/app/models/hcp_knowledge_config.py`
  found: `HcpKnowledgeConfig.hcp_profile_id` is a hard `ForeignKey("hcp_profiles.id", ondelete="CASCADE")` — knowledge-base attachment is structurally HCP-specific at the database level, not a generic capability with an optional HCP scope.
  implication: Genuine backend gap. Reusing this for personas would require a new backend table/schema/service/API (or a schema migration to make the FK polymorphic) — none of which exists today. Per explicit instruction, this was NOT faked with placeholder UI; it is reported here as an open gap for future backend work (see Resolution).

- timestamp: 2026-08-03T02:18:00Z
  checked: `playground-preview-panel.tsx` (the HCP page's "工作台" live-test workbench with the Start button)
  found: Requires either `vlInstanceId` (voice mode → `<VoiceTestPlayground>`) or `agentId` (text-chat mode → `testChatWithAgent`) to function — both HCP-specific concepts. `AvatarPersona` has neither a voice-live-instance assignment nor a Foundry agent assignment.
  implication: A genuinely live/interactive Start-call test cannot be built for personas without significant new backend work (assigning personas to a VL instance or Foundry agent). Confirmed this is correctly excluded from persona functionality; for visual parity with the reference page, added a disabled Start button (not a fake-functional one) with a tooltip explaining why, rather than omitting the affordance entirely or faking a working button.

- timestamp: 2026-08-03T02:25:00Z
  checked: Re-ran `npx tsc -b`, targeted `npx vitest run src/pages/admin/persona-editor.test.tsx` (32 tests, 2 new), full `npx vitest run` (2673 tests), and `npm run build` after the Card restructure + Model Deployment card + disabled Start button + i18n additions.
  found: `tsc -b` 0 errors. Targeted suite 32/32 passed. Full suite 2672/2673 passed — the 1 failure is the same pre-existing, previously-confirmed-unrelated `login.test.tsx` failure (navigate target `/` vs `/user/dashboard`, predates this task). `npm run build` succeeded (same pre-existing chunk-size advisory only).
  implication: Zero regressions from the HCP-parity restructure. All 5 locale files re-validated as loadable JSON with the new `hcp.identity`/`hcp.modelDeployment`/`hcp.playgroundStart` (pre-existing, reused) and `personas.editor.modelDeploymentNote`/`personas.editor.noLiveTestNote` (new) keys resolving correctly in en-US, zh-CN, es-ES, es-MX, es-US.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: /admin/avatar-personas configured personas via a cramped `<Dialog>` modal (`persona-dialog.tsx`) with voice-live-instance-style fields, rather than the full-page layout already implemented elsewhere in this codebase for HCP-facing voice/agent configuration (`hcp-profile-editor.tsx`'s "语音和数字人" tab, structurally: `agent-config-left-panel.tsx` + `playground-preview-panel.tsx`) — a design/UX gap, not a code defect. Round 1 of this fix approximated the Foundry-playground screenshot directly; round 2 (this update) corrects course to mirror the actual in-repo HCP reference page the user specified, on a per-section basis, checking real backend support for each section rather than assuming.
fix: Restructured `frontend/src/pages/admin/persona-editor.tsx`'s left panel from flat `<h3>`/`<Separator />` sections into 5 discrete `<Card>` sections mirroring `agent-config-left-panel.tsx`'s visual convention: (1) Identity (name + is_default toggle), (2) Character & Avatar (avatar/style picker — replaces the HCP page's HCP-specific "VL Instance Summary" card, since personas have no voice-live-instance concept), (3) Speech (per-locale voice + greeting, the other half of what replaces the VL Instance card), (4) Model Deployment — NEW, added `<AgentFoundationModelSelect>` (confirmed generic/backend-agnostic, reused with zero backend changes; kept as informational-only/non-persisted, honestly matching the HCP page's own current D-14 limitation rather than fabricating persistence that doesn't exist for HCP either), (5) Instructions (`prompt_fragment` override field only — the HCP page's "自动生成指令" auto-generate half was NOT ported, since it depends on HCP-only profile fields `AvatarPersona` does not have, so there is no data to generate from). Added a disabled "Start" button with an explanatory tooltip in the right-panel preview card header, mirroring the HCP page's "工作台" Start button for visual parity without faking a live-test capability that has no backing data (personas have no assigned VL instance or Foundry agent for `playground-preview-panel.tsx` to test against). Added 2 new i18n keys (`personas.editor.modelDeploymentNote`, `personas.editor.noLiveTestNote`) across all 5 locales; reused 3 existing keys (`hcp.identity`, `hcp.modelDeployment`, `hcp.playgroundStart`) rather than duplicating persona-specific ones.
  **Explicit backend gaps (not implemented, reported per user instruction rather than faked):**
  - Knowledge Base attachment: `HcpKnowledgeConfig.hcp_profile_id` is a hard `ForeignKey("hcp_profiles.id", ondelete="CASCADE")` — structurally HCP-specific. Reusing for personas requires a new backend table/schema/service/API (or a migration to a polymorphic FK). Not built.
  - Persona-level model-deployment persistence: no `AvatarPersona` column exists for this today, same as `HcpProfile` — if ever desired, requires a new schema field + migration + service wiring on both models.
  - Live/interactive persona test session: requires assigning personas to either a Voice Live instance or a Foundry agent (neither exists for personas today) plus a decoupled test-session-creation mechanism — significant new backend work, not built.
verification: `npx tsc -b` — 0 errors. Targeted `npx vitest run src/pages/admin/persona-editor.test.tsx` — 32/32 passed (30 pre-existing + 2 new: Model Deployment card renders, Start button renders disabled). Full `npx vitest run` — 2672/2673 passed; the 1 failure (`login.test.tsx`) is the same pre-existing, previously `git stash`-confirmed-unrelated failure from before this task. `npm run build` — succeeds (pre-existing chunk-size advisory only). All 5 locale JSON files re-validated (`json.load`) with the new/reused keys resolving correctly in en-US, zh-CN, es-ES, es-MX, es-US. E2E spec (`admin-avatar-personas.spec.ts`) re-reviewed against the Card restructure: all its locators (`#persona-editor-greeting`, `#persona-editor-prompt-fragment`, role/text/placeholder matchers, `data-persona-id`) are DOM-structure-agnostic and remain valid, though not re-run live against a dev server in this round. Not yet verified live in a running browser/dev-server session by the user — that is the pending human-verification step for this round.
files_changed:
  - frontend/src/pages/admin/persona-editor.tsx (restructured left panel into Card sections; added Model Deployment card + foundationModel state; added disabled Start button + tooltip in right panel; added id attributes to greeting/prompt-fragment textareas in round 1)
  - frontend/src/pages/admin/persona-editor.test.tsx (added useAgentFoundationModels mock; added 2 tests for Model Deployment card + disabled Start button)
  - frontend/src/pages/admin/avatar-personas.tsx (round 1: rewritten to navigate() instead of dialog state)
  - frontend/src/components/admin/persona-dialog.tsx (round 1: deleted)
  - frontend/src/components/avatar/persona-switcher.tsx (round 1: comment update only)
  - frontend/src/hooks/use-avatar-personas.ts (round 1: added useAvatarPersona)
  - frontend/src/hooks/use-avatar-personas.test.ts (round 1: added useAvatarPersona tests)
  - frontend/src/router/index.tsx (round 1: added avatar-personas/new + avatar-personas/:id/edit routes)
  - frontend/e2e/admin-avatar-personas.spec.ts (round 1: rewrote createPersonaViaUi for full-page flow)
  - frontend/public/locales/en-US/admin.json (round 1 + round 2: personas.editor.* keys, incl. modelDeploymentNote/noLiveTestNote)
  - frontend/public/locales/zh-CN/admin.json (round 1 + round 2: personas.editor.* keys, incl. modelDeploymentNote/noLiveTestNote)
  - frontend/public/locales/es-ES/admin.json (round 1 + round 2: personas.editor.* keys, incl. modelDeploymentNote/noLiveTestNote)
  - frontend/public/locales/es-MX/admin.json (round 1 + round 2: personas.editor.* keys, incl. modelDeploymentNote/noLiveTestNote)
  - frontend/public/locales/es-US/admin.json (round 1 + round 2: personas.editor.* keys, incl. modelDeploymentNote/noLiveTestNote)
