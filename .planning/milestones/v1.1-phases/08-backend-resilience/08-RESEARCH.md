# Phase 8: Backend Resilience - Research

**Researched:** 2026-04-17
**Domain:** Node.js backend — exponential backoff retry, admin controller chain, frontend cleanup
**Confidence:** HIGH

## Summary

Phase 8 is a focused backend-only change across two independent concerns: (1) converting the
existing fixed-delay retry loop in `forecastService.fetchWithRetry()` to exponential backoff, and
(2) wiring `calcularRiscos()` + `checkAndSendAlerts()` into the `confirmar` and `recalcular`
controllers so that risk scores update immediately after CSV import or manual trigger.

All decisions were locked by the user in CONTEXT.md. The codebase is small, self-contained, and
follows a strict "services never throw" pattern. No new routes, no new tables, no new
dependencies. The entire implementation is surgical edits to three existing files plus a minor
frontend cleanup.

**Primary recommendation:** Follow the exact diff prescribed in the CONTEXT.md canonical refs.
The risk of regression is low because all services already handle errors internally and return
silently — the new call chains are additive, not structural.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Exponential Backoff (RESIL-02)
- **D-01:** Manter MAX_RETRIES=3 e base de 5s; mudar de delay fixo para exponencial: tentativa 1 → 5s, tentativa 2 → 10s, tentativa 3 → falha (serve stale cache). Sem jitter.
- **D-02:** Cache stale continua sendo servido durante todas as tentativas — fetchAndCacheForecasts() nunca faz throw (padrão já existente, manter).
- **D-03:** Em falha final, atualizar `forecasts_meta.status='error'` e `last_error` como já feito. Nenhuma mudança nessa parte.

#### Recalculate Trigger (RESIL-01)
- **D-04:** `POST /api/admin/confirmar` deve auto-acionar `calcularRiscos()` imediatamente após inserir as linhas — sem esperar o clique extra do admin. O endpoint retorna os stats de importação + confirmação de recálculo.
- **D-05:** A seção `admin-recalcular-section` e o botão `btn-admin-recalcular` no frontend podem ser removidos ou ocultados, já que o recálculo agora ocorre automaticamente no confirmar. O endpoint `POST /api/admin/recalcular` permanece disponível como ação standalone (útil fora do fluxo CSV).

#### Alerts After Manual Recalculate
- **D-06:** `POST /api/admin/recalcular` deve chamar `calcularRiscos()` seguido de `checkAndSendAlerts()` — consistente com o comportamento do scheduler (`5 */4 * * *`). Se novos dados CSV elevaram o risco, os alertas devem disparar imediatamente.
- **D-07:** O `confirmar` que agora auto-aciona recálculo: chamar também `checkAndSendAlerts()` após `calcularRiscos()`, pela mesma razão — importação de dados históricos pode alterar scores de risco que afetam usuários ativos.

### Claude's Discretion
- Tratamento de erro no auto-trigger dentro de `confirmar`: se `calcularRiscos()` falhar, a resposta ainda deve retornar `{inseridos: N, ...}` com sucesso — o recálculo é best-effort, não deve bloquear a confirmação da importação.
- Formato exato da resposta de `confirmar` com o campo de recálculo (ex: `{ inseridos, duplicatas_ignoradas, erros, recalculo: 'ok' | 'erro' }`).

### Deferred Ideas (OUT OF SCOPE)
- Banner de dados stale quando forecast > 120min desatualizado — Phase 9 (RESIL-03)
- Painel de status do sistema (forecast freshness, calendar sync, push ativo) — Phase 9 (UX-02)
- Jitter no backoff — descartado pelo usuário; "você decide" não foi selecionado
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESIL-01 | Admin pode acionar recálculo manual de risco imediatamente após importação CSV | D-04, D-06, D-07: wiring confirmar + recalcular controllers to call calcularRiscos() then checkAndSendAlerts() |
| RESIL-02 | Sistema retenta fetch Open-Meteo com backoff exponencial em caso de falha | D-01, D-02, D-03: change sleep(RETRY_DELAY_MS) to sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1)) in fetchWithRetry() |
</phase_requirements>

