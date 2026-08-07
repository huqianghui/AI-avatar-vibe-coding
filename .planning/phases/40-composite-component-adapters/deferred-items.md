# Deferred Items — Phase 40

## Item 1: Backend `seed_data.py` fails due to missing model import (blocks local Playwright E2E run)

- **Found during:** 40-01 pre-commit E2E verification step (attempting to run
  Dialog-touching specs `admin-dry-run.spec.ts` / `admin-persona-knowledge.spec.ts`
  against a locally seeded backend).
- **File:** `backend/app/models/__init__.py`
- **Issue:** `AvatarPersona.knowledge_config` declares
  `relationship("AvatarPersonaKnowledgeConfig", ...)` (see
  `backend/app/models/avatar_persona.py`), but
  `AvatarPersonaKnowledgeConfig` (defined in
  `backend/app/models/avatar_persona_knowledge_config.py`) is never imported
  into `app/models/__init__.py`. SQLAlchemy's mapper configuration fails at
  first query with `InvalidRequestError: ... failed to locate a name
  ('AvatarPersonaKnowledgeConfig')`, which crashes
  `backend/scripts/seed_data.py` before any users/personas are seeded --
  Playwright's `auth.setup.ts` (login as `user1`/`admin`) cannot succeed
  against an unseeded DB.
- **Scope:** Out of scope for 40-01 (`files_modified: [dialog.tsx,
  dialog.test.tsx, _shim-as-child.ts]`) -- this is a pre-existing backend
  model-registration bug introduced by the "persona-hcp-foundry-alignment
  Increment C" commit (`41699ab`), unrelated to the Dialog Fluent UI
  migration.
- **Action:** Not fixed. Documented here per the deviation-rules scope
  boundary. Local Playwright E2E execution for 40-01 was substituted with:
  (a) unit/component-level ARIA assertions in `dialog.test.tsx` covering the
  same `role="dialog"` / `aria-labelledby` / `aria-describedby` contract the
  E2E specs assert on, and (b) static verification that
  `admin-dry-run.spec.ts` / `admin-persona-knowledge.spec.ts` use
  `page.getByRole("dialog")` (role-based, not implementation-detail
  selectors), which the Fluent-backed `dialog.tsx` continues to satisfy
  unchanged. Recommend a future quick-task fix: add
  `from app.models.avatar_persona_knowledge_config import
  AvatarPersonaKnowledgeConfig` to `app/models/__init__.py`'s import list and
  `__all__`.
