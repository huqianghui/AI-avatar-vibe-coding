# Phase 19: AI Avatar Skill Module - Research

**Researched:** 2026-04-11
**Domain:** Skill lifecycle management, document-to-SOP conversion, Skill Hub UI, Scenario-Skill association
**Confidence:** HIGH

## Summary

Phase 19 builds a Skill module aligned with the agentskills.io / Microsoft Agent Framework SKILL.md specification. The core workflow is: admin uploads training documents (PDF, DOCX, PPTX, TXT, MD) -> system converts to Markdown then uses Azure OpenAI to extract structured SOP content (Coaching Protocol with assessment criteria, key knowledge points) -> admin reviews and publishes the Skill -> admin associates Skill with Scenario -> during training sessions, the HCP Agent follows the Skill's SOP via SkillManager.compose_instructions().

This phase introduces 3 new database models (Skill, SkillVersion, SkillResource), a new `skill_service.py` for business logic, a new `skill_conversion_service.py` for AI-powered document-to-SOP extraction, new API routes, and a Skill Hub admin frontend. Skill data uses split storage: YAML frontmatter → DB fields, Markdown body → content Text field, resources → SkillResource table. The existing `agent_sync_service.py` will be extended to inject Skill SOP content into agent instructions via SkillManager when a Scenario has an associated Skill. Skill Hub is admin-only — MR users access Skills indirectly through Scenarios.

**Primary recommendation:** Follow the exact patterns established in Phases 5 (material upload), 11 (agent sync), and 17 (knowledge base config) -- new models with TimestampMixin, async services with `db.flush()`, Pydantic v2 schemas, TanStack Query hooks, and Alembic migrations with `server_default` for SQLite compatibility.

## Project Constraints (from CLAUDE.md)

- All Python code async (`async def`, `await`, `AsyncSession`)
- Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)`
- Route ordering: static routes before parameterized `/{id}` routes
- Create returns 201, Delete returns 204
- Service layer holds business logic, routers only handle HTTP
- All models MUST use `TimestampMixin`
- Schema changes require Alembic migration (never delete DB file)
- All routes under `/api/v1/` prefix
- TypeScript `strict: true`, no `any` types
- TanStack Query hooks per domain, no inline `useQuery`
- i18n via react-i18next with separate namespace files
- Design tokens via CSS custom properties, `cn()` for class composition
- `server_default` in migrations for SQLite compatibility with existing rows
- `db.flush()` instead of `db.commit()` to work with session middleware

## Standard Stack

### Core (Backend - already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | API routing, DI | Project standard [VERIFIED: pyproject.toml] |
| SQLAlchemy 2.0+ | async | ORM models | Project standard [VERIFIED: pyproject.toml] |
| Alembic | >=1.13.0 | DB migrations | Project standard [VERIFIED: pyproject.toml] |
| Pydantic v2 | >=2.0 | Request/response schemas | Project standard [VERIFIED: pyproject.toml] |
| pdfplumber | latest | PDF text extraction (better table support) | Needs installation — chosen over pypdf for superior table extraction in training materials |
| python-docx | 1.2.0 | DOCX text extraction | Already installed [VERIFIED: pip list] |
| openai | >=1.50.0 | Azure OpenAI for SOP extraction | Project standard [VERIFIED: pyproject.toml] |
| aiofiles | >=23.0.0 | Async file I/O | Project standard [VERIFIED: pyproject.toml] |

### New (Backend - needs installation)

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| python-pptx | 1.0.2 | PPTX text extraction | Phase requires PPT/PPTX support for material-to-skill conversion [VERIFIED: pip index versions] |

### Core (Frontend - already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.60.0 | Server state | Project standard [VERIFIED: package.json] |
| react-dropzone | ^15.0.0 | File upload drag-and-drop | Used in materials page [VERIFIED: package.json] |
| axios | ^1.7.0 | HTTP client | Project standard [VERIFIED: package.json] |
| react-hook-form + zod | ^7.72.0 / ^4.3.6 | Form validation | Used in admin forms [VERIFIED: package.json] |
| lucide-react | ^0.460.0 | Icons | Project standard [VERIFIED: package.json] |
| file-saver | ^2.0.5 | File download | Already installed [VERIFIED: package.json] |

### New (Frontend - needs installation)

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| jszip | 3.10.1 | Skill package ZIP export/import | Standard library for in-browser ZIP creation and extraction [VERIFIED: npm view jszip version] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfplumber + python-docx + python-pptx | Azure Content Understanding API | CU is overkill for text extraction; local parsing is faster, cheaper, and works offline. pdfplumber chosen over pypdf for better table support in training materials. |
| jszip (frontend) | Python zipfile (backend-only) | Backend-only ZIP is simpler but prevents client-side preview before upload. Use both: backend for export API, jszip for client-side import preview. |
| Custom SOP extraction prompts | LangChain/LlamaIndex | Over-engineered for single-prompt extraction. A well-crafted Azure OpenAI prompt with structured JSON output is sufficient. |

**Installation:**

```bash
# Backend
cd backend
pip install "python-pptx>=1.0.0" "pdfplumber>=0.10.0"
# Add to pyproject.toml dependencies

