---
phase: 38-voice-mode-config-foundry-portal
reviewed: 2026-08-04T06:13:31Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - backend/alembic/versions/g40a_add_hcp_direct_voice_config.py
  - backend/app/api/hcp_profiles.py
  - backend/app/models/hcp_profile.py
  - backend/app/schemas/hcp_profile.py
  - backend/app/services/agent_sync_service.py
  - backend/app/services/hcp_profile_service.py
  - backend/app/services/voice_live_instance_service.py
  - backend/tests/test_hcp_profile_voice.py
  - backend/tests/test_voice_live_instance_service.py
  - backend/tests/test_hcp_profiles_api.py
  - backend/tests/test_agent_sync_service.py
  - backend/tests/test_conference_service.py
  - backend/tests/test_hcp_agent_sync_integration.py
  - backend/tests/test_voice_live_instance.py
  - backend/tests/test_voice_live_model.py
  - backend/tests/test_voice_live_per_hcp.py
  - backend/tests/test_voice_live_websocket.py
  - frontend/src/pages/admin/hcp-profile-editor.tsx
  - frontend/src/pages/admin/hcp-profile-editor.test.tsx
  - frontend/src/pages/admin/persona-editor.tsx
  - frontend/src/pages/admin/persona-editor.test.tsx
  - frontend/src/types/hcp.ts
  - frontend/src/components/admin/agent-config-left-panel.tsx
  - frontend/src/components/admin/agent-config-left-panel.test.tsx
  - frontend/src/components/admin/avatar-character-gallery.tsx
  - frontend/src/components/admin/avatar-character-gallery.test.tsx
  - frontend/src/lib/voice-constants.ts
  - frontend/src/__tests__/hcp-editor-tabs.test.tsx
  - frontend/e2e/admin-avatar-personas.spec.ts
  - frontend/e2e/hcp-editor-voice-tab.spec.ts
  - frontend/public/locales/en-US/admin.json
  - frontend/public/locales/es-ES/admin.json
  - frontend/public/locales/es-MX/admin.json
  - frontend/public/locales/es-US/admin.json
  - frontend/public/locales/zh-CN/admin.json
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-08-04T06:13:31Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Phase 38 (VMODE-01, 2026-08-04 rescope) moves HCP voice-mode config from a
mandatory linked `VoiceLiveInstance` back onto 6 direct inline `HcpProfile`
columns (`voice_live_model`, `voice_name`, `recognition_language`,
`avatar_character`, `avatar_style`, `avatar_enabled`), Foundry-portal style.
This reverses two prior decisions (D-09's column drop, D-13's mandatory-link
requirement) and is implemented consistently and correctly across every layer
inspected: Alembic migration (columns + SQL backfill from any previously-linked
instance), SQLAlchemy model, Pydantic schemas, the central
`resolve_voice_config()` function, `build_voice_live_metadata()`, TypeScript
types, Zod schema, React form defaults, the new "Voice & Avatar Configuration"
card, the shared `AvatarCharacterGallery` component (reused by both the HCP
editor and the persona editor), and `voice-constants.ts`. Default values for
the 6 fields match across DB migration server-defaults, ORM column defaults,
Pydantic schema defaults, TS types, Zod schema, and React form defaultValues —
no drift found. Locale content (en-US/es-ES/es-MX/es-US/zh-CN `admin.json`) is
fully consistent — 0 missing/extra keys, and phase-38-specific strings were
spot-checked for correct wording in all 5 locales.

Backend and frontend test suites were updated thoroughly and correctly to
match the new (VMODE-01) contract — real-DB integration tests prove
`resolve_voice_config()` genuinely ignores a linked `VoiceLiveInstance` even
when one is present with divergent values, which is the core correctness
property of this phase.

No critical or security issues were found. Two warnings are noted below: one
behavioral UX-trap risk around legacy `VoiceLiveInstance` CRUD endpoints that
now silently have no effect on an HCP's actual voice config, and one set of
stale test comments referencing a reversed decision (D-10) that could mislead
future maintainers. Three minor info-level code-clarity/consistency notes are
also included.

## Warnings

### WR-01: Editing or assigning a legacy VoiceLiveInstance silently has no effect on HCP voice config

**File:** `backend/app/services/voice_live_instance_service.py:81` (`update_instance`) and `:170` (`assign_to_hcp`)
**Issue:** Both `update_instance()` and `assign_to_hcp()` still trigger an agent
metadata re-sync via `build_voice_live_metadata(profile)` (lines ~116 and
~200), but since VMODE-01, `resolve_voice_config()` reads exclusively from the
profile's own 6 inline columns and no longer consults
`profile.voice_live_instance` at all. An admin who edits an existing
`VoiceLiveInstance`'s `voice_name`/`avatar_character`/etc., or assigns a
different instance to an HCP, will see the re-sync fire (implying the change
took effect) but the HCP's actual resolved voice config — and thus the agent's
live voice/avatar behavior — will be completely unaffected. This is
intentional per VMODE-01 and confirmed by tests (e.g.
`test_resolve_config_ignores_instance_uses_inline` in
`test_voice_live_instance.py`), but nothing in the VL Instance management UI
or API response currently warns the admin that the instance is now
display/legacy-only for any profile it's linked to. This is not documented in
`.planning/phases/38-voice-mode-config-foundry-portal/deferred-items.md`.
**Fix:** Either (a) stop triggering a metadata re-sync from `update_instance`/
`assign_to_hcp` since it now does nothing to the target profile's live config
(avoids a wasted Azure API call and a misleading no-op), or (b) surface an
explicit "legacy/no effect" notice in the VL Instance admin UI and/or add a
one-line docstring warning to both service functions, e.g.:
```python
async def update_instance(...):
    """Update a VoiceLiveInstance record.

    VMODE-01: this is a legacy/display-only entity as of the g40a migration --
    updating it does NOT affect any HCP's resolved voice config, since
    resolve_voice_config() reads exclusively from the profile's own inline
    columns. The re-sync call below is effectively a no-op for voice/avatar
    fields; retained only in case other (non-voice) profile fields are synced
    by the same call path.
    """
```

