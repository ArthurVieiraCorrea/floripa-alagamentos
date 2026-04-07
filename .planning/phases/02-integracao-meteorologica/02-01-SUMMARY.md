---
phase: 02-integracao-meteorologica
plan: "01"
subsystem: database
tags: [sqlite, schema, forecasts, ddl]
dependency_graph:
  requires: [01-autenticacao]
  provides: [forecasts-table, forecasts-meta-table]
  affects: [02-02-forecastService, 02-03-api-previsao]
tech_stack:
  added: []
  patterns: [CREATE TABLE IF NOT EXISTS, INSERT OR IGNORE singleton seed, UNIQUE constraint for idempotent upsert]
key_files:
  modified:
    - backend/src/config/database.js
decisions:
  - "forecast_time stores ISO 8601 strings without offset as returned by Open-Meteo; timezone parsing deferred to forecastService"
  - "forecasts_meta singleton seeded at schema init so GET /api/previsao/atual never sees null meta before first fetch"
  - "idx_forecasts_bairro_time created now to avoid migration when Phase 3 range queries are added"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-07"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 02 Plan 01: Schema e Cache de Previsoes Summary

SQLite schema extended with `forecasts` and `forecasts_meta` tables inside the existing `initSchema()` function, enabling idempotent INSERT OR REPLACE upserts for Open-Meteo hourly data and singleton state tracking for the scheduler.

## What Was Built

Extended `backend/src/config/database.js` `initSchema()` with four new `db.run()` calls:

1. `CREATE TABLE IF NOT EXISTS forecasts` — stores one row per hour per bairro; `UNIQUE(bairro, forecast_time)` enables `INSERT OR REPLACE` without duplicates.
2. `CREATE INDEX IF NOT EXISTS idx_forecasts_bairro_time` — covering index on `(bairro, forecast_time)` for Phase 3 range queries over 24h/48h/72h windows.
3. `CREATE TABLE IF NOT EXISTS forecasts_meta` — singleton table (id=1 always) with `CHECK(status IN ('ok', 'error', 'pending'))` constraint enforced at DB level (T-02-02 mitigation).
4. `INSERT OR IGNORE INTO forecasts_meta(id) VALUES(1)` — seeds singleton row so `GET /api/previsao/atual` can detect "never fetched" state (`status='pending'`) without conditional INSERT in the service layer.

## Schema (exact)

### forecasts

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| bairro | TEXT | NOT NULL DEFAULT 'florianopolis' |
| forecast_time | TEXT | NOT NULL |
| precipitacao_mm | REAL | NOT NULL DEFAULT 0 |
| fonte | TEXT | NOT NULL DEFAULT 'open-meteo' |
| fetched_at | TEXT | NOT NULL DEFAULT (datetime('now')) |
| — | — | UNIQUE(bairro, forecast_time) |

### forecasts_meta

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY DEFAULT 1 |
| last_fetched_at | TEXT | nullable |
| status | TEXT | NOT NULL DEFAULT 'pending' CHECK(status IN ('ok', 'error', 'pending')) |
| precip_48h_mm | REAL | NOT NULL DEFAULT 0 |
| last_error | TEXT | nullable |

## Verification Output

```
OK — tables: forecasts, forecasts_meta, ocorrencias, sessions, sqlite_sequence, usuarios
OK — forecasts_meta singleton: {"id":1,"last_fetched_at":null,"status":"pending","precip_48h_mm":0,"last_error":null}
OK — index exists
```

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Add forecasts and forecasts_meta tables to initSchema() | 55b36d0 |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Disposition | Applied |
|--------|-------------|---------|
| T-02-02 Tampering forecasts_meta.status | mitigate | CHECK constraint in DDL |
| T-02-04 SQL injection in forecasts rows | mitigate | Deferred to forecastService prepared statements (Plan 02-02) |

## Self-Check: PASSED

- `backend/src/config/database.js` modified — FOUND
- Commit 55b36d0 — FOUND
- Verification script output — all three OK lines printed