# Frontend
cd frontend
npm install jszip @types/jszip
```

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── models/
│   └── skill.py           # Skill, SkillVersion, SkillResource
├── schemas/
│   └── skill.py           # Pydantic v2 request/response schemas
├── api/
│   └── skills.py          # /api/v1/skills/* routes
├── services/
│   ├── skill_service.py          # CRUD, lifecycle, assignment management
│   └── skill_conversion_service.py  # AI-powered material -> SOP extraction

frontend/src/
├── types/
│   └── skill.ts           # TypeScript interfaces
├── api/
│   └── skills.ts          # Axios API client for skills
├── hooks/
│   └── use-skills.ts      # TanStack Query hooks
├── pages/
│   ├── admin/
│   │   ├── skill-hub.tsx          # Skill list + management
│   │   └── skill-editor.tsx       # Skill create/edit with material upload + file tree view
├── locales/
│   ├── en-US/skill.json   # English translations
│   └── zh-CN/skill.json   # Chinese translations
```

### Pattern 1: Skill Data Model (3 tables + Scenario FK)

**What:** Three SQLAlchemy models following the existing TimestampMixin + relationship pattern, plus a `skill_id` FK on Scenario.
**When to use:** All skill-related data persistence.

**Key design decisions (from CONTEXT.md):**
- Split storage: YAML frontmatter → DB fields, Markdown body → `content` Text, resources → `SkillResource` table
- Five-state lifecycle: `draft → review → published → archived` + `failed`
- Independent from TrainingMaterial — no cross-references
- Skill links to Scenario (not HCP directly) via `scenario.skill_id` FK

```python
# Source: Existing pattern from models/material.py, models/hcp_profile.py [VERIFIED: codebase]

class Skill(Base, TimestampMixin):
    """Training skill with lifecycle: draft -> review -> published -> archived + failed."""
    __tablename__ = "skills"

    # From YAML frontmatter
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    product: Mapped[str] = mapped_column(String(255), default="", index=True)
    therapeutic_area: Mapped[str] = mapped_column(String(255), default="")
    compatibility: Mapped[str] = mapped_column(String(255), default="")  # e.g. "Requires python3"
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")  # Extended frontmatter fields as JSON
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated

    # Markdown body (Coaching Protocol content)
    content: Mapped[str] = mapped_column(Text, default="")  # Full Markdown body of SKILL.md

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/review/published/archived/failed
    current_version: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Quality evaluation
    structure_check_passed: Mapped[bool | None] = mapped_column(default=None)
    structure_check_score: Mapped[int | None] = mapped_column(default=None)
    quality_score: Mapped[int | None] = mapped_column(default=None)
    quality_verdict: Mapped[str | None] = mapped_column(String(20), default=None)

    # Conversion tracking
    conversion_status: Mapped[str | None] = mapped_column(String(20), default=None)  # pending/processing/completed/failed

    # Relationships
    versions = relationship("SkillVersion", back_populates="skill", order_by="SkillVersion.version_number.desc()")
    resources = relationship("SkillResource", back_populates="skill")


class SkillVersion(Base, TimestampMixin):
    """Versioned snapshot of a skill's content."""
    __tablename__ = "skill_versions"

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")  # Markdown body snapshot
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")  # Frontmatter snapshot
    change_notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(default=True)

    skill = relationship("Skill", back_populates="versions")


class SkillResource(Base, TimestampMixin):
    """A resource file belonging to a Skill package (references/, scripts/, assets/)."""
    __tablename__ = "skill_resources"

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(20), nullable=False)  # reference/script/asset
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)  # Storage path
    content_type: Mapped[str] = mapped_column(String(100), default="")
    file_size: Mapped[int] = mapped_column(default=0)
    extraction_status: Mapped[str | None] = mapped_column(String(20), default=None)  # For reference files: pending/processing/completed/failed

    skill = relationship("Skill", back_populates="resources")


# Scenario model extension (existing table, add FK):
# class Scenario(Base, TimestampMixin):
#     ...existing fields...
#     skill_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("skills.id"), nullable=True)
```

### Pattern 2: AI-Powered SOP Extraction Service

**What:** A service that reads uploaded reference files from SkillResource, converts to Markdown, applies semantic chunking, and uses Azure OpenAI to generate Coaching Protocol content.
**When to use:** When admin uploads materials and clicks "Convert to Skill".
**Key decisions:** Long documents → Markdown → semantic+size chunking → per-chunk extraction → merge. Chunk size is admin-configurable (D-07).

```python
# Source: Existing patterns from material_service.py + scoring_engine.py [VERIFIED: codebase]

async def extract_sop_from_skill_resources(
    db: AsyncSession,
    skill_id: str,
) -> str:
    """Extract Coaching Protocol content from Skill reference materials.

    Pipeline (aligned with coaching-skill-creator 5-phase flow):
    1. Load reference files from SkillResource (type='reference')
    2. Extract text → convert to Markdown (preserving structure)
    3. Semantic chunking by heading/section boundaries + size limit
    4. Per-chunk extraction of key points, knowledge, assessment criteria
    5. Merge + deduplicate → generate complete Coaching Protocol (Markdown body)
    """
    storage = get_storage()
    skill = await get_skill(db, skill_id)

    # 1. Collect all reference resources
    references = [r for r in skill.resources if r.resource_type == "reference"]
    all_markdown = ""
    for ref in references:
        content = await storage.read(ref.path)
        markdown = convert_to_markdown(content, ref.content_type)
        all_markdown += markdown + "\n\n"

    # 2. Semantic chunking (configurable chunk size)
    chunk_limit = await get_admin_config("skill_chunk_token_limit", default=80000)
    chunks = semantic_chunk(all_markdown, max_tokens=chunk_limit)

    # 3. Per-chunk extraction + merge
    extracted_parts = []
    for chunk in chunks:
        part = await call_sop_extraction(chunk)
        extracted_parts.append(part)

    # 4. Merge and deduplicate into final Coaching Protocol
    coaching_protocol = merge_extractions(extracted_parts)
    return coaching_protocol  # Markdown body for skill.content
```

