# Phase 2: F2F Text Coaching and Scoring - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

An MR can select a scenario, have a text-based F2F conversation with an AI HCP that behaves according to its profile, and receive a multi-dimensional scored feedback report after the session. Admin can create and manage HCP profiles and training scenarios. Voice, avatar, and conference mode are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Coaching Conversation Flow
- **D-01:** AI HCP responds with streaming word-by-word via SSE/WebSocket — extends existing CoachEvent streaming pattern from `BaseCoachingAdapter`
- **D-02:** Coaching hints use hybrid approach — static scenario hints loaded at session start + contextual hints triggered at key conversation moments (e.g., when MR misses an objection handling opportunity). Separate AI call for milestone triggers.
- **D-03:** Key message tracking via AI auto-detection — after each MR message, AI evaluates whether any key messages were delivered, checklist updates automatically in real-time

### Scoring & Feedback
- **D-04:** Scoring is post-session only — single AI analysis of full transcript after "End Session". No real-time score preview during conversation.
- **D-05:** Full feedback report per Figma spec (06-scoring-feedback.md) — radar chart comparing current vs previous session, dimension score bars (green>80, orange 60-80, red<60), detailed strengths/weaknesses with conversation quotes, actionable suggestions per dimension
- **D-06:** Session end via manual button + HCP-initiated — MR can click "End Session" anytime, AI HCP may also initiate end ("I need to go to my next patient") after key messages are covered or based on session duration. Most realistic simulation.

### Admin HCP/Scenario Management
- **D-07:** HCP profile editor uses full form layout per Figma spec (09-admin-hcp-scenarios.md) — left sidebar HCP list + right editor panel with identity fields, personality sliders (type, emotional state, communication style), knowledge background, and interaction rules (objections, probe topics, difficulty)
- **D-08:** Scoring weights use linked sliders totaling 100% — when one slider increases, others decrease proportionally. 5 dimensions: Key Message Delivery, Objection Handling, Communication Skills, Product Knowledge, Scientific Information
- **D-09:** Quick "Test Chat" feature for HCP profiles — admin can open a mini-chat dialog to test HCP personality before assigning to scenarios. Uses same coaching engine.

### AI HCP Personality System
- **D-10:** Strict character adherence — AI strictly stays in character per HCP profile. Personality type, objections, knowledge, and communication style are all enforced in the system prompt. A skeptical HCP always pushes back; a friendly one is more receptive.
- **D-11:** Full session context for conversation memory — entire conversation history sent with each turn. AI can reference earlier statements, track what was discussed, and maintain coherent dialogue.
- **D-12:** Realistic mock provider with templates — pre-scripted responses based on scenario context with personality-appropriate variations and some randomization. Should feel somewhat real even without Azure OpenAI.

### Planning & Parallelization
- **D-13:** Plans should maximize parallelization — backend models/API, admin UI, coaching UI, and scoring engine can be developed as parallel workstreams where there are no functional conflicts.

### Claude's Discretion
- System prompt engineering for HCP character fidelity (exact prompt structure, token budgets)
- SSE vs WebSocket choice for streaming (SSE recommended for text-only, simpler)
- Database schema details for HCP profiles, scenarios, sessions, messages, scores
- Scenario editor modal vs inline expand (Figma spec shows both options)
- Azure service config UI layout (PLAT-03 — admin configures Azure connections)
- Session timer implementation details
- Responsive adaptations of 3-column F2F coaching layout for tablet/mobile

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Figma Design Specs
- `docs/figma-prompts/03-scenario-selection.md` — Scenario card grid layout, filters, HCP info display, difficulty badges
- `docs/figma-prompts/04-f2f-coaching.md` — 3-column coaching layout: left (scenario/HCP/key messages), center (chat area), right (hints/tracker). This is the most important page.
- `docs/figma-prompts/06-scoring-feedback.md` — Post-session scoring: radar chart, dimension bars, strengths/weaknesses with quotes, action bar
- `docs/figma-prompts/09-admin-hcp-scenarios.md` — HCP profile editor form + scenario management table/editor

