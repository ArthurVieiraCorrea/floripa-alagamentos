# Phase 10: Onboarding Wizard - Research

**Researched:** 2026-04-27
**Domain:** Vanilla JS modal wizard, SQLite migration, Express PATCH endpoint
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Adicionar coluna `onboarding_done INTEGER DEFAULT 0` na tabela `usuarios` via migration segura (`ALTER TABLE ... ADD COLUMN`), seguindo o padrão já usado para `alert_threshold` e `alert_hours_before`.

**D-02:** O endpoint `GET /api/sessao` (implementado em `/api/auth/me`) deve retornar `onboarding_done` no objeto de usuário. O frontend lê esse campo após `carregarSessao()` para decidir se abre o wizard.

**D-03:** O wizard é disparado em `carregarSessao()` quando `usuario.onboarding_done === 0` (ou falsy). Não usa heurística de `calendar_connected`.

**D-04:** O wizard é um modal com backdrop — o primeiro modal do projeto. CSS e HTML novos necessários.

**D-05:** Estrutura do modal: indicador de progresso "Passo X de 3" + conteúdo do passo + botões [Próximo / Concluir] e [Pular].

**D-06:** Pular = concluir. Ao clicar "Pular", o frontend grava `onboarding_done = 1` via `PATCH /api/usuarios/me` e fecha o modal. Wizard nunca reaparece.

**D-07:** Ao concluir o passo 3 normalmente: mesmo `PATCH /api/usuarios/me { onboarding_done: 1 }` e fecha o modal.

**D-08:** Não há botão "completar depois via configurações" — pular é definitivo.

**D-09:** Passo 1 — informativo, sem ação obrigatória. Botão "Próximo".

**D-10:** Passo 2 — chama `api.conectarCalendario()` diretamente no wizard. `refresh_token_enc` já existe. Feedback inline. Avançar não exige ter conectado.

**D-11:** Passo 3 — reutiliza o fluxo de `btn-push-optin`. Feedback inline. Botão "Concluir" grava o flag.

### Claude's Discretion

- Texto e copy de cada passo do wizard (definido em UI-SPEC)
- Estilo visual do modal (definido em UI-SPEC)
- Indicador de progresso (definido em UI-SPEC: dots + texto "Passo X de 3")
- Comportamento ao fechar clicando fora (definido em UI-SPEC: shake animation, não fecha)

### Deferred Ideas (OUT OF SCOPE)

- Botão "Refazer onboarding" via página de configurações
- Wizard reaparece se calendar/push não configurados (heurística)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-04 | Usuário novo é guiado por wizard de 3 passos (login → calendar → push) no primeiro acesso | Migration DB + endpoint PATCH + lógica JS de modal cobrem este requisito completamente |

</phase_requirements>

---

## Summary

Esta fase implementa um wizard modal de 3 passos para onboarding de novos usuários. O trabalho se divide em três camadas: (1) backend — migration DB + novo endpoint PATCH `/api/usuarios/me` + exposição do campo `onboarding_done` em `/api/auth/me`; (2) frontend JS — funções `abrirWizard()` / `fecharWizard()` / lógica de passos integrada no `carregarSessao()` existente; (3) CSS — o primeiro modal do projeto, usando exclusivamente custom properties já declaradas em `main.css`.

O codebase foi inspecionado linha a linha. Todos os pontos de integração foram localizados com precisão: o padrão de migration em `database.js` (linhas 191–203), o endpoint `/api/auth/me` em `auth.js` (linha 117), o `carregarSessao()` em `main.js` (linha 619), o `btn-push-optin` listener (linha 814), a função `api.conectarCalendario()` em `api.js` (linha 46), e o `requireAuth` middleware. O arquivo `backend/src/routes/usuarios.js` **não existe** — precisa ser criado e montado em `app.js`.

