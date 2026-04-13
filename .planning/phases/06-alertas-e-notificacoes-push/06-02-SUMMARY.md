---
phase: "06"
plan: "02"
subsystem: "alert-engine"
tags: ["web-push", "alert-dedup", "scheduler", "risk-engine", "calendar-events"]
dependency_graph:
  requires: ["push_subscriptions-table", "alert_threshold-column", "calendar_events_cache", "risk_scores"]
  provides: ["alertas_enviados-table", "checkAndSendAlerts()", "alert-scheduler-chain"]
  affects: ["backend/src/config/database.js", "backend/src/jobs/scheduler.js"]
tech_stack:
  added: []
  patterns: ["INSERT OR IGNORE for atomic dedup", "risk_cycle_key truncated to hour for 4h-window safety", "per-user try/catch isolation", "stale subscription cleanup on 404/410"]
key_files:
  created:
    - backend/src/services/alertService.js
  modified:
    - backend/src/config/database.js
    - backend/src/jobs/scheduler.js
decisions:
  - "risk_cycle_key derived as ISO hour slice (slice(0,13)) — tolerates two runs in same 4h window without double-alerting"
  - "alertas_enviados records every alert regardless of push subscription — enables in-app fallback (ALERT-05) to query the table"
  - "checkAndSendAlerts() chained in scheduler IIFE after calcularRiscos() — ensures alert run on startup without separate startup delay"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 06 Plan 02: Motor de Alertas Summary

Alert engine using web-push VAPID notifications with per-cycle deduplication via alertas_enviados table, crossing calendar_events_cache against risk_scores and chained into the 4h scheduler after risk recalculation.

## What Was Built

### Task 1 — alertas_enviados table + alertService.js

- Added `alertas_enviados` table to `initSchema()` in `database.js` after `push_subscriptions` block:
  - Columns: `id`, `usuario_id`, `google_event_id`, `risk_cycle_key`, `bairro`, `score`, `summary`, `enviado_em`, `visto_em`
  - `UNIQUE(usuario_id, google_event_id, risk_cycle_key)` — dedup constraint (ALERT-03)
  - `idx_alertas_enviados_usuario_visto` index for in-app fallback polling
  - `idx_alertas_enviados_usuario_em` index for chronological listing
- Created `backend/src/services/alertService.js` with:
  - `checkAndSendAlerts()` — main entry point; queries risk_scores (window=24h), derives `risk_cycle_key` as `calculated_at.slice(0,13)`, loops over users with `calendar_connected=1 AND calendar_disconnected=0`
  - `enviarPush()` — sends via `webpush.sendNotification()`; on 404/410 deletes stale endpoint (RFC 8030)
  - `registrarAlertaEnviado()` — `INSERT OR IGNORE` for atomic dedup
  - Per-user try/catch prevents one failing user from stopping others
  - Registers alert in `alertas_enviados` even without push subscription (in-app fallback readable)

### Task 2 — Wire into scheduler.js

- Imported `checkAndSendAlerts` at top of `scheduler.js`
- Extended `5 */4 * * *` cron callback to call `checkAndSendAlerts()` after `calcularRiscos()`
- Added `checkAndSendAlerts()` try/catch block to startup IIFE after `calcularRiscos()`
- Updated log line: `Risco+Alertas: 5 */4 * * *`

## Verification Results

- `node -e "require('./backend/src/services/alertService')"` — no output (PASS)
- `alertas_enviados` table defined in `initSchema()` with correct columns and UNIQUE constraint — PASS
- `idx_alertas_enviados_usuario_visto` and `idx_alertas_enviados_usuario_em` indexes added — PASS
- `checkAndSendAlerts` imported and chained in `5 */4 * * *` cron — PASS
- `checkAndSendAlerts` in startup IIFE after `calcularRiscos()` — PASS
- Log line updated to `Risco+Alertas` — PASS
- `calendar_disconnected = 0` filter prevents processing users with expired tokens (ALERT-06) — PASS
- `INSERT OR IGNORE` with UNIQUE(usuario_id, google_event_id, risk_cycle_key) prevents duplicate alerts (ALERT-03) — PASS
- 404/410 handler deletes stale subscription endpoint — PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all alert logic is wired. End-to-end push delivery requires VAPID keys in `.env`, a connected user with calendar events in the cache, and computed risk scores in the DB.

## Threat Flags

No new network endpoints or trust boundary changes introduced. All threats listed in plan's threat_model are addressed:
- XSS: payload built from internal DB data, sw.js uses `showNotification()` (text-only)
- Alert spam: UNIQUE constraint + INSERT OR IGNORE
- Cross-user subscription leak: `WHERE usuario_id = ?` scoped queries
- Stale subscription accumulation: deleted on 404/410

## Self-Check: PASSED

- `backend/src/services/alertService.js` — FOUND
- `backend/src/config/database.js` modified with alertas_enviados table — FOUND
- `backend/src/jobs/scheduler.js` modified with checkAndSendAlerts chain — FOUND
- Commit 52ee501 — FOUND
- Commit d328ee2 — FOUND

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 52ee501 | feat(06-02): alertas_enviados table + alertService.js |
| 2 | d328ee2 | feat(06-02): wire checkAndSendAlerts into scheduler |
