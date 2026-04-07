---
phase: 03-motor-de-risco
plan: "03"
subsystem: api
tags: [node-cron, express, sqlite, risk-scoring, flood-alert, scheduler]

# Dependency graph
requires:
  - phase: 03-01
    provides: risk_scores table schema and getDb() database singleton
  - phase: 03-02
    provides: calcularRiscos() function computing 150 risk scores (50 bairros × 3 windows)
  - phase: 02-03
    provides: fetchAndCacheForecasts() and initScheduler() pattern
provides:
  - GET /api/risco/bairros?window=24|48|72 — all bairros with flood risk scores
  - GET /api/risco/:bairro?window=24|48|72 — single bairro detailed score
  - node-cron job at '5 */4 * * *' recalculating risk scores every 4h
  - Sequential startup: fetchAndCacheForecasts then calcularRiscos (race condition resolved)
affects:
  - 04-dashboard
  - 05-google-calendar
  - 06-alertas

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequential async IIFE for startup: forecast-then-risk prevents calcularRiscos with empty cache"
    - "503 for empty risk_scores table (matches previsao.js pattern for uninitialized data)"
    - "insufficient_data boolean coercion from SQLite int (0/1) to JS boolean in route layer"
    - "window param validation against VALID_WINDOWS = [24, 48, 72] with 400 on invalid"
    - "bairro param truncated to 100 chars before use in error message (reflection mitigation)"

key-files:
  created:
    - backend/src/routes/risco.js
  modified:
    - backend/src/jobs/scheduler.js
    - backend/src/app.js

key-decisions:
  - "Sequential IIFE startup (await forecast then await risk) instead of fire-and-forget — solves race condition documented in RESEARCH.md Pitfall 5"
  - "Cron offset '5 */4 * * *' (5min after :00) guarantees forecast cron ran before risk recalculation"

patterns-established:
  - "503 pattern: return 503+pending when risk_scores table is empty (same as previsao.js for forecasts)"
  - "Route param truncation: String(param).slice(0, 100) before error message interpolation"

requirements-completed:
  - RISCO-03
  - RISCO-04
  - RISCO-01
  - RISCO-02

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 03 Plan 03: Job e API de Risco Summary

**Express risk API (GET /api/risco/bairros, GET /api/risco/:bairro) wired to node-cron scheduler with sequential startup ensuring forecast-before-risk ordering**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-07T21:29:06Z
- **Completed:** 2026-04-07T21:31:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `calcularRiscos` cron at `5 */4 * * *` in scheduler.js (RISCO-03)
- Replaced fire-and-forget startup with sequential async IIFE: forecast completes before risk calculated
- Created `risco.js` router with GET /bairros (all 50 bairros) and GET /:bairro (single detail)
- Mounted `/api/risco` in app.js after previsaoRouter
- 503 when risk_scores empty, 400 for invalid window, 404 for unknown bairro

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar job de risco ao scheduler.js** - `4f802e1` (feat)
2. **Task 2: Criar risco.js router** - `f882bf5` (feat)
3. **Task 3: Montar riscoRouter em app.js** - `1b119c9` (feat)

## Files Created/Modified
- `backend/src/routes/risco.js` - Express router; GET /bairros (list all) and GET /:bairro (detail); 503/400/404 handling; insufficient_data coercion
- `backend/src/jobs/scheduler.js` - Added calcularRiscos import; cron '5 */4 * * *'; sequential async startup IIFE
- `backend/src/app.js` - Added riscoRouter import and mount at /api/risco

## Decisions Made
- Sequential IIFE startup instead of fire-and-forget: ensures calcularRiscos() only runs after fetchAndCacheForecasts() completes, resolving the race condition (RESEARCH.md Pitfall 5)
- Cron offset 5min (`5 */4 * * *`) so the forecast cron (`0 * * * *`) always runs before risk recalculation at :05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree had no `node_modules` (worktree setup artifact) — ran `npm install` in backend directory to enable syntax verification. Not a code issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full risk pipeline is operational: Open-Meteo forecast → riskEngine.calcularRiscos() → risk_scores table → /api/risco/* endpoints
- Phase 04 (Dashboard de Previsão) can query /api/risco/bairros?window=24|48|72 for choropleth map layer
- Phase 03 Motor de Risco is fully complete

---
*Phase: 03-motor-de-risco*
*Completed: 2026-04-07*