**Recomendação principal:** Seguir exatamente os padrões já estabelecidos no codebase. Migration via try/catch, PATCH endpoint idêntico ao `/api/push/threshold`, modal injetado por JS no DOM (não hardcoded em HTML), lógica de push extraída do listener `btn-push-optin` para função reutilizável.

---

## Standard Stack

### Core

| Componente | Versão | Propósito | Padrão no projeto |
|------------|--------|-----------|-------------------|
| Vanilla JS (ES modules) | nativo | Toda a lógica do frontend | `frontend/src/main.js`, sem frameworks |
| Node.js + Express | existente | Backend routes | `backend/src/routes/*.js` |
| node-sqlite3-wasm | existente | Banco de dados | `backend/src/config/database.js` |
| CSS custom properties | nativo | Estilos do modal | Todas as cores já declaradas em `main.css` |

### Sem dependências novas

Esta fase não requer instalação de nenhuma biblioteca. Todo o trabalho usa APIs e bibliotecas já presentes no projeto.

**Instalação:** nenhuma.

---

## Architecture Patterns

### Padrão de Migration Segura (database.js linhas 191–203)

```javascript
// VERIFIED: leitura direta de database.js linhas 191-203
// Adicionar logo após o bloco de alert_hours_before (linha 203)
try {
  db.run(`ALTER TABLE usuarios ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0`);
} catch (_) {
  // Coluna já existe — ignorar silenciosamente
}
```

Exatamente o mesmo padrão do `alert_threshold` (linha 192) e `alert_hours_before` (linha 199). O `try/catch` silencioso é o padrão estabelecido para migrations seguras em SQLite com `node-sqlite3-wasm`.

### Padrão de Endpoint PATCH (baseado em push.js linhas 60–80)

```javascript
// VERIFIED: baseado em push.js linhas 63-80 (padrão já existente)
router.patch('/me', requireAuth, (req, res) => {
  const { onboarding_done } = req.body;
  if (onboarding_done !== 1) {
    return res.status(400).json({ erro: 'onboarding_done deve ser 1' });
  }
  const db = getDb();
  try {
    db.run(
      `UPDATE usuarios SET onboarding_done = 1, atualizado_em = datetime('now') WHERE id = ?`,
      [req.session.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[usuarios] Erro ao atualizar onboarding_done:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});
```

### Padrão de Exposição em /api/auth/me (auth.js linha 117)

```javascript
// VERIFIED: auth.js linhas 114-130
// SELECT atual:
`SELECT calendar_connected, calendar_disconnected, alert_threshold, alert_hours_before FROM usuarios WHERE id = ?`
// Deve ser expandido para:
`SELECT calendar_connected, calendar_disconnected, alert_threshold, alert_hours_before, onboarding_done FROM usuarios WHERE id = ?`

// Resposta JSON — adicionar:
onboarding_done: usuario?.onboarding_done ?? 0,
```

### Padrão de Disparo do Wizard em carregarSessao() (main.js linha 619)

```javascript
// VERIFIED: carregarSessao() em main.js linha 619
// Ponto de inserção: após a linha 635 (state.usuario = usuario) e ANTES de carregarCalendario()
if (usuario) {
  state.usuario = usuario;
  // ... setup de UI existente ...
  if (usuario.onboarding_done === 0) {
    abrirWizard(); // nova função
  }
  await carregarCalendario(usuario);
}
```

O wizard deve ser disparado antes de `carregarCalendario()` para que o modal apareça antes de qualquer conteúdo da aba calendário ser carregado.

### Padrão de Modal — Injeção por JS (não hardcoded em HTML)

O `index.html` não tem nenhum modal hardcoded. O padrão existente para elementos dinâmicos é criar via `document.createElement` ou `innerHTML`. O backdrop+modal deve ser injetado por `abrirWizard()` e removido por `fecharWizard()`.

```javascript
// ASSUMED — padrão recomendado para este projeto (sem React, sem templates)
function abrirWizard() {
  const backdrop = document.createElement('div');
  backdrop.id = 'wizard-backdrop';
  backdrop.innerHTML = `
    <div id="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabindex="-1">
      <!-- estrutura completa conforme UI-SPEC -->
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById('wizard-modal').focus();
  // instalar listeners de shake, pular, próximo, ações de cada passo
}

