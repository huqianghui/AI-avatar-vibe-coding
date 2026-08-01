# Phase 33: Personalized CRM-Excel Avatar - Research

**Researched:** 2026-08-01
**Domain:** Excel-driven CRM context injection into LLM system prompts (personalization) + admin-managed tagging UI + prompt-injection/PII sanitization
**Confidence:** MEDIUM-HIGH (stack/patterns HIGH — all derived from existing codebase precedent; security sanitization specifics MEDIUM — one library-free defense pattern, cross-checked against OWASP but not against a live red-team)

## Summary

Phase 33 adds a second avatar entry path (authenticated/personalized) alongside Phase 32's anonymous path, sharing the same `/` page, `AvatarView`/`SourcesPanel`/session-lifecycle infrastructure, but resolving prompt personalization from two new tables (`UserCrmContext` from an admin-uploaded Excel file, `UserPreference` from admin manual tagging) instead of a knowledge-base config. All three requirements (PERS-01/02/03) are additive: new models + Alembic migration, a new Excel-parsing service built on `openpyxl` (already a dependency, but never used for *reading* .xlsx in this codebase — only for *writing* export files), a new sanitization module (does not exist anywhere in the codebase today — greenfield), a new authenticated avatar-session endpoint variant, and new admin surfaces (extend `users.tsx` with a "个性化" section; a **net-new** admin page for CRM Excel upload — contrary to CONTEXT.md's claim of an existing "同级参照", no admin UI exists today for `PublicKnowledgeConfig`, so the "CRM 数据" page has no direct sibling to copy code from, only patterns to borrow from `training-materials.tsx` (file upload) and `settings.tsx` (config-page layout)).

The critical technical risk is NOT the Excel parsing (straightforward, `openpyxl.load_workbook` + header validation, well-trodden) — it is the **sanitization/injection defense layer** (D-06/D-07): this is genuinely new code, has no existing test suite or reference implementation in this codebase, and sits directly on the OWASP LLM01 (Prompt Injection) attack surface since CRM free-text (`crm_notes`) is untrusted admin-uploaded data rendered verbatim into a system prompt that also carries real instructions.

**Primary recommendation:** Reuse Phase 32's exact architectural shape (session model + service + router + prompt_builder extension) for the personalized path; build the CRM Excel import and sanitizer as two independently unit-testable service modules (`crm_import_service.py`, `prompt_sanitizer.py`) with zero UI/router coupling, so PERS-01 and PERS-02 can each hit 100% unit coverage per CLAUDE.md's one-requirement-at-a-time rule before either touches the shared `prompt_builder.py` injection point.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Excel CRM 映射格式与上传语义（PERS-01）**
- D-01: Fixed column template — `user_email` (match key), `customer_name`, `company`, `role`, `crm_notes` (free-text knowledge), `contact_person`. Strict header validation on upload; Admin can download a standard template (openpyxl already a dependency).
- D-02: `user_email` matches platform `User.email`. Unmatched rows are flagged "unmatched" and shown to Admin in the import result.
- D-03: Per-user upsert on re-upload (match → update; no match → insert). Users missing from the new Excel keep their old data — NOT a full-table replace.
- D-04: Tiered validation — header errors reject the whole file (400 + expected-format hint); row-level errors (missing fields / no matching user) are skipped and reported ("N succeeded, M skipped + reason detail").

