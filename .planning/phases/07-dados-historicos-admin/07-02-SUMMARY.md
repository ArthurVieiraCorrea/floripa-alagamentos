---
phase: 07-dados-historicos-admin
plan: 02
subsystem: admin-csv-import
tags: [audit, validation, xss, sql-injection, csv-parsing, frontend]
dependency_graph:
  requires: [07-01]
  provides: [HIST-02-verified, admin-frontend-committed]
  affects: [frontend/src/main.js, frontend/src/services/api.js, frontend/index.html, backend/src/app.js]
tech_stack:
  added: []
  patterns: [RFC-4180-csv-parsing, NFD-normalization, parameterized-sql, xss-escaping]
key_files:
  created: []
  modified:
    - backend/src/app.js
    - frontend/index.html
    - frontend/src/main.js
    - frontend/src/services/api.js
    - frontend/src/styles/main.css
decisions:
  - "All HIST-02 validation behaviors confirmed PASS without any code changes needed"
  - "XSS escaping confirmed in renderizarTabelaNovas (bairro, descricao) and renderizarTabelaDups (bairro)"
  - "SQL deduplication uses parameterized ? placeholders — no string interpolation found"
metrics:
  duration: 25min
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_modified: 5
---

# Phase 07 Plan 02: Admin Controller Audit and Frontend Commit Summary

**One-liner:** HIST-02 CSV validation/deduplication audit confirmed all PASS; admin frontend tab, preview UI, and api.admin client committed.

## What Was Done

### Task 1: Audit validarLinha and parseCsv against HIST-02 spec

Read `backend/src/controllers/adminController.js` and verified every HIST-02 behavior:

**CSV Parsing (parseCsv + splitCsvLine):**
- PASS: splitCsvLine handles RFC 4180 quoted fields — comma inside `"Centro da Cidade,SP"` not split
- PASS: Escaped quotes `""` within quoted fields preserved as single `"`
- PASS: CRLF, LF, CR all normalized to LF before split
- PASS: Empty lines filtered out (`filter(l => l.trim() !== '')`)
- PASS: Returns `{ erro }` when only header row present (lines.length < 2)

**Field Validation (validarLinha):**
- PASS: lat — `parseFloat` + bounds -90..90, NaN/missing → error
- PASS: lng — `parseFloat` + bounds -180..180, NaN/missing → error
- PASS: bairro — non-empty, `length >= 2` check
- PASS: nivel — NFD normalization strips diacritics before NIVEL_MAP lookup; `médio` → `medio`, `crítico` → `critico`
- PASS: data — `normalizarData` handles ISO 8601, DD/MM/YYYY, DD/MM/YYYY HH:MM:SS; returns null on invalid → error
- PASS: descricao — optional, returns null if absent

**Column Aliases (validarLinha):**
- PASS: `raw.latitude ?? raw.lat`
- PASS: `raw.longitude ?? raw.lng ?? raw.lon`
- PASS: `raw.data ?? raw.date ?? raw.data_ocorrencia`
- PASS: `raw.descricao ?? raw.description`

**Preview Flow (AdminController.preview):**
- PASS: Returns 400 for empty body
- PASS: Calls parseCsv → validarLinha → checarDuplicatas (only on valid rows)
- PASS: Response shape matches spec: `total_linhas, validas, duplicatas, erros, preview, duplicatas_detalhe, erros_detalhe`
- PASS: `validas` counts new (non-duplicate) rows only

### Task 2: Deduplication query audit and frontend files committed

**Deduplication Query (checarDuplicatas):**
- PASS: Uses `?` placeholders — `db.get('SELECT id FROM ocorrencias WHERE lower(bairro) = lower(?) AND nivel = ? AND date(criado_em) = date(?)', [bairro, nivel, datePart])`
- PASS: No string interpolation in SQL (`${` not found in query)
- PASS: `datePart = data.slice(0, 10)` — extracts YYYY-MM-DD to match `date(criado_em)` SQLite function
- PASS: `id_existente` set to found row's id; `duplicata: true` flag set
- PASS: `checarDuplicatas` only called on rows that passed `validarLinha`

**XSS Escaping (main.js):**
- PASS: `renderizarTabelaNovas` — `String(r.bairro).replace(/</g, '&lt;')` and `String(r.descricao).replace(/</g, '&lt;')`
- PASS: `renderizarTabelaDups` — `String(r.bairro).replace(/</g, '&lt;')`
- PASS: `renderizarTabelaErros` — only renders `r.linha` (integer) and `r.erros` (server-generated array) — no user content

**Frontend files applied and committed:**
- `backend/src/app.js`: Added `adminRouter` import and `app.use('/api/admin', adminRouter)`
- `frontend/index.html`: Added `#tab-btn-admin` (hidden by default) and full admin panel with preview/confirm UI
- `frontend/src/main.js`: Added admin section (renderizarTabelaNovas/Dups/Erros, preview/confirm click handlers, tab visibility in carregarSessao)
- `frontend/src/services/api.js`: Added `api.admin.preview` (Content-Type: text/plain) and `api.admin.confirmar` (JSON)
- `frontend/src/styles/main.css`: Added admin panel styles (.admin-formato, .admin-table, .admin-resumo, .admin-resultado)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | f384fb0 | feat(07-02): audit adminController HIST-02 spec — all validations PASS |
| 2 | 8dffd8b | feat(07): wire admin frontend tab, CSV preview UI, and api.admin client (HIST-01, HIST-02) |

## Deviations from Plan

None — plan executed exactly as written. All HIST-02 behaviors were already correctly implemented in `adminController.js`. No code fixes required. Frontend files applied from main working tree and committed in this worktree.

## Known Stubs

None. The admin preview and confirm flows are fully wired: CSV file → api.admin.preview → renderizarTabelaNovas/Dups/Erros → api.admin.confirmar.

## Threat Flags

No new threat surface introduced beyond what was documented in the plan's threat model (T-07-05 through T-07-08). XSS mitigations (T-07-07) confirmed present.

## Self-Check: PASSED

All modified files exist. Both task commits confirmed in git log.

| Check | Result |
|-------|--------|
| backend/src/app.js | FOUND |
| frontend/index.html | FOUND |
| frontend/src/main.js | FOUND |
| frontend/src/services/api.js | FOUND |
| frontend/src/styles/main.css | FOUND |
| .planning/phases/07-dados-historicos-admin/07-02-SUMMARY.md | FOUND |
| commit f384fb0 | FOUND |
| commit 8dffd8b | FOUND |
