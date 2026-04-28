# Phase 10: Onboarding Wizard - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Novo usuário que faz login pela primeira vez é guiado por um wizard modal de 3 passos e sai com calendar conectado e push ativo. O wizard persiste o estado de conclusão no banco de dados e nunca reaparece após ser completado ou pulado.

</domain>

<decisions>
## Implementation Decisions

### Flag de Onboarding (UX-04)
- **D-01:** Adicionar coluna `onboarding_done INTEGER DEFAULT 0` na tabela `usuarios` via migration segura (`ALTER TABLE ... ADD COLUMN`), seguindo o padrão já usado para `alert_threshold` e `alert_hours_before`.
- **D-02:** O endpoint `GET /api/sessao` deve retornar `onboarding_done` no objeto de usuário. O frontend lê esse campo após `carregarSessao()` para decidir se abre o wizard.
- **D-03:** O wizard é disparado em `carregarSessao()` quando `usuario.onboarding_done === 0` (ou `false`). Não usa heurística de `calendar_connected` para evitar falsos positivos.

### Apresentação Visual
- **D-04:** O wizard é um modal com backdrop: overlay escurece o fundo, wizard centralizado na tela. Nenhum modal existe no codebase — este será o primeiro. CSS e HTML novos necessários.
- **D-05:** Estrutura do modal: indicador de progresso "Passo X de 3" + conteúdo do passo + botões [Próximo / Concluir] e [Pular].

### Comportamento ao Pular / Concluir
- **D-06:** Pular = concluir. Ao clicar "Pular" em qualquer passo, o frontend grava `onboarding_done = 1` via PATCH no backend e fecha o modal. O wizard **nunca reaparece**, independentemente de o usuário ter conectado o calendar ou o push.
- **D-07:** Ao concluir o passo 3 normalmente, mesmo comportamento: `PATCH /api/usuarios/me` com `{ onboarding_done: 1 }` e fecha o modal.
- **D-08:** Não há botão "completar depois via configurações" — pular é definitivo.

### Passos do Wizard
- **D-09:** Passo 1 (Boas-vindas) — informativo, sem ação obrigatória. Apresenta o app brevemente. Botão "Próximo".
- **D-10:** Passo 2 (Calendar) — chama `api.conectarCalendario()` (`POST /api/calendar/connect`) direto no wizard, sem redirect OAuth. O `refresh_token_enc` já foi obtido no login Google. Feedback de sucesso inline antes de avançar.
- **D-11:** Passo 3 (Push) — reutiliza o fluxo de `btn-push-optin` existente. Feedback inline de sucesso/falha. Botão "Concluir" grava o flag.

### Claude's Discretion
- Texto e copy de cada passo do wizard
- Estilo visual do modal (cores, sombra, border-radius, tamanho)
- Indicador de progresso (dots, barra, "1 / 3")
- Comportamento ao fechar clicando fora do modal (pode tratar como "Pular" ou bloquear)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database
- `backend/src/config/database.js` — padrão de migration segura com `ALTER TABLE ... ADD COLUMN`; adicionar `onboarding_done` seguindo o mesmo padrão de `alert_threshold` (linha ~191) e `alert_hours_before` (linha ~198)

### Backend
- `backend/src/routes/auth.js` — endpoint `/api/sessao`; adicionar `onboarding_done` no objeto retornado
- `backend/src/routes/usuarios.js` (ou criar) — `PATCH /api/usuarios/me` para gravar `onboarding_done = 1`

### Frontend
- `frontend/src/main.js` — `carregarSessao()` (linha ~620); ponto de disparo do wizard após login
- `frontend/src/main.js` — `btn-push-optin` listener (linha ~814); reutilizar lógica de ativação de push no passo 3
- `frontend/src/main.js` — `btn-conectar-cal` listener (linha ~469); reutilizar lógica de connect calendar no passo 2
- `frontend/index.html` — estrutura de tabs e modais existente (referência de padrões HTML)
- `frontend/src/services/api.js` — adicionar `usuarios.setOnboardingDone()` aqui

### Requirements
- `.planning/REQUIREMENTS.md` — UX-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api.conectarCalendario()` — `POST /api/calendar/connect`; chamada direta sem redirect; reutilizar no passo 2 do wizard
- `btn-push-optin` flow (`pushManager.subscribe` → `api.push.subscribe`) — reutilizar no passo 3
- `verificarStatusPush()` — para confirmar estado do push após ativação no passo 3
- `formatarData()` — não relevante para wizard, mas padrão de módulo utilitário a seguir
- Migration pattern em `database.js` (linhas ~191–200) — modelo para adicionar `onboarding_done`

### Established Patterns
- Services nunca fazem throw — logam e retornam silenciosamente. Novo endpoint PATCH deve seguir o mesmo padrão.
- `requireAuth` middleware já protege rotas autenticadas — PATCH `/api/usuarios/me` deve usar.
- Abas autenticadas: `style.display = 'inline-block'` quando `usuario` presente — wizard segue lógica similar (mostrar se `onboarding_done === 0`).

### Integration Points
- `carregarSessao()` (main.js ~620) → após `state.usuario = usuario`, checar `onboarding_done` e chamar `abrirWizard()` se necessário
- `database.js` → adicionar migration de `onboarding_done` junto às migrações existentes
- `/api/sessao` → incluir `onboarding_done` no SELECT e na resposta JSON

</code_context>

<specifics>
## Specific Ideas

- Modal com backdrop é o primeiro modal do projeto — CSS deve ser genérico o suficiente para não quebrar o layout existente
- Passo 2 do wizard conecta o calendar diretamente via POST (sem OAuth redirect) porque o `refresh_token_enc` já foi obtido no login Google com `prompt: 'consent'`
- Pular é definitivo (`onboarding_done = 1`) — sem fluxo de "completar depois"

</specifics>

<deferred>
## Deferred Ideas

- Botão "Refazer onboarding" via página de configurações — descartado; pular é definitivo
- Wizard reaparece se calendar/push não configurados (heurística) — descartado em favor de flag explícito no DB

</deferred>

---

*Phase: 10-onboarding-wizard*
*Context gathered: 2026-04-24*
