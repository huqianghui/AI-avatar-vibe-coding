# Phase 34: Spanish (es) i18n - Research

**Researched:** 2026-08-01
**Domain:** i18next/react-i18next locale expansion (5-locale key parity) + Azure Speech es-* neural voice wiring for an existing Voice Live avatar pipeline
**Confidence:** HIGH (i18next resolution mechanics verified directly against installed `node_modules` source; backend locale branch points verified by direct code read; Azure voice names verified against official Microsoft Learn docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**西语变体范围与翻译产出（LANG-01）**
- **D-01: 三套完整西语 locale** — es-ES / es-MX / es-US 各自独立：UI 翻译文件（`public/locales/{lng}/` 16 个 namespace 全量）、切换器选项、拒答模板、neural voice；用户明确要求「从 UI、翻译到口语都区分开」，不是单套中性西语
- **D-02: Claude 直接生成全部翻译** — 以 en-US 为源文本逐 namespace 生成三套 es；es-ES 用伊比利亚半岛用词（vosotros/ordenador 等），es-MX 与 es-US 用拉美用词（ustedes/computadora），整体采用正式 usted 敬称语域（专业场景）；POC 阶段不引入外部翻译流程
- **D-03: 未翻译白名单** — 品牌名/专有名词等三语相同的值通过白名单豁免「未翻译检测」，白名单初始清单由实现时确定

**Key-parity 校验机制（LANG-01 成功标准）**
- **D-04: vitest 全局 parity 测试** — 新增测试遍历 `frontend/public/locales/` 下全部 namespace JSON，递归比对 5 个 locale 的 key 集合完全一致；随 `npm test` 运行，CI 自然覆盖，不新增工具链
- **D-05: 三重深度校验** — 除 key 齐全外：① 空值检查（翻译值不得为空串/纯空白）② 插值占位符一致（同一 key 的 `{{var}}` 变量名跨语言一致）③ 未翻译检测（es 值 == en-US 值视为可疑，白名单豁免）

**es 语音与回退（LANG-02）**
- **D-06: voice_map 按 locale 1:1 扩展** — `PublicKnowledgeConfig.voice_map` JSON 新增 `es-ES`/`es-MX`/`es-US` 三个 key（结构 Phase 32 已预留）；Admin 公共配置页可编辑，预置 Azure 默认音色：es-ES-ElviraNeural / es-MX-DaliaNeural / es-US-PalomaNeural
- **D-07: 内置默认回退，不阻断** — 会话创建时所选 locale 在 voice_map 未配置 → 回退到该 locale 的内置默认音色常量；绝不因缺配置阻断会话
- **D-08: 拒答模板补齐三个 es-\* key** — `avatar_service.py` REFUSAL_TEMPLATES（及 personalized 变体）新增 es-ES/es-MX/es-US 条目，用词按变体区分

**切换器 UX 与 locale 解析**
- **D-09: 切换器 5 选项** — zh-CN 🇨🇳 / en-US 🇺🇸 / es-ES 🇪🇸 / es-MX 🇲🇽 / es-US 🇺🇸；西语 label 用本地语自称（如 Español (España) / Español (México) / Español (EE. UU.)），`common.json` 的 `lang.*` key 相应扩展；es-US 与 en-US 旗帜相同，靠 label 区分
- **D-10: 浏览器检测归一到 es-ES** — navigator 报 `es` 或未列出的 es-* 变体（es-AR 等）时解析到 es-ES（canonical 西语默认）；i18next fallback 链 es-* → es-ES → en-US；具体用 supportedLngs + fallbackLng 映射实现，细节 research 确认
- **D-11: mid-session 切语言重建会话** — 沿用现有 `avatar-page.tsx` 行为（`i18n.language` 变化触发重连），成功标准明确允许 rebuild 而非 live reconnect；无需新代码路径，仅验证 es-* 走通

### Claude's Discretion
- i18next supportedLngs/fallbackLng/nonExplicitSupportedLngs 的具体配置组合
- 未翻译白名单的初始条目
- 默认音色常量的存放位置（config vs service 常量）
- Admin voice_map 编辑 UI 对三个新 key 的呈现样式
- Playwright E2E 中语音链路的 mock 深度（真实 WebRTC 不可在 CI 建连）

### Deferred Ideas (OUT OF SCOPE)
- 更多西语变体（es-AR/es-CO 等）与其它语言扩展 — 检测归一规则（D-10）已为未列出变体兜底
- Legacy coach 隐藏与布局统一 — Phase 35
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANG-01 | UI 全量支持西班牙语（es）— 所有 locale namespace 补齐 es 翻译（3 变体），语言切换器含 es，含 key-parity 校验 | §Standard Stack (i18next config), §Namespace Inventory, §Code Examples (parity test), §Language Switcher findings |
| LANG-02 | 数字人可用西班牙语语音回答（es-* neural voice） | §Azure Voice Names, §Backend Locale Branch Points, §Common Pitfalls (webrtc pattern regex, single-locale voice fallback) |
</phase_requirements>

## Summary

Phase 34 is a **pure expansion of an existing, working i18n + voice pipeline** — no new subsystem, no schema migration, no new library. The three new locales (es-ES/es-MX/es-US) slot into the same `frontend/public/locales/{lng}/*.json` HTTP-backend structure, the same `voice_map` JSON column on `PublicKnowledgeConfig`, and the same `REFUSAL_TEMPLATES` dict already used for zh-CN/en-US. The bulk of the work is **content generation** (48 new JSON files: 16 namespaces × 3 variants) plus **five surgical code edits** to remove hardcoded 2-locale assumptions.

Three of those five edits are **not optional polish — they are functional blockers** for LANG-02 discovered during this research, not previously flagged in CONTEXT.md's code-context section:
1. `WebrtcSessionRequest.locale` has a hardcoded Pydantic `pattern="^(zh-CN|en-US)$"` — any es-* WebRTC session request will get a **422 Unprocessable Entity** until this regex is widened. This is the single highest-risk item in the phase.
2. `create_public_webrtc_session_config`'s voice fallback is a single global constant `"en-US-AvaNeural"` regardless of requested locale — D-07's "fall back to *that locale's* built-in voice" is not yet true; today an unconfigured es-* locale would silently get an English voice.
3. The anonymous **text-chat** path (`POST /public/avatar/chat`) never sends `locale` at all — `handle_anonymous_turn` always defaults to `"zh-CN"`, so adding es-* keys to `REFUSAL_TEMPLATES` has no effect on anonymous text refusals unless this wiring gap is also closed (the personalized text-chat path already forwards `i18n.language` correctly — only the anonymous one is missing it).

Separately, this research found **no admin UI or admin API exists yet** for editing `PublicKnowledgeConfig.voice_map` (Phase 32 planned one in its CONTEXT.md but none of its 5 executed plans built it) — D-06's "Admin 公共配置页可编辑" cannot be satisfied by extending an existing page; one does not exist to extend. See Open Questions.

On the good-news side, deep verification of the installed `i18next`/`i18next-browser-languagedetector` source (v25.10.5 / v8.2.1, exactly what's pinned in `package.json`) proves that **D-10's browser-detection-normalization requirement needs no custom code at all** — i18next's built-in prefix-matching fallback in `LanguageUtils.getBestMatchFromCodes()` already resolves a bare `"es"` or an unlisted `"es-AR"` to the first `es-*` entry in `supportedLngs`, as long as `"es-ES"` is listed before `"es-MX"`/`"es-US"` in the array. This removes an entire category of planned effort (object-form `fallbackLng` chains or `convertDetectedLanguage` callbacks).

**Primary recommendation:** Order `supportedLngs` as `["zh-CN", "en-US", "es-ES", "es-MX", "es-US"]` (es-ES before the other two es-* entries) and keep `fallbackLng: "en-US"` unchanged; widen the WebrtcSessionRequest locale regex to `^(zh-CN|en-US|es-ES|es-MX|es-US)$`; introduce a single `DEFAULT_VOICE_BY_LOCALE` constant dict reused by both the `voice_map.get()` fallback in `public_avatar.py` and the hardcoded fallback in `voice_live_webrtc.py`; generate 48 translation files with Claude directly (D-02); write one new global vitest parity test file that `fs.readdirSync`s the namespace list dynamically (not a hardcoded array) so it never drifts from the real files on disk.

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version (installed) | Purpose | Confidence |
|---------|---------|---------|--------------|
| i18next | 25.10.5 | Core i18n engine, language resolution/fallback | [VERIFIED: `frontend/node_modules/i18next/package.json`] |
| react-i18next | 16.6.2 | React bindings, `useTranslation` | [VERIFIED: `frontend/package.json`] |
| i18next-http-backend | 3.0.2 | Loads `/locales/{{lng}}/{{ns}}.json` at runtime (not bundled) | [VERIFIED: `frontend/package.json`] |
| i18next-browser-languagedetector | 8.2.1 | navigator/localStorage language detection | [VERIFIED: `frontend/node_modules/i18next-browser-languagedetector/package.json`] |
| vitest | (existing) | Frontend unit tests incl. new parity test | [VERIFIED: `frontend/package.json` scripts] |
| Playwright | ^1.48.0 | E2E — language-switch + mocked voice flow | [VERIFIED: `frontend/package.json`] |

**No `npm install` needed.** Registry check for a possible upgrade is informational only (out of scope): `i18next` latest on npm is `26.3.6`, `react-i18next` latest is `17.0.11` — both ahead of the pinned versions, but upgrading is not required by this phase and introduces unrelated risk; stay on the pinned versions. [VERIFIED: `npm view i18next version` / `npm view react-i18next version`]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native i18next prefix-match fallback for D-10 | Custom `detection.convertDetectedLanguage` callback, or object-form `fallbackLng: {es: [...], default: [...]}` | Both work, but are unnecessary — the native algorithm already produces the required result (see §Locale Resolution Mechanics). Only reach for `convertDetectedLanguage` if the planner wants to *also* remap non-`es` inputs, which is out of scope. |
| `fs.readFileSync` for locale JSON in vitest (existing pattern) | `import.meta.glob` on `public/locales/**` | `public/` is served as static assets, not part of Vite's module graph by default for `import.meta.glob` (it globs `src`-relative or explicitly-configured paths) — the codebase's own precedent (`hcp-editor-tabs.test.tsx`) already uses `fs.readFileSync` + `path.resolve(__dirname, ...)`, avoiding any Vite-transform-of-JSON edge cases with non-ASCII (Chinese/Spanish) content. Follow the existing pattern rather than introducing a new one. |

**Version verification performed:**
```bash
npm view i18next version        # 26.3.6 (registry) — 25.10.5 pinned, no upgrade needed
npm view react-i18next version  # 17.0.11 (registry) — 16.6.2 pinned, no upgrade needed
npm view i18next-browser-languagedetector versions --json  # latest 8.2.1 — matches pinned
```

## Locale Resolution Mechanics (D-10) — Verified Against Installed Source

This is the most non-obvious finding of this research and directly resolves D-10 ("navigator reports bare `es` or an unlisted `es-AR` → resolves to `es-ES`; explicit `es-MX`/`es-US` stick").

**Verified mechanism** [VERIFIED: read directly from `frontend/node_modules/i18next/dist/esm/i18next.js`, `LanguageUtils.getBestMatchFromCodes()`, lines ~944-969, and `frontend/node_modules/i18next-browser-languagedetector/dist/esm/i18nextBrowserLanguageDetector.js` line 428]:

1. The browser detector's `detect()` returns the raw list of detected candidate codes (e.g. `["es-AR", "es", "en"]` from `navigator.languages`) — it does **not** resolve them itself when `services.languageUtils.getBestMatchFromCodes` exists (i18next ≥ v19.5, true here).
2. i18next core then calls `languageUtils.getBestMatchFromCodes(detectedCodes)`, which:
   - **Pass 1** — exact match: for each candidate in order, check if it (after `Intl.getCanonicalLocales` normalization) is literally present in `supportedLngs`. An explicit `"es-MX"` or `"es-US"` request matches here and **sticks immediately** — this satisfies the "explicit selections stick" half of D-10.
   - **Pass 2** (only if pass 1 found nothing) — for each candidate, try its language-only part (`"es-AR"` → `"es"`) against `supportedLngs`; if still no exact hit, run:
     ```js
     found = this.options.supportedLngs.find(supportedLng => {
       if (supportedLng.indexOf('-') > 0 && lngOnly.indexOf('-') < 0 &&
           supportedLng.substring(0, supportedLng.indexOf('-')) === lngOnly) return supportedLng;
     });
     ```
     This returns the **first** entry in the `supportedLngs` array whose prefix (before its own `-`) equals the reduced language-only code. Since `"es-ES"`, `"es-MX"`, `"es-US"` **all** satisfy the prefix test for `lngOnly === "es"`, `Array.find` returns whichever one appears **first in the array**.
   - If nothing matches at all, falls through to `fallbackLng`.

**Practical consequence:** with
```js
supportedLngs: ["zh-CN", "en-US", "es-ES", "es-MX", "es-US"]  // es-ES BEFORE es-MX/es-US
fallbackLng: "en-US"
```
- Browser reports `"es"` or `"es-AR"`/`"es-CO"`/any unlisted es-variant → language-only reduces to `"es"` → prefix-matches `"es-ES"` first → **resolves to `es-ES`.** ✅ matches D-10.
- Browser reports exactly `"es-MX"` or `"es-US"` → exact match in Pass 1 → **sticks as requested.** ✅ matches D-10.
- Browser reports something unrelated (`"fr"`, `"ja"`) → no prefix match possible → falls to `fallbackLng: "en-US"`. ✅ unchanged existing behavior.

**No `nonExplicitSupportedLngs`, no object-form `fallbackLng`, no `convertDetectedLanguage` callback is required.** `nonExplicitSupportedLngs` solves the *opposite* direction (a base language in `supportedLngs` implicitly supporting its variants) and would not help here since no bare `"es"` entry exists in the array — do not add one, or `i18n.language` could itself resolve to `"es"` and attempt to load a non-existent `/locales/es/*.json` directory.

**Order dependency is load-bearing.** The planner/executor must place `"es-ES"` before `"es-MX"` and `"es-US"` in the `supportedLngs` array literal — this is a one-line ordering requirement, easy to get backwards, worth an explicit code comment and a dedicated unit test assertion (`expect(supportedLngs.indexOf("es-ES")).toBeLessThan(supportedLngs.indexOf("es-MX"))`).

**Existing test to update:** `frontend/src/i18n/index.test.ts` currently asserts `expect(config["supportedLngs"]).toEqual(["en-US", "zh-CN"])` — this must become the 5-entry array in the exact chosen order, and a new assertion for the ordering invariant above should be added.

## Namespace Inventory (for sizing translation tasks)

All 16 namespaces exist today only in `en-US`/`zh-CN`; es-ES/es-MX/es-US each need all 16 mirrored. Top-level key counts below [VERIFIED: `python3 -c "len(json.load(...))"` per file — note these are *top-level* key counts; several namespaces (`admin.json` especially) nest sub-objects, so total leaf-string count is higher than shown]:

| Namespace | Top-level keys (en-US) | File size (en-US) | Notes |
|-----------|------------------------|--------------------|-------|
| admin.json | 16 | 34,029 bytes | Largest file — heavily nested (includes `hcp.*` sub-object with 25+ leaf keys alone) |
| voice.json | 47 | 6,177 bytes | Voice/avatar UI strings — directly on the LANG-02 critical path |
| analytics.json | 82 | 3,257 bytes | Flat structure, many short keys |
| training.json | 39 | 1,457 bytes | |
| scoring.json | 36 | 4,265 bytes | |
| conference.json | 22 | 1,464 bytes | |
| dashboard.json | 23 | 967 bytes | |
| nav.json | 19 | 550 bytes | |
| session.json | 16 | 1,585 bytes | |
| skill.json | 11 | 10,488 bytes | Nested — large despite few top-level keys |
| meta-skill.json | 10 | 1,916 bytes | |
| auth.json | 12 | 435 bytes | |
| common.json | 51 | 2,143 bytes | **Contains `lang.*` switcher labels — must gain 3 new keys (D-09)** |
| avatar.json | 7 | 1,024 bytes | Smallest — directly on the LANG-01/02 critical path (avatar-page.tsx strings) |
| coach.json | 3 | 2,098 bytes | Legacy coach — low priority relative to avatar path but still needs parity |
| prompts.json | 4 | 3,418 bytes | |

**Total production: 16 namespaces × 3 new locale directories = 48 new JSON files.** Task sizing should group by namespace, not by locale, so all three es-* variants of one namespace are produced together (same source-of-truth en-US pass, easier to keep D-02's register consistent across variants in one sitting).

**Structural rule confirmed from `i18n/index.ts`:** namespace list is a hardcoded array (`ns: [...]`) that already lists exactly these 16 — no namespace add/remove needed, only new locale directories.

## Backend Locale Branch Points (exhaustive — LANG-02 scope)

Grepped every `zh-CN`/`en-US` literal in `backend/app` (excluding tests/`__pycache__`) [VERIFIED: direct grep + read]. Confirmed scope boundary: only the **public/personalized avatar surface** (Phase 32/33) is in Phase 34 scope. The many other `zh-CN`/`en-US` hits (`voice_live_service.py`, `voice_live_websocket.py`, `agent_sync_service.py`, `tts/azure.py`, `stt/azure.py`, `speech.py`, `pronunciation_assessment_service.py`) belong to the **legacy HCP-training coach voice pipeline** (pre-Phase-32) — untouched by CONTEXT.md's decisions and explicitly out of this phase's boundary (that surface is scheduled for hiding, not extension, in Phase 35). Do not touch them.

In-scope branch points:

| File:Line | Current state | Required change |
|-----------|---------------|------------------|
| `backend/app/schemas/public_avatar.py:51` | `locale: str = Field(default="zh-CN", pattern="^(zh-CN\|en-US)$")` on `WebrtcSessionRequest` | **BLOCKING** — widen pattern to `^(zh-CN\|en-US\|es-ES\|es-MX\|es-US)$` or the anonymous voice WebRTC session endpoint 422s on any es-* request |
| `backend/app/schemas/personalized_avatar.py:29` | `locale: str = "zh-CN"` on `PersonalizedChatRequest` — **no pattern constraint** | No change required — already accepts any string, es-* passes through today |
| `backend/app/services/avatar_service.py:31-36` | `REFUSAL_TEMPLATES = {"zh-CN": ..., "en-US": ...}` | Add 3 new keys: `es-ES`, `es-MX`, `es-US` (D-08) — imported and reused verbatim by `personalized_avatar_service.py` |
| `backend/app/services/voice_live_webrtc.py:284` | `"name": voice_name or "en-US-AvaNeural"` inside `create_public_webrtc_session_config` | Replace single hardcoded fallback with a locale-aware default (see below) — currently violates D-07 for any non-en-US locale whose `voice_map` entry is empty |
| `backend/app/api/public_avatar.py:80-81` | `voice_map = json.loads(...); voice = voice_map.get(body.locale, "")` | The `""` default flows into the single-fallback above; needs to become locale-aware together with the previous row |
| `backend/app/models/public_knowledge_config.py:24` | `voice_map: Mapped[str] = mapped_column(Text, default="{}")` — free-form JSON `Text` column | No schema/migration change needed — already accepts arbitrary locale keys (confirms CONTEXT.md's "Phase 32 已预留" claim) |

**Recommended fallback design (Claude's Discretion per CONTEXT.md, no user constraint dictates location):** a single module-level constant, e.g. in `voice_live_webrtc.py` (co-located with its only two call sites):
```python
DEFAULT_PUBLIC_VOICE_BY_LOCALE = {
    "zh-CN": "zh-CN-XiaoxiaoMultilingualNeural",
    "en-US": "en-US-AvaNeural",
    "es-ES": "es-ES-ElviraNeural",
    "es-MX": "es-MX-DaliaNeural",
    "es-US": "es-US-PalomaNeural",
}
```
used at the `public_avatar.py` call site as `voice_map.get(body.locale) or DEFAULT_PUBLIC_VOICE_BY_LOCALE.get(body.locale, "en-US-AvaNeural")`, so `create_public_webrtc_session_config`'s own inline fallback becomes dead code once callers always pass a non-empty value (or keep it as a final defensive floor — harmless either way).

## Frontend Locale Flow (LANG-02 end-to-end, verified)

Confirmed the full chain from UI language to voice, and one real gap in it:

1. `avatar-page.tsx` — `useAnonymousVoiceLive(sessionToken, { locale: i18n.language })`, and `attemptMicConnect()` calls `voiceLive.connect(i18n.language)` [VERIFIED: `frontend/src/pages/avatar-page.tsx:118-143`].
2. `use-anonymous-voice-live.ts` — `connect(locale)` → `fetchAnonymousWebrtcSession(sessionToken, locale)` → POST `/public/avatar/webrtc/session` body `{ locale }` [VERIFIED: `frontend/src/hooks/use-anonymous-voice-live.ts:225-230`, `frontend/src/api/public-avatar.ts:112-125`]. This hook's own doc-comment already flags the exact blocker found above: *"Locale for voice selection; must match the backend's `WebrtcSessionRequest.locale` pattern ("zh-CN" | "en-US")"* — i.e. the code itself documents that only 2 locales currently pass backend validation.
3. Backend resolves voice from `PublicKnowledgeConfig.voice_map` keyed by that locale (see previous section) → returned in `WebrtcSessionResponse.session_config.voice.name` → used by Azure Voice Live for TTS.
4. **Text chat gap:** `sendAnonymousChat(sessionToken, message)` [VERIFIED: `frontend/src/api/public-avatar.ts:96-109`] sends **no `locale` field at all** — the backend's `ChatRequest` schema has no `locale` field either [VERIFIED: `backend/app/schemas/public_avatar.py:19-26`], and `public_avatar.py`'s `chat()` endpoint calls `handle_anonymous_turn(db, session, body.message, public_config)` with **no `locale` kwarg**, so it always uses the function's default `"zh-CN"`. This means today, even for existing en-US users, an anonymous text-chat refusal is always shown in Chinese — a pre-existing, previously-invisible bug that becomes visible/relevant once es-* refusal templates are added, because the success criterion implies es-speaking users should see an es refusal, and text-chat currently cannot deliver that for **any** non-zh-CN locale.
   - By contrast, the **personalized** text-chat path is already correct: `usePersonalizedAvatarChat` resolves `i18n.language` internally and `sendPersonalizedChat(sessionId, message, i18n.language)` forwards it [VERIFIED: `frontend/src/hooks/use-personalized-avatar-chat.ts:34`, `frontend/src/api/personalized-avatar.ts:48-59`], and `PersonalizedChatRequest.locale` has no pattern restriction, through to `handle_personalized_turn(..., locale=body.locale)` [VERIFIED: `backend/app/api/personalized_avatar.py:61-63`].
   - **Planner decision needed:** whether closing the anonymous-chat locale gap (add `locale` field to `ChatRequest`, thread it through `chat()` → `handle_anonymous_turn()`, and have `sendAnonymousChat` send `i18n.language`) is in scope for Phase 34. CONTEXT.md's D-08 ("拒答模板补齐三个 es-* key") implies the templates should be *reachable*; without this fix the new es-* anonymous-chat refusal templates are unreachable dead data for text (voice path is unaffected — it already threads locale correctly per step 1-2 above).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Bare `"es"`/unlisted `es-AR` → `es-ES` resolution | Custom `convertDetectedLanguage` callback, or object-form `fallbackLng` map | Correct `supportedLngs` array ordering (see §Locale Resolution Mechanics) | i18next's built-in prefix-match algorithm already does this — verified against installed source; extra code would be redundant and a future-maintenance surface |
| Locale JSON key-parity diffing | A bespoke deep-diff npm package | Plain recursive object-walk in the new vitest test (same complexity as the existing single-namespace check in `hcp-editor-tabs.test.tsx`, generalized to loop namespaces/locales) | The comparison is a straightforward recursive key-set equality + string non-empty + `{{var}}` regex extraction — no library adds value at this scale (16 namespaces × 5 locales) |
| Locale-specific voice defaults | Per-request Azure voice lookup/API call | A static Python dict constant (`DEFAULT_PUBLIC_VOICE_BY_LOCALE`) | Voice names are a fixed, small, admin-overridable set — a network call to "discover" the default would add latency/failure modes for no benefit; this mirrors the existing pattern already in the codebase (`voice_live_webrtc.py`'s pre-existing single hardcoded default) |

**Key insight:** every piece of this phase has a direct existing precedent in the codebase (2-locale i18n config → 5-locale; 2-key REFUSAL_TEMPLATES dict → 5-key; 1-key voice fallback → 5-key map). Resist the urge to introduce new abstractions (e.g. a "LocaleRegistry" class, a generic locale-fallback library) — the existing dict/array patterns scale to 5 entries without any structural change.

## Common Pitfalls

### Pitfall 1: WebRTC session 422 on any es-* request (BLOCKING)
**What goes wrong:** Voice connect silently fails (or surfaces a generic error toast) for any es-* locale until `WebrtcSessionRequest.locale`'s Pydantic `pattern` regex is widened.
**Why it happens:** `frontend/src/hooks/use-anonymous-voice-live.ts` already documents this constraint in its own comment, so it's a "known but not yet acted on" gap, not a hidden one.
**How to avoid:** Make this the very first backend code change in the plan — LANG-02's whole voice path is dead until it lands. Update the pattern in `backend/app/schemas/public_avatar.py` and add a regression test asserting an es-MX/es-US/es-ES request returns 200, not 422.
**Warning signs:** Playwright/manual test of voice connect for an es-* locale returns HTTP 422 with a Pydantic validation error body.

### Pitfall 2: es-* voice silently falls back to English, not the locale's own default (D-07 violation)
**What goes wrong:** An es-ES session with an unconfigured `voice_map` entry gets `en-US-AvaNeural` instead of `es-ES-ElviraNeural`, because `create_public_webrtc_session_config`'s only fallback constant is English-specific.
**Why it happens:** The current single-locale MVP (Phase 32) never needed a *locale-aware* fallback — `voice_map.get(locale, "")` plus one global default was sufficient when only zh-CN/en-US existed and the pipeline's own hardcoded top-of-function default (`zh-CN-XiaoxiaoMultilingualNeural`, unused in the *public* path but present in the *authenticated* path at line 87) already hinted at the need for per-locale defaults.
**How to avoid:** Introduce the `DEFAULT_PUBLIC_VOICE_BY_LOCALE` dict (see above) and route both call sites through it.
**Warning signs:** Manual QA hears an English voice after selecting es-MX/es-US/es-ES with no admin voice_map configured.

### Pitfall 3: Anonymous text-chat refusal never reflects the selected language (pre-existing, newly consequential)
**What goes wrong:** Adding es-* keys to `REFUSAL_TEMPLATES` does nothing for anonymous text users — the `chat()` endpoint never forwards `locale`.
**Why it happens:** `ChatRequest` schema was designed with intentionally minimal surface (T-32-05: "no client-suppliable identifier") and `locale` was apparently omitted from that minimal set, unlike the later-built `WebrtcSessionRequest`/`PersonalizedChatRequest`.
**How to avoid:** Decide explicitly (flag to planner/user) whether to add `locale: str` to `ChatRequest` this phase; if yes, it's a small, mechanical 4-file change (schema, endpoint, frontend api client, frontend hook) mirroring the personalized path exactly.
**Warning signs:** Automated test sends an es-US anonymous chat message expected to trigger a refusal and asserts the response text is the es-US refusal string — test fails, showing zh-CN text instead.

### Pitfall 4: `supportedLngs` array order reversed (silently breaks D-10)
**What goes wrong:** If `es-MX` or `es-US` is listed before `es-ES` in `supportedLngs`, `Array.find`'s "first match wins" semantics mean a bare `"es"`/unlisted `"es-AR"` browser locale resolves to `es-MX` (or whichever is first) instead of the canonical `es-ES` default the user decision requires.
**Why it happens:** Non-obvious algorithmic dependency — nothing in the type system or a naive code review would catch a reordering; it "looks" like a harmless array literal.
**How to avoid:** A dedicated unit assertion (`supportedLngs.indexOf("es-ES") < supportedLngs.indexOf("es-MX")` and `< indexOf("es-US")`), plus an inline comment explaining why order matters, directly above the array in `frontend/src/i18n/index.ts`.
**Warning signs:** A test simulating `navigator.language = "es-AR"` resolves `i18n.language` to `es-MX` instead of `es-ES`.

### Pitfall 5: Namespace hardcoded arrays drift from the real file list
**What goes wrong:** The global parity test (D-04) hardcodes the 16-namespace list (mirroring `i18n/index.ts`'s `ns` array) instead of reading the actual directory contents; a future namespace addition/removal silently stops being covered.
**Why it happens:** Copy-pasting the existing `ns` array literal is the path of least resistance.
**How to avoid:** Enumerate namespaces via `fs.readdirSync(path.resolve(__dirname, "../../public/locales/en-US"))` (using en-US as the canonical source-of-truth directory) rather than a literal array, so the test is self-updating. Enumerate locales via a small explicit constant (`["zh-CN", "en-US", "es-ES", "es-MX", "es-US"]`) since locale count *is* a deliberate, reviewed decision (D-01) that should require an explicit code change to alter.
**Warning signs:** A new namespace is added in a later phase and the parity test keeps passing even though the new namespace has no es-* translations.

### Pitfall 6: Untranslated-value whitelist becomes a silent translation-skip mechanism
**What goes wrong:** D-03's whitelist (values legitimately identical across all 5 locales, e.g. brand names) can be abused to suppress the "untranslated detection" check for values that actually need translation but were left as-is under time pressure.
**Why it happens:** The whitelist has no natural size limit and nothing structurally prevents adding a whole namespace's worth of keys to it.
**How to avoid:** Scope the whitelist to specific `namespace.key` pairs (not whole namespaces), keep it small and reviewed, and consider asserting a maximum whitelist size in the parity test itself as a soft guardrail (e.g. flag if whitelist exceeds ~10-15 entries, prompting a second look).
**Warning signs:** Code review sees a component-level or namespace-level whitelist entry rather than individual leaf keys.

## Code Examples

### Existing key-parity test pattern to generalize (D-04)
```typescript
// Source: frontend/src/__tests__/hcp-editor-tabs.test.tsx (existing precedent, single-namespace)
function readLocaleJson(locale: string, ns: string): Record<string, unknown> {
  const filePath = path.resolve(__dirname, `../../public/locales/${locale}/${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}
```
Generalize this to a new dedicated test file (e.g. `frontend/src/i18n/locale-parity.test.ts`) that:
1. Enumerates namespaces via `fs.readdirSync` on the `en-US` directory (Pitfall 5).
2. Enumerates the 5-locale constant.
3. For each namespace, recursively walks the en-US object shape and asserts every other locale has the identical key set at every depth (recursion needed — `admin.json` nests, per §Namespace Inventory).
4. Within the recursive walk, for every **leaf string** value: assert non-empty/non-whitespace (D-05 check 1); extract `{{var}}` tokens via a shared regex (`/\{\{(\w+)\}\}/g`) and assert the token *set* matches across locales for that key (D-05 check 2); for the 3 es-* locales, assert the value `!== en-US value` unless the `namespace.key` pair is in the whitelist (D-05 check 3).

### D-10 config change (verified-safe ordering)
```typescript
// frontend/src/i18n/index.ts — order is load-bearing, see Locale Resolution Mechanics
supportedLngs: ["zh-CN", "en-US", "es-ES", "es-MX", "es-US"], // es-ES MUST precede es-MX/es-US
fallbackLng: "en-US", // unchanged — no object-form map needed
```

### Backend pattern widening (Pitfall 1)
```python
# backend/app/schemas/public_avatar.py
locale: str = Field(default="zh-CN", pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| 2-locale hardcoded `supportedLngs`/`REFUSAL_TEMPLATES`/voice fallback | 5-locale explicit entries, prefix-order-dependent detection | This phase | No architectural change — same data structures, more entries |

**Deprecated/outdated:** None — this is additive, not a migration away from anything.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Closing the anonymous text-chat locale-forwarding gap (Pitfall 3) is in-scope for Phase 34 rather than a separately-tracked bug | §Frontend Locale Flow, Pitfall 3 | If out of scope, the es-* `REFUSAL_TEMPLATES` entries for anonymous text chat are unreachable this phase; LANG-01/LANG-02 success criteria are voice/UI-focused and may not require this fix — planner should confirm with user/CONTEXT before deciding, since CONTEXT.md's D-08 doesn't explicitly call out this wiring gap |
| A2 | No admin UI/API exists for `PublicKnowledgeConfig.voice_map` today, and building one is out of scope unless the planner/user decides otherwise (POC-acceptable to seed/edit via a script or direct DB write) | §Open Questions | If D-06's "Admin 可编辑" is a hard requirement for this phase, a net-new admin page (agent_id/connection/index_name/avatar_character/avatar_style/voice_map — a meaningfully sized CRUD page) needs its own plan; this could significantly change phase scope/sizing |
| A3 | `es-ES-ElviraNeural` / `es-MX-DaliaNeural` / `es-US-PalomaNeural` remain live, current Azure voice names at execution time | §Azure Voice Names | Azure occasionally deprecates/renames preview voices; low risk since these are long-standing GA standard voices per Microsoft Learn, but not re-verified at execution time |

## Open Questions

1. **Does Phase 34 need to build an admin editing UI for `PublicKnowledgeConfig.voice_map`, or is direct DB/seed-script editing acceptable for this POC?**
   - What we know: No such admin page or admin API endpoint exists anywhere in the codebase today (verified by exhaustive grep across `frontend/src/pages/admin/` and `backend/app/api/`); Phase 32's own CONTEXT.md mentioned building one but none of its 5 executed plans did.
   - What's unclear: Whether D-06's "Admin 公共配置页可编辑" is a hard phase-34 deliverable or an aspirational restatement of an already-deferred Phase 32 item.
   - Recommendation: Given D-07's "不阻断" fallback already makes an admin UI non-blocking for the two success criteria (UI language switch works; avatar speaks in the chosen es-* voice via the built-in default), the planner should propose treating the admin UI as **out of scope for Phase 34** (voice_map es-* entries can ship via a migration-adjacent data seed or a documented manual DB update) unless the user explicitly requires it — flag this back to the user/CONTEXT rather than silently building or silently skipping a whole new CRUD page.

2. **Should the anonymous text-chat locale-forwarding gap (Pitfall 3) be fixed in this phase?**
   - What we know: The fix is small and mechanical (mirrors the already-correct personalized path); without it, the phase's new es-* refusal templates are only reachable via voice, not text, for anonymous users.
   - What's unclear: Whether "text chat refusal wording" is covered by LANG-01's UI-translation success criterion or LANG-02's voice-only success criterion — arguably neither literally, since it's neither "UI text with missing-key fallback" nor "voice."
   - Recommendation: Treat as in-scope (low cost, closes an obvious gap, consistent with D-08's intent) but flag explicitly as a Rule-3-style deviation/addition in the plan rather than silently bundling it into an unrelated task.

## Environment Availability

No new external dependencies, services, or CLIs are introduced by this phase — it operates entirely on already-installed npm packages, the existing Azure Voice Live / Speech configuration (already required and configured for Phases 32/33), and the existing SQLite/PostgreSQL `PublicKnowledgeConfig` row. Skipping per the stated skip condition (no *new* external dependencies).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend framework | vitest (via `npm test` = `vitest run`) |
| Frontend config file | `frontend/vite.config.ts` / vitest defaults (no separate vitest.config) |
| Backend framework | pytest + pytest-asyncio, `asyncio_mode = "auto"` |
| Backend config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` — `--cov-fail-under=89` enforced |
| E2E framework | Playwright, `frontend/e2e/playwright.config.ts` |
| Quick run command (frontend) | `cd frontend && npx vitest run src/i18n/locale-parity.test.ts` |
| Quick run command (backend) | `cd backend && pytest tests/test_public_avatar_api.py tests/test_avatar_service.py tests/test_public_webrtc_session.py -v` |
| Full suite command (frontend) | `cd frontend && npm test` |
| Full suite command (backend) | `cd backend && pytest -v` |
| Full E2E command | `cd frontend && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| LANG-01 | 5-locale key parity (keys, non-empty, interpolation vars, untranslated-detection w/ whitelist) across all 16 namespaces | unit | `npx vitest run src/i18n/locale-parity.test.ts` | ❌ Wave 0 (new file) |
| LANG-01 | `supportedLngs` contains exactly the 5 locales in the D-10-required order | unit | `npx vitest run src/i18n/index.test.ts` | ✅ exists, needs updated assertions (not a new file) |
| LANG-01 | Language switcher renders 5 options with correct flags/labels | unit | `npx vitest run src/components/shared/language-switcher.test.tsx` | ❌ Wave 0 (no existing test file found for this component — verify at execution time) |
| LANG-01 | UI end-to-end: switching to each es-* variant renders translated text with no fallback/missing-key gaps | e2e | `npm run test:e2e -- language-switcher-es.spec.ts` | ❌ Wave 0 |
| LANG-02 | `WebrtcSessionRequest` accepts es-ES/es-MX/es-US locale (no 422) | unit | `pytest tests/test_public_webrtc_session.py -x` | ✅ file exists, needs new parametrized cases added |
| LANG-02 | `REFUSAL_TEMPLATES` has es-ES/es-MX/es-US entries; `handle_anonymous_turn`/`handle_personalized_turn` return the correct one per locale | unit | `pytest tests/test_avatar_service.py tests/test_personalized_avatar_service.py -x` | ✅ files exist, need new cases |
| LANG-02 | Locale-aware voice default fallback (D-07) — unconfigured es-* locale gets that locale's default, not `en-US-AvaNeural` | unit | `pytest tests/test_public_webrtc_session.py -x` (or a new `test_voice_live_webrtc.py` case) | ✅/partial — verify at execution time whether `voice_live_webrtc.py` has a dedicated unit test file |
| LANG-02 | Voice E2E: selecting an es-* locale and connecting negotiates a session whose mocked voice-name reflects the es-* default | e2e | `npm run test:e2e -- anonymous-avatar-voice-es.spec.ts` (mirror `anonymous-avatar-voice.spec.ts`'s mock pattern) | ❌ Wave 0 (extend existing pattern, new file) |

### Sampling Rate
- **Per task commit:** run the specific unit test file(s) touched (quick commands above)
- **Per wave merge:** `cd frontend && npm test` **and** `cd backend && pytest -v` (full suites) plus `npx tsc -b` / `ruff check . && ruff format --check .`
- **Phase gate:** Full suite green (frontend vitest, backend pytest with `--cov-fail-under=89`, `npm run test:e2e`) before `/gsd-verify-work`, per CLAUDE.md's top-priority "100% unit + Playwright E2E per requirement before commit" rule

### Wave 0 Gaps
- [ ] `frontend/src/i18n/locale-parity.test.ts` — new global 5-locale/16-namespace parity test (D-04/D-05) — covers LANG-01
- [ ] Existence check at execution time: does `frontend/src/components/shared/language-switcher.test.tsx` already exist? (not found by this research's search, but confirm before assuming Wave 0 work)
- [ ] `frontend/e2e/language-switcher-es.spec.ts` or equivalent — new E2E for language switching to es-ES/es-MX/es-US with translated-text assertions — covers LANG-01
- [ ] `frontend/e2e/anonymous-avatar-voice-es.spec.ts` (or extend `anonymous-avatar-voice.spec.ts` with an es-* `test.describe` block reusing its existing mock helpers) — covers LANG-02 voice path
- [ ] Backend: confirm whether a dedicated `test_voice_live_webrtc.py` exists for unit-testing `create_public_webrtc_session_config`'s fallback logic directly, or whether that logic is only reachable/testable via `test_public_webrtc_session.py`'s API-level tests — locate at execution time and add locale-fallback cases there
- [ ] Whitelist file/constant for D-03 untranslated-detection exemptions — needs to be created (e.g. `frontend/src/i18n/untranslated-whitelist.ts` or inline in the parity test) before the parity test can pass on real brand-name/proper-noun values

## Sources

### Primary (HIGH confidence — verified via tool/direct code read)
- `frontend/node_modules/i18next/dist/esm/i18next.js` (installed v25.10.5) — `LanguageUtils.getBestMatchFromCodes/isSupportedCode/getLanguagePartFromCode`, and `init()`'s `languageDetector` wiring (line ~2015) — read directly, not from training knowledge
- `frontend/node_modules/i18next-browser-languagedetector/dist/esm/i18nextBrowserLanguageDetector.js` (installed v8.2.1) — `Browser.detect()` / `convertDetectedLanguage` handling
- `frontend/node_modules/i18next-browser-languagedetector/index.d.ts` — `convertDetectedLanguage` type signature
- `frontend/src/i18n/index.ts`, `frontend/src/i18n/index.test.ts` — current 2-locale config and its test assertions
- `frontend/src/components/shared/language-switcher.tsx` — current 2-option switcher implementation
- `frontend/src/__tests__/hcp-editor-tabs.test.tsx` — existing key-parity test pattern precedent
- `frontend/public/locales/en-US/*.json` (all 16 files) — namespace/key-count inventory
- `backend/app/schemas/public_avatar.py`, `backend/app/schemas/personalized_avatar.py` — locale field definitions/constraints
- `backend/app/services/avatar_service.py`, `backend/app/services/personalized_avatar_service.py` — `REFUSAL_TEMPLATES` and its two call sites
- `backend/app/services/voice_live_webrtc.py`, `backend/app/api/public_avatar.py` — voice_map resolution and fallback chain
- `backend/app/models/public_knowledge_config.py` — `voice_map` column definition (no migration needed)
- `frontend/src/pages/avatar-page.tsx`, `frontend/src/hooks/use-anonymous-voice-live.ts`, `frontend/src/api/public-avatar.ts`, `frontend/src/api/personalized-avatar.ts`, `frontend/src/hooks/use-personalized-avatar-chat.ts` — full frontend locale-to-voice/chat flow
- `frontend/e2e/anonymous-avatar-voice.spec.ts` — existing WebRTC-mocking E2E pattern to extend
- `npm view i18next version`, `npm view react-i18next version`, `npm view i18next-browser-languagedetector versions` — registry version checks

### Secondary (MEDIUM confidence — official docs via WebFetch, cross-checked against installed source where possible)
- [i18next Fallback Principles](https://www.i18next.com/principles/fallback) — object-form `fallbackLng` documented (ultimately not needed, per primary-source verification above)
- [i18next-browser-languageDetector README (GitHub)](https://github.com/i18next/i18next-browser-languageDetector) — detection order and `supportedLngs` interaction
- [i18next Configuration Options](https://www.i18next.com/overview/configuration-options) — `nonExplicitSupportedLngs`/`load` semantics
- [Azure AI Speech language support (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) — confirmed `es-ES-ElviraNeural`, `es-MX-DaliaNeural`, `es-US-PalomaNeural` are current standard neural voices for their respective locales, plus availability of Multilingual/HD variants (not used per D-06's explicit standard-voice choice)

### Tertiary (LOW confidence)
- None — all findings in this research were either verified against installed source/codebase or cited from official Microsoft/i18next documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; versions read directly from `package.json`/`node_modules`
- Locale resolution mechanics (D-10): HIGH — traced through actual installed i18next source line-by-line, not inferred from docs alone
- Backend locale branch points: HIGH — exhaustive grep + direct file reads, cross-checked call sites end-to-end
- Azure voice names: HIGH — official Microsoft Learn docs confirm exact names in CONTEXT.md's D-06 are current
- Admin UI gap (Open Question 1): HIGH confidence that no such UI/API exists today (exhaustive search); MEDIUM confidence on whether this is genuinely in-scope (a scoping judgment call for the planner/user, not a factual claim)
- Namespace/key counts: HIGH — computed directly from files on disk

**Research date:** 2026-08-01
**Valid until:** ~30 days (stable, in-house codebase facts) for code-derived findings; Azure voice-name findings should be re-confirmed if execution is delayed more than ~90 days, as Microsoft periodically expands/renames preview voice catalogs (the specific GA voices cited here have been stable for a long time, so risk is low).