**个性化注入与净化策略（PERS-02）**
- D-05: Structured template-section injection — system prompt has a fixed "用户背景" (User Background) section; field-name + sanitized-value lines concatenated (e.g., `Customer: X / Company: Y / Preferences: a, b`), matching Phase 32's `prompt_builder.py` pattern.
- D-06: Rule-based sanitization, double-gated — field length caps + control-character/prompt-delimiter filtering (`` ``` ``, `system:`, etc.) + common injection-pattern stripping ("ignore previous instructions" style); runs once at import time AND once at injection time; no LLM-based secondary review.
- D-07: Business fields ARE allowed to be injected (that's the point of personalization) — `customer_name`/`company`/`role`/`crm_notes`/`contact_person` all injectable. `crm_notes` free text is scanned for regex-detectable PII (ID number / bank card / phone / email) and replaced with placeholders.
- D-08: Silent fallback when no CRM data exists for a user — prompt has no personalization section, behaves like anonymous Q&A. Existing preference tags (if Admin already tagged them) still inject. User has no visible indication either way.

**偏好标签模型与 Admin UI（PERS-03）**
- D-09: Predefined category + free-text value model (e.g., "沟通风格"/"关注领域"/"语言偏好" categories). Categories keep prompt injection organized; value sanitization uses the same rules as CRM fields.
- D-10: Standalone `UserPreference(user_id, category, value)` table + `TimestampMixin` + Alembic migration. Separate from CRM data (`UserCrmContext` table) so Excel re-upload never touches tags; leaves an extension point for future auto-extraction (PERS-04).
- D-11: Extend the existing Admin user management page — add a "个性化" (Personalization) section to the user detail/edit flow: CRM match status (read-only) + preference tag add/edit/delete. Do NOT build a separate standalone tag-management page.
- D-12: New "CRM 数据" (CRM Data) page in the Admin settings area, sibling-level to `PublicKnowledgeConfig` config: upload Excel, download template, view last import result (success/skipped/unmatched detail).

**登录用户的 avatar 入口 UX**
- D-13: Same `/` page, auth-aware — not logged in → anonymous session; logged in → auto-create personalized session (JWT). UI layout, sources panel, voice pipeline all reused; only the session-creation call and prompt differ.
- D-14: Lightweight personalization indicator — username + small badge (e.g., "专属模式") in the header/corner; never display any CRM content.
- D-15: Reuse the avatar session pipeline with a JWT-authenticated variant — new authenticated session endpoint (e.g. `POST /avatar/session`, `Depends(get_current_user)`); session record tagged `personalized` + `user_id`; reuses Phase 32's session lifecycle/quota/audit (`AvatarInteractionLog`) infrastructure. Logged-in-user quota may be looser than anonymous.

### Claude's Discretion
- Excel cell-level validation details (empty-value handling, specific length caps)
- The specific sanitization regex / injection-pattern list
- The initial set of predefined preference categories + their i18n copy
- The specific numeric quota for logged-in users
- Visual styling of the Admin "CRM Data" page and import-result detail view

### Deferred Ideas (OUT OF SCOPE)
- Automated preference extraction / deep memory mechanism — PERS-04, post-POC
- Real CRM system integration — PERS-05, post-POC
- Spanish i18n (including refusal/badge copy in es) — Phase 34
- Legacy coach hiding and layout unification — Phase 35

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-01 | Admin uploads Excel CRM mapping (userid → CRM knowledge/support contact); system parses and stores it | `openpyxl` (installed, `>=3.1.0`, verified `3.1.2` in venv / `3.1.5` latest on PyPI) read-side pattern; `materials.py`/`material_service.py` upload-endpoint pattern (UploadFile → validate ext/size → service call); new `UserCrmContext` model + Alembic migration following `b35a_add_anonymous_avatar_tables.py` conventions |
| PERS-02 | On login-user question, inject CRM context + preferences into system prompt at chat time, with prompt-injection/PII sanitization | `prompt_builder.py`'s existing section-based construction pattern (`build_hcp_system_prompt`); OWASP LLM01 mitigation guidance (segregate untrusted content, constrain model behavior); needs a **new** sanitizer module — none exists in this codebase today |
| PERS-03 | Admin views/edits user preference tags via UI | `admin_users.py` CRUD pattern (`require_role("admin")`, `PATCH /{user_id}`); `users.tsx` admin page (table + dialog pattern) as the page to extend, not replace |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openpyxl | installed 3.1.2 (pyproject pin `>=3.1.0`; latest on PyPI 3.1.5 [VERIFIED: pip index]) | Read/write .xlsx (CRM mapping upload + template download) | Already a project dependency (used today only for writing exports in `export_service.py`); pure-Python, no native deps, matches project's existing Excel-touching code |
| SQLAlchemy 2.0 async + Alembic | per project pins | `UserCrmContext`, `UserPreference` ORM models + migration | Project-mandated (CLAUDE.md Database Rules); matches every existing model in `backend/app/models/` |
| FastAPI `UploadFile`/`File`/`Form` | per project pin (`fastapi>=0.115.0`) | Excel file upload endpoint | Identical shape to `materials.py`'s existing upload route — zero new pattern needed |
| `re` (stdlib) | n/a | Regex-based sanitization (control chars, delimiters, PII patterns) | D-06 explicitly locks "rule-based sanitization... no LLM secondary review" — stdlib `re` is sufficient and requires no new dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-jose` + FastAPI `OAuth2PasswordBearer` | existing pin | Authenticated avatar-session endpoint (D-15) | Already used by `get_current_user` in `dependencies.py` — reuse verbatim, do not build a parallel auth mechanism |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled regex sanitizer | An LLM-based "guardrail" review pass (e.g. a second cheap model call classifying injected text as safe/unsafe) | D-06 explicitly rejects this for POC scope ("不引入 LLM 二次审查") — noted here only so the planner does not accidentally reintroduce it |
| `openpyxl` streaming (`read_only=True`) mode | Full in-memory `load_workbook` | CRM files are small (per-user rows, POC scale) — no evidence of a need for streaming; `read_only=True` is still worth using defensively since it avoids loading styles/formatting that Excel files sometimes carry, but is a minor perf choice, not a correctness one |

**Installation:**
No new packages required. `openpyxl` is already declared in `backend/pyproject.toml` (`openpyxl>=3.1.0`) and installed.

**Version verification:**
```
$ pip index versions openpyxl
openpyxl (3.1.5)
Available versions: 3.1.5, 3.1.4, 3.1.3, ...
  INSTALLED: 3.1.2
  LATEST:    3.1.5
```
[VERIFIED: pip index, run in backend venv, 2026-08-01] — installed version satisfies the `>=3.1.0` pin; no upgrade required for this phase.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── models/
│   ├── user_crm_context.py       # NEW — UserCrmContext(user_id FK, customer_name, company, role, crm_notes, contact_person)
│   └── user_preference.py        # NEW — UserPreference(user_id FK, category, value)
├── schemas/
│   ├── crm_import.py             # NEW — CrmImportResult (success_count, skipped[], unmatched[])
│   └── user_preference.py        # NEW — UserPreferenceOut/Create/Update
├── services/
│   ├── crm_import_service.py     # NEW — parse_crm_excel(), upsert_crm_rows()
│   ├── prompt_sanitizer.py       # NEW — sanitize_field(value, max_len), strip_injection_patterns(), redact_pii()
│   ├── personalized_session_service.py  # NEW — mirrors anonymous_session_service.py but JWT-keyed
│   └── prompt_builder.py         # MODIFIED — add build_personalized_section(crm_context, preferences)
├── api/
│   ├── admin_crm.py               # NEW — POST /admin/crm/upload, GET /admin/crm/template, GET /admin/crm/last-import
│   ├── admin_user_preferences.py  # NEW (or folded into admin_users.py) — CRUD for UserPreference
│   └── personalized_avatar.py     # NEW — POST /avatar/session, POST /avatar/chat (authenticated variant)
└── alembic/versions/
    └── <next>_add_crm_context_and_preference_tables.py  # NEW — follow b35a_* naming/structure convention

frontend/src/
├── pages/admin/
│   └── crm-data.tsx               # NEW — upload Excel, download template, view last import result
├── components/admin/
│   └── user-personalization-section.tsx  # NEW — embedded in users.tsx detail/edit, not a new page
├── hooks/
│   ├── use-crm-import.ts          # NEW
│   ├── use-user-preferences.ts    # NEW
│   └── use-personalized-avatar-session.ts  # NEW — mirrors use-anonymous-avatar-session.ts
└── router/index.tsx               # MODIFIED — add { path: "crm-data", element: ... } under /admin
```

### Pattern 1: Excel upload → validate → upsert (PERS-01)
**What:** Reuse `materials.py`'s exact upload-endpoint shape (`UploadFile = File(...)`, extension check, size cap, admin-only `Depends(require_role("admin"))`), but delegate to a new service function that does header validation (reject 400 on mismatch) then per-row validation (skip + collect reasons) then per-user upsert keyed on `User.email`.
**When to use:** PERS-01 upload endpoint.
**Example:**
```python
# Source: backend/app/api/materials.py (existing pattern, Phase <5>)
@router.post("/upload", response_model=CrmImportResult, status_code=200)
async def upload_crm_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    if not file.filename or Path(file.filename).suffix.lower() != ".xlsx":
        bad_request("Only .xlsx files are supported")
    content = await file.read()
    return await crm_import_service.import_crm_excel(db, content)
```
```python
# Source: openpyxl official docs pattern (load_workbook + iter_rows)
from openpyxl import load_workbook
import io

EXPECTED_HEADERS = ["user_email", "customer_name", "company", "role", "crm_notes", "contact_person"]

def parse_workbook(content: bytes) -> list[dict]:
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h else "" for h in next(rows)]
    if headers != EXPECTED_HEADERS:
        bad_request(f"Invalid header row. Expected: {EXPECTED_HEADERS}")
    return [dict(zip(headers, row, strict=False)) for row in rows]
