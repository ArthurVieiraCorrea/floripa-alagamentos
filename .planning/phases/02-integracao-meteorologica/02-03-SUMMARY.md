---
phase: 02-integracao-meteorologica
plan: 02-03
subsystem: backend
tags: [scheduler, cron, forecast, api, cache]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [forecast-scheduler, forecast-api]
  affects: [app.js, scheduler.js, previsao.js]
tech_stack:
  added: [node-cron@4]
  patterns: [singleton-guard, fire-and-forget-warmup, cache-only-endpoint]
key_files:
  created:
    - backend/src/jobs/scheduler.js
    - backend/src/routes/previsao.js
  modified:
    - backend/src/app.js
    - backend/package.json
decisions:
  - "initScheduler() called after app.use(session(...)) so initSchema() has already created forecasts table before warm-up fires"
  - "Singleton guard (initialized flag) prevents double-scheduling if require() called twice"
  - "Response shape is flat (last_updated, status, stale, precip_48h_mm, previsao[]) not nested — matches dashboard consumption pattern"
  - "stale=true threshold set to 120min (2x the 1h cron interval) to tolerate transient network failures"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-07"
  tasks: 2
  files_changed: 3
---

# Phase 02 Plan 03: Scheduler e API de Previsão Summary

**One-liner:** node-cron singleton scheduler with startup warm-up wired to Express, serving cache-only `GET /api/previsao/atual` with stale detection.

## What Was Built

### Task 1 — scheduler.js (node-cron singleton)

`backend/src/jobs/scheduler.js` exports `initScheduler()`:
- Singleton guard via `initialized` flag prevents double-scheduling
- Schedules `fetchAndCacheForecasts()` at `'0 * * * *'` (top of every hour) with timezone `America/Sao_Paulo`
- Fire-and-forget warm-up call on startup so cache is populated before the first user request
- Logs `[scheduler] Job de previsão agendado (a cada hora em :00)` on init

### Task 2 — previsao.js route + app.js integration

`backend/src/routes/previsao.js` — `GET /api/previsao/atual`:
- Reads only SQLite (zero external calls — PREV-02 compliant)
- Returns 503 if `forecasts_meta` row is missing or status is `pending`
- Computes `stale=true` when `last_fetched_at` is older than 120 minutes
- Response: `{ last_updated, status, stale, precip_48h_mm, previsao[] }`
- Try/catch on both DB reads with 500 error responses for internal failures

`backend/src/app.js` changes:
- `require('./jobs/scheduler')` destructures `initScheduler`
- `app.use('/api/previsao', previsaoRouter)` mounted after `ocorrenciasRouter`
- `initScheduler()` called AFTER all `app.use(...)` middleware and BEFORE `app.listen()`, ensuring `initSchema()` has already created the `forecasts` table via the session store

## Verification Results

```
OK — node-cron instalado
OK — scheduler.js carregado, initScheduler é função
OK — node-cron em package.json: ^4.2.1
[scheduler] Job de previsão agendado (a cada hora em :00)
Servidor rodando em http://localhost:3099
OK — endpoint 200, campos presentes, previsao.length=72
```

All verification checks passed:
- [x] `node-cron` in `backend/package.json` dependencies
- [x] `scheduler.js` exports `initScheduler`
- [x] `previsao.js` mounts `GET /atual`
- [x] `app.js` imports `previsaoRouter` and `initScheduler`
- [x] `app.use('/api/previsao', previsaoRouter)` present
- [x] `initScheduler()` called AFTER session middleware, BEFORE `app.listen()`
- [x] Endpoint returns 200 with `last_updated`, `status`, `stale`, `precip_48h_mm`, `previsao`
- [x] No external HTTP calls in route handler (SQLite only)
- [x] Startup log confirms `[scheduler] Job de previsão agendado (a cada hora em :00)`

## Deviations from Plan

The previous commit (`d710ae2`) had already created the files but with structural issues that required correction:

**1. [Rule 1 - Bug] Renamed startScheduler → initScheduler with singleton guard**
- **Found during:** Task 1 review
- **Issue:** Previous impl exported `startScheduler` (not matching plan spec), had no singleton guard, no timezone
- **Fix:** Rewrote to export `initScheduler`, added `initialized` flag, added `timezone: 'America/Sao_Paulo'`
- **Files modified:** `backend/src/jobs/scheduler.js`
- **Commit:** e4ce036

**2. [Rule 1 - Bug] Fixed previsao.js response shape and added stale detection**
- **Found during:** Task 2 review
- **Issue:** Previous impl returned `{ meta: {...}, forecasts: [] }` (nested); missing `stale` field; no try/catch on DB calls
- **Fix:** Flattened to `{ last_updated, status, stale, precip_48h_mm, previsao[] }`; added stale calculation (>120min); added try/catch on both db.get() and db.all()
- **Files modified:** `backend/src/routes/previsao.js`
- **Commit:** e4ce036

**3. [Rule 1 - Bug] Moved initScheduler() before app.listen()**
- **Found during:** Task 2 review (critical constraint from plan)
- **Issue:** Previous impl called `startScheduler()` inside `app.listen()` callback — after the server starts listening, not before. Also wrong function name.
- **Fix:** Moved call to immediately before `app.listen()`, after all middleware
- **Files modified:** `backend/src/app.js`
- **Commit:** e4ce036

## Phase 2 Requirements Status

| Requirement | Description | Status |
|-------------|-------------|--------|
| PREV-01 | Schema tables `forecasts` + `forecasts_meta` | Complete (02-01) |
| PREV-02 | `GET /api/previsao/atual` never calls Open-Meteo | Complete (02-03) |
| PREV-03 | Scheduler updates cache hourly + startup warm-up | Complete (02-03) |
| PREV-04 | forecastService fetches Open-Meteo and caches to SQLite | Complete (02-02) |

Phase 02 — Integração Meteorológica: **all 4 requirements satisfied**.

## Known Stubs

None — the endpoint is fully wired to SQLite data populated by forecastService.

## Threat Flags

None — no new trust boundaries introduced beyond what was modeled in the plan's threat register. T-02-10 (DoS via endpoint) is mitigated by global rate limiting already mounted in app.js. T-02-11 (last_error disclosure) is mitigated — field not included in response.

## Self-Check: PASSED

- backend/src/jobs/scheduler.js: FOUND
- backend/src/routes/previsao.js: FOUND
- backend/src/app.js: FOUND (contains initScheduler)
- Commit e4ce036: FOUND
