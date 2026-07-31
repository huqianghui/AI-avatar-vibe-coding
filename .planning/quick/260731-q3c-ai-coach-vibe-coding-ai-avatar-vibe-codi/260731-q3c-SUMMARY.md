# Quick Task 260731-q3c: 统一项目名称 AI-Coach-vibe-coding → AI-avatar-vibe-coding - Summary

**Completed:** 2026-07-31
**Tasks:** 3/3
**Commits:**
- `9b00945` — chore(quick-260731-q3c): rename repo-name token and .planning product name from AI-Coach-vibe-coding to AI-avatar-vibe-coding (373 files)
- `4d43b25` — feat(quick-260731-q3c): rewrite product positioning to AI Avatar Platform and rename ai-coach-* identifiers to ai-avatar-* (15 files)

## What Was Done

### Task 1: Mechanical bulk rename (373 files)
- Repo-wide replace `AI-Coach-vibe-coding` → `AI-avatar-vibe-coding`, including all hardcoded absolute paths in `.claude/` GSD tooling (commands, agents, workflows, references, templates, settings.local.json)
- Full replace across `.planning/**` historical artifacts per user decision (PLAN/SUMMARY/PROJECT/ROADMAP/STATE/codebase docs)
- Also updated: `.continue-here.md`, `wiki/Dev-Onboarding.md`, `infra/azure/**`, `backend/pyproject.toml`, `frontend/package.json` + `package-lock.json`, `.nyc_output` references

### Task 2: Product positioning rewrite + identifier rename (15 files)
- CLAUDE.md: retitled "AI Avatar Platform Engineering Handbook"; project section rewritten to new avatar product positioning (anonymous website-knowledge Q&A via Foundry IQ, personalized CRM-based avatar for logged-in users, Spanish i18n, clean avatar+document-links UI); "AI Coach Domain Rules" → "AI Avatar Domain Rules" (avatar session lifecycle, anonymous/personalized modes)
- README.md: retitled and positioning rewritten
- .planning/PROJECT.md: positioning updated
- frontend/index.html: page title → AI Avatar Platform
- `ai-coach-*` identifiers → `ai-avatar-*` (theme-store localStorage key + test, backend config/proxy/prompt-optimizer client identifiers, infra bicep/scripts where safe)

### Task 3: Verification (no code changes)
- Backend: `ruff check` clean, `ruff format --check` clean, smoke pytest 55/55 passed (re-run with `--no-cov` to bypass 5-file-subset coverage gate)
- Frontend: `npx tsc -b` clean, vitest 12/12 passed, `npm run build` succeeded
- `grep "AI-Coach"` residuals limited to deliberate exclusions below

## Deliberate Scope Exclusions
- **Azure resource groups** `ai-coach-public-rg` / `ai-coach-private-rg` (`infra/azure/environments/*.json` 等): left unrenamed — they reference live Azure resources; renaming text without migrating cloud resources would break deployments. Needs a separate infra migration task.
- Bare "AI Coach" branding in `docs/**`, most `wiki/**`, and frontend UI components/locale strings: left for the upcoming feature refactor (coach features will be removed/rewritten anyway; several strings have coupled test assertions).
- git remote URL: user-managed, out of scope.

## Issues Encountered
- Shell `sed` aliased to GNU `gsed` — plan's BSD-style `sed -i ''` adapted to GNU syntax.
- Backend global `--cov-fail-under=89` gate fails on partial test subsets by design — verified via `--no-cov` re-run.
- (Orchestrator) `.github/` directory was found deleted from the main working tree after merge — restored from HEAD via `git restore .github/`.
- (Orchestrator) Original SUMMARY.md was created inside the executor worktree and lost during worktree cleanup — reconstructed from executor report.
