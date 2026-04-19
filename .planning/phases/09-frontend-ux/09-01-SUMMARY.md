---
phase: 09-frontend-ux
plan: 01
subsystem: ui
tags: [vanilla-js, css, status-panel, ux, push-notifications, google-calendar, forecast]

# Dependency graph
requires:
  - phase: 08-backend-resilience
    provides: stale flag on /api/previsao/atual response used by forecast indicator
  - phase: 05-integracao-google-calendar
    provides: calendar_connected/calendar_disconnected fields on state.usuario
  - phase: 06-alertas-e-notificacoes-push
    provides: swRegistration with pushManager.getSubscription() for push indicator
provides:
  - Auth-gated Status tab with three read-only system health indicators
  - carregarStatus() function consulting live API, session state, and SW subscription
  - CSS card layout for .status-indicador components
affects:
  - 09-02 (alert lead time selector — same sidebar auth-gating pattern)
  - 09-03 (stale forecast banner — shares forecast stale detection)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Auth-gated tab: button hidden by default, shown/hidden in carregarSessao() alongside Admin
    - Lazy-load tab: carregarStatus() triggered only on tab click via dataset.tab check
    - Color-coded status dot: JS overwrites default --text-muted color with risco-verde/vermelho/amarelo

key-files:
  created: []
  modified:
    - frontend/index.html
    - frontend/src/main.js
    - frontend/src/styles/main.css

key-decisions:
  - "Status tab uses same auth-gating pattern as Admin tab (show/hide in carregarSessao)"
  - "Forecast indicator reads stale flag from api.previsao.atual() — no new endpoint needed"
  - "Calendar indicator reads from state.usuario already populated at session load — no extra fetch"
  - "Push indicator calls swRegistration.pushManager.getSubscription() in real-time on tab open"
  - "Panel is read-only — no action buttons per D-05"

patterns-established:
  - "Status dot coloring: green=#22c55e, red=#ef4444, yellow=#f59e0b, muted=#94a3b8"
  - "Tab lazy-load: add 'if (tab.dataset.tab === X) carregarX()' in the tab click forEach block"

requirements-completed:
  - UX-02

# Metrics
duration: 20min
completed: 2026-04-19
---

# Phase 09 Plan 01: Status Tab Summary

**Read-only system health panel with three color-coded indicators (forecast freshness, calendar connection, push subscription) visible only to authenticated users between Calendário and Admin tabs**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-19T00:00:00Z
- **Completed:** 2026-04-19T00:20:00Z
- **Tasks:** 3 (+ 1 checkpoint:human-verify pending)
- **Files modified:** 3

## Accomplishments
- Added #tab-btn-status button in correct position (after Calendário, before Admin) with display:none default
- Added #tab-status panel with three .status-indicador elements (forecast, calendar, push)
- Implemented carregarStatus() fetching live data from API, session state, and SW subscription
- Wired show/hide of tab-btn-status in carregarSessao() alongside existing Admin tab pattern
- Added lazy-load trigger in tab click handler
- Added CSS card layout with flex column, surface2 background, and colored dot support

## Task Commits

Each task was committed atomically:

1. **Task 1: HTML — Adicionar botão e painel da aba Status em index.html** - `859f30c` (feat)
2. **Task 2: JS — Implementar carregarStatus() e wiring de sessão/tabs em main.js** - `8643491` (feat)
3. **Task 3: CSS — Adicionar estilos para o painel Status em main.css** - `bd58a6e` (feat)

## Files Created/Modified
- `frontend/index.html` - Added #tab-btn-status button and #tab-status panel with three .status-indicador divs
- `frontend/src/main.js` - Added carregarStatus(), show/hide wiring in carregarSessao(), lazy-load in tab handler
- `frontend/src/styles/main.css` - Added .status-indicadores, .status-indicador, .status-dot, .status-info, .status-label, .status-detalhe

## Decisions Made
- Followed plan exactly: same auth-gating pattern as Admin, no action buttons, three fixed indicators
- Push indicator uses real-time getSubscription() call rather than cached state to avoid stale data (pitfall 4 from research)
- Calendar indicator reads calendar_connected/calendar_disconnected from state.usuario (already loaded) rather than making a new fetch (pitfall 7 from research)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all three indicators fetch real data:
- Forecast: `api.previsao.atual()` returns live stale flag
- Calendar: `state.usuario.calendar_connected` populated by session load
- Push: `swRegistration.pushManager.getSubscription()` is a live browser API call

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Status tab fully functional; human visual verification pending (checkpoint:human-verify)
- Plan 09-02 (alert lead time selector) can proceed in parallel — same auth-gating pattern established here
- Plan 09-03 (stale forecast banner) shares forecast stale detection logic with carregarStatus()

---
*Phase: 09-frontend-ux*
*Completed: 2026-04-19*
