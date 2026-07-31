# UI Fidelity Review: Figma Make Designs vs. Actual Implementation

> **Audit Date**: 2026-03-25
> **Scope**: All 12 Figma Make design sets (00-11) vs. frontend implementation
> **Method**: Code-level comparison of Figma Make TSX source + PNG screenshots vs. actual frontend TSX
> **Overall Fidelity Score: 5.7 / 10**

---

## Executive Summary

| Page / Area | Figma Folder | Fidelity | Priority |
|-------------|-------------|----------|----------|
| Design System Tokens | 00 | **8/10** | Low |
| Login Page | 01 | **7/10** | Low |
| MR Dashboard | 02 | **6/10** | Medium |
| Scenario Selection | 03 | **5/10** | High |
| F2F HCP Training | 04 | **8/10** | Low |
| Conference Presentation | 05 | **6/10** | High |
| Scoring & Feedback | 06 | **7/10** | Medium |
| Session History | 07a | **4/10** | High |
| Personal Reports | 07b | **2/10** | Critical |
| Admin Dashboard | 08a | **5/10** | High |
| User Management | 08b | **0/10** | Critical |
| HCP Profiles | 09a | **8/10** | Low |
| Scenario Management | 09b | **7/10** | Medium |
| Azure Config | 10 | **6/10** | Medium |
| Training Materials | 11a | **5/10** | High |
| Organization Reports | 11b | **3/10** | Critical |
| Shared Components | 00 | **6/10** | Medium |
| UI Library (shadcn) | 00 | **9/10** | Low |
| Layouts | 01 | **7/10** | Low |

**Top 5 Fixes (Impact-Ordered):**
1. **User Management page** — Entire page missing (Figma 08)
2. **Personal Reports page** — Entire page missing as standalone route (Figma 07)
3. **Organization Reports** — Full analytics dashboard reduced to 2 export cards (Figma 11)
4. **Session History** — Missing filters, mode column, dimension bars, pagination (Figma 07)
5. **Conference Mode** — Slide-based presentation replaced with chat-based (Figma 05)

---

## 1. Design System Tokens (Figma 00)

**Fidelity: 8/10**

### Matches
- Primary color `#1E40AF` matches across both
- Scoring semantic tokens (`--strength`, `--weakness`, `--improvement`) match
- Destructive `#EF4444` matches
- Muted, accent, border tokens all match
- Radius scale (`--radius: 0.625rem` and derived values) matches
- Dark mode tokens match
- Base typography styles (h1-h4, label, button) match

### Mismatches

| Token | Figma Make | Actual | Impact |
|-------|-----------|--------|--------|
| `--secondary` | `#475569` (dark slate) | `oklch(0.95 0.0058 264.53)` (light lavender) | High — inverted secondary button/badge appearance |
| `--secondary-foreground` | `#ffffff` | `#030213` | High — paired with secondary |
| `--sidebar` | `oklch(0.985 0 0)` (near-white) | `#1E293B` (dark slate) | Medium — actual matches layout designs |
| `--font-sans` | Not defined | `'Inter', 'Noto Sans SC'` | Low — actual adds proper font stack |
| `--font-mono` | Not defined | `'JetBrains Mono'` | Low |

### Action Items
- [ ] **FIX**: Align `--secondary` and `--secondary-foreground` — decide if secondary should be dark (Figma Make) or light (current). The dark variant matches the Figma screenshot better for badges.
- [ ] **OK**: Sidebar dark color is correct — actual layout designs use dark sidebar.
- [ ] **OK**: Font definitions are an improvement over Figma Make.

---

## 2. Login Page (Figma 01)

**Fidelity: 7/10**

### Matches
- Centered card on gradient background (`from-blue-50 via-white to-blue-50`)
- Card max-width 480px, `rounded-2xl`, `shadow-xl`
- Form field order: Email → Password (with eye toggle) → Remember Me → Sign In
- Language switcher in top-right
- Footer copyright text

### Discrepancies