### Pattern 3: Agent Instruction Injection via SkillManager

**What:** When a Scenario has an associated Skill, the Skill's Coaching Protocol content is injected into the agent's instructions via SkillManager.compose_instructions().
**When to use:** During agent sync and session creation.
**Reference:** `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skill_manager.py`

```python
# Source: Existing pattern from agent_sync_service.py build_agent_instructions() [VERIFIED: codebase]
# + SkillManager pattern from reference code [VERIFIED: skill_manager.py]

async def build_skill_augmented_instructions(
    db: AsyncSession,
    profile: HcpProfile,
    scenario_id: str | None = None,
    template: str | None = None,
) -> str:
    """Build agent instructions with Skill SOP content from associated Scenario."""
    base_instructions = build_agent_instructions(profile.to_prompt_dict(), template)

    if not scenario_id:
        return base_instructions

    # Load Scenario → Skill association
    scenario = await get_scenario(db, scenario_id)
    if not scenario or not scenario.skill_id:
        return base_instructions

    skill = await get_skill(db, scenario.skill_id)
    if not skill or skill.status != "published":
        return base_instructions

    # Use SkillManager pattern: compose_instructions() merges Skill content
    # skill.content contains the Markdown body (Coaching Protocol)
    skill_block = f"## Training Skill: {skill.name}\n\n{skill.content}"
    return f"{base_instructions}\n\n# SOP Training Instructions\n{skill_block}"
```

### Pattern 4: Skill Package ZIP Import/Export

**What:** Export a skill as a ZIP package containing SKILL.md + resources. Import by uploading a ZIP. Compatible with agentskills.io spec.
**When to use:** Skill portability between environments.

```python
# Backend: Python zipfile (stdlib) for creation
import zipfile
import io
import yaml

async def export_skill_package(db: AsyncSession, skill_id: str) -> bytes:
    """Export a skill as a ZIP package (agentskills.io compatible)."""
    skill = await get_skill(db, skill_id)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Reconstruct SKILL.md from DB fields
        frontmatter = {
            "name": skill.name,
            "description": skill.description,
            "compatibility": skill.compatibility,
            **(json.loads(skill.metadata_json) if skill.metadata_json else {}),
        }
        skill_md = f"---\n{yaml.dump(frontmatter, allow_unicode=True)}---\n\n{skill.content}"
        zf.writestr("SKILL.md", skill_md)

        # Resources (references/, scripts/, assets/)
        for resource in skill.resources:
            content = await storage.read(resource.path)
            zf.writestr(f"{resource.resource_type}s/{resource.filename}", content)
    return buffer.getvalue()
```

### Anti-Patterns to Avoid

- **Storing SOP content only in agent instructions:** SOP must be stored in the Skill model (`content` field) as the source of truth. Agent instructions are derived from it via SkillManager and regenerated on sync.
- **Direct file parsing in API routes:** All document parsing and AI extraction must go through the service layer. Routers only handle HTTP.
- **Synchronous document processing in request:** Material-to-SOP conversion can be slow (AI call). Use async processing with status tracking (pending -> processing -> completed -> failed) per Skill record.
- **Modifying agent instructions without the sync pattern:** Always go through `agent_sync_service.sync_agent_for_profile()` to update agent instructions. Never patch instructions directly.
- **Hard-coding SOP prompt in multiple places:** Use a single `build_sop_extraction_prompt()` function in `prompt_builder.py`, following the existing pattern.
- **Cross-referencing TrainingMaterial:** Skill resources are stored independently in SkillResource table. Do NOT create FK references to training_materials table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | `pdfplumber` | Better table extraction than pypdf for training materials |
| DOCX text extraction | Custom XML parser | `python-docx` Document API | Already installed, handles paragraphs + tables |
| PPTX text extraction | Custom OPC parser | `python-pptx` Presentation API | Standard library for .pptx files |
| ZIP packaging | Custom binary format | Python `zipfile` (stdlib) + `jszip` (frontend) | Standard, portable, inspectable |
| Structured JSON extraction from LLM | Regex parsing of LLM output | Azure OpenAI `response_format={"type": "json_object"}` | Guarantees valid JSON output |
| File upload with progress | Custom XHR handler | Axios `onUploadProgress` (existing pattern) | Already established in materials upload |
| Pagination | Custom pagination logic | `PaginatedResponse.create()` (existing) | Project standard utility |

**Key insight:** This phase is primarily data modeling and UI -- the AI extraction is a single well-crafted prompt call to Azure OpenAI. Don't over-engineer the AI pipeline. The existing `openai` SDK + a structured prompt is sufficient.

## Common Pitfalls

### Pitfall 1: SQLite ALTER COLUMN in Alembic Migration
**What goes wrong:** SQLite doesn't support ALTER COLUMN; migration fails.
**Why it happens:** Phase adds new tables but may also need to add FK columns to existing tables.
**How to avoid:** Use `render_as_batch=True` in alembic env.py (already configured). Use `server_default` on all new columns. New tables don't need batch mode.
**Warning signs:** Alembic migration error mentioning ALTER TABLE.

### Pitfall 2: MissingGreenlet on SQLAlchemy Relationship Loading
**What goes wrong:** Accessing a relationship attribute outside async context raises MissingGreenlet.
**Why it happens:** SQLAlchemy async mode requires eager loading or explicit async loading of relationships.
**How to avoid:** Use `selectinload()` in queries or the expunge+re-query pattern from `material_service.py`. [VERIFIED: Phase 05 decision]
**Warning signs:** `MissingGreenlet` exception in logs.

