# Phase 9: Frontend UX - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

O usuário vê em tempo real se os dados são confiáveis (RESIL-03), controla a antecedência dos alertas (UX-01), consulta um painel de status do sistema (UX-02) e visualiza o histórico de alertas recebidos (UX-03).

Nota: RESIL-03 (stale banner) e UX-01 (seletor de antecedência) já estão implementados no código atual — Phase 9 verifica que funcionam e implementa UX-02 e UX-03.

</domain>

<decisions>
## Implementation Decisions

### RESIL-03: Stale Forecast Banner
- **D-01:** Banner já implementado — `#banner-stale-forecast` HTML existe, JS verifica `data.stale` no init (`api.previsao.atual()`), backend retorna `stale: staleMinutes > 120`. Apenas verificar que funciona como esperado. Sem código novo.

### UX-01: Seletor de Antecedência
- **D-02:** Seletor já implementado — `#sel-alert-hours` HTML existe (valores: 1, 2, 6, 12, 24, 48h), listener chama `api.push.setAlertHours()`, aparece quando push está ativo via `atualizarStatusPush('ativo', ...)`. Apenas verificar. Sem código novo.

### UX-02: Painel de Status
- **D-03:** Nova aba "Status" na sidebar, visível apenas para usuário autenticado (mesmo comportamento da aba Admin). Painel dedicado, não polui a aba Calendário.
- **D-04:** Conteúdo: três indicadores simples com ícones coloridos (● verde/vermelho/amarelo):
  - **Forecast:** Atualizado / Desatualizado — mostra idade em minutos quando stale. Lê de `api.previsao.atual()`.
  - **Calendário:** Conectado / Não conectado — derivado do estado `state.usuario` (campo `calendar_connected` ou equivalente).
  - **Push:** Ativo / Inativo — derivado do estado da subscription via `swRegistration.pushManager.getSubscription()`.
- **D-05:** Sem botões de ação inline no painel de status — apenas indicadores de leitura. O usuário acessa o Calendário para conectar/desconectar ou ativar push.
- **D-06:** Botão da aba "Status" exibido logo após o botão de aba "Calendário", antes de "Admin".

### UX-03: Histórico de Alertas
- **D-07:** Nova aba "Alertas" na sidebar, visível apenas para usuário autenticado.
- **D-08:** Novo endpoint de backend: `GET /api/alertas/historico` — retorna todos os alertas do usuário (incluindo os já vistos), 20 por página, ordenados por `enviado_em DESC`. Parâmetro de paginação: `?pagina=N`.
- **D-09:** Campos exibidos em cada card do histórico: `bairro`, `enviado_em` formatado em pt-BR, `summary` (nome do evento Google Calendar). Sem score de risco — manter limpo.
- **D-10:** Se não há alertas, exibir estado vazio: "Você ainda não recebeu alertas."
- **D-11:** Paginação simples igual ao padrão do histórico de ocorrências (`#paginacao` com botões numerados).

### Claude's Discretion
- Estilo visual dos indicadores de status (cores exatas, tamanho dos ícones ●)
- Formato exato de exibição da idade do forecast (ex: "há 2h30" vs. "há 150 min")
- Estrutura HTML/CSS da nova aba Status e dos cards do histórico de alertas

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend (referência de padrões)
- `frontend/src/main.js` — padrões existentes de tabs, state, verificarStatusPush, carregarCalendario, renderizarLista
- `frontend/index.html` — estrutura HTML das tabs, `#tab-btn-admin` como modelo para novos botões de aba autenticados
- `frontend/src/services/api.js` — padrões de chamadas de API; adicionar `alertas.historico()` aqui

### Backend (referência de implementação)
- `backend/src/routes/alertas.js` — endpoint `/pendentes` existente; novo `/historico` segue o mesmo padrão
- `backend/src/routes/previsao.js` — campo `stale` já retornado (linha 54); referência para o painel de status
- `backend/src/config/database.js` — schema de `alertas_enviados` (campos: bairro, score, summary, enviado_em, visto_em)

### Requirements
- `.planning/REQUIREMENTS.md` — RESIL-03, UX-01, UX-02, UX-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verificarStatusPush(threshold, hoursBefore)` — lógica de check de subscription; reusar no painel de status
- `api.previsao.atual()` — retorna `{ stale: boolean, ... }`; reusar no painel de status
- Padrão de tabs com `data-tab` e `tab-content active` — replicar para aba Status e aba Alertas
- `renderizarLista()` + paginação em `#paginacao` — modelo para lista de histórico de alertas
- `formatarData(str)` — formata datas para pt-BR; reusar nos cards do histórico

### Established Patterns
- Abas autenticadas: `document.getElementById('tab-btn-admin').style.display = 'inline-block'` quando `usuario` presente — replicar para "Status" e "Alertas"
- Services nunca fazem throw — logam e retornam silenciosamente. Novo endpoint `/historico` deve seguir o mesmo padrão.
- `requireAuth` middleware já protege rotas de alertas — novo endpoint usa o mesmo.

### Integration Points
- `carregarSessao()` → já exibe/oculta aba Admin; adicionar display de aba Status e aba Alertas aqui
- `state.usuario` — contém `alert_threshold` e `alert_hours_before`; verificar se contém info de `calendar_connected`
- `backend/src/routes/alertas.js` → adicionar rota GET `/historico` no mesmo arquivo

</code_context>

<specifics>
## Specific Ideas

- Painel de status deve ser leitura apenas (sem ações) — o usuário vai ao Calendário para agir.
- Histórico de alertas: manter limpo (bairro + horário + evento), sem score técnico.
- RESIL-03 e UX-01 apenas verificar — sem reescrever código que já funciona.

</specifics>

<deferred>
## Deferred Ideas

- Bot\u00f5es de a\u00e7\u00e3o inline no painel de status (conectar calendar, ativar push) — descartado pelo usuário; fica no tab Calendário
- Score de risco nos cards de histórico — descartado pelo usuário; manter limpo
- Onboarding wizard (UX-04) — Phase 10

</deferred>

---

*Phase: 09-frontend-ux*
*Context gathered: 2026-04-19*
