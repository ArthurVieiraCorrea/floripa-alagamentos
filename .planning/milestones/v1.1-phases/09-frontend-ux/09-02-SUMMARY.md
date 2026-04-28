---
phase: 09-frontend-ux
plan: 02
subsystem: ui
tags: [vanilla-js, css, alertas-tab, ux, pagination, auth-gating]

# Dependency graph
requires:
  - phase: 06-alertas-e-notificacoes-push
    provides: alertas_enviados table with usuario_id, bairro, summary, enviado_em, visto_em
  - plan: 09-01
    provides: auth-gating pattern (show/hide in carregarSessao), tab lazy-load pattern
provides:
  - GET /api/alertas/historico with requireAuth, pagination, WHERE usuario_id
  - api.alertas.historico(pagina) in frontend service layer
  - Auth-gated Alertas tab with paginated card list
  - carregarHistoricoAlertas() and renderizarListaAlertas() functions
  - state.paginaAlertas independent from state.paginaAtual
affects:
  - 09-03 (stale forecast banner — no shared state, independent)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Paginated GET endpoint: COUNT(*) for total + LIMIT/OFFSET for page slice
    - Independent pagination state: paginaAlertas vs paginaAtual avoids collision
    - XSS prevention: .replace(/</g, '&lt;').replace(/>/g, '&gt;') on user-sourced fields before innerHTML
    - Auth-gated tab: same show/hide in carregarSessao() pattern as Admin and Status tabs

key-files:
  created: []
  modified:
    - backend/src/routes/alertas.js
    - frontend/src/services/api.js
    - frontend/index.html
    - frontend/src/main.js
    - frontend/src/styles/main.css

key-decisions:
  - "GET /historico returns ALL alertas (including visto_em IS NOT NULL) per D-08 — no visto_em filter"
  - "SELECT excludes score per D-09 — only id, bairro, summary, enviado_em returned"
  - "Empty state message: 'Você ainda não recebeu alertas.' per D-10"
  - "Pagination uses #paginacao-alertas and state.paginaAlertas to avoid collision with ocorrencias (D-11)"
  - "Tab resets paginaAlertas=1 on each open for consistent UX"

requirements-completed:
  - UX-03

# Metrics
duration: 15min
completed: 2026-04-20
---

# Phase 09 Plan 02: Alertas Tab Summary

**Endpoint GET /api/alertas/historico with requireAuth and pagination, plus auth-gated Alertas tab displaying paginated cards with bairro, date in pt-BR, and event summary**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-20T12:30:00Z
- **Completed:** 2026-04-20T12:46:04Z
- **Tasks:** 2 auto (+ 1 checkpoint:human-verify pending)
- **Files modified:** 5

## Accomplishments

- Added GET /api/alertas/historico with requireAuth, WHERE usuario_id = req.session.userId, LIMIT/OFFSET pagination, returns { alertas, paginacao: { pagina, paginas, total } }
- Added api.alertas.historico(pagina) to frontend service layer
- Added #tab-btn-alertas button in correct position (after Status, before Admin) with display:none default
- Added #tab-alertas panel with #lista-alertas and #paginacao-alertas
- Implemented carregarHistoricoAlertas() and renderizarListaAlertas() in main.js
- Added state.paginaAlertas (independent from state.paginaAtual) to prevent pagination collision
- Wired show/hide of tab-btn-alertas in carregarSessao() for auth-gating
- Added lazy-load trigger in tab click handler (resets to page 1 on each open)
- XSS prevention: bairro and summary escaped before innerHTML insertion
- Added CSS: .lista-alertas, .card-alerta, .card-top, .card-bairro, .card-data, .card-desc

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend — GET /api/alertas/historico** - `8d5adf7` (feat)
2. **Task 2: Frontend — api.js + HTML + main.js + CSS** - `539f57b` (feat)

## Files Created/Modified

- `backend/src/routes/alertas.js` - Added GET /historico route (33 lines) before module.exports
- `frontend/src/services/api.js` - Added historico(pagina) method to alertas object
- `frontend/index.html` - Added #tab-btn-alertas button and #tab-alertas panel with lista/paginacao
- `frontend/src/main.js` - Added paginaAlertas to state, carregarHistoricoAlertas(), renderizarListaAlertas(), show/hide wiring, tab handler
- `frontend/src/styles/main.css` - Added 6 CSS classes for Alertas tab cards

## Decisions Made

- Followed plan exactly: same auth-gating pattern as Admin and Status tabs
- GET /historico returns ALL alertas including those with visto_em set (D-08 explicitly states "incluindo os já vistos")
- SELECT omits score column per D-09
- Empty state message uses exact text from D-10
- state.paginaAlertas is completely independent from state.paginaAtual to avoid pitfall 1 from RESEARCH.md

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all data is fetched from real API:
- Cards render real bairro, enviado_em, and summary from alertas_enviados table
- Pagination reflects real COUNT(*) from database
- Empty state appears only when the authenticated user has zero alertas

## Threat Surface Scan

All threats from plan's threat_model were mitigated:
- T-09-02-01: requireAuth middleware on /historico — 401 without valid session
- T-09-02-02: WHERE usuario_id = req.session.userId — no cross-user data leakage
- T-09-02-03: parseInt + Math.max(1,...) on pagina param — never interpolated in SQL
- T-09-02-04: bairro and summary escaped with .replace() before innerHTML insertion

No new threat surface introduced beyond what was planned.

## Next Phase Readiness

- Alertas tab fully implemented; human visual verification pending (checkpoint:human-verify)
- Plan 09-03 (stale forecast banner) can proceed — shares no state with this plan

---
*Phase: 09-frontend-ux*
*Completed: 2026-04-20*
