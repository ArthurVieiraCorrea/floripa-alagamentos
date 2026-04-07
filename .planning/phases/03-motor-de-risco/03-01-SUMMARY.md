---
phase: 03-motor-de-risco
plan: "01"
subsystem: database
tags: [sqlite, schema, risk-scores, indexes]

requires:
  - phase: 02-integracao-meteorologica
    provides: forecasts and forecasts_meta tables that risk engine reads

provides:
  - risk_scores table with UNIQUE(bairro, window_hours) upsert semantics
  - Two query indexes for bairro+window and window-only lookups

affects:
  - 03-02-riskEngine (writes to risk_scores via INSERT OR REPLACE)
  - 03-03-api-risco (reads risk_scores for HTTP endpoints)

tech-stack:
  added: []
  patterns:
    - "INSERT OR REPLACE upsert pattern via UNIQUE constraint — each scoring cycle overwrites previous"
    - "CHECK constraints inline on window_hours and nivel to enforce domain invariants at DB layer"

key-files:
  created: []
  modified:
    - backend/src/config/database.js

key-decisions:
  - "UNIQUE(bairro, window_hours) enables INSERT OR REPLACE upsert — 150 rows max (50 bairros x 3 janelas) per scoring cycle"
  - "CHECK(window_hours IN (24,48,72)) at DB layer avoids invalid window values reaching the schema"

patterns-established:
  - "New domain tables added at bottom of initSchema() following existing CREATE TABLE IF NOT EXISTS pattern"
  - "Indexes created immediately after their table definition in initSchema()"

requirements-completed:
  - RISCO-01
  - RISCO-02
  - RISCO-03
  - RISCO-04

duration: 5min
completed: 2026-04-07
---

# Phase 03 Plan 01: Schema de Risk Scores Summary

**SQLite risk_scores table with UNIQUE(bairro, window_hours) upsert semantics, CHECK constraints on window_hours and nivel, and two covering indexes added to initSchema()**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-07T20:30:00Z
- **Completed:** 2026-04-07T20:35:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `risk_scores` table to `initSchema()` with all domain constraints
- `UNIQUE(bairro, window_hours)` constraint enables `INSERT OR REPLACE` as an upsert operation — riskEngine can write 150 rows per cycle without duplicates
- `idx_risk_scores_bairro_window` and `idx_risk_scores_window` indexes created for efficient API queries
- `CHECK(window_hours IN (24, 48, 72))` and `CHECK(nivel IN ('verde', 'amarelo', 'laranja', 'vermelho'))` enforce domain invariants at the database layer

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar tabela risk_scores ao initSchema()** - `db59dd2` (feat)

## Files Created/Modified

- `backend/src/config/database.js` — risk_scores table definition with UNIQUE constraint, CHECK constraints, and two indexes appended after `INSERT OR IGNORE INTO forecasts_meta`

## Decisions Made

None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan's verification commands used `require('./backend/src/config/database')` which resolves `node-sqlite3-wasm` via node_modules. The worktree doesn't have its own `node_modules` — modules live in the main repo's `backend/node_modules`. Verification was run with `NODE_PATH` pointing to the main repo's node_modules and both checks passed:
- `{ name: 'risk_scores' }` confirmed table exists
- `idx_risk_scores_bairro_window` and `idx_risk_scores_window` confirmed in sqlite_master

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `risk_scores` table is ready for `riskEngine.js` (Plan 03-02) to write scored rows via `INSERT OR REPLACE`
- API layer (Plan 03-03) can query by `(bairro, window_hours)` or by `window_hours` efficiently via the created indexes
- No blockers

---
*Phase: 03-motor-de-risco*
*Completed: 2026-04-07*
