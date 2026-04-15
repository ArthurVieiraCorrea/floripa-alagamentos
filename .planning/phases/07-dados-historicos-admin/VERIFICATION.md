---
phase: 07-dados-historicos-admin
verified: 2026-04-15T19:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "End-to-end admin CSV import round-trip"
    expected: "Upload test CSV via admin tab → preview shows novas:2, duplicatas:0, erros:0 → confirm inserts 2 rows → GET /api/ocorrencias returns fonte=csv rows → SQLite shows criado_em=2020-03-15/2020-03-16 → second preview shows duplicatas:2"
    why_human: "Requires running browser with active Google OAuth session; cannot verify UI tab visibility, form interaction, or real authenticated HTTP flow programmatically"
  - test: "Admin tab hidden/visible based on auth state"
    expected: "#tab-btn-admin has display:none when logged out; becomes visible after successful OAuth login"
    why_human: "UI visibility change driven by JavaScript runtime (carregarSessao in main.js) — not verifiable by static analysis alone"
  - test: "Unauthenticated 401 gate"
    expected: "curl -X POST http://localhost:3001/api/admin/preview -H 'Content-Type: text/plain' -d 'lat,bairro' returns HTTP 401"
    why_human: "Requires running server with session middleware active"
---

# Phase 7: Dados Históricos (Admin) Verification Report

**Phase Goal:** Um administrador autenticado pode fazer upload de CSV com ocorrências históricas, o sistema valida e deduplica antes de inserir, e os dados ficam imediatamente disponíveis para o motor de risco.
**Verified:** 2026-04-15T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Checklist: Requested Verification Points

