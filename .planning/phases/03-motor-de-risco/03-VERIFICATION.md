---
phase: 03-motor-de-risco
verified: 2026-04-07T22:00:00Z
status: human_needed
score: 10/11 must-haves verified
re_verification: false
human_verification:
  - test: "Start the backend server and observe startup logs"
    expected: "Logs show '[riskEngine] 150 scores calculados e persistidos.' within seconds of server start"
    why_human: "Cannot start the server in this environment to verify the live scheduler IIFE actually fires and completes without error"
  - test: "GET /api/risco/bairros — before any scores are calculated (empty state)"
    expected: "HTTP 503 with JSON body { erro: '...', status: 'pending' }"
    why_human: "Requires running server and a clean DB state; cannot control DB state programmatically here"
  - test: "GET /api/risco/bairros?window=24 after scores are populated"
    expected: "HTTP 200 with window_hours=24 and scores array of exactly 50 objects"
    why_human: "Requires running server with forecasts and risk scores already populated"
  - test: "GET /api/risco/Centro?window=48"
    expected: "HTTP 200 with all D-08 fields: bairro, window_hours, score, nivel, precipitacao_prevista_mm, ocorrencias_historicas_count, insufficient_data (boolean), calculated_at"
    why_human: "Requires running server with populated risk_scores table"
  - test: "GET /api/risco/bairros?window=99"
    expected: "HTTP 400 with erro field"
    why_human: "Requires running server"
  - test: "GET /api/risco/BairroInexistenteXYZ"
    expected: "HTTP 404 with erro field"
    why_human: "Requires running server"
---

# Phase 03: Motor de Risco Verification Report

**Phase Goal:** O sistema calcula e persiste score de risco (0-100) para cada bairro a cada 4h. Bairros com histórico insuficiente exibem aviso "dados limitados". Scores são acessíveis via API.
**Verified:** 2026-04-07T22:00:00Z
**Status:** human_needed (automated checks passed; live endpoint behavior requires human testing)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tabela risk_scores existe no banco após inicialização | VERIFIED | `database.js` lines 88-111: `CREATE TABLE IF NOT EXISTS risk_scores` with all required columns, UNIQUE(bairro, window_hours), CHECK constraints |
| 2 | INSERT OR REPLACE funciona sem erro de constraint | VERIFIED | UNIQUE(bairro, window_hours) defined; riskEngine uses `INSERT OR REPLACE INTO risk_scores` (line 166) matching constraint semantics |
| 3 | Consulta por (bairro, window_hours) é eficiente via índice | VERIFIED | `idx_risk_scores_bairro_window ON risk_scores(bairro, window_hours)` and `idx_risk_scores_window ON risk_scores(window_hours)` both created in database.js lines 103-111 |
| 4 | calcularRiscos() insere exatamente 150 linhas (50 bairros x 3 janelas) | VERIFIED | BAIRROS_FLORIANOPOLIS has exactly 50 entries (49 from plan + 'Bela Vista' added as documented deviation); 50 × 3 = 150 rows per run |
| 5 | score_precip segue D-03: min(precip_mm / 80, 1.0) * 100 | VERIFIED | riskEngine.js line 139: `Math.min(precip / PRECIP_SATURATION, 1.0) * 100` where PRECIP_SATURATION=80 |
| 6 | score final usa pesos 0.6/0.4 (ou 0.9/0.1 quando count < 5) conforme D-04 | VERIFIED | Lines 145-147: `wP = insufficientData ? 0.9 : 0.6`, `wH = insufficientData ? 0.1 : 0.4` |
| 7 | insufficient_data=1 quando ocorrencias_count < 5 (RISCO-04) | VERIFIED | Line 133: `const insufficientData = count < INSUFFICIENT_THRESHOLD` where INSUFFICIENT_THRESHOLD=5; line 156: `insufficient_data: insufficientData ? 1 : 0` |
| 8 | nivel segue thresholds D-06: verde 0-25, amarelo 26-50, laranja 51-75, vermelho 76-100 | VERIFIED | categorizarNivel() lines 51-56: `<=25 verde`, `<=50 amarelo`, `<=75 laranja`, `>75 vermelho` — confirmed correct by logic trace |
| 9 | Erros de banco são logados sem throw externo | VERIFIED | Three try/catch blocks in calcularRiscos(): forecasts query (line 97-99), ocorrencias query (line 116-119), INSERT transaction (line 175-178) — all log and return, never rethrow |
| 10 | calcularRiscos() executa na startup antes do primeiro request (encadeado após fetchAndCacheForecasts) | VERIFIED (code) | scheduler.js lines 44-55: async IIFE `await fetchAndCacheForecasts()` then `await calcularRiscos()` inside initScheduler(); initScheduler() called at app.js line 87 before app.listen() at line 89 |
| 11 | Cron recalcula scores a cada 4h com offset de 5 minutos (5 */4 * * *) | VERIFIED | scheduler.js line 35: `cron.schedule('5 */4 * * *)` |
| 12 | GET /api/risco/bairros?window=24 retorna todos os 50 bairros com score | HUMAN NEEDED | Route logic correct (risco.js lines 27-59); DB query present; actual HTTP response requires running server |
| 13 | GET /api/risco/:bairro?window=24 retorna detalhe com todos os campos de D-08 | HUMAN NEEDED | Route logic correct (risco.js lines 73-104); fields selected: bairro, window_hours, score, nivel, precipitacao_prevista_mm, ocorrencias_historicas_count, insufficient_data, calculated_at |
| 14 | Ambos os endpoints retornam 503 quando risk_scores está vazio | HUMAN NEEDED | Code path correct (risco.js line 46-50: `if (rows.length === 0) return res.status(503).json(...)`) — requires live test |
| 15 | window inválido retorna 400 | HUMAN NEEDED | Code correct (risco.js lines 30-33, 76-79: `if (!VALID_WINDOWS.includes(window)) return res.status(400)`) — requires live test |
| 16 | Bairro não encontrado retorna 404 | HUMAN NEEDED | Code correct (risco.js lines 94-97: `if (!row) return res.status(404)`) — requires live test |