```

### Pattern 2: Structured personalization section injection (PERS-02, D-05)
**What:** Extend `prompt_builder.py` with a function that returns a "用户背景" block using the SAME `prompt_parts: list[str]` + `"\n".join(...)` pattern as `build_hcp_system_prompt`, called only when a `UserCrmContext` or `UserPreference` rows exist for the user (D-08 silent fallback).
**When to use:** Personalized avatar chat turn, before calling the agent.
**Example:**
```python
# Source: backend/app/services/prompt_builder.py (existing structural pattern)
def build_personalization_section(
    crm: UserCrmContext | None,
    preferences: list[UserPreference],
) -> str:
    if crm is None and not preferences:
        return ""  # D-08: silent fallback, behaves like anonymous
    lines = ["# User Background"]
    if crm:
        if crm.customer_name:
            lines.append(f"Customer: {sanitize_field(crm.customer_name)}")
        if crm.company:
            lines.append(f"Company: {sanitize_field(crm.company)}")
        if crm.role:
            lines.append(f"Role: {sanitize_field(crm.role)}")
        if crm.crm_notes:
            lines.append(f"Notes: {redact_pii(sanitize_field(crm.crm_notes))}")
    if preferences:
        pref_str = ", ".join(f"{p.category}={sanitize_field(p.value)}" for p in preferences)
        lines.append(f"Preferences: {pref_str}")
    return "\n".join(lines)
