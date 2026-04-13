---
phase: "06"
plan: "01"
subsystem: "push-notifications"
tags: ["web-push", "vapid", "service-worker", "push-subscriptions", "frontend", "backend"]
dependency_graph:
  requires: ["phase-05-complete", "calendar_events_cache", "banner-cal-desconectado"]
  provides: ["push_subscriptions-table", "alert_threshold-column", "POST /api/push/subscribe", "DELETE /api/push/unsubscribe", "PATCH /api/push/threshold", "GET /api/push/vapid-public-key", "sw.js", "secao-notificacoes-UI"]
  affects: ["backend/src/config/database.js", "backend/src/app.js", "frontend/index.html", "frontend/src/main.js"]
tech_stack:
  added: ["web-push@3.6.7"]
  patterns: ["VAPID key pair via env vars", "SW registered at /sw.js via Vite public/", "INSERT OR REPLACE for subscription upsert", "ALTER TABLE safe migration for new columns", "PushManager.subscribe() with userVisibleOnly:true"]
key_files:
  created:
    - backend/src/routes/push.js
    - frontend/public/sw.js
  modified:
    - backend/src/config/database.js
    - backend/src/app.js
    - backend/.env.example
    - frontend/src/services/api.js
    - frontend/index.html
    - frontend/src/main.js
decisions:
  - "VAPID public key served via GET /api/push/vapid-public-key (not meta tag) — avoids Vite build-time env injection complexity"
  - "state.usuario added to main.js state object to give push handlers access to alert_threshold without re-fetching"
  - "webpush.setVapidDetails() uses fallback empty strings when VAPID env vars absent — prevents crash on dev startup without .env configured"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 6
---

# Phase 06 Plan 01: Infraestrutura Web Push Summary

Web Push infrastructure with VAPID key management, push_subscriptions table, subscribe/unsubscribe/threshold API routes, service worker, and push opt-in UI in the Calendar tab.

## What Was Built

### Task 1 — Backend
- Installed `web-push@3.6.7`
- Added `push_subscriptions` table (`id`, `usuario_id`, `endpoint`, `p256dh`, `auth`, `criado_em`) with `UNIQUE(endpoint)` constraint and `idx_push_subs_usuario` index
- Added `alert_threshold INTEGER NOT NULL DEFAULT 51` column to `usuarios` via safe `ALTER TABLE` migration
- Created `backend/src/routes/push.js` with four endpoints:
  - `GET /api/push/vapid-public-key` — public, returns VAPID public key for browser subscription
  - `POST /api/push/subscribe` — requireAuth, upserts subscription via INSERT OR REPLACE
  - `DELETE /api/push/unsubscribe` — requireAuth, removes subscription by endpoint
  - `PATCH /api/push/threshold` — requireAuth, validates threshold in `[1, 26, 51, 76]` whitelist
- Mounted pushRouter at `/api/push` in `app.js`
- Initialized `webpush.setVapidDetails()` in `app.js` from env vars
- Added VAPID env vars to `.env.example`

### Task 2 — Frontend
- Created `frontend/public/sw.js` with `push` event listener (showNotification with tag deduplication) and `notificationclick` handler (focus or openWindow)
- Added `push.*` methods to `api.js`: `subscribe`, `unsubscribe`, `setThreshold`, `getVapidPublicKey`
- Added `#secao-notificacoes` HTML block inside `#cal-conectado` with: explanatory text, status indicator, opt-in/opt-out buttons, threshold selector (Verde/Amarelo/Laranja/Vermelho)
- Added to `main.js`:
  - `swRegistration` and `urlBase64ToUint8Array()` helper
  - `state.usuario` field to track authenticated user for threshold access
  - `atualizarStatusPush()` and `verificarStatusPush()` functions
  - Event listeners for `btn-push-optin`, `btn-push-optout`, `sel-threshold`
  - SW registration after `carregarSessao()` in Init block
  - `verificarStatusPush()` call in `carregarCalendario()` connected branch
  - `state.usuario = usuario` assignment in `carregarSessao()`

## Verification Results

- `npm ls web-push` shows `web-push@3.6.7` — PASS
- `pushRouter` mounted at `/api/push` in `app.js` — PASS
- `push_subscriptions` table in `initSchema()` — PASS
- `alert_threshold` safe migration in `initSchema()` — PASS
- `frontend/public/sw.js` exists with `push` and `notificationclick` listeners — PASS
- `#secao-notificacoes` inside `#cal-conectado` in `index.html` — PASS
- `requireAuth` applied to POST /subscribe, DELETE /unsubscribe, PATCH /threshold — PASS
- Threshold validation whitelist `[1, 26, 51, 76]` — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added state.usuario to state object**
- **Found during:** Task 2
- **Issue:** Push opt-in handler referenced `state.usuario?.alert_threshold` but `usuario` was not stored on the state object — would produce `undefined` silently
- **Fix:** Added `usuario: null` to state declaration; assigned `state.usuario = usuario` in `carregarSessao()`
- **Files modified:** `frontend/src/main.js`
- **Commit:** e0b2286

**2. [Rule 2 - Missing critical functionality] VAPID setVapidDetails uses safe fallbacks**
- **Found during:** Task 1
- **Issue:** Plan called `process.env.VAPID_EMAIL` without fallback — would throw if VAPID env vars not set in dev environment without .env
- **Fix:** Added `|| 'admin@example.com'` and `|| ''` fallbacks to prevent startup crash when running without VAPID keys configured
- **Files modified:** `backend/src/app.js`
- **Commit:** 292022d

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 292022d | feat(06-01): backend web-push install, VAPID setup, push_subscriptions table, subscribe/unsubscribe/threshold routes |
| 2 | e0b2286 | feat(06-01): frontend service worker, push opt-in UI in Calendar tab |

## Known Stubs

None — all functionality is wired. Push subscription flow requires a real VAPID key pair in `.env` and a compatible browser to test end-to-end; the infrastructure is complete.

## Self-Check: PASSED

- `backend/src/routes/push.js` — FOUND
- `frontend/public/sw.js` — FOUND
- Commit 292022d — FOUND
- Commit e0b2286 — FOUND