### Requirements
- `docs/requirements.md` — Requirements HCP-01 through HCP-05, COACH-01 through COACH-03, COACH-08, COACH-09, SCORE-01 through SCORE-05, UI-03, UI-05, PLAT-03

### Existing Code Patterns
- `backend/app/services/agents/base.py` — BaseCoachingAdapter ABC, CoachRequest, CoachEvent, CoachEventType (extend for F2F coaching)
- `backend/app/services/agents/registry.py` — ServiceRegistry singleton (register coaching adapter)
- `backend/app/services/agents/adapters/mock.py` — MockCoachingAdapter (extend with realistic HCP templates)
- `backend/app/models/base.py` — Base + TimestampMixin (use for all new models)
- `backend/app/api/auth.py` — Auth router pattern (follow for new API routers)

### Reference Material
- `docs/capgemini-ai-coach-solution.md` — Reference solution architecture (Capgemini AI Avatar for AWS, adapted to Azure)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 17 shadcn/ui components in `frontend/src/components/ui/`: Button, Card, Dialog, Form, Input, Select, Badge, Checkbox, Switch, Skeleton, Tooltip, DropdownMenu, Sheet, Label, Separator, Avatar, Sonner — covers most UI needs for admin forms and coaching page
- `cn()` utility in `frontend/src/lib/utils.ts`: Conditional class composition for all new components
- `BaseCoachingAdapter` + `CoachEvent` streaming pattern: Foundation for HCP conversation engine
- `ServiceRegistry`: Register new coaching and scoring adapters
- `MockCoachingAdapter`: Extend with realistic template-based responses
- Auth hooks (`use-auth.ts`) and config hooks (`use-config.ts`): Reuse for session management
- User model + auth API: Role-based access already works for admin vs user routes

### Established Patterns
- Async backend: All new services/routes must be async
- TanStack Query: New hooks for HCP profiles, scenarios, sessions, scoring
- Tailwind v4 with `@theme inline` design tokens: Consistent styling
- i18n with react-i18next: All new UI text must use translation keys
- Pydantic v2 schemas with `ConfigDict(from_attributes=True)`
- FastAPI dependency injection: `Depends(get_db)`, `Depends(get_current_user)`

### Integration Points
- `backend/app/main.py`: Register new routers (hcp_profiles, scenarios, sessions, scoring, config)
- `backend/alembic/`: New migration for HCP, Scenario, Session, Message, Score models
- `frontend/src/pages/`: New pages — ScenarioSelection, F2FCoaching, ScoringFeedback, Admin HCP, Admin Scenarios, Admin Azure Config
- `frontend/src/hooks/`: New TanStack Query hooks per domain
- `frontend/src/components/coach/`: Empty — build coaching-specific components here
- `frontend/src/router/`: Add new routes with auth guards

</code_context>

<specifics>
## Specific Ideas

- User wants maximum parallelization in planning — "没有功能冲突点的话，我希望加快速度并行起来" (parallelize where no functional conflicts)
- Prototype demo needed this week (week of 2026-03-24) — prioritize visible features
- Figma prompts are the design source of truth for each page layout
- MockCoachingAdapter should feel realistic enough for demo — not obviously a placeholder
- HCP personality must be strictly enforced — "skeptical" means always pushes back, not just sometimes

</specifics>

<deferred>
## Deferred Ideas

- Voice interaction (STT/TTS) — Phase 3
- AI Avatar visual for HCP — Phase 3
- Conference presentation mode — Phase 3
- PDF export for scoring reports — Phase 3+ (PLAT-03 covers Azure config UI only)
- Training material upload and RAG grounding — Phase 3 (CONTENT-01 through CONTENT-03)

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-f2f-text-coaching-and-scoring*
*Context gathered: 2026-03-24*