function fecharWizard() {
  document.getElementById('wizard-backdrop')?.remove();
}
```

### Fluxo de Push no Passo 3 — Extrair Lógica Existente

O listener `btn-push-optin` (main.js linhas 814–866) contém toda a lógica de ativação push. Para reutilizar no passo 3 sem duplicar código:

```javascript
// VERIFIED: lógica em main.js linhas 814-866
// A lógica completa é:
// 1. Verificar suporte (Notification, serviceWorker)
// 2. Notification.requestPermission()
// 3. navigator.serviceWorker.ready
// 4. api.push.getVapidPublicKey()
// 5. swRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
// 6. api.push.subscribe(subscription.toJSON())
// A variável `swRegistration` é de módulo (linha 22) — acessível dentro de abrirWizard()
```

A forma mais segura de reutilizar: extrair a lógica em uma função `ativarPushNotificacoes(feedbackEl, btnEl)` que recebe os elementos DOM de feedback/botão. O listener original do `btn-push-optin` passa seus próprios elementos; o wizard passa os elementos do passo 3.

### Fluxo de Calendar no Passo 2

```javascript
// VERIFIED: api.conectarCalendario() em api.js linha 46
// Assinatura: api.conectarCalendario() → POST /api/calendar/connect → retorna void ou lança
// Nenhum parâmetro. Sem redirect OAuth — usa refresh_token_enc já armazenado.
// Em caso de erro, a API lança com err.message

// Listener existente em main.js linha 469 usa o padrão:
btn.disabled = true;
btn.textContent = 'Conectando...';
try {
  await api.conectarCalendario();
  // sucesso
} catch (err) {
  // feedback de erro
  btn.disabled = false;
  btn.textContent = 'Conectar Calendário';
}
```

No wizard o padrão é idêntico, mas o feedback vai para `.wizard-feedback` em vez de `#cal-connect-msg`, e o wizard não chama `carregarSessao()` após conectar (evita fechar o modal).

### Padrão de api.js — Adicionar Método

```javascript
// VERIFIED: api.js — adicionar dentro do objeto `api` exportado
usuarios: {
  setOnboardingDone: () =>
    request('/usuarios/me', { method: 'PATCH', body: JSON.stringify({ onboarding_done: 1 }) }),
},
```

### Montagem do Router em app.js

```javascript
// VERIFIED: app.js — padrão de montagem existente (linhas analisadas)
// Adicionar após os routers existentes:
const usuariosRouter = require('./routes/usuarios');
// ...
app.use('/api/usuarios', usuariosRouter);
```

### Acessibilidade — Focus Trap Manual

O projeto não tem nenhum utilitário de focus trap existente. A UI-SPEC define que Tab/Shift+Tab devem circular apenas entre os elementos focáveis do modal. Implementação mínima:

```javascript
// ASSUMED — padrão minimal para focus trap sem biblioteca
wizardModal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return; // Escape não fecha (conforme UI-SPEC)
  if (e.key !== 'Tab') return;

  const focusable = [...wizardModal.querySelectorAll(
    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
```

### Shake Animation — Clicar Fora do Modal

```javascript
// ASSUMED — padrão baseado na UI-SPEC
backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) { // clique no backdrop, não no modal
    const modal = document.getElementById('wizard-modal');
    modal.classList.add('shaking');
    modal.addEventListener('animationend', () => modal.classList.remove('shaking'), { once: true });
  }
});
```

### Anti-Padrões a Evitar