```

### Pattern 3: Authenticated avatar session variant (PERS-02/D-15)
**What:** Mirror `AnonymousAvatarSession` + `anonymous_session_service.py` + `public_avatar.py`, but key the session by `user_id` (JWT via `get_current_user`) instead of an anonymous JWT with no identity claim.
**When to use:** `POST /avatar/session` (authenticated) and its chat turn.
**Example:**
```python
# Source: backend/app/services/anonymous_session_service.py (structural mirror)
async def create_personalized_session(db: AsyncSession, user: User) -> PersonalizedAvatarSession:
    session = PersonalizedAvatarSession(user_id=user.id, expires_at=..., last_activity_at=...)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session
```

### Anti-Patterns to Avoid
- **Full-table replace on Excel re-upload:** D-03 explicitly requires per-user upsert; a naive `DELETE FROM user_crm_context; INSERT ...` would silently wipe data for users missing from a partial re-upload.
- **Sanitizing only `crm_notes`:** D-07 requires sanitization at BOTH import time and injection time, and across ALL injected fields, not just the free-text one — `customer_name`/`company`/`role`/`contact_person` are also attacker-controllable via the Excel upload (an admin could paste malicious text into any cell) and are rendered verbatim into a real system prompt.
- **Merging CRM data and preference tags into one table:** D-10 explicitly separates them so Excel re-upload never clobbers manually-tagged preferences — a single table would violate this on the next `import_crm_excel` upsert.
- **Building a new admin config page from a nonexistent "sibling":** CONTEXT.md's `code_context` section names `public_knowledge_config.py` + "对应 Admin 配置页" as a reference — **that admin page does not exist in the current codebase** (verified: no route, no component references `PublicKnowledgeConfig` in `frontend/src/`). Do not plan around copying a page that isn't there; use `training-materials.tsx` (upload UX) and `settings.tsx` (page layout/card sections) as the actual structural references instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .xlsx parsing | Custom binary/XML zip parser | `openpyxl.load_workbook` | Already a dependency; handles Excel's OOXML format correctly, including edge cases (merged cells, empty trailing rows, various date/number formats) that a hand-rolled parser would mishandle |
| JWT auth for the authenticated avatar endpoint | A parallel token scheme | `get_current_user` / `oauth2_scheme` from `dependencies.py` | Project already has one authoritative JWT mechanism (`python-jose` + `secret_key`/`algorithm` settings); a second scheme would fragment auth logic and violate CLAUDE.md's "no raw SQL / one pattern per concern" spirit |
| Admin-only route protection | Manual `if user.role != "admin"` checks scattered in route bodies | `Depends(require_role("admin"))` factory | Already the exact pattern in `admin_users.py`/`materials.py`; consistent 403 shape via the existing `AppException` hierarchy |

**Key insight:** Every plumbing concern in this phase (upload, auth, pagination, CRUD, migrations) already has an established codebase pattern from Phase 32 or earlier phases — the ONLY genuinely new engineering surface is the sanitizer, because prompt-injection/PII defense has never been built in this codebase before.

## Common Pitfalls

### Pitfall 1: Treating the sanitizer as "just regex, ship it"
**What goes wrong:** A minimal regex-only sanitizer (strip ``` `` ` ``, strip "ignore previous instructions") gives a false sense of security; injection phrasing has effectively unlimited paraphrases ("disregard the above", "forget your rules", non-English phrasings, unicode homoglyphs, zero-width characters).
**Why it happens:** D-06 explicitly scopes this to rule-based-only (no LLM review) for POC speed — this is an accepted, locked tradeoff, not an oversight, but the planner must not let scope creep silently expand the sanitizer into "the only defense" without also leaning on D-05's structural segregation (fixed section headers/labels) as a second independent layer, consistent with OWASP LLM01 guidance to "separate and clearly denote untrusted content" [CITED: genai.owasp.org/llmrisk/llm01-prompt-injection/].
**How to avoid:** Test the sanitizer against a small curated set of known injection strings (not exhaustive, but > 5 patterns) as its own unit-test suite; treat the structural template (D-05's fixed labeled sections) as the primary defense and the regex filter as defense-in-depth, not the sole gate.
**Warning signs:** A sanitizer unit test suite with only 1-2 test cases; sanitize logic that only runs at injection time and skips the "at import time too" requirement from D-06.

### Pitfall 2: PII regex false negatives/positives for `crm_notes`
**What goes wrong:** Naive Chinese ID-number/phone/bank-card regexes either under-match (missing valid formats: hyphenated, spaced, with country code) or over-match (false-positive on a legitimate 11-digit reference number).
**Why it happens:** Regex-based PII detection is inherently probabilistic — this is training-knowledge guidance, not verified against the actual test data this project will use.
**How to avoid:** Treat the exact regex list as `[ASSUMED]` (see Assumptions Log) and get explicit user sign-off on the specific patterns before locking them in code, per CONTEXT.md's "Claude's Discretion" note that leaves this open. Log/count redactions in the import result so an admin can spot-check false positives/negatives without exposing raw PII.
**Warning signs:** Zero test cases against realistic Chinese CRM free-text samples containing phone/ID/bank patterns.

### Pitfall 3: `email` uniqueness/case-sensitivity mismatch between Excel and `User.email`
**What goes wrong:** `User.email` is stored case-sensitively (`String(255), unique=True`); an Excel `user_email` cell with different casing (`John@Corp.com` vs `john@corp.com`) silently lands in "unmatched" even though the user exists.
**Why it happens:** SQLite/`ilike` behavior differs from case-insensitive lookups elsewhere in the codebase (`admin_users.py`'s search uses `ilike` for full-text search, but no existing exact-match-by-email lookup was found to confirm case-fold behavior).
**How to avoid:** Match on a case-normalized comparison (`func.lower(User.email) == email.strip().lower()`) rather than an exact `==`, and unit-test this explicitly with mixed-case Excel input.
**Warning signs:** Import result unmatched-count higher than expected in manual QA with real-looking test data.

### Pitfall 4: Forgetting D-08's "silent" requirement in the UI
**What goes wrong:** Frontend accidentally surfaces a "no personalized data" toast/badge-state difference, contradicting D-08 ("用户无感知" — user must have no visible indication of whether CRM data exists).
**Why it happens:** Natural instinct to show loading/empty states explicitly, as most other list/detail views in this codebase do (e.g. `SourcesPanel`'s explicit `empty-no-match` status).
**How to avoid:** The personalized-mode badge (D-14) is ONLY about login state ("专属模式"), never about whether CRM data was found — the chat UX must look byte-identical whether or not `UserCrmContext` exists for that user.
**Warning signs:** Any conditional render keyed on "has CRM data" reaching a component the end user sees.

## Runtime State Inventory

Not applicable — this is a greenfield-additive phase (new tables/endpoints/pages), not a rename/refactor/migration. No existing runtime state (stored data, live service config, OS-registered state, secrets, build artifacts) needs to change for anything already in production. The one caveat: initial deployment/rollout will need admins to actually upload the first CRM Excel file before PERS-02 has any effect — this is a data-population step, not a migration, and D-08's silent fallback means the system functions correctly (degrades to anonymous-like behavior) even with zero rows present.

## Code Examples

### Excel header validation with a clear 400 error (D-04)
```python
# Source: openpyxl official docs (load_workbook) + project's bad_request() convention
# backend/app/utils/exceptions.py already defines bad_request(message) -> NoReturn
from app.utils.exceptions import bad_request

