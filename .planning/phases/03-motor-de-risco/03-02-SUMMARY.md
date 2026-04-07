---
phase: 03-motor-de-risco
plan: "02"
subsystem: api
tags: [sqlite, risk-scoring, flood-prediction, florianopolis]

# Dependency graph
requires:
  - phase: 03-01
    provides: risk_scores table schema and database singleton via getDb()
  - phase: 02-01
    provides: forecasts table with precipitacao_mm per bairro/forecast_time
provides:
  - calcularRiscos() function that computes 150 risk scores (50 bairros × 3 time windows)
  - risk_scores table populated with verde/amarelo/laranja/vermelho levels
affects:
  - 03-03-scheduler
  - 04-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-weight scoring: 0.6/0.4 precip/history when sufficient data, 0.9/0.1 when count < 5"
    - "Never-throw service pattern: log errors, return silently (matches forecastService.js)"
    - "UTC-3 correction for forecast_time: datetime('now', '-3 hours') for local-stored timestamps"
    - "Single transaction for 150 INSERTs to keep risk_scores consistent"

key-files:
  created:
    - backend/src/services/riskEngine.js
  modified: []

key-decisions:
  - "Added 'Bela Vista' as 50th bairro — original plan array had 49 entries but must_have required exactly 150 rows (50×3)"
  - "Template literal interpolation for datetime modifier ('+${horas} hours') — node-sqlite3-wasm does not support bind params in SQLite datetime modifiers"

patterns-established:
  - "Score clamped via Math.round(...*10)/10 for one-decimal precision"
  - "Historical lookup via normalizarNome() strips accents + lowercases for fuzzy bairro matching"

requirements-completed:
  - RISCO-01
  - RISCO-02
  - RISCO-04

# Metrics
duration: 15min
completed: 2026-04-07
---

# Phase 03 Plan 02: Algoritmo de Scoring Summary

**Risk scoring engine computing 0-100 flood scores for 50 Florianópolis bairros × 3 time windows with dual-weight formula persisted atomically to risk_scores**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-07T21:10:00Z
- **Completed:** 2026-04-07T21:26:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Implemented `calcularRiscos()` with D-01 canonical 50-bairro list for Florianópolis
- Score formula: D-03 (precip/80mm saturation) × 0.6 + D-05 (hist/10 saturation) × 0.4, adjusting to 0.9/0.1 when insufficient data (RISCO-04)
- D-06 level thresholds: verde ≤25, amarelo ≤50, laranja ≤75, vermelho >75
- UTC-3 correction applied to all `forecast_time` comparisons
- Verified 150 rows inserted per run; all fields correct per plan verification queries

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar riskEngine.js** - `9d48929` (feat)

## Files Created/Modified
- `backend/src/services/riskEngine.js` - Full scoring engine; exports `calcularRiscos()`; 50 bairros × 3 windows; BEGIN/COMMIT transaction

## Decisions Made
- Added 'Bela Vista' (continental bairro) as 50th entry — the plan's array had 49 bairros, causing 147 rows vs. required 150
- Template literal used for SQLite datetime modifier `'+${horas} hours'` because node-sqlite3-wasm does not support bind parameters in SQLite modifier positions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bairro count from 49 to 50**
- **Found during:** Task 1 (Criar riskEngine.js)
- **Issue:** Plan's BAIRROS_FLORIANOPOLIS array had 49 items but must_have required exactly 150 rows (50×3). Verification showed `rows: 147`.
- **Fix:** Added 'Bela Vista' as 50th bairro (real Florianópolis continental neighborhood) to reach exactly 150 rows.
- **Files modified:** backend/src/services/riskEngine.js
- **Verification:** Re-ran calcularRiscos(); console logged "150 scores calculados"; COUNT query returned 150.
- **Committed in:** 9d48929 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan array count)
**Impact on plan:** Fix required for correctness — must_have explicitly requires 150 rows. No scope creep.

## Issues Encountered
- Worktree backend lacked `node_modules` — ran `npm install` in worktree backend directory to enable verification. This is a worktree setup artifact, not a code issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `calcularRiscos()` is fully implemented and verified
- Ready for 03-03 to wire this into the node-cron scheduler (every 4h + startup)
- `risk_scores` table populated; 04-dashboard can query by bairro/window_hours

---
*Phase: 03-motor-de-risco*
*Completed: 2026-04-07*
