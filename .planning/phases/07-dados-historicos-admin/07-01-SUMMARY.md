---
phase: 07-dados-historicos-admin
plan: "01"
subsystem: admin-csv-import
tags: [admin, csv, import, auth, backend, frontend]
one_liner: "Protected admin CSV import with validation, dedup, preview/confirm workflow and frontend panel"
dependency_graph:
  requires:
    - "06-03 (in-app alertas routes — alertasRouter already mounted in app.js)"
    - "01-02 (requireAuth middleware from Phase 01)"
  provides:
    - "POST /api/admin/preview — parse+validate+dedup CSV, return preview without inserting"
    - "POST /api/admin/confirmar — bulk insert validated rows, return report"
  affects:
    - "backend/src/app.js — adminRouter now mounted at /api/admin"
    - "backend/src/models/ocorrencia.js — ORM model added for ocorrencias table"
tech_stack:
  added:
    - "express.text() body parser for raw CSV (text/plain, text/csv, application/octet-stream, limit 5mb)"
  patterns:
    - "requireAuth middleware on both admin routes (HIST-01 auth requirement)"
    - "preview-then-confirm pattern: no DB writes on preview, re-validates before insert"
    - "bairro+nivel+date composite dedup key using SQLite date() function"
key_files:
  created:
    - backend/src/routes/admin.js
    - backend/src/controllers/adminController.js
    - backend/src/models/ocorrencia.js
  modified:
    - backend/src/app.js
    - frontend/index.html
    - frontend/src/services/api.js
    - frontend/src/main.js
    - frontend/src/styles/main.css
    - package.json
decisions:
  - "express.text() with multiple MIME types instead of multer — avoids file upload complexity; CSV is small text"
  - "Re-validate on /confirmar — prevents stale previews from being inserted with invalid data"
  - "Admin tab hidden by default (display:none) — shown only when req.session.userId is set by main.js auth check"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 9
---

# Phase 07 Plan 01: Admin CSV Import Routes and Frontend Panel Summary

Protected admin CSV import with validation, dedup, preview/confirm workflow and frontend panel (HIST-01).

## What Was Done

All Phase 07 backend files were already implemented in the main working directory as untracked files. This plan verified all contracts and committed them to the worktree branch.

### Task 1: Verify route definitions and app.js mount

Verified `backend/src/routes/admin.js` against expected contracts:
- Imports `{ requireAuth }` from `'../middleware/auth'` — PASS
- Imports `AdminController` from `'../controllers/adminController'` — PASS
- `csvText` middleware: `express.text({ type: ['text/plain', 'text/csv', 'application/octet-stream'], limit: '5mb' })` — PASS
- `router.post('/preview', requireAuth, csvText, AdminController.preview)` — PASS
- `router.post('/confirmar', requireAuth, express.json(), AdminController.confirmar)` — PASS
- `module.exports = router` — PASS

Verified `backend/src/app.js`:
- `const adminRouter = require('./routes/admin')` — PASS
- `app.use('/api/admin', adminRouter)` — PASS

Module load verification: `node -e "require('./backend/src/routes/admin.js')"` exits 0 — PASS

Curl check: Server on port 3001 returned 404 (not the Phase 07 version — Phase 07 files not yet deployed). Code inspection confirms `requireAuth` returns 401 when `req.session.userId` is absent.

### Task 2: Verify frontend contracts and commit

Verified `frontend/src/services/api.js`:
- `api.admin.preview(csvText)` — POSTs with `Content-Type: text/plain` — PASS
- `api.admin.confirmar(linhas)` — POSTs JSON `{ linhas }` — PASS

Verified `frontend/index.html` required elements:
- `#tab-btn-admin` with `style="display:none"` (line 70) — PASS
- `#admin-csv-input` file input (line 152) — PASS
- `#btn-admin-preview` button (line 154) — PASS
- `#btn-admin-confirmar` button (line 174) — PASS
- `#admin-resumo` div (line 159) — PASS
- `#admin-preview-section` div (line 158) — PASS
- `#admin-resultado` div (line 201) — PASS

Committed all 9 files (2 modified backend files, 3 new backend files, 4 modified frontend files).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1+2 | b8911e4 | feat(07-01): add admin CSV import routes, controller, and frontend panel (HIST-01) |

## Deviations from Plan

None — plan executed exactly as written. All contracts verified as-is, no fixes required.

## Known Stubs

None — frontend admin panel is fully wired to live API endpoints (`api.admin.preview` and `api.admin.confirmar`). Data flows from CSV file input through preview table to confirmation insert.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. All four threats (T-07-01 through T-07-04) are mitigated by requireAuth, 5mb limit, and content validation in the controller.

## Self-Check: PASSED

- backend/src/routes/admin.js — FOUND (committed at b8911e4)
- backend/src/controllers/adminController.js — FOUND (committed at b8911e4)
- backend/src/models/ocorrencia.js — FOUND (committed at b8911e4)
- backend/src/app.js — FOUND (modified, committed at b8911e4)
- frontend/index.html — FOUND (modified, committed at b8911e4)
- frontend/src/services/api.js — FOUND (modified, committed at b8911e4)
- Commit b8911e4 exists in git log — VERIFIED
