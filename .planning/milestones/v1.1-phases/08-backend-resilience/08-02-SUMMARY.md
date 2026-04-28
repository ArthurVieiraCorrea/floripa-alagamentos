---
phase: 08-backend-resilience
plan: 02
subsystem: api
tags: [adminController, alertService, riskEngine, frontend, html, javascript]

requires:
  - phase: 06-alertas-e-notificacoes-push
    provides: checkAndSendAlerts() service with idempotent alert deduplication

provides:
  - confirmar() is now async and chains calcularRiscos() + checkAndSendAlerts() best-effort after CSV import
  - recalcular() chains checkAndSendAlerts() after calcularRiscos() for scheduler consistency
  - admin-recalcular-section button removed from frontend (UI simplified)

affects: [admin-flow, alert-pipeline, frontend-admin]

tech-stack:
  added: []
  patterns: [best-effort try/catch for post-import side effects, auto-trigger risk+alert cycle]

key-files:
  created: []
  modified:
    - backend/src/controllers/adminController.js
    - frontend/index.html
    - frontend/src/main.js

key-decisions:
  - "Best-effort auto-trigger: confirmar() always returns 200 with import stats; recalculo field signals success/failure of side effect"
  - "api.admin.recalcular() preserved in api.js — endpoint still active, only UI button removed"
  - "checkAndSendAlerts() deduplication relies on existing UNIQUE constraint in alertas_enviados (cycleKey hourly)"

patterns-established:
  - "Auto-trigger pattern: post-import side effects wrapped in best-effort try/catch, never blocking the primary response"

requirements-completed:
  - RESIL-01

duration: ~35min
completed: 2026-04-19
---

# Plan 08-02: Auto-trigger Risk Recalc + Frontend Cleanup Summary

**confirmar() now auto-chains calcularRiscos() + checkAndSendAlerts() after CSV import; manual recalculate button removed from admin UI**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `confirmar()` made `async` — chains `calcularRiscos()` + `checkAndSendAlerts()` in best-effort try/catch after inserting rows; response includes `recalculo: 'ok' | 'erro'` field
- `recalcular()` now calls `checkAndSendAlerts()` after `calcularRiscos()`, consistent with the cron scheduler pattern
- Removed `admin-recalcular-section` div and `btn-admin-recalcular` from `index.html` and its event listener from `main.js`; `api.admin.recalcular()` in `api.js` preserved

## Task Commits

1. **Task 1: Atualizar adminController.js** — `9fc5b2d` (feat)
2. **Task 2: Limpar frontend** — `44d2135` (feat)

## Files Created/Modified

- `backend/src/controllers/adminController.js` — added `checkAndSendAlerts` import; `confirmar()` → async with auto-trigger; `recalcular()` → chains `checkAndSendAlerts()`
- `frontend/index.html` — removed `admin-recalcular-section` block (lines 208-212)
- `frontend/src/main.js` — removed display call and full event listener for `btn-admin-recalcular`

## Decisions Made

- Best-effort pattern chosen for auto-trigger: import stats always returned even if recalculation fails, with `recalculo: 'erro'` signaling partial failure
- `api.admin.recalcular()` kept in `api.js` per D-05 — endpoint remains accessible via curl/programmatic use

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Agent experienced auth failure in completion handler after all work was committed. Spot-checks confirmed all commits and verification passed. SUMMARY.md created by orchestrator.

## Verification Results

All 6 verification commands passed:
- `require('./backend/src/controllers/adminController.js')` — OK
- `checkAndSendAlerts` present in adminController — OK
- `async confirmar` present — OK
- `recalcular()` chains `checkAndSendAlerts` — OK
- Frontend `admin-recalcular-section` removed from html and js — OK
- `api.admin.recalcular()` preserved in api.js — OK

## Next Phase Readiness

- RESIL-01 complete: CSV import auto-triggers full risk+alert cycle
- Admin UI is simplified — no manual recalculate step
- Phase 08 complete pending verification

---
*Phase: 08-backend-resilience*
*Completed: 2026-04-19*
