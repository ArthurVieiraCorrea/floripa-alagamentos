---
phase: 04-dashboard-de-previsao
plan: "03"
subsystem: frontend
tags: [leaflet, choropleth, controls, main.js, dashboard-wiring]
dependency_graph:
  requires:
    - 04-01  # renderizarCamadaRisco, removerCamadaRisco, api.riscos()
    - 04-02  # criarControleToggle, criarControleSeletor
  provides:
    - complete dashboard wiring in main.js
    - carregarCamadaRisco() — choropleth loader with 503 handling and D-08 timestamp
  affects:
    - frontend/src/main.js  # full dashboard integration complete
tech_stack:
  added: []
  patterns:
    - Promise.all for parallel GeoJSON cache + API fetch
    - let atualizarTimestamp assigned after control init (closure pattern)
    - modoAtivo guard in setInterval (conditional refresh)
    - 503 cold-start handling with grey choropleth fallback
key_files:
  created: []
  modified:
    - frontend/src/main.js
decisions:
  - "carregarMapa() NOT called at startup — D-03/D-04 compliance; only called in toggle callback and setInterval else branch"
  - "atualizarTimestamp declared as let before carregarCamadaRisco() and assigned after seletor init — order ensures closure works correctly"
  - "503 catch fetches GeoJSON separately if not cached — handles cold-start where Promise.all may have failed on scores side"
  - "GeoJSON cached in state.geojsonBairros after first fetch — subsequent calls use Promise.resolve() bypass"
metrics:
  duration_seconds: 180
  completed_date: "2026-04-07"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 1
requirements:
  - DASH-01
  - DASH-02
  - DASH-03
  - DASH-04
---

# Phase 04 Plan 03: Wire Dashboard in main.js — Summary

**One-liner:** main.js wired with state extensions, carregarCamadaRisco() (Promise.all + 503 cold-start), toggle/horizon controls, and conditional 60s auto-refresh completing DASH-01 through DASH-04.

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Wire state, controls, and choropleth loading in main.js | 4f33da5 | frontend/src/main.js |

---

## What Was Done

- Extended `state` with `camadaRisco`, `modoAtivo`, `horizonteAtivo`, `geojsonBairros`
- Added imports for `renderizarCamadaRisco`, `removerCamadaRisco`, `criarControleToggle`, `criarControleSeletor`
- Implemented `carregarCamadaRisco()` with:
  - `Promise.all` to fetch GeoJSON (cached) and risk scores in parallel
  - GeoJSON caching in `state.geojsonBairros` — single fetch across the session
  - D-08 timestamp update from `calculated_at` field of first score row
  - 503 cold-start path: fetches GeoJSON separately if needed, renders all-grey bairros, shows 'Calculando...'
  - Generic error path: shows error text in timestamp row, logs to console
- Initialized toggle control with `onModoChange`: switches `state.modoAtivo`, removes one layer type before showing the other (D-04 exclusivity)
- Initialized horizon selector with `onHorizonteChange`: updates `state.horizonteAtivo`, triggers `carregarCamadaRisco()` if in risco mode (D-06)
- Exposed `seletor.atualizarTimestamp` by assigning to `atualizarTimestamp` let variable after control init
- Updated startup: `carregarCamadaRisco()` called instead of `carregarMapa()` (D-03 — default mode is risco)
- Updated `setInterval`: conditionally calls `carregarCamadaRisco()` or `carregarMapa()` based on `state.modoAtivo`

## Decisions Applied

- **D-03:** Default mode is 'risco' — choropleth visible at startup, markers hidden
- **D-04:** Mode exclusivity enforced — toggle callback removes one layer before showing the other
- **D-05/D-06:** Horizon selector re-fetches scores on change, re-renders without page reload
- **D-08:** Timestamp updated from `calculated_at` field; shows 'Calculando...' on 503 or missing data

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all functions are fully wired. The dashboard is complete: choropleth renders on load, toggle switches modes, horizon selector re-fetches scores, auto-refresh runs every 60s.

---

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The only new fetch is `GET /bairros.geojson` (static file served by Vite, T-04-04 accepted in Plan 01).

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| grep -c "carregarCamadaRisco" returns >= 3 | FOUND (6) |
| grep -c "renderizarCamadaRisco\|removerCamadaRisco" returns >= 1 | FOUND (4) |
| grep -c "criarControleToggle\|criarControleSeletor" returns >= 2 | FOUND (4) |
| grep -c "modoAtivo" returns >= 3 | FOUND (4) |
| grep -c "geojsonBairros" returns >= 2 | FOUND (8) |
| carregarMapa NOT in startup init block | CONFIRMED |
| npm run build exits 0 | PASSED |
| commit 4f33da5 exists | FOUND |
