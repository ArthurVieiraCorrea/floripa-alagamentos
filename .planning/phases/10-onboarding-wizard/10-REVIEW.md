---
phase: 10-onboarding-wizard
status: issues_found
depth: standard
files_reviewed: 7
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
---

# Code Review: Phase 10 — Onboarding Wizard

## Summary

A implementação do wizard de onboarding está correta na maior parte: o endpoint PATCH
`/api/usuarios/me` é protegido por `requireAuth`, a migration é idempotente, e a lógica
de disparo no frontend evita reabrir o modal na mesma sessão. Os achados mais importantes
são dois warnings de UX/robustez no backend e dois warnings de segurança que existem em
código pré-existente mas que a fase 10 toca indiretamente (XSS em `renderizarLista` e
dupla exposição do `authRouter`). Nenhum achado crítico.

---

## Findings

### WR-01: PATCH /api/usuarios/me responde 200 mesmo quando userId não existe no banco

**File:** `backend/src/routes/usuarios.js:20-24`
**Severity:** warning
**Issue:** O `db.run()` do UPDATE não é verificado quanto a `changes` (linhas afetadas).
Se `req.session.userId` existir na sessão mas não no banco (sessão órfã após limpeza manual
do DB em desenvolvimento, por exemplo), o UPDATE silenciosamente não afeta nenhuma row e
a resposta ainda é `{ ok: true }`. Para o wizard isso significa que o onboarding não é
marcado, mas o usuário recebe feedback positivo.

```js
// Situação atual
db.run(`UPDATE usuarios SET onboarding_done = 1 ... WHERE id = ?`, [req.session.userId]);
res.json({ ok: true }); // sempre 200, independente de rows afetadas
```

**Fix:** Verificar `db.run()` via retorno ou `db.get()` após o UPDATE:

```js
const result = db.run(
  `UPDATE usuarios SET onboarding_done = 1, atualizado_em = datetime('now') WHERE id = ?`,
  [req.session.userId]
);
// node-sqlite3-wasm retorna objeto com .changes
if (!result?.changes) {
  return res.status(404).json({ erro: 'Usuário não encontrado' });
}
res.json({ ok: true });
```

Caso a API do `node-sqlite3-wasm` não exponha `.changes` no retorno de `run()`, a
alternativa é fazer `db.get('SELECT changes() AS n')` imediatamente após o `db.run()`.

---

### WR-02: Botão "Próximo/Concluir" não é desabilitado durante operações assíncronas

**File:** `frontend/src/main.js:859-872`
**Severity:** warning
**Issue:** O listener do `#wizard-btn-proximo` não desabilita o botão durante o `await
api.usuarios.setOnboardingDone()` no passo Concluir. Um clique duplo rápido chama
`fecharWizard()` duas vezes (idempotente — ok) e `setOnboardingDone()` duas vezes (idempotente
no backend — ok), mas pode gerar race conditions de UI se o DOM for modificado entre as
duas chamadas. Além disso, no avanço de passo (passoAtual < PASSOS.length - 1), o usuário
pode clicar Próximo múltiplas vezes antes de `renderizarPasso()` completar, incrementando
`passoAtual` além do esperado (indo do passo 1 para o 3, pulando o 2).

```js
document.getElementById('wizard-btn-proximo').addEventListener('click', async () => {
  // Sem proteção contra double-click
  if (passoAtual < PASSOS.length - 1) {
    passoAtual++; // pode ser chamado 2x se usuário clicar rápido
    renderizarPasso();
  } else { /* ... */ }
});
```

**Fix:** Desabilitar o botão no início do handler e reabilitar no final (ou usar uma flag):

```js
document.getElementById('wizard-btn-proximo').addEventListener('click', async () => {
  const btn = document.getElementById('wizard-btn-proximo');
  if (btn.disabled) return; // guard contra double-click
  btn.disabled = true;
  try {
    if (passoAtual < PASSOS.length - 1) {
      passoAtual++;
      renderizarPasso();
    } else {
      fecharWizard();
      await api.usuarios.setOnboardingDone().catch(() => {});
    }
  } finally {
    // Só reabilita se o modal ainda existir (não foi fechado)
    if (document.getElementById('wizard-btn-proximo')) btn.disabled = false;
  }
});
```

---

### WR-03: XSS em renderizarLista — `o.bairro` e `o.descricao` sem escape

**File:** `frontend/src/main.js:194-204`
**Severity:** warning
**Issue:** A função `renderizarLista` (listagem de ocorrências) insere `o.bairro` e
`o.descricao` diretamente em `innerHTML` sem escape de HTML. Outros locais do mesmo arquivo
(alertas, eventos de calendário, admin) já aplicam `.replace(/</g, '&lt;').replace(/>/g, '&gt;')`.
A inconsistência é um risco pré-existente, mas a fase 10 é momento oportuno de registrar.
Um administrador mal-intencionado que registre uma ocorrência com `bairro` contendo `<script>`
via API direta poderia injetar HTML no DOM de outros usuários.

```js
// linha 197 — sem escape
<span class="card-bairro">${o.bairro}</span>
// linha 201 — sem escape
${o.descricao ? `<div class="card-desc">${o.descricao}</div>` : ''}
```