### Pitfall 3: SOP Extraction Prompt Returns Invalid JSON
**What goes wrong:** Azure OpenAI returns markdown-wrapped JSON or truncated output.
**Why it happens:** Without `response_format`, LLM may wrap JSON in code blocks or truncate long responses.
**How to avoid:** Always use `response_format={"type": "json_object"}` in the API call. Validate the response with Pydantic before storing.
**Warning signs:** JSON parse errors in skill_conversion_service.

### Pitfall 4: Circular Import Between skill_service and agent_sync_service
**What goes wrong:** Import error at startup.
**Why it happens:** skill_service imports agent_sync_service for agent re-sync; agent_sync_service needs skill data for instruction building.
**How to avoid:** Use lazy import pattern inside functions (existing convention: `from app.services import knowledge_base_service` inside `sync_agent_for_profile`). [VERIFIED: agent_sync_service.py line 635]
**Warning signs:** ImportError on startup.

### Pitfall 5: Large Document Text Exceeds Azure OpenAI Token Limit
**What goes wrong:** SOP extraction fails because combined document text exceeds model context window.
**Why it happens:** Multiple large documents combined for extraction.
**How to avoid:** Implement text chunking (truncate to ~100K characters, roughly 25K tokens for GPT-4o). For very large corpora, extract per-document then merge. Log a warning if truncation occurs.
**Warning signs:** 400 error from Azure OpenAI mentioning token limit.

### Pitfall 6: Scenario-Skill Association Not Triggering Agent Re-Sync
**What goes wrong:** HCP Agent doesn't follow the SOP during training.
**Why it happens:** Associating a Skill with a Scenario doesn't automatically update the agent's instructions in AI Foundry.
**How to avoid:** When Scenario.skill_id changes, trigger `agent_sync_service.sync_agent_for_profile()` for all HCP profiles used by that Scenario (same pattern as `knowledge_base_service._trigger_agent_resync()`). [VERIFIED: knowledge_base_service.py line 313]
**Warning signs:** Agent responds without SOP awareness.

### Pitfall 7: Frontend Type Mismatch with Snake_Case Backend
**What goes wrong:** TypeScript types use camelCase but API returns snake_case.
**Why it happens:** Backend follows Python snake_case convention.
**How to avoid:** Use snake_case in TypeScript types to match API exactly (existing project convention). [VERIFIED: all frontend types use snake_case matching backend]
**Warning signs:** Undefined values in UI when rendering skill data.

## Code Examples

### Document Text Extraction (Backend)

```python
# Source: Extending existing pattern from material upload [VERIFIED: material_service.py, storage/local.py]

def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber (better table support)."""
    import pdfplumber
    import io
    pages = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    from docx import Document
    import io
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def extract_text_from_pptx(content: bytes) -> str:
    """Extract text from PPTX bytes using python-pptx."""
    from pptx import Presentation
    import io
    prs = Presentation(io.BytesIO(content))
    slides_text = []
    for slide in prs.slides:
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                texts.append(shape.text)
        if texts:
            slides_text.append("\n".join(texts))
    return "\n\n---\n\n".join(slides_text)


def extract_text(content: bytes, content_type: str) -> str:
    """Dispatch text extraction based on content type."""
    if "pdf" in content_type:
        return extract_text_from_pdf(content)
    elif "wordprocessing" in content_type or content_type.endswith(".docx"):
        return extract_text_from_docx(content)
    elif "presentation" in content_type or content_type.endswith(".pptx"):
        return extract_text_from_pptx(content)
    return ""
```

### SOP Extraction Prompt

```python
# Source: Extending pattern from prompt_builder.py [VERIFIED: codebase]

SOP_EXTRACTION_PROMPT = """You are an expert medical training content designer. 
Analyze the following training materials and extract a structured Standard Operating Procedure (SOP) for Medical Representative (MR) training.

## Input Materials
{document_text}

## Required Output Format
Return ONLY valid JSON in this exact format:
{{
  "sop_steps": [
    {{
      "step_number": 1,
      "title": "Step title",
      "description": "Detailed description of what MR should do",
      "key_points": ["point 1", "point 2"],
      "expected_duration_minutes": 5
    }}
  ],
  "assessment_criteria": [
    {{
      "criterion": "Assessment item description",
      "weight": 20,
      "passing_score": 70
    }}
  ],
  "key_knowledge_points": [
    {{
      "topic": "Knowledge topic",
      "content": "Key information the MR must know",
      "importance": "high"
    }}
  ],
  "summary": "Brief 2-3 sentence summary of the skill"
}}

Rules:
1. Extract ALL actionable training steps from the materials
2. Assessment criteria weights must total 100
3. Knowledge points should cover product, mechanism, clinical data, and safety
4. Use the same language as the source materials (Chinese or English)
5. Be specific and actionable - avoid generic instructions"""
```

### Skill API Route (Backend)

```python
# Source: Following exact pattern from api/materials.py [VERIFIED: codebase]

router = APIRouter(prefix="/skills", tags=["skills"])

@router.post("", response_model=SkillOut, status_code=201)
async def create_skill(
    data: SkillCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new skill. Admin only."""
    skill = await skill_service.create_skill(db, data, user.id)
    return skill


# Static routes BEFORE parameterized /{id} routes (Gotcha #3)
@router.get("/published", response_model=PaginatedResponse[SkillListOut])
async def list_published_skills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List published skills for Skill Hub (Admin only — MR accesses Skills via Scenarios)."""
    items, total = await skill_service.get_published_skills(db, page=page, page_size=page_size, search=search)
    return PaginatedResponse.create(items=[SkillListOut.model_validate(i) for i in items], total=total, page=page, page_size=page_size)


@router.get("/{skill_id}", response_model=SkillOut)
async def get_skill(skill_id: str, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role("admin"))):
    """Get a skill with full details. Admin only."""
    return await skill_service.get_skill(db, skill_id)
```