| Element | Figma Make Code | Actual Code | Fix |
|---------|----------------|-------------|-----|
| Logo icon | Lightbulb SVG path | Sun/gear SVG | Align to Figma |
| Logo background | `bg-gradient-to-br from-blue-500 to-blue-600` | `bg-primary` (solid) | Change to gradient |
| Title weight | `font-bold` | `font-semibold` | Change to bold |
| Input styling | Raw `<input>` with `border-gray-300 rounded-lg px-4 py-3` | `<Input>` component (smaller padding) | Adjust Input padding |
| Button color | `bg-blue-600 hover:bg-blue-700` | `bg-primary` (#1E40AF) | Minor — acceptable |
| Form spacing | `space-y-6` | `space-y-4` | Change to y-6 |
| Language switcher | Flag emoji + text button | Globe icon dropdown | Align to flag-based |

### Missing from Implementation
- [ ] Input placeholder text ("Enter your email", "Enter your password")
- [ ] Flag-based language switcher with country emoji

### Extra in Implementation (Keep)
- Loading state with Loader2 spinner
- Error message display
- i18n integration
- Accessibility attributes

---

## 3. MR Dashboard (Figma 02)

**Fidelity: 6/10**

### Matches
- 4-column stat card grid layout
- 3/5 + 2/5 column split for sessions + actions
- Session list items with avatar, name, mode badge, score, time
- Action cards with gradient backgrounds (blue for F2F, purple for Conference)
- Recommended Scenario section

### Discrepancies

| Element | Figma Make | Actual | Fix |
|---------|-----------|--------|-----|
| Nav items | "Dashboard, My Sessions, Analytics, Resources" | "Dashboard, Training, History, Reports" | Align naming |
| StatCard colors | Per-card color theming (green/blue/purple) | Uniform primary-tinted | Add per-card colors |
| StatCard value weight | `font-bold` | `font-semibold` | Change to bold |
| Session avatar | `<img>` with photos | `<AvatarFallback>` initials only | Add avatar URL support |
| Score display | Colored rounded box (`bg-green-50`) | Plain colored text | Add background box |
| "Start Training" title | Wrapping card with heading | Standalone cards | Add wrapper card |

### Missing from Implementation
- [ ] Search icon in top navigation
- [ ] Red notification dot on bell icon
- [ ] Per-card color theming for stat cards
- [ ] Avatar photos for session items
- [ ] Score background highlight box
- [ ] "Start Training" section title
- [ ] Progress bar label ("5 of 7 goal") in stat cards

### Extra in Implementation (Keep)
- Welcome banner with personalized greeting
- Export Excel button
- Loading/empty states
- Responsive breakpoints
- Skill Overview Radar chart

---

## 4. Scenario Selection (Figma 03)

**Fidelity: 5/10**

### Matches
- Page title and F2F/Conference tabs
- 3-column grid for scenario cards
- Filter dropdowns + search
- Card structure (header, title, description, button)

### Critical Discrepancies

| Element | Figma Screenshot/Make | Actual | Fix |
|---------|----------------------|--------|-----|
| Card design | HCP profile cards: circular doctor photo, bilingual name, hospital, personality traits | Generic scenario card with PlayCircle gradient header | **Major redesign needed** |
| Personality traits | Badges ("Skeptical", "Detail-oriented") | Not rendered | Add trait badges |
| Missing filter | "All Specialties" dropdown | Only Product + Difficulty | Add specialty filter |
| Button style | Full-width "Start Training" | Right-aligned "Start" | Change to full-width |
| Difficulty badge | Upper-right corner | Bottom-left | Move to upper-right |

### Missing from Implementation
- [ ] **HIGH**: HCP doctor photo (circular avatar at card top)
- [ ] **HIGH**: Bilingual HCP names (e.g., "Dr. Wang Wei (王伟)")
- [ ] **HIGH**: Hospital affiliation text
- [ ] **HIGH**: Personality trait badges
- [ ] **MEDIUM**: Product name on cards
- [ ] **MEDIUM**: "All Specialties" filter dropdown
- [ ] **LOW**: Full-width "Start Training" button
- [ ] **LOW**: Difficulty badge repositioning

---

## 5. F2F HCP Training (Figma 04)

**Fidelity: 8/10** — Best match

### Matches
- Three-panel layout (left 280px, center flex, right 260px)
- Collapsible sidebars with chevron toggle
- Left panel: Scenario Briefing, HCP Profile, Key Messages, Scoring Criteria
- Center: Timer bar, avatar area (bg-slate-900, 240px), chat messages, input area
- Right: AI Avatar Hints (yellow-50), Message Tracker, Session Stats
- Mic/Send circular buttons, input area border-top

### Discrepancies

| Element | Figma Make | Actual | Fix |
|---------|-----------|--------|-----|
| Input Mode toggle | Explicit Text/Audio selector | Mic button disabled, no mode toggle | Add toggle when voice ready |
| "Azure AI Avatar" label | Below avatar | Absent | Add label |
| Recording animation | Pulse on mic, red/yellow states | Permanently disabled/gray | Implement when voice ready |
| HCP Background | Separate text field | Not shown | Add Background field |

### Missing from Implementation
- [ ] Input Mode toggle (Text/Audio) — defer until voice feature is ready
- [ ] "Azure AI Avatar" badge label beneath avatar
- [ ] Recording state animation (pulse, color change)
- [ ] Floating help (?) button

---

## 6. Conference Presentation Mode (Figma 05)

**Fidelity: 6/10** — Architectural divergence

### Structural Comparison

| Aspect | Figma Make | Actual |
|--------|-----------|--------|
| Main paradigm | **Slide-based** presentation with slide navigation | **Chat-based** conversation with ConferenceStage |
| Left area | PresentationSlide (slide viewer + nav) | TopicGuide sidebar (key topics checklist) |
| Right area | AudienceQuestions + ObjectionHints | TranscriptionPanel (scrollable transcript) |
| Bottom | AudioControls bar (large mic, waveform) | AudiencePanel strip (avatar cards) |
| Questions | Right panel list | QuestionQueue overlay |

### Missing from Implementation
- [ ] **HIGH**: Slide presentation viewer with prev/next navigation and slide counter
- [ ] **HIGH**: ObjectionHints panel with expandable cards (yellow background)
- [ ] **MEDIUM**: Animated audio waveform visualization
- [ ] **MEDIUM**: Large circular mic button (64px) with mute/unmute
- [ ] **LOW**: Hand-raised indicator on audience avatars
- [ ] **LOW**: Active speaker ring indicator

### Extra in Implementation (Keep)
- TopicGuide sidebar (useful coaching addition)
- Full TranscriptionPanel with timestamped lines
- SubStateBadge for conference phase tracking
- SSE-based real-time streaming

### Decision Required
> **Product Decision**: The Figma design shows a **slide-based presentation** paradigm. The implementation uses a **chat-based conversation** paradigm. Need to decide:
> - Option A: Add slide viewer component alongside existing chat-based interaction
> - Option B: Accept chat-based as the production approach and update Figma

---

## 7a. Session History (Figma 07)

**Fidelity: 4/10**

### Discrepancies

| Element | Figma Make | Actual | Fix |
|---------|-----------|--------|-----|
| Tabs | "Training History" / "Performance Report" tabs | Single combined page | Add tab navigation |
| Filter bar | Date Range, Mode, Product, Score Range slider | None | Add filter bar |
| Table: Mode column | Badge (F2F/Conference) | Missing | Add column |
| Table: Scenario | Avatar + HCP name + specialty | Name only | Add avatar + detail |
| Table: Dimensions | 5 mini vertical bar charts | Thin horizontal bars | Redesign to mini bars |
| Table: Actions | View + Replay buttons | View Details only | Add Replay |
| Pagination | Page number buttons | None | Add pagination |

### Missing from Implementation
- [ ] **HIGH**: Filter bar (Date Range, Mode, Product, Score Range slider)
- [ ] **HIGH**: Mode column with colored badges
- [ ] **HIGH**: Pagination controls
- [ ] **MEDIUM**: HCP avatar and specialty in scenario column
- [ ] **MEDIUM**: Dimension mini bar charts
- [ ] **LOW**: Replay action button
- [ ] **LOW**: Search input

---

## 7b. Personal Reports (Figma 07)

**Fidelity: 2/10** — Page missing

### Status
**The "My Performance Report" page does not exist as a standalone route.** The Figma design shows:
- Time period tabs (Week/Month/Quarter/Year)
- 2x2 chart grid: Score Trend, Dimension Radar, Training Frequency bar, Focus Areas card
- Export PDF Report + Export Excel Data buttons

### Missing from Implementation
- [ ] **CRITICAL**: Create standalone Personal Reports page at `/user/reports`
- [ ] **CRITICAL**: Time period filter tabs
- [ ] **CRITICAL**: Training Frequency bar chart
- [ ] **CRITICAL**: Focus Areas card (Top Strength / Needs Work)
- [ ] **HIGH**: Export PDF Report button
- [ ] **HIGH**: Export Excel Data button

---

## 8a. Admin Dashboard (Figma 08)

**Fidelity: 5/10**

### Discrepancies

| Element | Figma Make | Actual | Fix |
|---------|-----------|--------|-----|
| Stat cards | "Total MRs (156), Avg Score (74), Active Now (12), Completion Rate (82%)" | "Total Users, Active Users, Total Sessions, Avg Org Score" | Align metrics |
| Main chart | Score Distribution bar (color-coded by range) | BU Comparison bar | Add score distribution |
| Performance Alerts | Top Performers + Needs Attention lists | Missing | Add alerts panel |
| Training Heatmap | GitHub-style activity heatmap with BU/Region filters | Missing | Add heatmap |
| Active Now pulse | Animated green pulse indicator | Static number | Add animation |

### Missing from Implementation
- [ ] **HIGH**: Score Distribution chart (color-coded by range)
- [ ] **HIGH**: Performance Alerts panel (Top Performers + Needs Attention)
- [ ] **MEDIUM**: Training Activity Heatmap with BU/Region filters
- [ ] **LOW**: Animated "Active Now" pulse indicator

---

## 8b. User Management (Figma 08)

**Fidelity: 0/10** — Page missing

### Status
**The User Management page does not exist.** No route, no page component, no implementation.

The Figma design shows:
- Search bar + Role/BU/Status filter dropdowns
- Data table with: Checkbox, Avatar, Name, Email, Role badge, Business Unit, Region, Last Active, Status dot, Actions (Edit/Delete)
- Pagination with numbered pages
- Import CSV button + Add User button

### Missing from Implementation
- [ ] **CRITICAL**: Create User Management page at `/admin/users`
- [ ] **CRITICAL**: User data table with all columns
- [ ] **CRITICAL**: User CRUD operations (Add, Edit, Delete)
- [ ] **HIGH**: Role-based color badges (MR/DM/Admin)
- [ ] **HIGH**: Search + filter dropdowns
- [ ] **MEDIUM**: Import CSV functionality
- [ ] **MEDIUM**: Pagination

---

## 9a. HCP Profiles (Figma 09)

**Fidelity: 8/10** — Close match

### Matches
- Master-detail layout: Left HCP list + Right editor
- Search bar + "Create New HCP" button
- Editor: Avatar, name, specialty, hospital, title fields
- Personality Settings: Type dropdown, Emotional State slider, Communication Style slider
- Knowledge Background: Expertise, Prescribing Habits, Concerns
- Interaction Rules: Objection list, Probe topics
- Difficulty radio buttons
- Save / Test Chat / Discard buttons

### Minor Discrepancies
- [ ] Avatar upload hover overlay missing (static initials only)
- [ ] Expertise tags: Figma uses blue pill chips with "x" buttons; actual uses comma-separated text input

---

## 9b. Scenario Management (Figma 09)

**Fidelity: 7/10**

### Matches
- Table with: Name, Product, HCP, Mode badge, Difficulty, Status, Actions
- Status badges (Active green, Draft gray)
- Clone/Edit/Delete dropdown actions

### Key Discrepancy
- **Figma**: Inline expandable row editor with scoring weights, key messages, pass threshold visible inline
- **Actual**: Dialog modal for editing

### Missing from Implementation
- [ ] **MEDIUM**: Inline expandable row editor (instead of modal)
- [ ] **LOW**: Key messages checklist visible inline
- [ ] **LOW**: Scoring weights visible inline with percentage total

---

## 10. Azure Service Configuration (Figma 10)

**Fidelity: 6/10**

### Matches
- Accordion/expandable card per service
- Status indicator dots (green/gray)
- Endpoint URL + API Key fields
- Test Connection button

### Discrepancies

| Element | Figma Make | Actual | Fix |
|---------|-----------|--------|-----|
| Service count | 6 (+ Realtime, + Database) | 5 (splits Speech into STT/TTS) | Add Realtime + DB |
| Field richness | Deployment Name, Model dropdown, Temperature slider | Generic 2x2 grid | Add service-specific fields |
| Eye toggle | Masked input with toggle | Plain password input | Add eye toggle |
| "Test All" button | In page header | Missing | Add button |
| System Settings | Separate sub-page (Language, Retention, Branding) | Missing | Add page |

### Missing from Implementation
- [ ] **HIGH**: Azure OpenAI Realtime service card
- [ ] **HIGH**: System Settings sub-page (Language, Data Retention, Branding)
- [ ] **MEDIUM**: Service-specific fields (Deployment Name, Temperature, etc.)
- [ ] **MEDIUM**: Masked input with eye toggle
- [ ] **LOW**: "Test All Connections" button
- [ ] **LOW**: Database service card

---

## 11a. Training Materials (Figma 11)

**Fidelity: 5/10**

### Discrepancies

| Element | Figma Make | Actual | Fix |
|---------|-----------|--------|-----|
| Layout | Left folder tree + Right file list | Flat table with filters | Add folder tree panel |
| Table columns | Name, Type badge, Size, Date, Uploaded By, Version, Actions | Name, Product, Area, Version, Status, Date, Actions | Align columns |
| File type badges | Colored (red PDF, blue Word, green Excel) | None | Add badges |
| Version history | Inline expandable rows | Dialog modal | Consider inline |
| Retention banner | Blue info bar at bottom | Missing | Add banner |
| Drag-and-drop | Visible on main page | Inside upload dialog only | Move to main page |

### Missing from Implementation
- [ ] **HIGH**: Folder tree navigation panel (By Product / By Therapeutic Area)
- [ ] **HIGH**: File type colored badges
- [ ] **MEDIUM**: File size column
- [ ] **MEDIUM**: "Uploaded By" column
- [ ] **LOW**: Retention policy info banner
- [ ] **LOW**: Download button per file

---

## 11b. Organization Reports (Figma 11)

**Fidelity: 3/10** — Major gap

### Status
Figma shows a full analytics dashboard. Implementation is just 2 export buttons.

### Figma Design Includes
- Filter bar: BU, Region, Product dropdowns + date range picker
- 2x2 chart grid: Group Performance bar, Score Trends line, Completion Rates bar, Skill Gap Analysis table
- Export PDF + Excel buttons

### Missing from Implementation
- [ ] **CRITICAL**: Filter bar (Business Unit, Region, Product, Date Range)
- [ ] **CRITICAL**: Group Performance chart (color-coded by BU)
- [ ] **CRITICAL**: Score Trends line chart with benchmark line
- [ ] **CRITICAL**: Completion Rates by Region chart
- [ ] **HIGH**: Skill Gap Analysis table with color-coded cells
- [ ] **HIGH**: 2x2 chart grid layout

---

## Shared Components (Figma 00)

**Fidelity: 6/10**

### Component-Level Differences

| Component | Figma Make | Actual | Gap |
|-----------|-----------|--------|-----|
| **HCPProfileCard** | Horizontal layout (avatar left) | Vertical/centered layout | Major structural change |
| **ChatBubble** | `bg-primary/10` wash for HCP | `bg-primary` solid fill for HCP | Color treatment differs |
| **ChatInput** | Single-line `<Input>` | Multi-line `<Textarea>` | Different element |
| **StatusBadge** | Pill with colored background | Dot indicator + text | Different visual approach |
| **LanguageSwitcher** | Flag emoji + text button | Globe icon dropdown | Different visual |
| **DimensionBar** | Configurable `color` prop | Always `bg-primary` | Reduced flexibility |
| **LoadingState** | 3 variants (card/table/list) | Single spinner only | Reduced variants |
| **EmptyState** | Configurable icon prop | Hardcoded Inbox icon | Less flexible |

### Action Items
- [ ] **MEDIUM**: Restore configurable color prop on DimensionBar
- [ ] **MEDIUM**: Add LoadingState variants (card skeleton, table skeleton)
- [ ] **LOW**: Align ChatBubble colors to Figma wash style
- [ ] **LOW**: Consider flag-based LanguageSwitcher

---

## Layout Components (Figma 01)

**Fidelity: 7/10**

### AdminLayout
| Element | Figma Make | Actual | Status |
|---------|-----------|--------|--------|
| Sidebar dark color | `bg-[#1E293B]` | `bg-sidebar` → `#1E293B` | Match |
| Nav items | 8 items | 9 items (adds Scoring Rubrics) | OK — feature addition |
| Active state | `bg-blue-600` hardcoded | `bg-sidebar-primary` token | Actual is better |
| Logo | SVG lightbulb | "AI" text badge | Align to Figma |
| Breadcrumb | Dynamic from URL | Missing | Add breadcrumb |
| Mobile sidebar | Raw overlay | `<Sheet>` component | Actual is better |

### UserLayout
| Element | Figma Make | Actual | Status |
|---------|-----------|--------|--------|
| Header | `fixed top-0` | `sticky top-0` | Actual is better |
| Nav items | Dashboard, Training, History, Reports | Same | Match |
| Logo | SVG lightbulb | "AI" text badge | Align to Figma |

### Missing
- [ ] **MEDIUM**: Breadcrumb navigation in admin layout
- [ ] **LOW**: Logo icon alignment (lightbulb SVG vs text badge)

---

## Router Issues Found

| Issue | Severity |
|-------|----------|
| ConferenceSession page exists but has **no route** in router | High |
| ScoringFeedback route uses `:sessionId` path param but page reads `?id=` query param | Medium |
| `/admin/users` sidebar link has **no route or page** | Critical |
| `/admin/settings` sidebar link has **no route or page** | Medium |

---

## Priority Fix Matrix

### Critical (Score 0-2, missing pages)
1. **User Management page** — Create `/admin/users` with full CRUD table
2. **Personal Reports page** — Create `/user/reports` with charts + exports
3. **Organization Reports** — Replace export-only cards with full analytics dashboard

### High (Score 3-5, significant gaps)
4. **Session History** — Add filter bar, mode column, pagination, dimension bars
5. **Scenario Selection cards** — Redesign to HCP profile cards (photo, traits, bilingual names)
6. **Admin Dashboard** — Add score distribution, performance alerts, activity heatmap
7. **Training Materials** — Add folder tree panel, file type badges
8. **Conference Mode** — Product decision: add slide viewer or accept chat-based
9. **ConferenceSession route** — Wire `/user/conference/:id` route in router

### Medium (Score 6-7, polish items)
10. **MR Dashboard** — Per-card colors, avatar photos, score highlight box
11. **Scoring & Feedback** — Add circular progress ring, session metadata, radar legend
12. **Azure Config** — Add service-specific fields, System Settings page
13. **Scenario Management** — Consider inline editor vs modal
14. **Design tokens** — Align `--secondary` color decision
15. **Shared components** — Restore DimensionBar color prop, LoadingState variants

### Low (Score 8+, minor polish)
16. **Login** — Placeholder text, logo icon, form spacing
17. **F2F Training** — Azure AI Avatar label, voice mode toggle (when ready)
18. **HCP Profiles** — Avatar upload, expertise tag chips
19. **Layouts** — Logo alignment, breadcrumb

---

## UI REVIEW COMPLETE