**Fix:** Escapar da mesma forma que os demais campos do mesmo arquivo:

```js
const bairroEsc = String(o.bairro || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const descEsc   = String(o.descricao || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// usar bairroEsc e descEsc no template
```

---

### WR-04: `authRouter` montado em `/auth` e `/api/auth` — `/auth/me` exposto sem prefixo

**File:** `backend/src/app.js:68-69`
**Severity:** warning
**Issue:** O mesmo roteador de autenticação é montado em dois pontos:

```js
app.use('/auth',     authRouter);  // para o OAuth flow
app.use('/api/auth', authRouter);  // para /api/auth/me
```

Isso expõe `/auth/me` (sem o prefixo `/api`) com a mesma resposta de `/api/auth/me`. O
endpoint `/auth/me` é inofensivo (retorna dados da sessão ou 401), mas os endpoints de OAuth
`/auth/google` e `/auth/google/callback` estão corretos — o problema é que `/api/auth/google`
e `/api/auth/google/callback` também ficam acessíveis, criando caminhos redundantes e
potencialmente confusos para usuários que inspecionam a API. Além disso, se um rate limiter
for adicionado futuramente em `/api/*`, o caminho `/auth/*` escaparia.

**Fix:** Separar os roteadores: manter o OAuth em `/auth` e criar um roteador REST separado
para `/api/auth/me`:

```js
app.use('/auth',     authRouter);     // apenas OAuth (google, callback, logout)
app.use('/api/auth', authApiRouter);  // apenas /me
```

Ou, alternativa mais simples: adicionar o route `/api/auth/me` diretamente em `app.js`
delegando para a mesma lógica, sem re-montar o router completo.

---

### IN-01: `db.get()` em `/api/auth/me` pode retornar `undefined` para sessão válida com banco corrompido

**File:** `backend/src/routes/auth.js:116-130`
**Severity:** info
**Issue:** O código usa `usuario?.calendar_connected ?? 0` (optional chaining + nullish
coalescing) para o caso em que `db.get()` retorna `undefined`. Isso é robusto e correto —
o fallback funciona. Não é um bug, mas é informação de contexto: se a sessão tiver `userId`
mas o registro não existir no banco, o endpoint responde com campos zerados sem sinalizar
inconsistência. O comportamento é aceitável e intencional.

---

### IN-02: Focus trap usa `offsetParent !== null` para detectar visibilidade — pode falhar em edge cases

**File:** `frontend/src/main.js:835`
**Severity:** info
**Issue:** A detecção de elementos focáveis no focus trap combina seletor CSS
`:not([style*="display: none"])` com verificação `offsetParent !== null`. O seletor CSS
detecta `display:none` via atributo `style` inline — funciona para os botões gerenciados
pelo wizard. Mas `offsetParent` pode ser `null` por razões além de `display:none`
(ex.: `position:fixed` em alguns browsers antigos). Na prática, com os poucos elementos
focáveis do modal e os browsers modernos visados, isso não causará problemas.

---

### IN-03: `abrirWizard()` é chamado antes de `carregarCalendario()` — carregamento do calendário pode sobrepor UI

**File:** `frontend/src/main.js:896-899`
**Severity:** info
**Issue:** A ordem em `carregarSessao()` é:

```js
if (!usuario.onboarding_done) {
  abrirWizard();           // síncrono — monta DOM do modal
}
await carregarCalendario(usuario); // assíncrono — modifica o DOM do sidebar
```

`carregarCalendario()` modifica `style.display` de vários elementos do sidebar enquanto o
modal do wizard está aberto. Não há conflito visual direto (o modal tem z-index 1000 e cobre
tudo), mas operações como `document.getElementById('lista-eventos-cal').innerHTML = ...`
ocorrem "por baixo" do modal. O comportamento é correto e intencional (conforme comentário
no plano 10-02 de não chamar `carregarSessao()` dentro do wizard). Registrado apenas para
documentação.

---

## Files Reviewed

- `backend/src/routes/usuarios.js` — Lógico e seguro; único achado é a falta de verificação de rows afetadas no UPDATE (WR-01).
- `backend/src/config/database.js` — Migration idempotente, padrão correto; schema completo e bem organizado.
- `backend/src/routes/auth.js` — OAuth flow correto; `/api/auth/me` expõe `onboarding_done` adequadamente; dupla montagem em `app.js` é fonte do WR-04.
- `backend/src/app.js` — Configuração geral sólida; dupla montagem do `authRouter` é desnecessária e levemente confusa (WR-04); CORS `'*'` é aceitável pois sessões não requerem `credentials: 'include'` dado o proxy/same-origin.
- `frontend/src/services/api.js` — `api.usuarios.setOnboardingDone()` implementado corretamente no sub-objeto; padrão consistente com o restante do módulo.
- `frontend/src/main.js` — Wizard bem estruturado; focus trap, shake animation e idempotência do PATCH corretos; WR-02 (double-click) e WR-03 (XSS pré-existente em renderizarLista) merecem atenção.
- `frontend/src/styles/main.css` — CSS do wizard completo conforme UI-SPEC aprovada; responsivo e sem conflito com estilos existentes.