---

## Standard Stack

No new dependencies required. All libraries already present in the project.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Node.js built-in `fetch` | — | HTTP to Open-Meteo | Already used in forecastService.js [VERIFIED: codebase] |
| `better-sqlite3` (sync) | — | DB access in controllers | All DB calls are synchronous [VERIFIED: codebase] |
| `node-cron` | — | Scheduler (reference pattern) | Not modified in this phase [VERIFIED: codebase] |

**Installation:** None required. `[VERIFIED: codebase grep]`

---

## Architecture Patterns

### Established Project Pattern: "Services Never Throw"

Every service in this codebase (`forecastService`, `riskEngine`, `alertService`) catches its own
errors internally, logs them, and returns silently. This is the non-negotiable contract for
calling them from controllers and scheduler chains.

```javascript
// Source: backend/src/services/riskEngine.js (lines 43-148)
// calcularRiscos() — never throws; returns void on error
async function calcularRiscos() {
  // ... catches every DB error internally and returns
}

// Source: backend/src/services/alertService.js (lines 96-244)
// checkAndSendAlerts() — never throws; returns void on error
async function checkAndSendAlerts() {
  // ... catches every error internally and returns
}
```
[VERIFIED: codebase]

### Pattern 1: Exponential Backoff in fetchWithRetry()

**What:** Replace fixed `sleep(RETRY_DELAY_MS)` with `sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1))`.

**Current code (lines 41-61 of forecastService.js):**
```javascript
// Current: fixed delay
await sleep(RETRY_DELAY_MS); // always 5000ms

// Target: exponential
await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
// attempt=1: 5000 * 1 = 5s
// attempt=2: 5000 * 2 = 10s
// attempt=3: would be 20s, but MAX_RETRIES=3 means attempt=3 is last → no sleep, throw
```
[VERIFIED: codebase — current guard is `if (attempt < MAX_RETRIES)` so sleep only runs for attempt 1 and 2]

**Key observation about existing guard:** The existing `if (attempt < MAX_RETRIES)` guard means
sleep runs for attempts 1 and 2 only. With exponential backoff and no jitter:
- Attempt 1 fails → sleep 5s (5000 * 2^0 = 5000)
- Attempt 2 fails → sleep 10s (5000 * 2^1 = 10000)
- Attempt 3 fails → throws (no sleep; the loop ends and `throw lastErr` executes)

This produces the 5s → 10s → fail sequence specified in D-01. The single-line change is exact.

**Also update the log message** at line 55 to reflect the actual wait time (not the static RETRY_DELAY_MS value), so ops/debugging is accurate:
```javascript
// Before (always prints "5s"):
console.warn(`... Aguardando ${RETRY_DELAY_MS / 1000}s...`);

// After (prints actual wait):
const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
await sleep(waitMs);
console.warn(`... Aguardando ${waitMs / 1000}s...`);
```

### Pattern 2: Auto-trigger Chain in confirmar()

**What:** After the insertion loop, call `calcularRiscos()` then `checkAndSendAlerts()` in a
best-effort try/catch. The insertion result is always returned regardless of recalculation outcome.

**Current confirmar() ending (lines 254-255 of adminController.js):**
```javascript
    res.json({ inseridos, duplicatas_ignoradas, erros });
```