- **Não chamar `carregarSessao()` dentro do wizard após conectar calendar (passo 2):** isso fecharia o modal. Em vez disso, atualizar apenas o feedback inline e o `state.usuario.calendar_connected` localmente se necessário.
- **Não colocar o HTML do modal em `index.html`:** o modal é criado e destruído por JS para evitar que fique no DOM quando não necessário.
- **Não usar `throw` em services:** o padrão do projeto é logar e retornar silenciosamente; o novo endpoint PATCH deve seguir o mesmo padrão de error handling de `push.js`.
- **Não esquecer de remover o backdrop do DOM ao fechar:** `fecharWizard()` deve fazer `document.getElementById('wizard-backdrop')?.remove()`, não apenas `display: none`.

---

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|--------------|------|---------|
| Push subscription | Lógica própria de VAPID | Lógica existente em `btn-push-optin` (main.js:814) | Já trata todos os edge cases: suporte, permissão, VAPID key |
| Calendar connect | Nova chamada de API | `api.conectarCalendario()` (api.js:46) | Já implementado e testado |
| Feedback de erro/sucesso | Classes CSS novas | `.form-msg.success` / `.form-msg.error` (main.css:134-136) | Reutilizar estilos existentes em `.wizard-feedback` |
| Auth check no endpoint | Validação manual de sessão | `requireAuth` middleware (middleware/auth.js) | Já protege todas as rotas autenticadas |

---

## Inventory de Arquivos a Tocar

Esta seção documenta exatamente quais arquivos mudam e por quê — para o planner dividir em tasks independentes.

| Arquivo | Tipo de mudança | Detalhe |
|---------|-----------------|---------|
| `backend/src/config/database.js` | Edição (1 bloco try/catch) | Migration `onboarding_done` após linha 203 |
| `backend/src/routes/auth.js` | Edição (2 linhas) | SELECT + JSON response em `/api/auth/me` |
| `backend/src/routes/usuarios.js` | Criação | Router Express com `PATCH /me` |
| `backend/src/app.js` | Edição (2 linhas) | Require + mount do usuariosRouter |
| `frontend/src/services/api.js` | Edição (1 método) | `api.usuarios.setOnboardingDone()` |
| `frontend/src/styles/main.css` | Edição (CSS novo) | Bloco de estilos do wizard (UI-SPEC fornece o CSS completo) |
| `frontend/src/main.js` | Edição (funções novas + 1 linha em carregarSessao) | `abrirWizard()`, `fecharWizard()`, extração de `ativarPushNotificacoes()`, disparo em carregarSessao() |

---

## Common Pitfalls

### Pitfall 1: Chamar carregarSessao() dentro do wizard ao conectar calendar

**O que dá errado:** O listener existente de `btn-conectar-cal` (main.js:477) chama `await carregarSessao()` após conectar, o que refaz o setup de UI inteiro. Se o wizard chamar o mesmo, o modal fecha e o usuário perde o fluxo.

**Por que acontece:** Desenvolvedores copiam o listener existente sem adaptar.

**Como evitar:** No passo 2 do wizard, após sucesso de `api.conectarCalendario()`, apenas mostrar o feedback inline. Não chamar `carregarSessao()`. Opcionalmente atualizar `state.usuario.calendar_connected = 1` localmente.

### Pitfall 2: Não remover event listener de shake quando wizard fecha

**O que dá errado:** Se o backdrop é removido do DOM mas o listener ainda existe (referência em memória), pode causar erro ao tentar acessar `#wizard-modal` em interações futuras.

**Como evitar:** Instalar o listener no backdrop ao criar (`abrirWizard()`), e como o backdrop é removido do DOM em `fecharWizard()`, o listener é automaticamente garbage-collected. Usar `{ once: true }` no `animationend`.

### Pitfall 3: Z-index conflito com `#auth-container`

**O que dá errado:** O `#auth-container` já tem `z-index: 1000` (index.html linha 12). O wizard backdrop também usa `z-index: 1000` (UI-SPEC) com o modal em `z-index: 1001`. Se o auth-container ficar sobre o backdrop, o visual fica quebrado.

