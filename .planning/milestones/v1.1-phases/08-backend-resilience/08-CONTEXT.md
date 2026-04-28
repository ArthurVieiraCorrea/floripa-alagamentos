# Phase 8: Backend Resilience - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

O backend tolera falhas transitórias do Open-Meteo sem perder dados (RESIL-02) e permite ao admin sincronizar riscos imediatamente após importação CSV (RESIL-01). Sem UI nova — todo trabalho é backend/controller. Banner de dados stale (RESIL-03) é Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Exponential Backoff (RESIL-02)
- **D-01:** Manter MAX_RETRIES=3 e base de 5s; mudar de delay fixo para exponencial: tentativa 1 → 5s, tentativa 2 → 10s, tentativa 3 → falha (serve stale cache). Sem jitter.
- **D-02:** Cache stale continua sendo servido durante todas as tentativas — fetchAndCacheForecasts() nunca faz throw (padrão já existente, manter).
- **D-03:** Em falha final, atualizar `forecasts_meta.status='error'` e `last_error` como já feito. Nenhuma mudança nessa parte.

### Recalculate Trigger (RESIL-01)
- **D-04:** `POST /api/admin/confirmar` deve auto-acionar `calcularRiscos()` imediatamente após inserir as linhas — sem esperar o clique extra do admin. O endpoint retorna os stats de importação + confirmação de recálculo.
- **D-05:** A seção `admin-recalcular-section` e o botão `btn-admin-recalcular` no frontend podem ser removidos ou ocultados, já que o recálculo agora ocorre automaticamente no confirmar. O endpoint `POST /api/admin/recalcular` permanece disponível como ação standalone (útil fora do fluxo CSV).

### Alerts After Manual Recalculate
- **D-06:** `POST /api/admin/recalcular` deve chamar `calcularRiscos()` seguido de `checkAndSendAlerts()` — consistente com o comportamento do scheduler (`5 */4 * * *`). Se novos dados CSV elevaram o risco, os alertas devem disparar imediatamente.
- **D-07:** O `confirmar` que agora auto-aciona recálculo: chamar também `checkAndSendAlerts()` após `calcularRiscos()`, pela mesma razão — importação de dados históricos pode alterar scores de risco que afetam usuários ativos.

### Claude's Discretion
- Tratamento de erro no auto-trigger dentro de `confirmar`: se `calcularRiscos()` falhar, a resposta ainda deve retornar `{inseridos: N, ...}` com sucesso — o recálculo é best-effort, não deve bloquear a confirmação da importação.
- Formato exato da resposta de `confirmar` com o campo de recálculo (ex: `{ inseridos, duplicatas_ignoradas, erros, recalculo: 'ok' | 'erro' }`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend core
- `backend/src/services/forecastService.js` — fetchWithRetry(), fetchAndCacheForecasts(), constantes MAX_RETRIES e RETRY_DELAY_MS a modificar
- `backend/src/controllers/adminController.js` — confirmar() a modificar (auto-trigger), recalcular() a modificar (+ alertas)
- `backend/src/routes/admin.js` — rotas existentes; nenhuma nova rota esperada
- `backend/src/services/riskEngine.js` — calcularRiscos() chamado por recalcular e confirmar
- `backend/src/services/alertService.js` — checkAndSendAlerts() a ser chamada após recálculo

### Scheduler (padrão de referência)
- `backend/src/jobs/scheduler.js` — padrão de encadeamento calcularRiscos() → checkAndSendAlerts() que deve ser replicado no manual recalcular

### Requirements
- `.planning/REQUIREMENTS.md` — RESIL-01, RESIL-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchWithRetry()` em forecastService.js — já tem estrutura de loop com attempt counter; só precisa mudar o cálculo do delay de `RETRY_DELAY_MS` para `RETRY_DELAY_MS * Math.pow(2, attempt - 1)`
- `calcularRiscos()` — assíncrona, nunca faz throw (padrão seguro para chamar dentro de confirmar)
- `checkAndSendAlerts()` — assíncrona; já encadeada no scheduler após calcularRiscos()

### Established Patterns
- Services nunca fazem throw — logam e retornam silenciosamente. Confirmar deve seguir o mesmo padrão ao chamar calcularRiscos() (try/catch local, registrar erro na resposta sem bloquear).
- `requireAuth` middleware já protege todas as rotas de `/api/admin` — nenhuma mudança necessária.
- `admin-recalcular-section` / `btn-admin-recalcular` existem no frontend (main.js:973, 985) e podem ser removidos.

### Integration Points
- `adminController.confirmar()` → adicionar chamada a `calcularRiscos()` → `checkAndSendAlerts()` após loop de inserção
- `adminController.recalcular()` → adicionar chamada a `checkAndSendAlerts()` após `calcularRiscos()`
- `forecastService.fetchWithRetry()` → trocar `sleep(RETRY_DELAY_MS)` por `sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1))`

</code_context>

<specifics>
## Specific Ideas

- Backoff escolhido: 5s → 10s → 20s (base 5s, doubles a cada tentativa). Sem jitter.
- confirmar auto-trigger: best-effort — falha no recálculo não deve rejeitar a importação.
- Botão explícito `btn-admin-recalcular` pode ser removido; admin ainda pode chamar o endpoint standalone se necessário (ex: via curl ou painel futuro).

</specifics>

<deferred>
## Deferred Ideas

- Banner de dados stale quando forecast > 120min desatualizado — Phase 9 (RESIL-03)
- Painel de status do sistema (forecast freshness, calendar sync, push ativo) — Phase 9 (UX-02)
- Jitter no backoff — descartado pelo usuário; "você decide" não foi selecionado

</deferred>

---

*Phase: 08-backend-resilience*
*Context gathered: 2026-04-17*