**Target confirmar() ending:**
```javascript
  // Auto-trigger best-effort (D-04, D-07)
  let recalculo = 'ok';
  try {
    await calcularRiscos();
    await checkAndSendAlerts();
  } catch (err) {
    console.error('[admin] Erro no recálculo automático pós-confirmar:', err.message);
    recalculo = 'erro';
  }

  res.json({ inseridos, duplicatas_ignoradas, erros, recalculo });
```
[ASSUMED — exact format is Claude's Discretion per CONTEXT.md, but this matches the suggested shape `{ inseridos, duplicatas_ignoradas, erros, recalculo: 'ok'|'erro' }`]

**Note: confirmar() must become async.** Currently it is a synchronous function (no `async`
keyword). Adding `await calcularRiscos()` requires changing `confirmar(req, res)` to
`async confirmar(req, res)`. [VERIFIED: codebase — line 206 shows sync function]

**Note: checkAndSendAlerts must be imported.** adminController.js currently only imports
`calcularRiscos` from riskEngine. It must also import `checkAndSendAlerts` from alertService.
[VERIFIED: codebase — line 3 of adminController.js shows current import]

### Pattern 3: Updated recalcular() to include checkAndSendAlerts()

**Current recalcular() (lines 262-270 of adminController.js):**
```javascript
async recalcular(req, res) {
  try {
    await calcularRiscos();
    res.json({ ok: true, mensagem: 'Risco recalculado com sucesso.' });
  } catch (err) {
    console.error('[admin] Erro ao recalcular riscos:', err.message);
    res.status(500).json({ erro: 'Erro ao recalcular riscos.' });
  }
},
```

**Target (D-06 — add checkAndSendAlerts after calcularRiscos):**
```javascript
async recalcular(req, res) {
  try {
    await calcularRiscos();
    await checkAndSendAlerts();
    res.json({ ok: true, mensagem: 'Risco recalculado com sucesso.' });
  } catch (err) {
    console.error('[admin] Erro ao recalcular riscos:', err.message);
    res.status(500).json({ erro: 'Erro ao recalcular riscos.' });
  }
},
```
[VERIFIED: codebase — existing structure, additive change only]

**Note on error handling difference:** Unlike `confirmar`, `recalcular` is an explicit admin action
with a dedicated response. If `checkAndSendAlerts()` throws (which it should never do per the
"services never throw" contract), the catch block will return 500. This is acceptable — the admin
is explicitly triggering the action and expects a clear success/failure signal. The services'
own internal guards make this case extremely unlikely.

### Pattern 4: Frontend Cleanup (D-05)

**Files to modify:**
- `frontend/index.html` — lines 209-212: remove the `<div id="admin-recalcular-section">` block
- `frontend/src/main.js` — line 973: remove `document.getElementById('admin-recalcular-section').style.display = 'block'`
- `frontend/src/main.js` — lines 984-1004: remove the entire `btn-admin-recalcular` event listener block
- `frontend/src/services/api.js` — line 97-99: optionally keep `admin.recalcular()` (endpoint still exists as standalone) or remove if no other caller

**Note on api.js:** The `api.admin.recalcular()` method should be KEPT in api.js even after the
button removal. The endpoint `POST /api/admin/recalcular` remains active per D-05 ("útil fora
do fluxo CSV"). Removing the method would cause a silent 404 if any future caller uses it.
[VERIFIED: codebase — D-05 explicitly preserves the endpoint]

### Reference Pattern: Scheduler Chain (confirmed working)

The scheduler at `backend/src/jobs/scheduler.js` (lines 37-42) already demonstrates the
correct chain:
```javascript
// Source: scheduler.js lines 37-42 [VERIFIED: codebase]
cron.schedule('5 */4 * * *', async () => {
  await calcularRiscos();
  await checkAndSendAlerts();
});
```
The `recalcular` and `confirmar` changes replicate this exact pattern.

### Anti-Patterns to Avoid

- **Making confirmar() throw on recalculation failure:** The insertion already succeeded; the
  admin imported N records. Throwing a 500 here would mislead the admin. Use best-effort
  try/catch and report in the response body (D-04, Claude's Discretion).

- **Forgetting to make confirmar async:** The function must be `async` to `await` the services.
  Calling `calcularRiscos().then(...)` as a detached promise is dangerous — unhandled rejections
  and the response may send before recalculation.

- **Using Math.pow(2, attempt) instead of Math.pow(2, attempt - 1):** With attempt starting at 1,
  this would produce 10s on the first retry instead of 5s. The base 5s for attempt 1 requires
  `Math.pow(2, attempt - 1)` = `Math.pow(2, 0)` = 1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential delay calculation | Custom timing logic | `RETRY_DELAY_MS * Math.pow(2, attempt - 1)` | One-liner, already correct with existing loop guard |
| Alert deduplication | New dedup logic | Existing `alertas_enviados` UNIQUE constraint in checkAndSendAlerts() | Already handles the case: same alert in same cycle will be silently ignored |
| Auth protection on recalcular | New middleware | Existing `requireAuth` already applied in admin.js line 26 | `[VERIFIED: codebase]` — no change needed |

---

## Common Pitfalls

### Pitfall 1: Forgetting async on confirmar()
**What goes wrong:** `await calcularRiscos()` inside a non-async function causes a SyntaxError at
startup.
**Why it happens:** confirmar() is currently synchronous (line 206 of adminController.js).
**How to avoid:** Add `async` keyword: `async confirmar(req, res) {`
**Warning signs:** Server fails to start with "await is not valid in non-async function".

### Pitfall 2: Stale import in adminController.js
**What goes wrong:** `checkAndSendAlerts()` is called but not imported — runtime
ReferenceError.
**Why it happens:** The current import block only imports `calcularRiscos` (line 3).
**How to avoid:** Add to the import: `const { checkAndSendAlerts } = require('../services/alertService');`
**Warning signs:** `ReferenceError: checkAndSendAlerts is not defined` on first trigger.

### Pitfall 3: Log message still shows fixed 5s
**What goes wrong:** Ops team sees "Aguardando 5s..." in logs even on the 10s retry — confusion
during incident triage.
**Why it happens:** The warn log uses `RETRY_DELAY_MS / 1000` (constant) not the computed
`waitMs / 1000`.
**How to avoid:** Compute `waitMs` first, pass it to both `sleep()` and the log message.
**Warning signs:** Log line on attempt 2 says "Aguardando 5s..." but actual wait is 10s.

### Pitfall 4: Removing api.admin.recalcular() from api.js
**What goes wrong:** Any future caller (or existing bookmark/curl habit) gets a confusing
client-side error.
**Why it happens:** Developer removes the JS method alongside the button.
**How to avoid:** Keep `api.admin.recalcular()` — only remove the HTML button and event listener.
D-05 explicitly says the endpoint stays.

### Pitfall 5: Double-counting the recalculation in tests
**What goes wrong:** Manual testing — admin confirms CSV import, sees "risco recalculado",
THEN also manually calls recalcular and wonders why the cycle key didn't change.
**Why it happens:** Both the auto-trigger in confirmar and the standalone recalcular call
calcularRiscos(), which writes a new `calculated_at`. The cycleKey in alertService uses
hour-granularity truncation — two calls in the same hour produce the same cycleKey, so
deduplication in alertas_enviados will correctly suppress double-alerts.
**How to avoid:** This is correct behavior, not a bug. Document in plan verification steps.

---

## Code Examples

### Verified: Current fetchWithRetry loop (lines 41-61, forecastService.js)
```javascript
// Source: backend/src/services/forecastService.js [VERIFIED: codebase]
async function fetchWithRetry() {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(OPEN_METEO_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`[forecast] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}. Aguardando ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);  // ← CHANGE THIS LINE
      }
    }
  }
  throw lastErr;
}
```

The single targeted change (with log fix):
```javascript
// Replace the two lines inside the `if (attempt < MAX_RETRIES)` block:
const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
console.warn(`[forecast] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}. Aguardando ${waitMs / 1000}s...`);
await sleep(waitMs);
```

### Verified: Scheduler reference chain (scheduler.js lines 37-42)
```javascript
// Source: backend/src/jobs/scheduler.js [VERIFIED: codebase]
cron.schedule('5 */4 * * *', async () => {
  await calcularRiscos();
  await checkAndSendAlerts();
});
```

### Verified: Current confirmar() response (adminController.js line 254)
```javascript
// Source: backend/src/controllers/adminController.js [VERIFIED: codebase]
res.json({ inseridos, duplicatas_ignoradas, erros });
// ↑ No recalculo field, synchronous function, no service calls after loop
```

### Verified: Frontend HTML block to remove (index.html lines 209-212)
```html
<!-- Source: frontend/index.html [VERIFIED: codebase] -->
<div id="admin-recalcular-section" style="display:none; margin-top:1rem">
  <button id="btn-admin-recalcular" class="btn-secondary">Recalcular Risco Agora</button>
  <span id="admin-recalcular-msg" class="form-msg" style="margin-left:.75rem"></span>