**Como evitar:** A UI-SPEC já definiu `z-index: 1000` para o backdrop e `1001` para o modal, com `position: fixed` no backdrop cobrindo toda a viewport. Isso é correto — o backdrop `fixed` cobre o `auth-container`. Nenhuma mudança de z-index necessária.

### Pitfall 4: `onboarding_done` retornar null para usuários antigos

**O que dá errado:** Usuários que já existiam no banco antes da migration têm `onboarding_done = NULL` (se a migration rodar com `DEFAULT 0` mas a linha já existia sem o campo). Na prática, `ALTER TABLE ... ADD COLUMN ... DEFAULT 0` em SQLite retroativamente aplica o DEFAULT a linhas existentes.

**Por que acontece:** Mal-entendido sobre como SQLite aplica DEFAULT em ALTER TABLE.

**Como evitar:** O SQLite aplica o valor DEFAULT a todas as linhas existentes quando uma coluna é adicionada com `ADD COLUMN`. Portanto, `onboarding_done` nunca será NULL para usuários existentes após a migration. O frontend ainda deve usar `usuario?.onboarding_done ?? 0` como fallback defensivo por boa prática.

**Implicação:** Todos os usuários existentes terão `onboarding_done = 0` após a migration e verão o wizard no próximo login. Isso é comportamento correto — eles são "novos" do ponto de vista do onboarding. [VERIFIED: comportamento padrão SQLite ALTER TABLE ADD COLUMN com DEFAULT]

### Pitfall 5: Focus não vai para o modal ao abrir

**O que dá errado:** Sem `focus()` explícito no modal ao abrir, o foco permanece no elemento que ativou a abertura (ou no body), e leitores de tela não anunciam o dialog.

**Como evitar:** `abrirWizard()` deve chamar `document.getElementById('wizard-modal').focus()` imediatamente após `appendChild`. O `tabindex="-1"` no `#wizard-modal` permite receber foco programático sem entrar no tab order.

### Pitfall 6: Pular aciona PATCH mas modal fecha antes da resposta

**O que dá errado:** Se fecharWizard() for chamado antes de `await api.usuarios.setOnboardingDone()` terminar, o usuário pode recarregar a página e ver o wizard novamente (PATCH falhou silenciosamente).

**Como evitar:** A UI-SPEC define que se o PATCH falhar, o modal fecha mesmo assim (degradação silenciosa aceitável — o wizard pode reaparecer no próximo login). Isso é OK. A implementação deve: (1) chamar `fecharWizard()`, (2) depois `await api.usuarios.setOnboardingDone().catch(() => {})` — ou na ordem inversa com try/catch silencioso. A ordem recomendada é: disparar o PATCH, aguardar, depois fechar — com timeout de 3s como fallback para não travar a UI.

---

## Code Examples

### CSS Completo do Wizard (UI-SPEC — já aprovado)

```css
/* VERIFIED: UI-SPEC aprovada 2026-04-27 */
/* ── Phase 10: Onboarding Wizard ─────────────────────── */
#wizard-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

#wizard-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  width: calc(100vw - 32px);
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  z-index: 1001;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

@keyframes wizard-shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-6px); }
  75%       { transform: translateX(6px); }
}
#wizard-modal.shaking {
  animation: wizard-shake 0.2s ease-in-out 2;
}

.wizard-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.wizard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.2s, opacity 0.2s;
}
.wizard-dot.ativo    { background: var(--accent); }
.wizard-dot.visitado { background: var(--accent); opacity: 0.4; }

.wizard-progress-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: 4px;
}

#wizard-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
  line-height: 1.3;
}

.wizard-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 16px;
}

.wizard-action-area {
  margin-bottom: 8px;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 16px;
  margin-top: 24px;
}

#wizard-btn-pular {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 12px 0;
  transition: color 0.15s;
}
#wizard-btn-pular:hover { color: var(--accent); }

#wizard-btn-proximo {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  min-width: 120px;
  transition: opacity 0.15s;
}
#wizard-btn-proximo:hover    { opacity: 0.85; }
#wizard-btn-proximo:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 640px) {
  #wizard-modal { padding: 16px; }
  .wizard-footer { gap: 8px; }
}
```