| # | Check | Result |
|---|-------|--------|
| 1 | All 3 plans have SUMMARY.md files | PASS |
| 2 | backend/src/routes/admin.js exists | PASS |
| 3 | backend/src/controllers/adminController.js exists | PASS |
| 4 | backend/src/models/ocorrencia.js exists | PASS |
| 5 | app.js mounts adminRouter at /api/admin | PASS |
| 6 | api.admin.preview exists in frontend/src/services/api.js | PASS |
| 7 | api.admin.confirmar exists in frontend/src/services/api.js | PASS |
| 8 | adminController exports preview function | PASS |
| 9 | adminController exports confirmar function | PASS |
| 10 | git log shows Phase 7 commits | PASS |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Admin route is mounted at /api/admin in app.js | VERIFIED | `app.use('/api/admin', adminRouter)` at line 77 of app.js; `adminRouter = require('./routes/admin')` at line 36 |
| 2 | POST /api/admin/preview and POST /api/admin/confirmar are protected by requireAuth | VERIFIED | admin.js lines 20-23: both routes have `requireAuth` as second argument before controller |
| 3 | api.admin.preview sends Content-Type: text/plain | VERIFIED | api.js lines 80-88: uses raw `fetch` with `'Content-Type': 'text/plain'` header |
| 4 | adminController exports both preview and confirmar functions | VERIFIED | adminController.js line 257: `module.exports = AdminController`; both methods present at lines 172 and 205 |
| 5 | confirmar inserts with fonte='csv' and historical criado_em | VERIFIED | adminController.js lines 242-245: `INSERT INTO ocorrencias ... VALUES (?, ?, ?, ?, ?, 'csv', ?, ?)` with `[..., data, data]` — historical date, not CURRENT_TIMESTAMP |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/routes/admin.js` | Route definitions for POST /preview and POST /confirmar | VERIFIED | 26 lines; exports router; requireAuth on both routes; csvText middleware on /preview; express.json() on /confirmar |
| `backend/src/controllers/adminController.js` | parseCsv, validarLinha, checarDuplicatas, preview, confirmar | VERIFIED | 257 lines; all functions present and substantive |
| `backend/src/models/ocorrencia.js` | ORM model for ocorrencias table | VERIFIED | 73 lines; full CRUD model with findAll, create, delete, findRecentes, estatisticas |
| `backend/src/app.js` | Mounts adminRouter at /api/admin | VERIFIED | Line 36 imports adminRouter; line 77 mounts it |
| `frontend/src/services/api.js` | api.admin.preview and api.admin.confirmar | VERIFIED | Lines 77-93; preview uses text/plain fetch; confirmar uses JSON request helper |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| frontend/src/services/api.js | /api/admin/preview | fetch with Content-Type: text/plain | WIRED | api.js line 80: `fetch('${BASE}/admin/preview', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: csvText })` |
| backend/src/app.js | backend/src/routes/admin.js | app.use('/api/admin', adminRouter) | WIRED | app.js line 36 import + line 77 mount |
| AdminController.preview | checarDuplicatas | called after validarLinha filter | WIRED | adminController.js line 185: `checarDuplicatas(validas)` |
| checarDuplicatas | ocorrencias table | db.get SELECT with parameterized query | WIRED | Lines 153-157: `SELECT id FROM ocorrencias WHERE lower(bairro) = lower(?) AND nivel = ? AND date(criado_em) = date(?)` with `[bairro, nivel, datePart]` |
| POST /api/admin/confirmar | ocorrencias table | db.run INSERT with fonte='csv', criado_em=data | WIRED | Lines 242-245: INSERT uses 'csv' literal and `data` (historical date) for both criado_em and atualizado_em |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| AdminController.preview | rows (from parseCsv) | req.body CSV text | Yes — parses real CSV body via splitCsvLine/parseCsv | FLOWING |
| AdminController.confirmar | linhas | req.body JSON | Yes — iterates linhas array from request, runs real db.get dedup check and db.run INSERT | FLOWING |
| checarDuplicatas | existe | db.get on ocorrencias | Yes — real SQLite query with parameterized WHERE clause | FLOWING |

---

## Behavioral Spot-Checks

Automated spot-checks require a running server with an active session (Google OAuth). Deferred to human verification.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| adminController module loads without errors | `node -e "require('./backend/src/controllers/adminController.js')"` | Not run (server env vars not available) | SKIP |
| admin router exports valid Express router | `node -e "require('./backend/src/routes/admin.js')"` | Verified via static analysis: exports `router` (Express.Router instance) | SKIP |
| confirmar function is exported | Static check | `typeof AdminController.confirmar === 'function'` — confirmed at line 205 and 257 | PASS (static) |
| preview function is exported | Static check | `typeof AdminController.preview === 'function'` — confirmed at line 172 and 257 | PASS (static) |

---

## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|---------|
| HIST-01 | 07-01 | Protected admin endpoints with requireAuth | SATISFIED | requireAuth on both routes in admin.js; api.admin.preview/confirmar wired in api.js |
| HIST-02 | 07-02 | CSV validation, dedup, NFD normalization, RFC 4180 parsing | SATISFIED | validarLinha, parseCsv, splitCsvLine, checarDuplicatas all present and substantive in adminController.js; NIVEL_MAP handles accented variants |
| HIST-03 | 07-03 | Rows inserted with fonte='csv' and historical criado_em; immediately queryable via GET /api/ocorrencias | SATISFIED (code) / NEEDS HUMAN (runtime) | INSERT statement verified; route mounted; runtime confirmation requires human smoke test |

Note: ROADMAP.md Coverage table (lines 183-185) still shows HIST-01/02/03 as "Pending" — this is a stale entry. The Phase Status table (line 148) correctly shows Phase 7 as "Complete 2026-04-15".

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, empty return stubs, or hardcoded empty data found in phase 7 artifacts. All handler functions have real implementations.

---

## Summary Files Check

| Plan | SUMMARY.md | Status |
|------|-----------|--------|
| 07-01 | 07-01-SUMMARY.md | FOUND — documents commit b8911e4 |
| 07-02 | 07-02-SUMMARY.md | FOUND — documents commits f384fb0 and 8dffd8b |
| 07-03 | 07-03-SUMMARY.md | FOUND — documents commit 42492b1 and human smoke test |

---

## Git Commits Verification

Phase 7 commits confirmed in git log:

| Commit | Message |
|--------|---------|
| b8911e4 | feat(07-01): add admin CSV import routes, controller, and frontend panel (HIST-01) |
| f384fb0 | feat(07-02): audit adminController HIST-02 spec — all validations PASS |
| 8dffd8b | feat(07): wire admin frontend tab, CSV preview UI, and api.admin client (HIST-01, HIST-02) |
| 42492b1 | chore(07-03): add plan file and audit AdminController.confirmar — all checks PASS |
| 692f710 | docs(07-03): complete ingest pipeline audit and smoke test summary |
| fb1d19e | docs(07-03): update STATE.md and ROADMAP.md — phase 07 complete |
| 21acc7f | chore: merge executor worktree (07-03) |

---

## Human Verification Required

### 1. End-to-End Admin CSV Import Round-Trip

**Test:** Start backend (`cd backend && node src/app.js`). Log in via browser. Click Admin tab. Upload a 2-row CSV. Click "Visualizar Prévia". Click "Confirmar Importação". Then run `curl http://localhost:3001/api/ocorrencias | grep fonte` and `sqlite3 data/alagamentos.db "SELECT bairro, fonte, criado_em FROM ocorrencias WHERE fonte='csv'"`.
**Expected:** Preview shows novas:2/duplicatas:0/erros:0. Confirmation reports inseridos:2. GET /api/ocorrencias returns rows with `"fonte":"csv"`. SQLite shows criado_em = historical dates (not today). Second preview pass shows duplicatas:2.
**Why human:** Requires running server with active Google OAuth session; UI interaction with file input and buttons cannot be verified programmatically.

### 2. Admin Tab Auth-Gated Visibility

**Test:** Open the frontend without being logged in and inspect #tab-btn-admin. Then log in with Google and observe the tab.
**Expected:** Tab is hidden (`display:none`) before login; becomes visible after successful authentication.
**Why human:** Tab visibility is controlled by `carregarSessao()` in main.js at runtime — static analysis confirms the code path exists but runtime behavior requires visual confirmation.

### 3. Unauthenticated 401 Gate

**Test:** `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/admin/preview -H "Content-Type: text/plain" -d "lat,bairro"`
**Expected:** HTTP 401
**Why human:** Requires running server; cannot execute without valid env vars (SESSION_SECRET, GOOGLE_CLIENT_ID, etc.).

---

## Gaps Summary

No gaps found. All five observable truths are verified, all required artifacts exist and are substantive and wired, all key links are confirmed, and all three SUMMARY.md files are present. Phase 7 goal is achieved at the code level.

Three items require human/runtime verification (server smoke test) — these are confirmation checks, not gaps. The 07-03 SUMMARY documents that the human smoke test was already performed and all 7 steps passed.

---

_Verified: 2026-04-15T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
