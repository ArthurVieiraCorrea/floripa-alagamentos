---
phase: "06"
plan: "03"
subsystem: alertas-inapp
tags: [alertas, banner, polling, sessionStorage, fallback]
dependency_graph:
  requires: [06-02]
  provides: [ALERT-05, fallback-inapp-banner]
  affects: [frontend/index.html, frontend/src/main.js, frontend/src/services/api.js, backend/src/routes/alertas.js, backend/src/app.js]
tech_stack:
  added: []
  patterns: [sessionStorage-dismissal, polling-60s, server-side-mark-seen]
key_files:
  created:
    - backend/src/routes/alertas.js
  modified:
    - backend/src/app.js
    - frontend/index.html
    - frontend/src/services/api.js
    - frontend/src/main.js
decisions:
  - sessionStorage used for session-scoped dismissal; server-side visto_em for cross-device/session persistence
  - ids=[0] shortcut marks all pending alerts for the session user — documented in route comments
  - textContent (not innerHTML) used for XSS-safe banner text rendering
metrics:
  duration_seconds: 125
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 5
---

# Phase 06 Plan 03: Fallback In-App e Preferências Summary

Fallback in-app alert banner with 60s polling, sessionStorage-based dismissal, and server-side mark-seen via GET /api/alertas/pendentes and POST /api/alertas/marcar-visto.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Backend — GET /api/alertas/pendentes + POST /api/alertas/marcar-visto + app.js mount | 49016e0 |
| 2 | Frontend — banner HTML, api.js methods, banner logic, polling, sessionStorage, close button | 6dc43af |

## What Was Built

### Backend (Task 1)

Created `backend/src/routes/alertas.js` with two authenticated endpoints:

- `GET /api/alertas/pendentes` — returns up to 20 unread alerts (`visto_em IS NULL`) for the session user, ordered by `enviado_em DESC`
- `POST /api/alertas/marcar-visto` — marks specified IDs as seen; accepts `ids=[0]` shortcut to mark all pending for the user; validates array non-empty (400 on empty); all queries scoped to `req.session.userId` preventing IDOR

Both routes protected by `requireAuth` middleware (401 without valid session). Router mounted at `/api/alertas` in `app.js` after `/api/push`.

### Frontend (Task 2)

- `frontend/index.html`: Added `#banner-alertas` div inside `#tab-calendario`, after `#banner-cal-desconectado` and before `#cal-nao-autenticado` (D-07 ordering)
- `frontend/src/services/api.js`: Added `api.alertas.pendentes()` and `api.alertas.marcarVisto(ids)` methods
- `frontend/src/main.js`:
  - `getAlertasFechadosNaSessao()` / `marcarFechadosNaSessao()` — sessionStorage helpers for session-scoped dismissal (D-06)
  - `atualizarBannerAlertas(alertas)` — filters dismissed alerts, builds score-labelled text via `textContent` (XSS-safe), shows/hides banner
  - `verificarAlertasPendentes()` — silent async poller; skips when `state.usuario` is null; ignores 401 errors
  - Close button listener: hides banner immediately, marks closed in sessionStorage + server
  - Wired into 60s `setInterval` (D-18)
  - Called after `carregarSessao()` resolves on page init (D-05)
  - Called when Calendário tab is opened (D-04)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| sessionStorage (not localStorage) for dismissal | Banner re-appears on new session if server-side visto_em still NULL — intentional per D-05 |
| ids=[0] marks all pending | Convenience shortcut for "dismiss all" UX; scoped to session user — no cross-user risk |
| textContent for banner text | XSS-safe; bairro/summary from DB not expected to contain HTML but textContent is defensive |
| LIMIT 20 on GET /pendentes | Caps response size if alerts accumulate; covers normal use case completely |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — banner wires directly to live `/api/alertas/pendentes` endpoint backed by `alertas_enviados` table populated by `checkAndSendAlerts` (Plan 02).

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. All `/api/alertas/*` routes require auth, queries are user-scoped, and banner text uses `textContent`.

## Self-Check

Checking created/modified files and commits exist.

## Self-Check: PASSED

- FOUND: backend/src/routes/alertas.js
- FOUND: backend/src/app.js
- FOUND: frontend/index.html
- FOUND: frontend/src/services/api.js
- FOUND: frontend/src/main.js
- FOUND commit: 49016e0 (Task 1)
- FOUND commit: 6dc43af (Task 2)