### HTML do Modal (conforme UI-SPEC)

```html
<!-- VERIFIED: estrutura definida na UI-SPEC aprovada -->
<div id="wizard-backdrop">
  <div id="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabindex="-1">
    <div class="wizard-header">
      <div class="wizard-progress">
        <div class="wizard-dot ativo"></div>
        <div class="wizard-dot"></div>
        <div class="wizard-dot"></div>
        <span class="wizard-progress-label">Passo 1 de 3</span>
      </div>
      <h2 id="wizard-title">Bem-vindo ao Floripa Alagamentos</h2>
    </div>
    <div class="wizard-body">
      <p class="wizard-desc">...</p>
      <div class="wizard-action-area"></div>
      <div class="wizard-feedback" role="status"></div>
    </div>
    <div class="wizard-footer">
      <button id="wizard-btn-pular">Pular configuração</button>
      <button id="wizard-btn-proximo">Próximo</button>
    </div>
  </div>
</div>
```

### Copy por Passo (UI-SPEC)

**Passo 1:**
- Título: "Bem-vindo ao Floripa Alagamentos"
- Descrição: "Este app monitora o risco de alagamento em tempo real nos bairros de Florianópolis e avisa você antes de ir a um lugar que pode estar alagado. Nos próximos 2 passos você conecta seu calendário e ativa os alertas."
- Botão primário: "Próximo"

**Passo 2:**
- Título: "Conecte seu Google Calendar"
- Descrição: "O app verifica seus eventos das próximas 72h e calcula o risco de alagamento nos bairros onde eles acontecem. Seu calendário nunca é modificado."
- Botão de ação: "Conectar Calendário" / "Conectando..." (loading) / some após sucesso
- Feedback sucesso: "Calendário conectado com sucesso."
- Feedback erro genérico: "Não foi possível conectar. Você pode tentar novamente na aba Calendário."
- Feedback erro sem permissão: "Permissão de calendário não foi concedida no login. Saia e entre novamente para autorizar."
- Botão primário: "Próximo" (habilitado o tempo todo)

**Passo 3:**
- Título: "Ative as notificações push"
- Descrição: "Receba alertas no seu dispositivo quando um evento do seu calendário cair em um bairro com risco elevado — mesmo com o app fechado."
- Botão de ação: "Ativar notificações" / "Ativando..." (loading) / some após sucesso
- Feedback sucesso: "Notificações ativadas."
- Feedback erro (permissão negada): "Permissão de notificações bloqueada no browser. Acesse as configurações do navegador para liberar e tente novamente."
- Feedback erro genérico: "Não foi possível ativar. Você pode tentar novamente na aba Calendário."
- Botão primário: "Concluir"

---

## State of the Art

| Aspecto | Situação atual no projeto |
|---------|--------------------------|
| Modal no projeto | Nenhum — este é o primeiro |
| Focus trap | Nenhum utilitário existente — implementar minimal inline |
| Migrations SQLite | Try/catch silencioso (padrão estabelecido) |
| Auth-only endpoints | `requireAuth` middleware já em uso |
| `usuarios.js` route | Não existe — criar do zero |

---

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | Modal injetado por JS (não hardcoded em HTML) é a abordagem preferida | Architecture Patterns | Baixo — consistente com o padrão do projeto de não ter elementos ocultos no HTML |
| A2 | Focus trap implementado inline (sem biblioteca) | Architecture Patterns | Baixo — projeto usa zero bibliotecas de UI |
| A3 | Ordem preferida para pular: PATCH depois fecharWizard() com try/catch silencioso se falhar | Pitfall 6 | Baixo — UI-SPEC já define degradação silenciosa como aceitável |

---

## Open Questions