EXPECTED_HEADERS = ["user_email", "customer_name", "company", "role", "crm_notes", "contact_person"]

def validate_headers(headers: list[str]) -> None:
    if headers != EXPECTED_HEADERS:
        bad_request(
            f"Invalid header row. Expected exactly: {', '.join(EXPECTED_HEADERS)}"
        )
```

### Case-insensitive email match for upsert (Pitfall 3 mitigation)
```python
# Source: project convention (sqlalchemy select + func) — see admin_users.py's or/ilike pattern
from sqlalchemy import func, select

async def find_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )
    return result.scalar_one_or_none()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| n/a (greenfield within this codebase) | n/a | n/a | No prior art in this codebase to supersede — this is the first personalization/injection-defense feature |

**Deprecated/outdated:** None applicable to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The specific regex patterns for Chinese ID-card number / bank-card number / phone number / email PII detection (D-07) are training-knowledge suggestions, NOT verified against a live regex-testing tool or an authoritative PII-pattern registry in this session (WebSearch tool returned HTTP 400 errors for all queries attempted during this research pass — see Sources) | Common Pitfalls #2, Code Examples | Under- or over-redaction of PII in `crm_notes`; false sense of compliance if patterns are wrong. CONTEXT.md already flags the exact pattern list as "Claude's Discretion" — treat as requiring explicit user/planner confirmation before locking into code, not as a locked decision |
| A2 | OWASP LLM01 mitigation guidance (segregate untrusted content, constrain model behavior, output/input filtering) was fetched live from `genai.owasp.org` via WebFetch and is current as of this research date — but the "double-gated sanitize at both import and injection time" locked decision (D-06) itself is a CONTEXT.md decision, not independently re-derived from OWASP guidance in this session | Pitfall 1 | If OWASP guidance has since diverged materially from what's cited, the sanitizer's threat model could be incomplete; low risk since D-06 already locks the approach and this is supplementary context, not the sole basis |
| A3 | No admin UI exists today for `PublicKnowledgeConfig` — verified by exhaustive grep of `frontend/src/` for the string, returning zero page/component matches (only `hooks/use-anonymous-voice-live.ts`, which references the model conceptually, not a config page) | Anti-Patterns, Summary | If a config page exists elsewhere (e.g., a branch not yet merged, or non-obvious naming), planner would mis-scope the "reuse existing sibling page" claim in CONTEXT.md's `code_context`; verified via grep at HEAD as of 2026-08-01, moderate confidence this is accurate for the current working tree |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **What are the exact PII regex patterns to use for D-07?**
   - What we know: Categories are locked (身份证/银行卡号/电话/邮箱 — ID number, bank card, phone, email); email is straightforward (`\S+@\S+\.\S+`-class pattern, low risk).
   - What's unclear: Exact Chinese 18-digit ID-number checksum validation, bank-card length/prefix variability (13-19 digits, various issuer prefixes), and phone-number formats (mobile-only vs. mobile+landline, +86 prefix or not) were not independently verified this session — WebSearch tooling errored on every attempt (see Sources).
   - Recommendation: Planner should surface this as a discuss-phase confirmation item or accept CONTEXT.md's explicit "Claude's Discretion" framing and have the executor draft + get a quick human eyeball-check on the regex list before merging, rather than treating any specific pattern as pre-verified.

