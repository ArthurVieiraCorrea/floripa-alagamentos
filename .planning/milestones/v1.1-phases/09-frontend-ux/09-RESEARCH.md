# Phase 9: Frontend UX - Research

**Researched:** 2026-04-19
**Domain:** Vanilla JS frontend (no framework), Express backend, SQLite via node-sqlite3-wasm
**Confidence:** HIGH — all findings verified directly from the codebase; no external tooling required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**RESIL-03: Stale Forecast Banner**
- D-01: Banner já implementado — `#banner-stale-forecast` HTML existe, JS verifica `data.stale` no init (`api.previsao.atual()`), backend retorna `stale: staleMinutes > 120`. Apenas verificar que funciona como esperado. Sem código novo.

**UX-01: Seletor de Antecedência**
- D-02: Seletor já implementado — `#sel-alert-hours` HTML existe (valores: 1, 2, 6, 12, 24, 48h), listener chama `api.push.setAlertHours()`, aparece quando push está ativo via `atualizarStatusPush('ativo', ...)`. Apenas verificar. Sem código novo.

**UX-02: Painel de Status**
- D-03: Nova aba "Status" na sidebar, visível apenas para usuário autenticado (mesmo comportamento da aba Admin).
- D-04: Conteúdo: três indicadores simples com ícones coloridos (● verde/vermelho/amarelo): Forecast (Atualizado/Desatualizado), Calendário (Conectado/Não conectado), Push (Ativo/Inativo).
- D-05: Sem botões de ação inline — apenas indicadores de leitura.
- D-06: Botão da aba "Status" exibido logo após o botão de aba "Calendário", antes de "Admin".

**UX-03: Histórico de Alertas**
- D-07: Nova aba "Alertas" na sidebar, visível apenas para usuário autenticado.
- D-08: Novo endpoint: `GET /api/alertas/historico` — retorna todos os alertas do usuário (incluindo vistos), 20 por página, ordenados por `enviado_em DESC`. Parâmetro: `?pagina=N`.
- D-09: Campos exibidos: `bairro`, `enviado_em` formatado em pt-BR, `summary`. Sem score de risco.
- D-10: Estado vazio: "Você ainda não recebeu alertas."
- D-11: Paginação igual ao padrão do histórico de ocorrências (`#paginacao` com botões numerados).

### Claude's Discretion
- Estilo visual dos indicadores de status (cores exatas, tamanho dos ícones ●)
- Formato exato de exibição da idade do forecast (ex: "há 2h30" vs. "há 150 min")
- Estrutura HTML/CSS da nova aba Status e dos cards do histórico de alertas

### Deferred Ideas (OUT OF SCOPE)
- Botões de ação inline no painel de status (conectar calendar, ativar push)
- Score de risco nos cards de histórico
- Onboarding wizard (UX-04) — Phase 10
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESIL-03 | Usuário vê banner de dados stale quando forecast está desatualizado | Banner já implementado in full; init call at line 1003 of main.js; backend returns `stale` at previsao.js line 54. Verification only. |
| UX-01 | Usuário pode configurar antecedência de alerta (1h a 48h) via seletor | `#sel-alert-hours` + listener at main.js line 982; `api.push.setAlertHours()` in api.js line 69. Verification only. |
| UX-02 | Usuário vê painel de status do sistema | New tab + HTML block + JS function needed; data sources confirmed (api.previsao.atual(), state.usuario, swRegistration). |
| UX-03 | Usuário vê histórico de alertas recebidos | New tab + HTML + JS + backend endpoint needed; alertas_enviados schema confirmed. |
</phase_requirements>

---

## Summary

Phase 9 is a hybrid of verification and new implementation. Two requirements (RESIL-03 and UX-01) are already coded and only need a smoke-test pass. Two requirements (UX-02 and UX-03) are net-new additions that follow established patterns already present in the codebase.

The frontend stack is vanilla JS (ES modules) with no build step for development — scripts are loaded directly via `<script type="module">`. There is no component framework; all DOM manipulation is imperative. The tab system uses `data-tab` attributes, `document.querySelectorAll('.tab')` listeners, and CSS class toggling (`active`). New tabs follow this exact pattern.