### TanStack Query Hook (Frontend)

```typescript
// Source: Following exact pattern from hooks/use-materials.ts [VERIFIED: codebase]
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSkills, getSkill, createSkill, updateSkill } from "@/api/skills";
import type { SkillCreate, SkillUpdate } from "@/types/skill";

export function useSkills(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["skills", params],
    queryFn: () => getSkills(params),
  });
}

export function useSkill(id: string | undefined) {
  return useQuery({
    queryKey: ["skills", id],
    queryFn: () => getSkill(id!),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SkillCreate) => createSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
```

## Skill Quality Evaluation System (Layer 1 + Layer 2)

### Design Rationale

AI Avatar Skill 的核心价值是确保 MR 训练的标准化和高质量。一个 Skill 从材料自动提取后，必须经过评测验证其合理性和全面性，否则低质量 Skill 会导致：
- SOP 步骤不完整 → MR 训练遗漏关键环节
- 考核内容与源材料脱节 → 评分结果不可信
- 知识点错误 → MR 学到错误信息

参考：科大讯飞 SkillHub（https://iflytek.github.io/skillhub/）的多级审核工作流 + 安全扫描思路，结合 AI Avatar 训练场景特点，设计三层评测体系（Phase 19 实现 Layer 1 + 2，Layer 3 Dry Run 模拟在 Phase 20 独立实现）。

### Layer 1: 自动结构检查（即时，Skill创建/导入后自动运行）

**触发时机：** Skill 创建、材料转换完成、ZIP 导入后立即执行
**执行方式：** 纯规则引擎，无 AI 调用，毫秒级完成

```python
# skill_validation_service.py — structure validation

@dataclass
class StructureCheckResult:
    passed: bool
    score: int  # 0-100
    issues: list[ValidationIssue]

@dataclass
class ValidationIssue:
    severity: str  # "error" | "warning" | "info"
    dimension: str  # 检查维度
    message: str
    suggestion: str

async def check_skill_structure(skill: Skill) -> StructureCheckResult:
    """Layer 1: 纯规则结构检查，无 AI 调用。"""
    issues = []

    # 1. SOP 完整性检查
    sop = skill.content  # Markdown body (Coaching Protocol)
    sop_steps = sop.get("sop_steps", [])
    if len(sop_steps) < 3:
        issues.append(ValidationIssue(
            severity="error", dimension="sop_completeness",
            message="SOP 步骤少于 3 步，培训流程不完整",
            suggestion="补充缺失的对话阶段（开场、需求挖掘、产品介绍、异议处理、收尾）"
        ))

    REQUIRED_STAGES = ["开场/Opening", "产品介绍/Product", "收尾/Closing"]
    # 检查关键阶段是否覆盖（模糊匹配标题）
    step_titles = " ".join([s.get("title", "") for s in sop_steps])
    for stage in REQUIRED_STAGES:
        keywords = stage.split("/")
        if not any(kw.lower() in step_titles.lower() for kw in keywords):
            issues.append(ValidationIssue(
                severity="warning", dimension="sop_completeness",
                message=f"缺少 '{stage}' 相关阶段",
                suggestion=f"建议添加 {stage} 环节"
            ))

    # 2. 考核项检查
    criteria = json.loads(skill.assessment_criteria)
    if len(criteria) < 2:
        issues.append(ValidationIssue(
            severity="error", dimension="assessment_coverage",
            message="考核项少于 2 项，无法多维度评估",
            suggestion="至少需要 2 个考核维度"
        ))
    total_weight = sum(c.get("weight", 0) for c in criteria)
    if criteria and abs(total_weight - 100) > 1:
        issues.append(ValidationIssue(
            severity="error", dimension="assessment_coverage",
            message=f"考核权重总和为 {total_weight}，应为 100",
            suggestion="调整各考核项权重使总和为 100"
        ))

    # 3. 知识点检查
    knowledge = json.loads(skill.key_knowledge_points)
    if len(knowledge) < 1:
        issues.append(ValidationIssue(
            severity="warning", dimension="knowledge_accuracy",
            message="无关键知识点，MR 无法获得产品知识培训",
            suggestion="补充产品、机制、临床数据等知识点"
        ))

    # 4. 必填字段检查
    if not skill.name or len(skill.name.strip()) < 2:
        issues.append(ValidationIssue(
            severity="error", dimension="basic_info",
            message="Skill 名称为空或过短", suggestion="填写有意义的 Skill 名称"
        ))
    if not skill.description or len(skill.description.strip()) < 10:
        issues.append(ValidationIssue(
            severity="warning", dimension="basic_info",
            message="Skill 描述过短", suggestion="补充详细描述，便于 Skill Hub 展示"
        ))

    error_count = sum(1 for i in issues if i.severity == "error")
    passed = error_count == 0
    score = max(0, 100 - error_count * 25 - sum(1 for i in issues if i.severity == "warning") * 10)

    return StructureCheckResult(passed=passed, score=score, issues=issues)
```

**检查维度汇总：**

| 维度 | 检查项 | 严重级别 |
|------|--------|---------|
| SOP完整性 | 步骤数 >= 3 | error |
| SOP完整性 | 覆盖关键阶段（开场/产品介绍/收尾） | warning |
| 考核覆盖度 | 考核项 >= 2 | error |
| 考核覆盖度 | 权重总和 = 100 | error |
| 知识准确性 | 知识点 >= 1 | warning |
| 基本信息 | 名称非空 >= 2 字符 | error |
| 基本信息 | 描述 >= 10 字符 | warning |