2. **Should the personalized avatar session share the SAME `AvatarInteractionLog` table as anonymous, with a `user_id`/`session_type` discriminator, or should it be a separate log table?**
   - What we know: D-15 says "复用 Phase 32 的会话生命周期/配额/审计（AvatarInteractionLog）基础设施" (reuse the AvatarInteractionLog infrastructure) — but the current `AvatarInteractionLog.session_id` FK points specifically at `anonymous_avatar_sessions.id` (`ForeignKey("anonymous_avatar_sessions.id")`), not a polymorphic/nullable reference to either session type.
   - What's unclear: Whether "reuse infrastructure" means (a) add a second nullable FK column pointing at the new `personalized_avatar_sessions` table, (b) generalize to a polymorphic `session_type` + `session_id` pair without a DB-level FK constraint, or (c) create a parallel `PersonalizedAvatarInteractionLog` table with the same shape.
   - Recommendation: Planner should treat this as a concrete task-level design decision (likely (a), a second nullable FK + a discriminator column, following the existing `ON DELETE SET NULL` audit-durability pattern) rather than something research can resolve without seeing the actual migration; flag for architect/planner judgment.

3. **Personalized-mode rate limits/quota (D-15: "登录用户配额可宽于匿名") — what specific numeric values?**
   - What we know: Anonymous quotas exist today as concrete `Settings` fields (`anon_rate_limit_chat_ip`, etc.) and CONTEXT.md explicitly defers the exact number to "Claude's Discretion."
   - What's unclear: Whether personalized quota should be IP-keyed, session-keyed, user-id-keyed, or some combination; the anonymous dual-key (IP + session) pattern in `rate_limit.py` was specifically designed because anonymous users have no stable identity — logged-in users DO have a stable identity (`user.id`), so a user-id-keyed limiter may be simpler and more correct than reusing the IP+session dual-key scheme verbatim.
   - Recommendation: Default to a single user-id-keyed `slowapi` limiter (simpler than anonymous's dual-key setup, since the identity problem anonymous mode solves doesn't exist here) with a looser default (e.g. `120/hour` vs anonymous's `60/hour`) — planner/executor to confirm exact number is non-blocking since it's explicitly "Claude's Discretion."

## Environment Availability

No external tool/service/runtime dependencies beyond what's already installed and verified (`openpyxl` 3.1.2, satisfies pin). No Docker/DB/service probing required — this phase is pure application code + one Alembic migration against the existing SQLite/PostgreSQL setup already running in this project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.3+ + pytest-asyncio 0.24+ (`backend/pyproject.toml` `[dev]` group) |
| Framework (frontend) | vitest (config split: `vite.config.ts` for build, `vitest.config.ts` for tests, per 29-10-SUMMARY.md) |
| Framework (E2E) | Playwright (`frontend/e2e/*.spec.ts`, existing `anonymous-avatar-qa.spec.ts` as the direct structural precedent) |
| Config file | `backend/pyproject.toml` (`[tool.pytest]`-equivalent via `dev` deps); `frontend/vitest.config.ts`; `frontend/playwright.config.ts` |
| Quick run command (backend) | `cd backend && pytest tests/test_crm_import_service.py -x` (per-module, once created) |
| Quick run command (frontend) | `cd frontend && npx vitest run src/hooks/use-crm-import.test.ts` |
| Full suite command (backend) | `cd backend && pytest -v` |
| Full suite command (frontend) | `cd frontend && npm run build && npx vitest run` |
| E2E command | `cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/personalized-avatar-qa.spec.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-01 | Admin uploads valid Excel → rows parsed, upserted, unmatched/skipped reported | unit + integration | `pytest tests/test_crm_import_service.py -x` | ❌ Wave 0 |
| PERS-01 | Header mismatch → 400 with expected-format hint | unit | `pytest tests/test_admin_crm_api.py::test_invalid_header_returns_400 -x` | ❌ Wave 0 |
| PERS-01 | Re-upload preserves users missing from new file (upsert, not replace) | unit | `pytest tests/test_crm_import_service.py::test_reupload_preserves_missing_users -x` | ❌ Wave 0 |
| PERS-02 | Personalized chat turn injects sanitized CRM section into system prompt | unit | `pytest tests/test_prompt_builder_personalization.py -x` | ❌ Wave 0 |
| PERS-02 | Injection-pattern strings are neutralized at both import and injection time | unit | `pytest tests/test_prompt_sanitizer.py -x` | ❌ Wave 0 |
| PERS-02 | `crm_notes` PII (ID/phone/bank/email patterns) is redacted before injection | unit | `pytest tests/test_prompt_sanitizer.py::test_redacts_pii -x` | ❌ Wave 0 |
| PERS-02 | No-CRM-data user gets silent anonymous-equivalent prompt (D-08) | unit | `pytest tests/test_prompt_builder_personalization.py::test_silent_fallback -x` | ❌ Wave 0 |
| PERS-03 | Admin can create/update/delete a user's preference tags via API | unit | `pytest tests/test_user_preference_api.py -x` | ❌ Wave 0 |
| PERS-03 | Admin UI shows CRM match status + tag CRUD in user detail | frontend unit | `npx vitest run src/components/admin/user-personalization-section.test.tsx` | ❌ Wave 0 |
| PERS-01/02/03 | End-to-end: admin uploads CRM Excel → tags a user → logged-in user asks a question → sees personalized (non-CRM-leaking) answer | E2E | `npx playwright test e2e/personalized-avatar-qa.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** module-scoped quick pytest/vitest run for the file(s) touched
- **Per wave merge:** full backend `pytest -v` + full frontend `npx vitest run` + `npx tsc -b`
- **Phase gate:** Full suite green (backend + frontend + Playwright personalized-avatar spec) before `/gsd-verify-work`, per CLAUDE.md's top-priority one-requirement-at-a-time + 100%-unit + E2E-pass + commit/push cycle

### Wave 0 Gaps
- [ ] `backend/tests/test_crm_import_service.py` — covers PERS-01 (parse/validate/upsert/skip/unmatched)
- [ ] `backend/tests/test_admin_crm_api.py` — covers PERS-01 admin endpoint (401/403/400/200 paths, following `test_public_avatar_api.py`'s structural style)
- [ ] `backend/tests/test_prompt_sanitizer.py` — covers PERS-02 sanitization/PII redaction (new module, zero existing coverage)
- [ ] `backend/tests/test_prompt_builder_personalization.py` — covers PERS-02 injection + D-08 silent fallback
- [ ] `backend/tests/test_user_preference_api.py` — covers PERS-03 CRUD
- [ ] `frontend/src/pages/admin/crm-data.test.tsx` — covers PERS-01 admin UI
- [ ] `frontend/src/components/admin/user-personalization-section.test.tsx` — covers PERS-03 admin UI
- [ ] `frontend/e2e/personalized-avatar-qa.spec.ts` — covers full PERS-01→03 user story, modeled directly on the existing `e2e/anonymous-avatar-qa.spec.ts`
- [ ] Framework install: none — pytest/vitest/Playwright are already configured project-wide; no new test tooling needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Existing JWT (`python-jose`) via `get_current_user`/`oauth2_scheme` — reuse verbatim for the new authenticated avatar endpoint (D-15); do not build a parallel scheme |
| V3 Session Management | yes | New `PersonalizedAvatarSession` model, DB-row-is-source-of-truth pattern (mirroring `AnonymousAvatarSession`'s `expires_at`/`is_revoked` fields, not trusting JWT `exp` alone) |
| V4 Access Control | yes | `Depends(require_role("admin"))` factory for all CRM-upload/preference-tag-edit endpoints — identical to `admin_users.py`/`materials.py` |
| V5 Input Validation | yes | Pydantic v2 schemas for all new request bodies (`CrmImportResult`, `UserPreferenceCreate`); Excel header/row validation (D-04); file-extension + size cap on upload (mirror `materials.py`'s `ALLOWED_EXTENSIONS`/`MAX_FILE_SIZE`) |
| V6 Cryptography | no | No new secrets/crypto surface introduced by this phase — reuses existing `secret_key`/JWT signing |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Prompt injection via CRM free-text (`crm_notes`) or tag values, reaching the LLM as part of a real system prompt | Tampering / Elevation of Privilege | D-05 structural segregation (fixed labeled "用户背景" section) + D-06 double-gated rule-based sanitization (import time + injection time) + OWASP LLM01 guidance to "separate and clearly denote untrusted content" and "constrain model behavior" [CITED: genai.owasp.org/llmrisk/llm01-prompt-injection/] |
| PII leakage from CRM notes into LLM context / potential model output | Information Disclosure | D-07 regex-based PII redaction before injection (A1: exact patterns need confirmation — see Assumptions Log) |
| Malicious/oversized Excel upload (e.g., zip-bomb-style XLSX, extremely large row count) | Denial of Service | Mirror `materials.py`'s `MAX_FILE_SIZE` cap (currently 4MB) and `.xlsx`-only extension allowlist for the new CRM upload endpoint; `openpyxl.load_workbook(..., read_only=True)` avoids loading the full style tree into memory |
| Unmatched/skipped-row detail response leaking other users' emails to a non-admin | Information Disclosure | Endpoint already gated `require_role("admin")` — no additional mitigation needed beyond existing RBAC, but confirm the import-result response is never exposed on any non-admin route |
| IDOR on preference-tag CRUD (editing another user's tags via `user_id` in the URL) | Elevation of Privilege | Route is inherently admin-scoped by design (D-11: admin edits ANY user's tags) — this is intended, not a vulnerability, but MUST remain behind `require_role("admin")`, never exposed to the `user` role for other users' data |

## Sources

### Primary (HIGH confidence)
- Codebase (this repo, read at HEAD 2026-08-01): `backend/app/services/{avatar_service,prompt_builder,anonymous_session_service,material_service,public_knowledge_config_service,rate_limit}.py`, `backend/app/api/{public_avatar,materials,admin_users}.py`, `backend/app/models/{anonymous_avatar_session,avatar_interaction_log,public_knowledge_config,user}.py`, `backend/app/dependencies.py`, `backend/app/config.py`, `backend/app/schemas/public_avatar.py`, `backend/alembic/versions/b35a_add_anonymous_avatar_tables.py`, `frontend/src/{router/index.tsx,router/auth-guard.tsx,stores/auth-store.ts,pages/avatar-page.tsx,pages/admin/users.tsx,pages/admin/settings.tsx,api/materials.py}` — direct inspection of existing patterns this phase must reuse
- `pip index versions openpyxl` [VERIFIED: tool run, 2026-08-01] — confirms installed 3.1.2 / latest 3.1.5, satisfies project pin `>=3.1.0`
- genai.owasp.org/llmrisk/llm01-prompt-injection/ [CITED: fetched live via WebFetch, 2026-08-01] — prompt-injection mitigation guidance (segregate untrusted content, constrain model behavior, input/output filtering)

### Secondary (MEDIUM confidence)
- None — all secondary/community sources were unreachable this session (see Tertiary below)

### Tertiary (LOW confidence / unverified this session)
- Chinese PII regex patterns (ID card/bank card/phone number formats) — `[ASSUMED]`, training knowledge only; WebSearch tool returned HTTP 400 errors on every query attempted this session (multiple query variants tried, all failed identically), so this could not be cross-verified. Flagged in Assumptions Log (A1) and Open Questions (#1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library choice is either already an installed/verified dependency or the project's single existing auth/DB mechanism; no new library introduced
- Architecture: HIGH — every pattern (upload endpoint, session service, prompt_builder extension, admin CRUD) has a direct, inspected precedent in this exact codebase from Phase 32 or earlier
- Pitfalls: MEDIUM — sanitization/PII pitfalls are grounded in general security reasoning + one live OWASP citation, but the exact regex patterns and a live red-team pass were not performed this session (WebSearch unavailable)

**Research date:** 2026-08-01
**Valid until:** 30 days (stable internal codebase patterns; the one time-sensitive external claim — openpyxl version — should be re-checked if this research is reused past that window)