1. **Usuários existentes vendo o wizard**
   - O que sabemos: após a migration, todos os usuários existentes terão `onboarding_done = 0`
   - O que está claro: D-06 diz que pular é definitivo e grava `onboarding_done = 1`
   - Recomendação: aceitar — usuários existentes verão o wizard uma única vez e podem pular imediatamente. Não há risco de perda de dados.

2. **Push: `swRegistration` é variável de módulo em main.js (linha 22)**
   - O que sabemos: `let swRegistration = null` é declarada no escopo de módulo
   - O que está claro: `abrirWizard()` é uma função dentro do mesmo módulo, portanto tem acesso
   - Recomendação: não é um problema. A função do wizard pode ler e escrever `swRegistration` diretamente.

---

## Environment Availability

Step 2.6: SKIPPED — fase é puramente código/config, sem dependências externas novas. Todas as dependências (SQLite, Express, pushManager API do browser) já estão em uso.

---

## Security Domain

| Categoria ASVS | Aplica | Controle padrão |
|----------------|--------|-----------------|
| V2 Authentication | sim (indiretamente) | `requireAuth` middleware no PATCH endpoint |
| V4 Access Control | sim | `requireAuth` — usuário só pode atualizar seu próprio `onboarding_done` via `req.session.userId` |
| V5 Input Validation | sim | PATCH valida que `onboarding_done === 1` (único valor válido) |
| V6 Cryptography | não | Sem operações criptográficas novas |

**Ameaças conhecidas para este stack:**

| Padrão | STRIDE | Mitigação padrão |
|--------|--------|-----------------|
| PATCH forjado por outro usuário | Spoofing / Elevation | `requireAuth` + `WHERE id = req.session.userId` (nunca usar `req.body.userId`) |
| XSS via copy do wizard | Tampering | Copy é hardcoded em JS, não interpolado de user input |

---

## Sources

### Primary (HIGH confidence)
- Leitura direta de `backend/src/config/database.js` — padrão de migration linhas 191-203
- Leitura direta de `backend/src/routes/auth.js` — endpoint `/api/auth/me` linhas 111-130
- Leitura direta de `backend/src/routes/push.js` — padrão PATCH endpoint linhas 60-102
- Leitura direta de `backend/src/middleware/auth.js` — `requireAuth` implementação completa
- Leitura direta de `backend/src/app.js` — padrão de montagem de routers
- Leitura direta de `frontend/src/main.js` — `carregarSessao()` linhas 619-651, `btn-push-optin` listener linhas 814-866, `btn-conectar-cal` listener linhas 469-484
- Leitura direta de `frontend/src/services/api.js` — `api.conectarCalendario()` linha 46, `api.push.subscribe()` linhas 62-64, padrão de `request()`
- Leitura direta de `frontend/src/styles/main.css` — `.form-msg` linhas 134-136, custom properties `:root` linhas 4-23
- Leitura direta de `frontend/index.html` — estrutura HTML existente, `z-index: 1000` no `#auth-container`
- Leitura direta de `.planning/phases/10-onboarding-wizard/10-UI-SPEC.md` — CSS completo e copywriting aprovados
- Leitura direta de `.planning/phases/10-onboarding-wizard/10-CONTEXT.md` — decisões D-01 a D-11

### Tertiary (LOW confidence)
- A3: Ordem de operações ao pular (PATCH antes/depois de fechar) — inferida do padrão do projeto, não explicitada

---

## Metadata

**Confidence breakdown:**
- Migration DB: HIGH — padrão exato verificado no código
- Endpoint PATCH: HIGH — padrão idêntico ao `/api/push/threshold` verificado
- Disparo do wizard em carregarSessao(): HIGH — linha exata localizada (619)
- Fluxo push no passo 3: HIGH — lógica completa em main.js:814-866 verificada
- Fluxo calendar no passo 2: HIGH — `api.conectarCalendario()` verificado em api.js:46
- Modal/focus trap: MEDIUM/HIGH — sem precedente no projeto, mas padrão vanilla bem estabelecido

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stack estável, sem mudanças frequentes)