The backend is Express + node-sqlite3-wasm synchronous API. The `alertas_enviados` table already has all necessary columns (`bairro`, `summary`, `enviado_em`). The new `/historico` endpoint is a direct counterpart to the existing `/pendentes` — same middleware, same db call pattern, adds `LIMIT/OFFSET` for pagination.

**Primary recommendation:** Implement in this order — (1) verify RESIL-03 and UX-01 by manual test, (2) add backend `/historico` route, (3) add `api.alertas.historico()` to api.js, (4) add HTML for Status and Alertas tabs, (5) add JS logic for both tabs, (6) add CSS for new components.

---

## Standard Stack

### Core (already in use — no new dependencies)
| Component | Version/Location | Purpose |
|-----------|-----------------|---------|
| Vanilla JS ES modules | frontend/src/main.js | App logic — no framework |
| Express | backend/src/app.js | HTTP router |
| node-sqlite3-wasm | backend/src/config/database.js | SQLite sync API via `db.all()`, `db.get()`, `db.run()` |
| requireAuth middleware | backend/src/middleware/auth.js | Session-based auth guard |

**No new npm packages are needed for this phase.** All UX work is HTML/CSS/JS additions to existing files.

### Installation
```bash
# Nothing to install — zero new dependencies
```

---

## Architecture Patterns

### Tab System (verified from codebase)
Tabs in `index.html` use this HTML pattern:
```html
<!-- Tab button in .tabs div -->
<button class="tab" data-tab="status" id="tab-btn-status" style="display:none">Status</button>

<!-- Tab content panel -->
<div class="tab-content" id="tab-status">
  <!-- content -->
</div>
```

The global tab listener in `main.js` (line 319) already handles any button with `.tab` class via `data-tab` attribute — new tabs are automatically wired without touching the listener:
```javascript
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    // ... lazy-load callbacks if tab.dataset.tab === 'historico', etc.
  });
});
```
[VERIFIED: frontend/src/main.js lines 319-328]

### Auth-gated Tab Visibility Pattern
The Admin tab visibility is controlled in `carregarSessao()` (main.js line 519):
```javascript
document.getElementById('tab-btn-admin').style.display = 'inline-block';
// and hidden on logout:
document.getElementById('tab-btn-admin').style.display = 'none';
```
New Status and Alertas tabs must be shown/hidden in the exact same location in `carregarSessao()`.
[VERIFIED: frontend/src/main.js lines 519, 525]

### Pagination Pattern
The `renderizarLista()` function (main.js lines 183-251) renders pagination into `#paginacao` using:
```javascript
pag.innerHTML = Array.from({ length: totalPags }, (_, i) => i + 1)
  .map(p => `<button class="${p === state.paginaAtual ? 'active' : ''}" data-p="${p}">${p}</button>`)
  .join('');
pag.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    state.paginaAtual = parseInt(btn.dataset.p);
    carregarHistorico();
  });
});
```
The Alertas tab needs its own pagination container (e.g., `#paginacao-alertas`) to avoid conflicts with the Histórico de Ocorrências pagination in `#paginacao`. The pattern is identical but uses a separate element and separate state variable.
[VERIFIED: frontend/src/main.js lines 238-250]

### Backend Pagination Pattern
The existing `/api/ocorrencias` endpoint uses `?pagina=N&limite=20` with `LIMIT ? OFFSET ?`. The new `/historico` should use the same pattern. Backend query:
```javascript
const pagina = parseInt(req.query.pagina) || 1;
const limite = 20;
const offset = (pagina - 1) * limite;
// COUNT query for total
// SELECT with LIMIT ? OFFSET ?
```
[VERIFIED: backend/src/routes/alertas.js pattern; ocorrencias route is the model]

