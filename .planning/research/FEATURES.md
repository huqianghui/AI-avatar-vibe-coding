# Feature Research

**Domain:** Grounded knowledge-Q&A digital human (anonymous RAG chat + personalized profile-aware chat + multilingual avatar UX)
**Milestone:** v2.0 Avatar MVP (supersedes the v1.0 MR-coaching-platform feature research previously in this file — see note at bottom)
**Researched:** 2026-07-31
**Confidence:** MEDIUM-HIGH (Azure/Foundry mechanics verified against official Microsoft Learn docs and this repo's existing code; general anonymous-session/personalization UX patterns are informed by well-established, cross-referenced industry patterns — `WebSearch` was unavailable this session (consistent API errors on every query, including trivial unrelated ones), so those specific claims are flagged LOW/MEDIUM and should get a light sanity-check during phase planning)

## How This Domain Actually Works (grounding for the tables below)

**Anonymous grounded Q&A.** The standard pattern (Azure OpenAI "On Your Data" — now deprecated, retiring October 14, 2026, superseded by **Foundry IQ**) is: user query → intent/query planning → retrieval against an indexed knowledge source (Azure AI Search) → **filtration by strictness/relevance threshold** → generation grounded in only the retrieved chunks → response with **extractive citations** (title, filename/URL, and the exact excerpt used). Two runtime knobs matter most: `inScope` / "limit responses to your data" (refuse to answer outside the KB — critical for a pharma-brand anonymous assistant to avoid unaudited claims) and `strictness` (how aggressively low-relevance chunks are filtered before generation). No login is required for this path — session state is purely conversational (turn history passed back each call), not identity-bound. [HIGH confidence — Microsoft Learn]

**Personalized/logged-in Q&A.** The same retrieval mechanics apply, but (a) the knowledge source differs per user context (here: an Excel-derived profile/preference lookup keyed by `user_id`, not a live CRM), and (b) a **system-message/`role_information` injection** carries profile + preference into the prompt at session start. Microsoft's own guidance on system-message design ("define a role," "define the type of data," "reaffirm critical behavior") maps directly onto "inject CRM-derived profile + preferences via system prompt" in `PROJECT.md`. Document/knowledge-source **access boundaries** (e.g., Azure AI Search security filters/ACLs, which Foundry IQ formalizes as permission-aware retrieval) are the standard mechanism for keeping personalized answers scoped to what a given user is allowed to see — the direct analog for "personalization boundaries" in this milestone. [HIGH confidence — Microsoft Learn]

**Citation display separate from spoken/avatar content.** Microsoft's own display requirements for grounding tools (Bing grounding legal terms, confirmed) mandate that citation references and source links be rendered **verbatim and separately** from the generated text — not merged into the model's prose. The canonical reference implementation for this exact UX (`Azure-Samples/azure-search-openai-demo`, referenced across Microsoft's own docs) renders answers as a chat bubble and citations as a **separate panel/list of clickable source links** — structurally the same "avatar output vs. document panel" split already mandated by this project's `CLAUDE.md` Domain Rule #6. [HIGH confidence for the display-separation requirement itself; MEDIUM confidence for exact reference-app panel mechanics — WebFetch of the README could not confirm rendered layout, so treat panel layout as a design decision, not a verified spec]

**Multilingual avatar UX / language switching.** Azure Speech TTS (which powers the avatar voice) has broad, confirmed Spanish locale support (es-ES, es-MX, es-US, and 18+ other es-* locales, each with neural voices) — voice-level Spanish support is not a blocker. What is NOT verified in official docs pulled this session is whether the **photorealistic/video avatar** (vs. plain TTS) has any additional locale restriction, or whether mid-session language switching requires tearing down and restarting the Voice Live avatar session (realtime speech pipelines typically fix language at connect time; switching mid-call commonly requires a reconnect in this product class, but this is a MEDIUM/LOW-confidence pattern-inference, not a documented fact — flag for phase-level research before promising a live switch). [MEDIUM confidence]

**This repo's existing capability baseline (verified by reading code, not docs):**
- `backend/app/models/session.py` — `CoachingSession.user_id` is a **required, non-null** FK to `users`. There is no existing "anonymous session" concept anywhere in the schema. Anonymous avatar chat cannot reuse this model as-is.
- `backend/app/api/knowledge_base.py` + `backend/app/services/knowledge_base_service.py` — Foundry IQ / Azure AI Search integration already exists (v1.0 Phase 17), but knowledge configs are **scoped to an `hcp_profile_id`** (`HcpKnowledgeConfig`), admin-managed, and return no runtime citation data — `backend/app/schemas/knowledge_base.py` only models connection/index metadata, never a query-time answer+citations response. Citation surfacing is net-new, not a gap-fill.
- `frontend/src/i18n/index.ts` — i18next with `supportedLngs: ["en-US", "zh-CN"]`, 10 namespaces, JSON files loaded via `HttpBackend` from `/locales/{{lng}}/{{ns}}.json`. Adding `es-ES` is additive (new locale folder + translations for existing namespaces) — no framework change needed.
- `frontend/src/components/voice/voice-session.tsx` — already accepts a `language` prop with `autoDetect` fallback (`language: language || "auto"`), so the voice pipeline already has a language-selection seam to extend for Spanish.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| No-login entry to avatar Q&A | A public-facing knowledge assistant that requires login before answering a basic question feels broken/hostile to visitors | MEDIUM | Blocked on a schema decision: `CoachingSession.user_id` is NOT NULL today — needs either a nullable-user anonymous session path or a lightweight parallel session mechanism (see Dependencies) |
| Answers grounded only in indexed site content (no hallucinated claims) | Pharma brand risk if an anonymous bot invents medical/regulatory claims | LOW | Reuse existing Foundry IQ integration; add a KB config scoped to "public site" rather than an HCP profile; set strictness/`inScope`-equivalent to strict |
| Refusal / "I don't know, here's who to contact" fallback | Prevents silent hallucination when the KB has no relevant match — standard grounded-chat pattern | LOW | Ties directly to strictness/relevance-threshold tuning; needs a defined fallback message + optional escalation link |
| Per-answer source citation (page + document link), rendered separately from the digital human's speech/text | Explicit requirement in `CLAUDE.md` Domain Rule #6/7 and the industry-standard grounded-chat display requirement (Microsoft's own display rules for grounding tools) | MEDIUM | Net-new: no citation schema exists in this codebase yet; must extend KB retrieval to return citation metadata at query time, plus a new UI element distinct from the avatar/voice transcript |
| Digital human speaks the grounded answer (voice/avatar) | Core product identity — this is an avatar platform, not a text chatbot | LOW | Reuse existing Voice Live avatar + Speech TTS fallback infra as-is |
| Clear visual distinction between anonymous mode and logged-in personalized mode | Users need to know whether they're getting a generic vs. "their" answer, and that logging in changes the answer source | LOW | Simple UI affordance (login CTA / "personalized for you" badge); no new backend beyond existing JWT auth |
| Login-gated personalized mode reachable from the same avatar surface | Users expect one entry point, not a separate app, for "more personalized" answers | LOW | JWT auth, login page, guards already exist (v1.0 Phase 1) |
| UI language selector covering zh-CN / en-US / es (new) | Explicit multi-language requirement; users expect the switch to be visible and immediate for at least UI text | LOW-MEDIUM | i18next framework already supports this; work is translation content + adding `es-ES` to `supportedLngs`, not framework changes |
| Clean UI: only digital human + document links visible, no leftover coach chrome | Explicit `PROJECT.md`/`CLAUDE.md` requirement; a demo/POC surface cluttered with unrelated training-platform nav looks unfinished to a client demo audience | LOW | Route/nav-level hide using existing feature-toggle config (v1.0 Phase 1 `ConfigProvider`); code stays, only entry points are removed |
| Responsive layout (desktop/tablet/mobile) for the anonymous surface | Public-facing assistant will be accessed on varied devices, including a client demo on unknown hardware | LOW | Existing responsive layout patterns from v1.0 apply; avatar-video sizing is the only new responsive concern |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CRM-derived (Excel POC) profile shaping personalized answers | Goes beyond generic RAG chat — the same question gets an answer tuned to who's asking, without a live CRM integration project | MEDIUM | Needs an Excel ingestion/mapping mechanism (pattern similar to the existing materials-upload flow) keyed by `user_id` |
| Per-user preference injection via system-prompt/template | Lightweight personalization that's auditable and controllable (vs. opaque learned memory) — a good fit for a regulated-industry demo | MEDIUM | Depends on the profile pipeline above; preferences are backend-extracted or manually tagged, not auto-learned (explicitly scoped this way in `PROJECT.md`) |
| Auditable per-response knowledge-source trail | Every avatar answer is traceable to a specific document/page — a valuable trust signal for a biotech/pharma audience and satisfies `CLAUDE.md` Domain Rule #7 | MEDIUM | Same underlying work as the citation table-stake feature; "auditability" is the framing that makes it demo-worthy, not extra engineering |
| Single avatar UI serving both anonymous and personalized modes | Reduces cognitive load — a visitor doesn't need a separate "member portal"; login simply unlocks a richer version of the same assistant | MEDIUM-HIGH | Requires deciding what happens to an anonymous conversation when the visitor logs in mid-session (re-ground with the personalized KB vs. start fresh) — recommend "start fresh on login" for v1 |
| Configurable premium Azure AI Avatar with Speech-TTS-only fallback | Cost control without losing the core value prop — the "digital human" experience degrades gracefully to voice-only rather than failing | LOW | Already exists from v1.0 (Phases 8, 13, 29); this milestone just needs to confirm the fallback also applies to the new anonymous surface |
| Spanish support as a first-class language (not bolted on) | Ahead of most pharma internal tooling in this space; directly serves BeiGene's stated global-deployment need | MEDIUM | Real work is translation quality + verifying avatar (not just plain TTS) Spanish support end-to-end — flagged above as needing phase-level verification |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Live CRM integration for personalization | "Real" personalization feels more convincing in a demo | Explicitly out of scope for this milestone/POC; adds a large integration surface (auth, data contracts, sync) with no validated payoff yet | Excel-based mapping table as a swappable adapter — same system-prompt injection contract, easy to replace with a real CRM later |
| Deep automated preference learning / cross-session memory | "The avatar remembers me and gets smarter" is an attractive pitch | Privacy/compliance risk for a pharma company; unpredictable behavior is hard to audit; explicitly deferred in `PROJECT.md` | Backend-driven extraction or manual tagging of preferences, injected fresh at each session start — deterministic and auditable |
| Merging the avatar's spoken/text answer and citation links into one chat bubble | A simpler-looking single-bubble chat UI is a common default pattern | Explicitly forbidden by `CLAUDE.md` Domain Rule #6; breaks the "clean UI" and audit-trail goals; also violates the display-separation norm Microsoft itself enforces for grounding tools | Two distinct UI regions: avatar/voice output area + a separate source-link list/panel |
| Unrestricted "ask anything" free-text for the anonymous surface | Feels more flexible/less limiting to visitors | Hallucination and off-brand/off-label claim risk for a regulated pharma company; the anonymous surface has no audit trail on who asked what | Strict grounding (`inScope`-equivalent + tuned strictness) with a defined refusal/escalation message when the KB has no good match |
| One shared multilingual index with on-the-fly cross-lingual answer generation | Avoids maintaining 3 separate indexes | Microsoft's own guidance: same-index cross-lingual retrieval quality degrades, especially for domain (medical/pharma) terminology; keyword/semantic search expects the query language to match the index language | Either a per-language index (translated content) or vector-search-based cross-lingual retrieval if content can't be triplicated — decide per KB, not globally |
| Deleting/removing old coach code this milestone | "Why keep dead code around" | Explicitly out of scope per `PROJECT.md` — hiding entry points is the agreed scope; premature deletion risks losing v1.0 capability needed for a later milestone | Hide nav entries/routes via feature toggle; defer deletion to a future milestone |
| OAuth/Azure AD SSO for the personalized login | "Enterprise-grade" login feels more finished | Explicitly deferred per `PROJECT.md` constraints; adds Entra app-registration and consent-flow complexity with no near-term requirement | Keep the existing simple JWT auth; architecture should not preclude Entra ID later (already a stated constraint) |

## Feature Dependencies

```
Anonymous knowledge Q&A
    |--requires--> Anonymous session mechanism (new -- CoachingSession.user_id is NOT NULL today)
    |--requires--> Foundry IQ KB config scoped to "public site" (new -- existing config is keyed to hcp_profile_id)
                       |--requires--> Runtime citation-bearing retrieval response schema (new -- current schema only
                                       models config metadata, not query-time answers+citations)

Citation display (page + doc link, separate from avatar speech)
    |--requires--> Runtime citation-bearing retrieval response schema (same dependency as above)

Personalized avatar (CRM-via-Excel + preferences)
    |--requires--> JWT auth (existing, v1.0 Phase 1)
    |--requires--> Excel-based profile/preference ingestion mechanism (new)
                       |--requires--> System-prompt/template injection point keyed by user_id (new, but same
                                       pattern as the existing HCP-profile system-prompt construction)

Spanish (es) i18n -- UI text
    |--requires--> i18next `supportedLngs` + locale JSON files (existing framework, additive content only)

Spanish (es) i18n -- avatar voice/speech
    |--requires--> Voice Live / avatar-service Spanish locale support (voice-level confirmed; avatar-level not
                     yet verified this session)
                       |--enhances--> Language switch control (mid-session switching mechanics still open --
                                       likely requires session reconnect, needs phase-level verification)

Clean UI (avatar + doc links only, old coach hidden)
    -- independent of all the above -- (pure routing/nav-config change using existing feature-toggle infra)

Seamless anonymous->personalized upgrade mid-session --conflicts--> "start fresh on login" simplicity
```

### Dependency Notes

- **Anonymous Q&A requires an anonymous session mechanism:** The existing `CoachingSession` model hard-requires a `user_id`. This is the single most consequential technical dependency uncovered in this research — it must be resolved (nullable user + anonymous flag, or a separate lightweight session concept) before any anonymous-chat phase can be implemented, since it shapes the session API contract for everything downstream.
- **Both anonymous Q&A and citation display require a net-new runtime response schema:** Today's `backend/app/schemas/knowledge_base.py` only models *admin-time configuration* (which index is attached to which HCP profile), never a *query-time* answer with citations. Both features depend on this same new schema/response shape — build it once, use it for both.
- **Personalized avatar enhances, but does not require, the citation feature:** Personalization and citations are independent capabilities that happen to share the same underlying retrieval plumbing. They can be built/tested somewhat in parallel once the shared response schema exists.
- **Spanish UI text and Spanish avatar voice are two separate dependency chains:** UI translation is low-risk and framework-supported today. Avatar-voice Spanish and mid-session language switching are the pieces that carry real unknowns and should get a short, phase-specific research pass before committing to a "switch language without restarting the avatar" UX promise.
- **Clean UI is dependency-free:** It can be scheduled in any phase (including first, as a quick win) without blocking or being blocked by the grounded-chat work.
- **Anonymous→personalized upgrade conflicts with simplicity:** Carrying an anonymous conversation's context into a freshly-logged-in personalized session is UX-nice but adds real complexity (which grounding source applies to already-asked questions, whether to re-cite). Recommend "start a fresh personalized session on login" as the v1 answer, and revisit continuity later.

## MVP Definition

### Launch With (v1 — this milestone)

- [ ] Anonymous, no-login avatar Q&A grounded in Foundry IQ-indexed public site content — the headline new capability and the entire reason for the milestone
- [ ] Per-answer citation (page + document link) rendered as a UI element separate from the avatar's spoken/text response — required by `CLAUDE.md` Domain Rule #6/7, not optional polish
- [ ] Refusal/fallback behavior when no relevant KB content exists — without this, anonymous mode risks hallucinated pharma claims on day one
- [ ] Login-gated personalized mode using Excel-based profile mapping + preference injection via system prompt — the second headline capability
- [ ] Spanish (`es`) added to the i18n framework for UI text — explicitly required, low technical risk
- [ ] Clean UI: only digital human + document links visible; old coach nav entries hidden — explicit scope requirement, needed for a credible client demo

### Add After Validation (v1.x)

- [ ] Mid-session language switching without a full avatar session restart — ship v1 with "switching language starts a new session" if reconnect mechanics aren't validated in time; revisit once avatar-level Spanish support is confirmed
- [ ] Seamless anonymous→personalized continuity when a visitor logs in mid-conversation — add once the basic dual-mode flow is proven and there's a real signal users want continuity rather than a fresh start
- [ ] A structured admin UI for managing the Excel-based profile/preference mapping (vs. a raw upload-and-parse flow) — add once the mapping table's real-world shape stabilizes

### Future Consideration (v2+)

- [ ] Live CRM integration replacing the Excel mapping — defer until the POC validates the personalization concept is worth the integration cost
- [ ] Automated preference learning / deep memory across sessions — explicitly deferred in `PROJECT.md`; revisit only with a clear privacy/compliance review for a pharma context
- [ ] OAuth / Azure AD (Entra ID) SSO — explicitly deferred; architecture should not block it, but no near-term need
- [ ] Teams Tab / Bot Service channel deployment — explicitly deferred per `PROJECT.md`
- [ ] Full deletion of legacy coach code paths — deferred to a later milestone once the hide-only approach has been in production long enough to confirm nothing regresses

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Anonymous grounded Q&A | HIGH | MEDIUM | P1 |
| Citation display (separate from avatar speech) | HIGH | MEDIUM | P1 |
| Grounding refusal/fallback behavior | HIGH | LOW | P1 |
| Personalized profile-aware answers (Excel POC) | HIGH | MEDIUM | P1 |
| Preference injection via system prompt | MEDIUM | MEDIUM | P1 |
| Spanish UI text (i18n) | MEDIUM | LOW | P1 |
| Clean UI / hide old coach entries | MEDIUM | LOW | P1 |
| Spanish avatar voice/speech | MEDIUM | MEDIUM (unverified avatar-level support) | P2 |
| Mid-session language switching | LOW-MEDIUM | MEDIUM-HIGH (unverified reconnect mechanics) | P2 |
| Anonymous→personalized session continuity | LOW-MEDIUM | HIGH | P2 |
| Live CRM integration | HIGH (long-term) | HIGH | P3 |
| Automated preference learning | MEDIUM | HIGH (+ compliance risk) | P3 |
| OAuth/Entra ID SSO | LOW (near-term) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Reference Pattern Analysis

There is no direct commercial "competitor" for this internal BeiGene tool; the relevant comparison is against Microsoft's own canonical reference patterns and the project's stated AWS-based reference (Capgemini AI Avatar solution, carried over from the v1.0 research).

| Capability | Azure OpenAI "On Your Data" / Foundry IQ reference pattern | `azure-search-openai-demo` reference app | Our Approach |
|---------|--------------------------------------------------------------|-------------------------------------------|--------------|
| Grounded answer generation | Retrieval → strictness filtering → generation restricted to retrieved chunks (`inScope`) | Same underlying pattern, packaged as a runnable chat app | Reuse existing Foundry IQ integration (v1.0 Phase 17); add a public-site-scoped KB config alongside the existing per-HCP configs |
| Citation display | Citations returned as structured data (title, filename/URL, content) in the API response | Rendered as a separate panel from the chat answer bubble | New citation-bearing runtime response schema; new UI element distinct from the avatar/voice-transcript component, satisfying the `CLAUDE.md` source-separation rule |
| Personalization | Document-level access control / ACL-based retrieval scoping (Foundry IQ permission enforcement) | Optional Entra ID-based per-user data access | Excel-based profile/preference mapping keyed by `user_id`, injected via system prompt — deliberately lighter-weight than ACL-based retrieval since this is a POC, not a security boundary |
| Multi-lingual data | Recommends per-language indexes or vector search for cross-lingual retrieval; index query language should match content language | Not multi-lingual by default | Plan for per-language content/index where feasible; avoid relying on one shared index to answer cross-lingually in three languages |

## Sources

- [What is Foundry IQ? — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-foundry-iq) — HIGH confidence, current (updated 2026-07-28)
- [Using your data with Azure OpenAI (On Your Data, classic/deprecated) — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/concepts/use-your-data) — HIGH confidence; explicitly notes On Your Data retires October 14, 2026 and recommends migrating to Foundry Agent Service + Foundry IQ, which is what this project should target
- [How to use Grounding with Bing Search in Foundry Agent Service — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry-classic/agents/how-to/tools-classic/bing-grounding) — HIGH confidence; source of the citation display-separation requirement
- [Text to speech avatar overview — Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) — HIGH confidence
- [Speech service language support (TTS) — Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) — HIGH confidence for voice-level Spanish support; avatar-level locale limitations NOT covered, flagged as an open question
- [Azure-Samples/azure-search-openai-demo — GitHub](https://github.com/Azure-Samples/azure-search-openai-demo) — MEDIUM confidence; confirmed the app "renders citations and thought process for each answer" but exact panel UX could not be verified from the README alone
- This repository: `backend/app/models/session.py`, `backend/app/api/knowledge_base.py`, `backend/app/services/knowledge_base_service.py`, `backend/app/schemas/knowledge_base.py`, `frontend/src/i18n/index.ts`, `frontend/src/components/voice/voice-session.tsx` — HIGH confidence, directly read
- `.planning/PROJECT.md` — HIGH confidence, direct project source of truth for scope/constraints

**Note on tooling:** `WebSearch` returned a consistent `400` API error for every query attempted this session (including trivial unrelated queries such as "weather today"), so ecosystem-discovery findings that would normally come from broad web search are instead grounded in official Microsoft Learn pages (via `WebFetch`) and direct repository inspection. General UX claims not tied to a fetched Microsoft Learn page (anonymous-session conventions, personalization-boundary conventions, citation-panel layout conventions) are flagged MEDIUM/LOW above and should get a lightweight validation pass — ideally with a working `WebSearch`/Brave search — before being treated as settled during phase planning.

**Note on file history:** This file previously contained v1.0 milestone research (MR coaching platform: HCP simulation, scoring, conference mode). That research is not lost — it described features already validated and shipped (see `.planning/PROJECT.md` "Validated" section) — but per the v2.0 Avatar MVP research brief, this file has been replaced to focus exclusively on the new milestone's features (anonymous grounded Q&A, personalized profile-aware avatar, Spanish i18n, clean UI). If the v1.0 feature research is needed for reference, retrieve it from git history.

---
*Feature research for: grounded avatar Q&A (anonymous + personalized) and multilingual avatar UX*
*Researched: 2026-07-31*