</div>
```

### Verified: Frontend JS lines to remove (main.js lines 973, 984-1004)
```javascript
// Source: frontend/src/main.js [VERIFIED: codebase]
// Line 973 — inside confirmar click handler, after el.style.display = 'block':
document.getElementById('admin-recalcular-section').style.display = 'block';

// Lines 984-1004 — entire standalone button listener:
document.getElementById('btn-admin-recalcular').addEventListener('click', async () => {
  // ... entire block
});
```

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely backend code edits and frontend HTML/JS cleanup.
No external tools, CLIs, databases, or services need to be installed.

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.
[VERIFIED: .planning/config.json line 19]

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `requireAuth` middleware already applied to all `/api/admin` routes [VERIFIED: backend/src/routes/admin.js line 20-26] |
| V5 Input Validation | no | No new inputs; existing validation in confirmar() unchanged |
| V6 Cryptography | no | — |

### Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated recalculate trigger | Elevation of Privilege | `requireAuth` already on `POST /api/admin/recalcular` (routes/admin.js line 26) — no change needed [VERIFIED: codebase] |
| DoS via rapid repeated recalculate calls | Denial of Service | Out of scope for Phase 8; calcularRiscos() is fast (150 in-memory scores + 1 DB transaction) — risk is low |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact response format for confirmar: `{ inseridos, duplicatas_ignoradas, erros, recalculo: 'ok'\|'erro' }` | Architecture Patterns / Pattern 2 | Frontend must be updated if a different field name is used — but since the button is being removed, only the field name in the JSON response matters for future callers |

---

## Open Questions

1. **Does the frontend `admin-resultado` display need to show the recalculo field?**
   - What we know: The HTML block currently renders `resultado.inseridos` and `resultado.duplicatas_ignoradas` (main.js lines 964-966). It does not render `resultado.erros.length` from the new field.
   - What's unclear: Whether to add a line like "✓ Risco recalculado automaticamente" or "⚠ Recálculo falhou" to the result display.
   - Recommendation: Add a conditional display line in the confirmar click handler — if `resultado.recalculo === 'ok'` show success, else show soft warning. This is a small additive change in the same HTML template block (main.js ~line 963-966). Planner should decide if this is in scope for Phase 8 or Phase 9 UX.

---

## Sources

### Primary (HIGH confidence)
- `backend/src/services/forecastService.js` — full source read; fetchWithRetry() and fetchAndCacheForecasts() verified
- `backend/src/controllers/adminController.js` — full source read; confirmar() and recalcular() verified
- `backend/src/routes/admin.js` — full source read; requireAuth coverage verified
- `backend/src/services/riskEngine.js` — full source read; calcularRiscos() contract verified
- `backend/src/services/alertService.js` — full source read; checkAndSendAlerts() contract verified
- `backend/src/jobs/scheduler.js` — full source read; reference chain pattern verified
- `frontend/src/main.js` — lines 930-1004 read; admin-recalcular-section and btn-admin-recalcular locations confirmed
- `frontend/index.html` — lines 205-212 read; HTML elements confirmed
- `frontend/src/services/api.js` — full source read; admin.recalcular() call shape confirmed
- `.planning/config.json` — nyquist_validation: false confirmed

### Secondary (MEDIUM confidence)
- None required — all findings are from direct codebase inspection.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing libraries verified in codebase
- Architecture: HIGH — all patterns verified from direct source code reads
- Pitfalls: HIGH — derived from actual code structure (async/sync mismatch, missing import are structural facts)

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable codebase, no fast-moving dependencies)