### Layer 2: AI 质量评估（异步，Admin 手动触发或发布前自动执行）

**触发时机：** Admin 点击"评估质量"按钮 / Skill 发布前自动执行
**执行方式：** Azure OpenAI 调用，耗时 10-30 秒，异步处理

```python
# skill_evaluation_service.py — AI quality assessment

SKILL_EVALUATION_PROMPT = """你是一位资深医药培训设计专家。请对以下 AI Avatar 培训 Skill 进行全面质量评估。

## Skill 信息
名称：{skill_name}
描述：{skill_description}
产品领域：{product}

## SOP 内容
{sop_content}

## 考核标准
{assessment_criteria}

## 关键知识点
{key_knowledge_points}

## 源培训材料摘要（如有）
{source_material_summary}

## 评估要求
请从以下 6 个维度对该 Skill 进行评分（每项 0-100 分）并给出详细改进建议：

1. **SOP完整性** (sop_completeness)：是否覆盖完整的 MR-HCP 对话流程？是否有遗漏的关键阶段？
2. **考核覆盖度** (assessment_coverage)：考核项是否全面覆盖了 SOP 中的关键技能点？考核权重分配是否合理？
3. **知识准确性** (knowledge_accuracy)：知识点是否与源材料一致？是否有错误或过时信息？（无源材料时评估内容的专业性）
4. **难度合理性** (difficulty_calibration)：SOP 复杂度是否适合目标学员？HCP 互动难度是否循序渐进？
5. **对话逻辑性** (conversation_logic)：SOP 步骤之间是否逻辑连贯？是否有矛盾或死循环路径？
6. **可执行性** (executability)：HCP Agent 能否根据此 SOP 驱动有效的模拟对话？指令是否足够具体？

返回 JSON 格式：
{{
  "overall_score": 85,
  "overall_verdict": "PASS",  // PASS (>=70) / NEEDS_REVIEW (50-69) / FAIL (<50)
  "dimensions": [
    {{
      "name": "sop_completeness",
      "score": 90,
      "verdict": "PASS",
      "strengths": ["覆盖了完整的 F2F 拜访流程"],
      "improvements": ["建议增加异议处理的具体示例"],
      "critical_issues": []
    }}
  ],
  "summary": "该 Skill 整体质量良好...",
  "top_3_improvements": ["...", "...", "..."]
}}"""

@dataclass
class SkillEvaluationResult:
    overall_score: int  # 0-100
    overall_verdict: str  # PASS / NEEDS_REVIEW / FAIL
    dimensions: list[DimensionScore]
    summary: str
    top_improvements: list[str]

async def evaluate_skill_quality(
    db: AsyncSession,
    skill_id: str,
    include_source_materials: bool = True,
) -> SkillEvaluationResult:
    """Layer 2: AI 驱动的多维度质量评估。"""
    skill = await get_skill(db, skill_id)

    # 获取源材料摘要（如果有关联材料）
    source_summary = ""
    if include_source_materials and skill.materials:
        source_summary = await _get_material_summary(db, skill.materials)

    prompt = SKILL_EVALUATION_PROMPT.format(
        skill_name=skill.name,
        skill_description=skill.description,
        product=skill.product,
        sop_content=skill.sop_content,
        assessment_criteria=skill.assessment_criteria,
        key_knowledge_points=skill.key_knowledge_points,
        source_material_summary=source_summary or "无源材料",
    )

    # 使用 Azure OpenAI JSON mode
    result = await call_azure_openai(prompt, response_format={"type": "json_object"})
    return SkillEvaluationResult(**result)
```

**评估维度详解：**

| 维度 | 评估内容 | 评分标准 | AI 评估方式 |
|------|---------|---------|------------|
| SOP完整性 | 对话阶段覆盖度、步骤粒度 | 90+: 覆盖全部阶段 / 70-89: 缺少次要阶段 / <70: 缺少核心阶段 | 对比标准 F2F 拜访流程模板 |
| 考核覆盖度 | 考核项 vs SOP关键技能点映射 | 90+: 每个 SOP 步骤都有考核 / 70-89: 80%覆盖 / <70: 大量遗漏 | 交叉比对 SOP steps 和 criteria |
| 知识准确性 | 知识点与源材料的一致性 | 90+: 完全一致 / 70-89: 小偏差 / <70: 有错误 | 与源材料摘要交叉验证 |
| 难度合理性 | 复杂度 vs 目标学员水平 | 90+: 难度适中 / 70-89: 略偏难/易 / <70: 明显不匹配 | 评估对话复杂度和专业术语密度 |
| 对话逻辑性 | 步骤间逻辑连贯性 | 90+: 逻辑自洽 / 70-89: 小逻辑跳跃 / <70: 矛盾或断裂 | 模拟对话路径分析 |
| 可执行性 | Agent 能否基于SOP交互 | 90+: 指令明确具体 / 70-89: 部分模糊 / <70: 无法执行 | 评估指令的具体性和可操作性 |

### Evaluation Data Model Extension

