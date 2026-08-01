# Deferred Items — Phase 34 (Spanish es-i18n)

Items discovered during execution that are out of scope for the current plan (pre-existing issues in files not listed in `files_modified`). Logged per the executor's scope-boundary process rather than fixed inline.

## 34-03: Duplicate top-level keys in `frontend/public/locales/en-US/scoring.json`

**Found during:** Plan 34-03, Task 2 (translating `scoring.json`)

**Issue:** `en-US/scoring.json` (owned by an earlier phase, not touched by this plan) defines several top-level keys twice:
- `voiceScore` — first as a nested object (`{ title, processing, failed, retry, retrying, retryFailed, sessionRecording, audioNotSupported, dimensions: {...} }`, the "Voice Analysis" panel), then again a few lines later as a flat string `"Voice Score"`.
- `contentWeight` — first `"Content (70%)"`, then again `"Content Evaluation Weight"`.
- `voiceWeight` — first `"Voice (30%)"`, then again `"Voice Evaluation Weight"`.

Because `JSON.parse` silently keeps only the **last** occurrence of a duplicate key, the entire nested "Voice Analysis" translation sub-tree (title/processing/failed/retry/retrying/retryFailed/sessionRecording/audioNotSupported/dimensions.clarity/pace/confidence/engagement/articulation) is dead — it parses out of the object and is unreachable by any i18next lookup (`t("scoring.voiceScore.title")` would resolve to `undefined`, not the intended "Voice Analysis" string). The two `*Weight` duplicates similarly mean the "(70%)"/"(30%)" percentage-labeled variants are unreachable; only the "Evaluation Weight" labels are ever used at runtime.

**Scope decision:** `en-US/scoring.json` is not in this plan's `files_modified` list and this bug predates plan 34-03 — out of scope per the deviation-rules scope boundary (pre-existing issue in a file this plan doesn't own). Not fixed here.

**Impact on this plan's translations:** The es-ES/es-MX/es-US `scoring.json` files created in 34-03 mirror the *effective* (post-`JSON.parse`, deduplicated) key structure of `en-US/scoring.json` — i.e. `voiceScore`/`contentWeight`/`voiceWeight` are flat translated strings ("Puntuación de Voz"/"Peso de Evaluación de Contenido"/"Peso de Evaluación de Voz" for es-ES; "Puntaje de Voz"/... for es-MX/es-US), matching exactly what `locale-parity.test.ts`'s `collectLeaves()` sees when it parses `en-US/scoring.json`. This makes the parity tests pass but means the es-* locales inherit the same dead-code gap: there is no translated "Voice Analysis" panel sub-tree (clarity/pace/confidence/engagement/articulation dimension labels, retry/retrying copy, etc.) in any locale, Spanish or English, because none of it is reachable at runtime.

**Suggested resolution (future plan):** Rename the duplicate keys in `en-US/scoring.json` to restore the intended distinct sub-trees (e.g. `voiceAnalysis` for the nested panel vs. `voiceScore` for the flat "Voice Score" label; `contentWeightPct`/`voiceWeightPct` for the "(70%)"/"(30%)" display labels vs. `contentWeight`/`voiceWeight` for the "Evaluation Weight" labels), then add the corresponding translated sub-trees to all five locale files, including the two already-translated es-* files from this plan.
