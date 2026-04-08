---
phase: 04-dashboard-de-previsao
plan: "01"
subsystem: frontend
tags: [geojson, choropleth, leaflet, risk-map, css]
dependency_graph:
  requires:
    - 03-03  # GET /api/risco/bairros endpoint
  provides:
    - bairros.geojson static asset
    - api.riscos() method
    - renderizarCamadaRisco() export
    - removerCamadaRisco() export
    - formatarPopupBairro() export
    - risk-level CSS custom properties
  affects:
    - frontend/src/main.js  # Plan 02 will wire these functions in
tech_stack:
  added:
    - mapshaper (one-time conversion tool, not added to package.json)
  patterns:
    - L.geoJSON with style() function for choropleth rendering
    - normalizarNomeLocal() for tolerant bairro name join (replicates backend riskEngine.js)
    - buildScoreMap() Map<normalizedName, scoreRow> for O(1) join lookups
    - Number() casting for XSS mitigation on numeric API fields in innerHTML
key_files:
  created:
    - frontend/public/bairros.geojson
    - frontend/src/services/mapa.js
    - frontend/src/styles/main.css
    - frontend/package.json
    - frontend/vite.config.js
    - frontend/package-lock.json
  modified:
    - frontend/src/services/api.js
decisions:
  - "Used normalizarNomeLocal() (not normalizarNome()) to avoid collision with potential future backend-name imports"
  - "Number() cast on score.score, precipitacao_prevista_mm, ocorrencias_historicas_count to mitigate T-04-02 XSS"
  - "&#x26A0; HTML entity for warning symbol instead of emoji to avoid encoding issues"
  - "87 bairros from IBGE vs ~50 in riskEngine list — IBGE splits compound bairros (Campeche into 4, Ingleses into 3)"
metrics:
  duration_seconds: 249
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
requirements:
  - DASH-01
  - DASH-03
---

# Phase 04 Plan 01: GeoJSON e Funções de Choropleth — Summary

**One-liner:** GeoJSON oficial IBGE para 87 bairros de Florianópolis + renderizarCamadaRisco/removerCamadaRisco/formatarPopupBairro com join tolerante a acentos e CSS custom properties de risco.

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Obtain and commit bairros.geojson from IBGE | 0d2e1e1 | frontend/public/bairros.geojson |
| 2 | Add api.riscos() and choropleth rendering functions | 20832fd | api.js, mapa.js (new), main.css (new), package.json, vite.config.js |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notable Implementation Notes

**GeoJSON audit — name divergences (expected, acceptable):**

| riskEngine.js name | IBGE GeoJSON | Notes |
|--------------------|-------------|-------|
| Ingleses | Ingleses Centro / Norte / Sul | IBGE splits; all 3 appear gray if no score |
| Lagoa da Conceição | Lagoa | IBGE uses shorter name; join fails via normalizarNome |
| São João do Rio Vermelho | (absent) | Not in IBGE 2022 shapefile for Florianópolis |
| Campeche | Campeche Central / Leste / Norte / Sul | IBGE splits; all 4 appear gray if no score |
| Rio Tavares | Rio Tavares Central / do Norte | IBGE splits |
| Serrinha | (absent) | Not in IBGE 2022 shapefile |
| Santo Antônio de Lisboa | Santo Antônio | Normalized join would partially work; "santo antonio de lisboa" != "santo antonio" |
| Bela Vista | (absent) | Not in IBGE 2022 shapefile |

These 8 bairros from the risk engine's list will render as gray (#cbd5e1) when their score exists but cannot be joined. This is documented behavior per research (acceptable).

**T-04-02 Threat Mitigation Applied:**
Numeric values (`score`, `precipitacao_prevista_mm`, `ocorrencias_historicas_count`) cast with `Number()` before embedding in innerHTML, per the threat register disposition `mitigate`.

---

## Known Stubs

None — all functions are fully implemented. `bairros.geojson` is real IBGE data (not placeholder). The choropleth functions are ready for wiring in Plan 02.

---

## Threat Flags

None — no new network endpoints or auth paths introduced. Static file served by Vite (T-04-04 accepted). GeoJSON content is controlled IBGE data (T-04-01 accepted).

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| frontend/public/bairros.geojson exists | FOUND |
| frontend/src/services/mapa.js exists | FOUND |
| frontend/src/styles/main.css exists | FOUND |
| frontend/src/services/api.js exists | FOUND |
| commit 0d2e1e1 exists | FOUND |
| commit 20832fd exists | FOUND |