### API Service Pattern
`api.js` never throws from service methods — errors propagate as rejected promises. New method follows same pattern:
```javascript
alertas: {
  pendentes: () => request('/alertas/pendentes'),
  marcarVisto: (ids) => request('/alertas/marcar-visto', { method: 'POST', body: JSON.stringify({ ids }) }),
  historico: (pagina = 1) => request(`/alertas/historico?pagina=${pagina}`),
},
```
[VERIFIED: frontend/src/services/api.js lines 73-77]

### Date Formatting
`formatarData(str)` in main.js (line 178) converts SQLite datetime strings to pt-BR locale:
```javascript
function formatarData(str) {
  const d = new Date(str.replace(' ', 'T'));
  return d.toLocaleString('pt-BR');
}
```
This function is reusable for `enviado_em` in the Alertas tab cards.
[VERIFIED: frontend/src/main.js lines 178-181]

### CSS Design System
CSS variables in main.css (lines 1-23):
- `--bg: #0f172a`, `--surface: #1e293b`, `--surface2: #263549`, `--border: #334155`, `--text: #e2e8f0`, `--text-muted: #94a3b8`, `--accent: #3b82f6`
- Risk colors: `--risco-verde: #22c55e`, `--risco-amarelo: #f59e0b`, `--risco-laranja: #f97316`, `--risco-vermelho: #ef4444`
- Status indicator colors to reuse: verde (#22c55e already used for push ativo in `atualizarStatusPush`), vermelho (#ef4444 for negado), amarelo (#f59e0b for inativo)

[VERIFIED: frontend/src/styles/main.css lines 1-23 and main.js line 553]

### Recommended Project Structure (additions only)
```
frontend/
├── index.html           — add 2 tab buttons + 2 tab-content divs
├── src/
│   ├── main.js          — add carregarStatus(), carregarHistoricoAlertas(),
│   │                       update carregarSessao(), update tab click handler
│   ├── services/
│   │   └── api.js       — add alertas.historico()
│   └── styles/
│       └── main.css     — add .status-indicador, .card-alerta, .lista-alertas
backend/
└── src/
    └── routes/
        └── alertas.js   — add GET /historico route
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination | Custom pagination class | Clone the exact `renderizarLista` + `#paginacao` button pattern | Already CSS-styled, already accessible |
| Date formatting | Custom date formatter | `formatarData(str)` already in main.js | Handles SQLite's space-separator datetime format |
| Auth guard | Custom session check | `requireAuth` middleware already imported in alertas.js | One line, consistent 401 behavior |
| Push status detection | Custom Notification API wrapper | `verificarStatusPush(threshold, hoursBefore)` in main.js | Already handles all edge cases (denied, no-support, no swRegistration) |
| Stale check | Re-query backend | `api.previsao.atual()` already called on init; result already available | Don't fetch again just for Status tab — call it once on tab open |

**Key insight:** This phase is about wiring existing data to new UI panels. The infrastructure (auth, push detection, stale check, date format, pagination CSS) is fully built. The risk is over-engineering — resist adding abstractions.

---

## Common Pitfalls

### Pitfall 1: Pagination State Collision
**What goes wrong:** Using the same `state.paginaAtual` and `#paginacao` element for both Histórico de Ocorrências and Histórico de Alertas causes them to interfere. Clicking a page in Alertas calls `carregarHistorico()` (ocorrências), not `carregarHistoricoAlertas()`.
**Why it happens:** The existing `renderizarLista()` function hardcodes `#paginacao` and `state.paginaAtual`.
**How to avoid:** Use a separate `state.paginaAlertas` variable and `#paginacao-alertas` element for the Alertas tab. Define `renderizarListaAlertas()` as a separate function.
**Warning signs:** Clicking Alertas page button jumps to Histórico tab.

### Pitfall 2: Tab Listener Not Firing for New Tabs
**What goes wrong:** New tab buttons added to `index.html` don't respond to clicks.
**Why it happens:** The tab listener is attached with `document.querySelectorAll('.tab').forEach(...)` at script parse time. If the HTML buttons exist at parse time (which they do — everything is static HTML), this works. But the tab-content div ID must match `tab-${tab.dataset.tab}` exactly.
**How to avoid:** Ensure `data-tab="status"` on the button and `id="tab-status"` on the content div. Same for `data-tab="alertas"` / `id="tab-alertas"`.
**Warning signs:** Console error `Cannot read properties of null (reading 'classList')` on tab click.

### Pitfall 3: Lazy Load Not Wired for New Tabs
**What goes wrong:** Clicking the "Status" or "Alertas" tab shows stale or empty data because no load function is called on tab activation.
**Why it happens:** The tab listener has explicit `if (tab.dataset.tab === 'historico')` and `if (tab.dataset.tab === 'calendario')` hooks. New tabs need analogous hooks.
**How to avoid:** Add `if (tab.dataset.tab === 'status') carregarStatus()` and `if (tab.dataset.tab === 'alertas') { state.paginaAlertas = 1; carregarHistoricoAlertas(); }` to the tab listener block.
**Warning signs:** Status panel shows placeholder text on first click; Alertas list stays "Carregando..." indefinitely.

### Pitfall 4: Status Tab Shows Stale Push State
**What goes wrong:** The push indicator in the Status panel is wrong because `swRegistration` may be null when the tab is first clicked (service worker registration is async).
**Why it happens:** Service worker registration starts at init but completes asynchronously. The `verificarStatusPush` function already handles `swRegistration === null` gracefully (returns 'inativo'), but the Status tab checks at click time.
**How to avoid:** The `carregarStatus()` function should call `swRegistration.pushManager.getSubscription()` (same as `verificarStatusPush`), not cache a result. This is already the pattern used in the existing Calendário tab.
**Warning signs:** Status tab always shows Push as "Inativo" even when push is active.

### Pitfall 5: Missing CSS for New Components
**What goes wrong:** New HTML elements render without styling because the push-status, secao-notificacoes, and push-threshold-row CSS classes referenced in main.js are **absent from main.css**.
**Why it happens:** These classes exist in JS and HTML but their CSS is either inline (not in main.css) or missing entirely. Verification confirmed main.css ends at line 482 with no `.push-status`, `.secao-notificacoes`, or `.push-threshold-row` rules.
**How to avoid:** New CSS sections for `.status-indicador`, `.lista-alertas`, `.card-alerta` must be explicitly added to main.css in Phase 9. Do not rely on browser defaults for layout.
**Warning signs:** Status indicators render inline, crowded, or without visual hierarchy.

### Pitfall 6: Backend `/historico` Returns All Users' Data
**What goes wrong:** Forgetting `WHERE usuario_id = ?` in the `/historico` query returns all alerts in the table.
**Why it happens:** Easy copy-paste omission when adapting from a simpler SELECT.
**How to avoid:** Mirror `/pendentes` exactly — include `WHERE usuario_id = ? ORDER BY enviado_em DESC LIMIT ? OFFSET ?`.
**Warning signs:** Users see each other's alert history.

### Pitfall 7: `state.usuario.calendar_connected` Field Name
**What goes wrong:** Status panel shows wrong calendar connection state.
**Why it happens:** The field on `state.usuario` (populated from `/api/auth/me`) is `calendar_connected` (integer 0 or 1) and `calendar_disconnected` (integer 0 or 1 for invalid_grant case). The `carregarCalendario(usuario)` function at main.js line 434 shows the exact logic: `usuario.calendar_disconnected === 1` is the disconnected-with-error state; `!usuario.calendar_connected` is the not-connected state.
**How to avoid:** Reuse exactly the same logic from `carregarCalendario()` to determine status:
  - Connected: `usuario.calendar_connected === 1 && usuario.calendar_disconnected !== 1`
  - Disconnected (token error): `usuario.calendar_disconnected === 1`
  - Not connected: `!usuario.calendar_connected`
**Warning signs:** Status shows "Conectado" when user only clicked connect but it failed.

---

## Code Examples

### Backend: GET /api/alertas/historico
```javascript
// Source: backend/src/routes/alertas.js — model from existing /pendentes
// Add after the /marcar-visto route, before module.exports

router.get('/historico', requireAuth, (req, res) => {
  const db = getDb();
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = 20;
  const offset = (pagina - 1) * limite;
  try {
    const total = db.get(
      `SELECT COUNT(*) as total FROM alertas_enviados WHERE usuario_id = ?`,
      [req.session.userId]
    );
    const alertas = db.all(
      `SELECT id, bairro, summary, enviado_em
         FROM alertas_enviados
        WHERE usuario_id = ?
        ORDER BY enviado_em DESC
        LIMIT ? OFFSET ?`,
      [req.session.userId, limite, offset]
    );
    const totalPaginas = Math.ceil((total?.total || 0) / limite);
    res.json({
      alertas: alertas || [],
      paginacao: { pagina, paginas: totalPaginas, total: total?.total || 0 }
    });
  } catch (err) {
    console.error('[alertas] Erro ao buscar historico:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});
```

### Frontend: Tab HTML additions (index.html)
```html
<!-- After Calendário button, before Admin button -->
<button class="tab" data-tab="status" id="tab-btn-status" style="display:none">Status</button>
<button class="tab" data-tab="alertas" id="tab-btn-alertas" style="display:none">Alertas</button>

<!-- Tab content for Status (after tab-calendario div) -->
<div class="tab-content" id="tab-status">
  <h2>Status do Sistema</h2>
  <div id="status-indicadores">
    <div class="status-indicador">
      <span class="status-dot" id="status-dot-forecast">&#9679;</span>
      <div class="status-info">
        <span class="status-label">Previsão meteorológica</span>
        <span class="status-detalhe" id="status-detalhe-forecast">Verificando...</span>
      </div>
    </div>
    <div class="status-indicador">
      <span class="status-dot" id="status-dot-calendar">&#9679;</span>
      <div class="status-info">
        <span class="status-label">Google Calendar</span>
        <span class="status-detalhe" id="status-detalhe-calendar">—</span>
      </div>
    </div>
    <div class="status-indicador">
      <span class="status-dot" id="status-dot-push">&#9679;</span>
      <div class="status-info">
        <span class="status-label">Notificações push</span>
        <span class="status-detalhe" id="status-detalhe-push">—</span>
      </div>
    </div>
  </div>
</div>

<!-- Tab content for Alertas -->
<div class="tab-content" id="tab-alertas">
  <h2>Histórico de Alertas</h2>
  <div id="lista-alertas" class="lista-alertas">
    <p class="loading">Carregando...</p>
  </div>
  <div id="paginacao-alertas" class="paginacao"></div>
</div>
```

### Frontend: carregarStatus() function
```javascript
// Source: pattern from carregarCalendario() and verificarStatusPush() in main.js
async function carregarStatus() {
  // Forecast freshness
  const dotF = document.getElementById('status-dot-forecast');
  const detF = document.getElementById('status-detalhe-forecast');
  try {
    const data = await api.previsao.atual();
    if (data?.stale) {
      dotF.style.color = '#ef4444';  // --alto
      const mins = data.last_updated
        ? Math.round((Date.now() - new Date(data.last_updated + 'Z')) / 60000)
        : '?';
      const horas = Math.floor(mins / 60);
      const resto = mins % 60;
      detF.textContent = `Desatualizado (há ${horas > 0 ? horas + 'h' : ''}${resto}min)`;
    } else {
      dotF.style.color = '#22c55e';  // --risco-verde
      detF.textContent = 'Atualizado';
    }
  } catch {
    dotF.style.color = '#94a3b8';  // --text-muted
    detF.textContent = 'Indisponível';
  }

  // Calendar connection — from state.usuario (already populated by carregarSessao)
  const dotC = document.getElementById('status-dot-calendar');
  const detC = document.getElementById('status-detalhe-calendar');
  const u = state.usuario;
  if (u?.calendar_connected === 1 && u?.calendar_disconnected !== 1) {
    dotC.style.color = '#22c55e';
    detC.textContent = 'Conectado';
  } else if (u?.calendar_disconnected === 1) {
    dotC.style.color = '#ef4444';
    detC.textContent = 'Desconectado (token expirado)';
  } else {
    dotC.style.color = '#f59e0b';  // --risco-amarelo
    detC.textContent = 'Não conectado';
  }

  // Push status — reuse verificarStatusPush logic directly
  const dotP = document.getElementById('status-dot-push');
  const detP = document.getElementById('status-detalhe-push');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    dotP.style.color = '#94a3b8';
    detP.textContent = 'Não suportado pelo browser';
  } else if (Notification.permission === 'denied') {
    dotP.style.color = '#ef4444';
    detP.textContent = 'Bloqueado pelo browser';
  } else if (swRegistration) {
    const sub = await swRegistration.pushManager.getSubscription();
    if (sub) {
      dotP.style.color = '#22c55e';
      detP.textContent = 'Ativo';
    } else {
      dotP.style.color = '#f59e0b';
      detP.textContent = 'Inativo';
    }
  } else {
    dotP.style.color = '#f59e0b';
    detP.textContent = 'Inativo';
  }
}
```

### Frontend: carregarHistoricoAlertas() function
```javascript
// Source: pattern from carregarHistorico() at main.js line 253
async function carregarHistoricoAlertas() {
  const lista = document.getElementById('lista-alertas');
  const pag   = document.getElementById('paginacao-alertas');
  lista.innerHTML = '<p class="loading">Carregando...</p>';
  try {
    const resp = await api.alertas.historico(state.paginaAlertas);
    renderizarListaAlertas(resp.alertas, resp.paginacao);
  } catch (e) {
    lista.innerHTML = `<p class="loading" style="color:#fca5a5">Erro: ${e.message}</p>`;
    pag.innerHTML = '';
  }
}

function renderizarListaAlertas(alertas, paginacao) {
  const lista = document.getElementById('lista-alertas');
  const pag   = document.getElementById('paginacao-alertas');

  if (!alertas.length) {
    lista.innerHTML = '<p class="loading">Você ainda não recebeu alertas.</p>';
    pag.innerHTML = '';
    return;
  }

  lista.innerHTML = alertas.map(a => `
    <div class="card-alerta">
      <div class="card-top">
        <span class="card-bairro">${a.bairro}</span>
        <span class="card-data">${formatarData(a.enviado_em)}</span>
      </div>
      ${a.summary ? `<div class="card-desc">${String(a.summary).replace(/</g, '&lt;')}</div>` : ''}
    </div>
  `).join('');

  const totalPags = paginacao.paginas;
  if (totalPags <= 1) { pag.innerHTML = ''; return; }

  pag.innerHTML = Array.from({ length: totalPags }, (_, i) => i + 1)
    .map(p => `<button class="${p === state.paginaAlertas ? 'active' : ''}" data-p="${p}">${p}</button>`)
    .join('');

  pag.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.paginaAlertas = parseInt(btn.dataset.p);
      carregarHistoricoAlertas();
    });
  });
}
```

### Frontend: carregarSessao() additions
```javascript
// Source: main.js lines 514-530 — add alongside tab-btn-admin show/hide

// On login (inside if (usuario) block, after tab-btn-admin):
document.getElementById('tab-btn-status').style.display = 'inline-block';
document.getElementById('tab-btn-alertas').style.display = 'inline-block';

// On logout (inside else block, after tab-btn-admin):
document.getElementById('tab-btn-status').style.display = 'none';
document.getElementById('tab-btn-alertas').style.display = 'none';
```

### Frontend: Tab click handler addition
```javascript
// Source: main.js lines 319-328 — add inside the forEach callback

if (tab.dataset.tab === 'status') carregarStatus();
if (tab.dataset.tab === 'alertas') {
  state.paginaAlertas = 1;
  carregarHistoricoAlertas();
}
```

### CSS additions for main.css
```css
/* ── Phase 9: Status panel ────────────────────────────── */
.status-indicadores { display: flex; flex-direction: column; gap: .75rem; margin-top: .5rem; }

.status-indicador {
  display: flex;
  align-items: flex-start;
  gap: .65rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: .65rem .8rem;
}

.status-dot {
  font-size: 1rem;
  line-height: 1.4;
  color: var(--text-muted);
  flex-shrink: 0;
}

.status-info { display: flex; flex-direction: column; gap: .1rem; }

.status-label {
  font-size: .82rem;
  font-weight: 600;
  color: var(--text);
}

.status-detalhe {
  font-size: .75rem;
  color: var(--text-muted);
}

/* ── Phase 9: Alertas tab ─────────────────────────────── */
.lista-alertas { flex: 1; display: flex; flex-direction: column; gap: 8px; }

.card-alerta {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  border-radius: 6px;
  padding: 10px 12px;
}
```

---

## State of the Art

| Old Assumption | Verified Reality | Impact |
|----------------|-----------------|--------|
| push-status CSS in main.css | `.push-status`, `.push-status-icon`, `.secao-notificacoes`, `.push-threshold-row` classes are referenced in JS/HTML but **not defined in main.css** (482 lines, none found) | New CSS for Phase 9 must be self-contained; do not rely on inherited styles for push indicators |
| `api.sessao()` returns only `{id, email, nome}` | Returns `{id, email, nome, alert_threshold, alert_hours_before, calendar_connected, calendar_disconnected}` — all UX-02 status fields are already in the session payload | No extra backend call needed for Status tab calendar/push state |
| stale field location | `previsao.js` line 54: `stale: staleMinutes > 120` — `staleMinutes` computed from `meta.last_fetched_at + 'Z'`. `last_updated` field in response is `meta.last_fetched_at` (UTC, no Z suffix) | Status tab must add 'Z' when parsing: `new Date(data.last_updated + 'Z')` |

---

## Data Layer Findings

### alertas_enviados schema (verified from database.js lines 150-167)
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| usuario_id | INTEGER FK | cascades on user delete |
| google_event_id | TEXT | |
| risk_cycle_key | TEXT | deduplication key — not needed in /historico response |
| bairro | TEXT | display in card |
| score | REAL | excluded per D-09 |
| summary | TEXT | nullable — event name from Google Calendar |
| enviado_em | TEXT | SQLite datetime('now') — UTC without Z |
| visto_em | TEXT | nullable — /historico returns ALL records regardless |

**Confirmed:** `/historico` should NOT filter by `visto_em IS NULL` — it returns full history (D-08 explicitly says "incluindo os já vistos").

Indexes already present:
- `idx_alertas_enviados_usuario_visto` — not useful for /historico
- `idx_alertas_enviados_usuario_em` — `ON alertas_enviados(usuario_id, enviado_em)` — **directly covers the /historico ORDER BY** [VERIFIED: database.js lines 169-172]

### usuarios schema (relevant fields for UX-02)
| Column | Notes |
|--------|-------|
| calendar_connected | INTEGER DEFAULT 0 — 1 when calendar authorized |
| calendar_disconnected | INTEGER DEFAULT 0 — 1 when invalid_grant (token expired) |
| alert_threshold | INTEGER DEFAULT 51 — already in session payload |
| alert_hours_before | INTEGER DEFAULT 24 — already in session payload |

[VERIFIED: backend/src/config/database.js lines 37-50, 174-186]

---

## Verification Checklist (RESIL-03 and UX-01)

These items require manual verification, not code changes:

**RESIL-03:**
- [ ] `api.previsao.atual()` is called on init (main.js line 1003) — code exists [VERIFIED]
- [ ] `data?.stale === true` triggers `banner-stale-forecast` to show — code exists [VERIFIED]
- [ ] Backend returns `stale: staleMinutes > 120` — code exists at previsao.js line 54 [VERIFIED]
- Manual test: set `last_fetched_at` to 3h ago in DB, reload — banner should appear

**UX-01:**
- [ ] `#sel-alert-hours` HTML exists with values 1,2,6,12,24,48 — [VERIFIED: index.html lines 291-299]
- [ ] `#push-hours-row` div wraps the selector — [VERIFIED: index.html line 289]
- [ ] Listener calls `api.push.setAlertHours()` — [VERIFIED: main.js line 982-993]
- [ ] `atualizarStatusPush('ativo', ...)` shows `#push-hours-row` — [VERIFIED: main.js line 558]
- Manual test: activate push, change selector, verify PATCH /api/push/alert-hours called

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is purely code/config changes (HTML, CSS, JS, backend route). No new external dependencies identified. Node.js and npm are required but were already present from Phase 8.

---

## Validation Architecture

> nyquist_validation is set to `false` in .planning/config.json — this section is skipped.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a for read-only status panel |
| V3 Session Management | yes | `requireAuth` middleware on /historico — same as /pendentes |
| V4 Access Control | yes | SQL must filter by `usuario_id = req.session.userId` — enforced in query |
| V5 Input Validation | yes | `pagina` param must be sanitized: `Math.max(1, parseInt(req.query.pagina) \|\| 1)` |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — accessing another user's alert history | Tampering | Always `WHERE usuario_id = ?` with `req.session.userId` binding |
| Integer overflow on pagina param | Tampering | `parseInt` + `Math.max(1, ...)` bounds check |
| XSS via `summary` field (calendar event names) | Tampering | Escape in JS: `String(a.summary).replace(/</g, '&lt;')` — same pattern as renderizarEventos() in main.js line 368 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `api.sessao()` returns `calendar_connected` and `calendar_disconnected` fields | Data Layer Findings | Status tab calendar indicator would always show wrong state; fix: add explicit DB query in /api/auth/me |
| A2 | `/api/push/alert-hours` PATCH endpoint exists and saves to `alert_hours_before` column | Verification Checklist | UX-01 verification would fail; route is in backend/src/routes/push.js (not read in this session) |

**Verification note for A1:** The `carregarCalendario(usuario)` function at main.js line 416 accepts `usuario` and reads `usuario.calendar_disconnected` — strongly implies these fields are in the session response. [ASSUMED based on code usage pattern; push.js route not explicitly verified in this session]

---

## Open Questions

1. **push-status / secao-notificacoes CSS absence**
   - What we know: Classes referenced in JS and HTML but absent from main.css (verified by reading all 482 lines)
   - What's unclear: Whether this causes visual bugs in production or if the layout works by accident
   - Recommendation: Add explicit CSS in Phase 9 regardless — do not rely on browser default inline behavior

2. **`state.paginaAlertas` initialization**
   - What we know: `state` object is defined at main.js line 33 with no `paginaAlertas` key
   - What's unclear: Whether to add it to the `state` declaration or declare it as a separate `let` variable
   - Recommendation: Add `paginaAlertas: 1` to the existing `state` object for consistency with `paginaAtual`

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/main.js` — full read; tab system, carregarSessao, verificarStatusPush, renderizarLista, pagination, formatarData, init sequence
- `frontend/index.html` — full read; all tab HTML, existing selectors, banner elements
- `frontend/src/services/api.js` — full read; all API methods, request() pattern
- `frontend/src/styles/main.css` — full read (482 lines); CSS variables, tab styles, card styles, pagination styles
- `backend/src/routes/alertas.js` — full read; /pendentes and /marcar-visto pattern
- `backend/src/routes/previsao.js` — full read; stale field, last_fetched_at field
- `backend/src/config/database.js` — full read; alertas_enviados schema, usuarios schema, indexes
- `backend/src/middleware/auth.js` — full read; requireAuth implementation
- `backend/src/app.js` — full read; route mounting, session config
- `.planning/phases/09-frontend-ux/09-CONTEXT.md` — full read; all decisions

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — requirements definitions for RESIL-03, UX-01, UX-02, UX-03
- `.planning/STATE.md` — project state and key decisions
- `.planning/ROADMAP.md` — phase success criteria

### Unverified
- `backend/src/routes/push.js` — not read; assumed to contain `/alert-hours` PATCH route based on api.js line 69

---

## Metadata

**Confidence breakdown:**
- RESIL-03 and UX-01 verification: HIGH — all referenced code confirmed present
- UX-02 implementation: HIGH — all data sources confirmed, pattern clear
- UX-03 implementation: HIGH — schema confirmed, backend pattern clear
- CSS absence pitfall: HIGH — verified by reading all 482 lines of main.css

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable codebase, no external dependencies)