**Score:** 11/11 code-verifiable truths verified; 5 additional truths need live HTTP testing

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/config/database.js` | risk_scores table in initSchema() | VERIFIED | Lines 88-111: full table definition with UNIQUE, CHECK constraints, and two indexes |
| `backend/src/services/riskEngine.js` | Exports calcularRiscos() | VERIFIED | 184 lines; `module.exports = { calcularRiscos }` at line 184; substantive implementation throughout |
| `backend/src/routes/risco.js` | Express Router with GET /bairros and GET /:bairro | VERIFIED | 106 lines; `module.exports = router` at line 106; both routes implemented with full validation and error handling |
| `backend/src/jobs/scheduler.js` | Cron 5 */4 * * * + startup run of calcularRiscos | VERIFIED | 58 lines; cron at line 35; sequential IIFE startup at lines 44-55 |
| `backend/src/app.js` | Mount riscoRouter at /api/risco | VERIFIED | Line 61: `app.use('/api/risco', riscoRouter)` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| initSchema() | risk_scores | CREATE TABLE IF NOT EXISTS | VERIFIED | database.js line 88 |
| riskEngine.js | forecasts | COALESCE(SUM(precipitacao_mm)) | VERIFIED | riskEngine.js line 89: query present (plan pattern `SELECT.*SUM.*FROM forecasts` split across lines but substance matches) |
| riskEngine.js | ocorrencias | LOWER(TRIM(bairro)) GROUP BY | VERIFIED | riskEngine.js lines 113-115: query present |
| riskEngine.js | risk_scores | INSERT OR REPLACE in BEGIN/COMMIT | VERIFIED | riskEngine.js lines 162-174: `db.run('BEGIN')`, loop with `INSERT OR REPLACE INTO risk_scores`, `db.run('COMMIT')` |
| scheduler.js startScheduler() | riskEngine.calcularRiscos() | await in IIFE and cron | VERIFIED | scheduler.js: import at line 10, cron call at line 37, IIFE call at line 51 |
| app.js | routes/risco.js | app.use('/api/risco', riscoRouter) | VERIFIED | app.js line 61 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| risco.js /bairros | rows | `db.all('SELECT ... FROM risk_scores WHERE window_hours=?')` | Yes — queries risk_scores table populated by riskEngine | FLOWING |
| risco.js /:bairro | row | `db.get('SELECT ... FROM risk_scores WHERE bairro=? AND window_hours=?')` | Yes — queries risk_scores table | FLOWING |
| riskEngine.js | precipPorJanela | `db.get('SELECT COALESCE(SUM(precipitacao_mm)...) FROM forecasts')` | Yes — real DB query; warns if zero (cache pending) | FLOWING |
| riskEngine.js | historicoRows | `db.all('SELECT LOWER(TRIM(bairro)), COUNT(*) FROM ocorrencias GROUP BY ...')` | Yes — real DB query against ocorrencias table | FLOWING |

### Behavioral Spot-Checks

| Behavior | Verification Method | Result | Status |
|----------|---------------------|--------|--------|
| 50 bairros in BAIRROS_FLORIANOPOLIS | Manual count of array in riskEngine.js | 50 entries (49 original + 'Bela Vista') | PASS |
| 50 × 3 = 150 rows per run | Array length × WINDOW_HOURS.length | 150 | PASS |
| D-03 formula: min(40/80, 1)*100 = 50 | Logic trace | scoreP = 50.0 | PASS |
| D-04 weights: insufficient (count=3) → 0.9/0.1 | Logic trace | wP=0.9, wH=0.1 | PASS |
| D-04 weights: sufficient (count=7) → 0.6/0.4 | Logic trace | wP=0.6, wH=0.4 | PASS |
| D-06 thresholds: 25→verde, 26→amarelo, 50→amarelo, 51→laranja, 75→laranja, 76→vermelho | Logic trace | All correct | PASS |
| No fire-and-forget startup (old pattern removed) | Grep for .catch pattern | Not found in scheduler.js | PASS |
| Sequential IIFE: forecast before risk | Code read | await fetchAndCacheForecasts() then await calcularRiscos() in IIFE | PASS |
| GET /api/risco/bairros and /:bairro endpoints | Requires running server | — | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RISCO-01 | 03-01, 03-02, 03-03 | Score 0-100 por bairro cruzando precipitação × histórico | SATISFIED | calcularRiscos() implements full formula; persists to risk_scores; API exposes scores |
| RISCO-02 | 03-01, 03-02, 03-03 | Categorizar em 4 níveis de cor (Verde/Amarelo/Laranja/Vermelho) | SATISFIED | categorizarNivel() with D-06 thresholds; nivel field in risk_scores with CHECK constraint |
| RISCO-03 | 03-03 | Recalcular scores a cada 4h via scheduler | SATISFIED | cron.schedule('5 */4 * * *') in scheduler.js; startup run also present |
| RISCO-04 | 03-02, 03-03 | insufficient_data flag quando histórico < 5 ocorrências | SATISFIED | INSUFFICIENT_THRESHOLD=5; insufficientData flag set and persisted; exposed in API response as boolean |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODOs, FIXMEs, stubs, empty returns, or placeholders found | — | None |

### Human Verification Required

#### 1. Startup log confirmation

**Test:** Start the backend server (`npm start` or `node backend/src/app.js` with env vars set), observe stdout within 30 seconds.
**Expected:** Log line `[riskEngine] 150 scores calculados e persistidos.` appears.
**Why human:** Cannot start the server or observe live logs in this environment.

#### 2. GET /api/risco/bairros (populated state)

**Test:** After server starts and risk scores are calculated, run `curl -s "http://localhost:3001/api/risco/bairros?window=24"`.
**Expected:** HTTP 200, JSON with `window_hours: 24` and `scores` array of exactly 50 objects, each with fields: `bairro`, `score`, `nivel`, `precipitacao_prevista_mm`, `ocorrencias_historicas_count`, `insufficient_data` (boolean), `calculated_at`.
**Why human:** Requires running server with populated DB.

#### 3. GET /api/risco/:bairro (detail endpoint)

**Test:** `curl -s "http://localhost:3001/api/risco/Centro?window=48"`
**Expected:** HTTP 200, JSON object with all D-08 fields including `window_hours: 48`.
**Why human:** Requires running server with populated DB.

#### 4. 503 when risk_scores is empty

**Test:** On a fresh DB (or after manually clearing risk_scores), call `curl -v "http://localhost:3001/api/risco/bairros"` before the startup calculation completes.
**Expected:** HTTP 503 with `{ "erro": "...", "status": "pending" }`.
**Why human:** Race condition window is narrow; requires a clean DB state.

#### 5. 400 on invalid window

**Test:** `curl -v "http://localhost:3001/api/risco/bairros?window=99"`
**Expected:** HTTP 400 with `{ "erro": "Parâmetro window inválido. Use 24, 48 ou 72." }`.
**Why human:** Requires running server.

#### 6. 404 on unknown bairro

**Test:** `curl -v "http://localhost:3001/api/risco/BairroInexistenteXYZ"`
**Expected:** HTTP 404 with `{ "erro": "Bairro 'BairroInexistenteXYZ' não encontrado..." }`.
**Why human:** Requires running server.

### Gaps Summary

No structural gaps found. All code artifacts exist, are substantive, and are correctly wired. The phase goal is achieved at the code level:

- The risk_scores table schema is correct in database.js with proper constraints and indexes.
- riskEngine.js implements the full D-01 through D-06 specification with 50 bairros, correct formula weights, correct level thresholds, and a single atomic transaction for 150 rows.
- The scheduler correctly wires the cron (5 */4 * * *) and sequential startup IIFE.
- The API routes implement all required status codes (400, 404, 503) and response shapes.
- app.js mounts the riscoRouter at /api/risco.

The only items requiring human verification are live HTTP endpoint behaviors that cannot be tested without a running server with a populated database.

---

_Verified: 2026-04-07T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