### WR-02: Stale D-10 references in HCP editor test comments contradict current (VMODE-01) behavior

**File:** `frontend/src/pages/admin/hcp-profile-editor.test.tsx:395`, `:466`
**Issue:** Line 395 (`// Assign a Voice Live Instance (D-10 -- required on
save)`) and line 466 (`/* ---- D-10: VL Instance required at save time (Task 1
behaviors) ---- */`) both reference D-10's "VL Instance required at save"
rule, which VMODE-01 reverses (a `voice_live_instance_id` is now fully
optional/nullable at save time — see the three `hcpSchema` tests directly
below line 466, which correctly assert non-empty/empty/null are all accepted).
The comments are misleading to a future reader skimming the file for current
save-time validation rules, even though the assertions themselves are
correct.
**Fix:** Update the comments to reflect the current contract, e.g.:
```ts
// Assign a Voice Live Instance (optional, vestigial as of VMODE-01 -- not
// required to save; exercised here only to keep this flow representative of
// a fully-populated form).
```
and
```ts
/* ---- voice_live_instance_id is optional at save time (vestigial, VMODE-01 reverses D-10) ---- */
```

## Info

### IN-01: Duplicate "Model Deployment" label used for two different concepts on the same page

**File:** `frontend/src/components/admin/agent-config-left-panel.tsx:75`, `:166`
**Issue:** The i18n key `admin:hcp.modelDeployment` ("Model Deployment") is
rendered for both the new VMODE-01 "Voice & Avatar Configuration" card's
`VoiceLiveModelSelect` label (line 75) and the separate, decorative "Agent
Foundation Model" card further down the page (line 166). These are two
unrelated concepts (Voice Live model deployment vs. Agent Foundation model,
per D-14) sharing identical visible text on the same page, which can confuse
admins and complicates E2E/manual QA scoping (the `hcp-editor-voice-tab.spec.ts`
E2E spec already has to add an explicit comment/workaround about this — see
its "Model Deployment selector is interactive" test).
**Fix:** Give the two cards distinct label keys, e.g. `admin:hcp.voiceModelDeployment`
("Voice Model Deployment") vs. `admin:hcp.agentModelDeployment` ("Agent Foundation Model Deployment"),
and update both call sites plus all 5 locale files.

### IN-02: Unreachable `.get()` fallback defaults in `build_voice_live_metadata` no longer match hardcoded values

**File:** `backend/app/services/agent_sync_service.py:162`, `:183`
**Issue:** `vc.get("voice_temperature", 0.8)` and
`vc.get("turn_detection_type", "azure_semantic_vad")` use fallback defaults
that no longer correspond to anything `resolve_voice_config()` can actually
return — since VMODE-01, that function unconditionally returns
`voice_temperature: 0.9` and `turn_detection_type: "server_vad"` (confirmed by
`resolve_voice_config()`'s hardcoded literals and by the corresponding test
suite, e.g. `test_build_voice_live_metadata_never_returns_none_since_vmode01`
and related tests in `test_agent_sync_service.py`). The `.get(..., 0.8)` and
`.get(..., "azure_semantic_vad")` fallback branches are therefore dead code
paths that could mislead a future maintainer into thinking `0.8`/
`"azure_semantic_vad"` are still reachable defaults.
**Fix:** Replace the `.get()` calls with direct key access (since the key is
now always present), or update the fallback literals to match the current
hardcoded values, with a comment noting they're vestigial safety nets:
```python
# vc always carries these two keys since VMODE-01 (resolve_voice_config
# hardcodes them) -- .get() defaults are a vestigial safety net only.
voice_temp = vc.get("voice_temperature", 0.9)
...
turn_detection_type = vc.get("turn_detection_type", "server_vad")
```

### IN-03: `avatar_character` default mismatch between `HcpProfile` ("lisa") and legacy VL instance factory ("lori")

**File:** `frontend/src/lib/voice-constants.ts:80`
**Issue:** `createDefaultVlInstanceForm()` defaults `avatar_character` to
`"lori"`, while every other default for this field across the phase-38 stack
(HcpProfile ORM column, Pydantic schema, TS types, Zod schema, React form
defaultValues) is `"lisa"`. Since `VoiceLiveInstance` is now legacy/display-
only per VMODE-01, this has no functional impact on resolved voice config, but
it's a latent inconsistency that could confuse anyone still using the legacy
VL Instance management pages (e.g. seeing a different default avatar there
than what a fresh HCP profile actually uses).
**Fix:** Align the default to `"lisa"` for consistency, or add a short
comment explaining the intentional divergence if there is one:
```ts
avatar_character: "lisa", // aligned with HcpProfile's inline default (VMODE-01)
```

---

_Reviewed: 2026-08-04T06:13:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