Evaluation fields are already included in the Skill model (Pattern 1 above):
- `structure_check_passed`, `structure_check_score` — Layer 1 results
- `quality_score`, `quality_verdict` — Layer 2 results
- Additional L2 detail (dimensions, summary) stored as JSON in `metadata_json` or a dedicated `quality_details` Text field (Claude's Discretion)

### Frontend Integration

```
Skill 编辑器页面布局：
┌─────────────────────────────────────────────────────┐
│ Skill 基本信息 (名称/描述/产品/标签)                    │
├─────────────────────────────────────────────────────┤
│ 材料上传区 → 转换按钮 → SOP 编辑器                      │
├──────────────────────┬──────────────────────────────┤
│ Layer 1 结构检查卡片   │ Layer 2 AI 质量评分卡片        │
│ ✅ PASS / ❌ FAIL     │ 85 分 - PASS                  │
│ • 3 issues found      │ 雷达图 (6维度)                 │
│ [查看详情]             │ [重新评估] [查看详情]           │
├──────────────────────┴──────────────────────────────┤
│ 发布按钮（Layer 1 必须 PASS，Layer 2 推荐 >= 70 分）    │
└─────────────────────────────────────────────────────┘
```

**发布门控规则：**
- Layer 1 结构检查 FAIL → **阻止发布**（硬门控）
- Layer 2 AI 评分 < 50 → **阻止发布**（硬门控）
- Layer 2 AI 评分 50-69 → **警告确认**（弹窗提示改进建议，Admin 可强制发布）
- Layer 2 AI 评分 >= 70 → **允许发布**

### API Routes for Evaluation

```python
# skills.py router extension
@router.post("/{skill_id}/check-structure", response_model=StructureCheckOut)
async def check_skill_structure(skill_id: str, ...):
    """Layer 1: Instant structure validation."""

@router.post("/{skill_id}/evaluate-quality", response_model=QualityEvaluationOut)
async def evaluate_skill_quality(skill_id: str, ...):
    """Layer 2: AI quality assessment (async, takes 10-30s)."""

@router.get("/{skill_id}/evaluation", response_model=SkillEvaluationSummaryOut)
async def get_skill_evaluation(skill_id: str, ...):
    """Get latest evaluation results (Layer 1 + Layer 2)."""
```

### Pattern 5: Skill Preview & Client Feedback Workflow

**What:** Admin 创建 Skill 后，可生成预览链接分享给客户（BeiGene 培训负责人等），客户查看 Skill 内容并提供反馈意见，Admin 根据反馈调整 Skill 后再发布。
**When to use:** Skill 从 draft 到 published 之间的客户审核环节。
**Why:** Skill 最终服务于 MR 培训，客户（培训负责人）对 SOP 内容、考核标准的合理性有最终话语权。

```
Skill 生命周期（含客户反馈）:

draft → [Layer 1 结构检查] → [Layer 2 AI 评估] → review
  ↓
review → [生成预览链接] → [客户查看] → [客户反馈]
  ↓                                        ↓
  ↓                                   feedback (存储)
  ↓                                        ↓
  ← ← ← ← ← ← [Admin 调整] ← ← ← ← ← ←
  ↓
review → published → archived
```

**数据模型扩展：**

```python
class SkillFeedback(Base, TimestampMixin):
    """客户对 Skill 的反馈意见。"""
    __tablename__ = "skill_feedbacks"

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), nullable=False, index=True)
    reviewer_name: Mapped[str] = mapped_column(String(255), nullable=False)  # 反馈人姓名
    reviewer_role: Mapped[str] = mapped_column(String(100), default="")  # 角色（培训经理/医学部等）
    dimension: Mapped[str] = mapped_column(String(50), default="general")  # 反馈维度
    content: Mapped[str] = mapped_column(Text, nullable=False)  # 反馈内容
    status: Mapped[str] = mapped_column(String(20), default="open")  # open/addressed/dismissed

    skill = relationship("Skill", back_populates="feedbacks")
```

**Skill 状态扩展：** `draft → review → published → archived`
- `review`: 新增状态，表示 Skill 已通过评测，正在等待客户审核

**预览链接机制：**
- 生成带 token 的只读预览 URL：`/preview/skills/{skill_id}?token={preview_token}`
- Token 有时效（默认 7 天），不需要登录即可查看
- 预览页面显示：Skill 概览 + SOP 步骤 + 考核标准 + 知识点 + 质量评分
- 页面底部有反馈表单（姓名 + 维度选择 + 内容文本框）

**API Routes:**

```python
@router.post("/{skill_id}/preview-link", response_model=PreviewLinkOut)
async def generate_preview_link(skill_id: str, expires_days: int = 7, ...):
    """生成 Skill 预览链接（Admin only）。"""

@router.get("/preview/{skill_id}", response_model=SkillPreviewOut)
async def get_skill_preview(skill_id: str, token: str = Query(...), ...):
    """公开预览页面（无需登录，token 验证）。"""

@router.post("/preview/{skill_id}/feedback", response_model=FeedbackOut)
async def submit_preview_feedback(skill_id: str, token: str, data: FeedbackCreate, ...):
    """提交预览反馈（无需登录，token 验证）。"""

@router.get("/{skill_id}/feedbacks", response_model=list[FeedbackOut])
async def list_skill_feedbacks(skill_id: str, ...):
    """查看 Skill 的所有反馈（Admin only）。"""
```

### Reference: Community Patterns

- **科大讯飞 SkillHub** (https://iflytek.github.io/skillhub/): 多级审核工作流 + Skill Scanner 安全分析 + 评分/星标系统。我们借鉴其"发布前自动检查"和"质量分数可见"的设计，但评测维度针对 AI Avatar 训练场景定制。
- **skills-hub** (https://github.com/qufei1993/skills-hub): Tauri+React 桌面应用，专注 Skill 管理和跨工具同步，无评测框架。其 Skill 存储和版本管理模式可参考。
- **ClawHub** (https://clawhub.ai/skills): AI Agent Skill 的版本化注册中心（类 npm 模式）。借鉴其设计：
  - **版本管理**：类 semver 版本控制 + 回滚能力 → 我们的 SkillVersion 表
  - **质量分层**：Staff Picks + Popular（下载量排序）+ 安全扫描 → 我们的 Layer 1/2 评测 + 发布门控
  - **搜索发现**：向量搜索 + 标签筛选 → 我们的 Skill Hub 搜索 + tags 字段
  - **Skill Hub 展示**：卡片式列表 + 下载量/评分指标 → 我们的 Skill Hub 页面设计参考

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unstructured training materials only (Phase 5) | Structured Skills with SOP extraction | Phase 19 | Enables SOP-driven training instead of free-form conversations |
| HCP Agent instructions = personality only | Agent instructions = personality + skill SOP | Phase 19 | Agent follows structured training protocol |
| Manual scoring criteria per scenario | Skill-level assessment criteria auto-extracted | Phase 19 | Assessment criteria derived from training materials |
| Azure OpenAI without json_object response format | `response_format={"type": "json_object"}` | GPT-4o launch | Guaranteed valid JSON from extraction prompts [ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Azure OpenAI supports `response_format={"type": "json_object"}` for SOP extraction | Code Examples | Would need manual JSON parsing with error handling; moderate risk |
| A2 | GPT-4o 128K context window is sufficient for combined training materials | Common Pitfalls | Would need chunked extraction strategy; low risk (truncation fallback exists) |
| A3 | python-pptx 1.0.2 supports all modern .pptx files | Standard Stack | Very low risk; widely tested library |
| A4 | jszip 3.10.1 works with modern React 18 + Vite 6 | Standard Stack | Very low risk; pure JS library with no framework dependencies |
| A5 | Existing `StorageBackend` Protocol is sufficient for skill package storage | Architecture Patterns | Low risk; same file I/O pattern as materials |

## Open Questions (Resolved by CONTEXT.md)

1. **SOP Content Schema Granularity** — RESOLVED (D-02, D-03): Coaching Protocol in Markdown body with structured steps (title, description, key_points, objections, assessment_criteria, knowledge_points, suggested_duration). Split DB storage: frontmatter→fields, body→content Text.

2. **Skill Assignment Cardinality** — RESOLVED (D-21): One-to-one Skill↔Scenario association via `scenario.skill_id` FK. No SkillAssignment table. Expandable to many-to-many later.

3. **Skill Version vs Material Version** — RESOLVED (D-19): Version management follows MaterialVersion pattern. No automatic re-extraction. Admin manually triggers re-extract. Failed conversions support retry (D-08).

4. **How SOP Content Integrates into Training Session Scoring** — RESOLVED (D-13, D-22): SOP injected via SkillManager.compose_instructions(). L2 quality evaluation is independent from Scoring Rubrics. Scoring dimension integration deferred.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Yes | 3.11.9 | -- |
| Node.js 20+ | Frontend | Yes | 25.9.0 | -- |
| pdfplumber | PDF extraction | No | -- | Install via pip (pyproject.toml) |
| python-docx | DOCX extraction | Yes | 1.2.0 | -- |
| python-pptx | PPTX extraction | No | -- | Install via pip (pyproject.toml) |
| jszip | ZIP export/import | No | -- | Install via npm |
| Azure OpenAI | SOP extraction | Config-dependent | -- | Mock extraction returning placeholder SOP |

**Missing dependencies with no fallback:**
- None (all missing deps are installable)

**Missing dependencies with fallback:**
- python-pptx: Install step required. Fallback: skip PPTX support until installed.
- pdfplumber: Install step required. Replaces pypdf for better table support.
- jszip: Install step required. Fallback: skip client-side ZIP preview.
- Azure OpenAI: If not configured, provide mock SOP extraction with placeholder content (same pattern as mock coaching adapter).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT Bearer token via `require_role()` dependency [VERIFIED: codebase] |
| V3 Session Management | yes | Existing JWT + localStorage pattern [VERIFIED: codebase] |
| V4 Access Control | yes | Admin-only for skill CRUD; user can view published skills only |
| V5 Input Validation | yes | Pydantic v2 for all request schemas; file extension validation |
| V6 Cryptography | no | No new crypto needs |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file upload (ZIP bomb, malicious PPTX) | Tampering | File size limits (existing 50MB), extension whitelist, ZIP extraction limits |
| SOP content injection via crafted documents | Tampering | LLM extraction acts as content sanitizer; validate output JSON schema |
| Unauthorized skill assignment manipulation | Elevation | `require_role("admin")` on all assignment endpoints |
| Path traversal in ZIP import | Tampering | Validate all filenames in ZIP; reject paths with `..` or absolute paths |
| Storage of sensitive training content | Information Disclosure | Same access controls as existing materials; admin-only access |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/app/models/material.py`, `backend/app/services/material_service.py`, `backend/app/services/agent_sync_service.py`, `backend/app/services/knowledge_base_service.py`, `backend/app/services/prompt_builder.py` -- verified all patterns referenced
- `backend/pyproject.toml` -- verified all dependency versions
- `frontend/package.json` -- verified all frontend dependency versions

### Secondary (MEDIUM confidence)
- pip index: python-pptx 1.0.2 is latest version
- npm registry: jszip 3.10.1 is latest version

### Tertiary (LOW confidence)
- Azure OpenAI `response_format` JSON mode -- based on training knowledge, not verified against current API docs [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already in project, only 2 new additions
- Architecture: HIGH -- follows exact patterns from 5+ existing phases verified in codebase
- Pitfalls: HIGH -- all pitfalls derived from actual project gotchas documented in STATE.md and CLAUDE.md
- SOP extraction approach: MEDIUM -- prompt engineering quality depends on iteration

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days -- stable domain, no fast-moving dependencies)
