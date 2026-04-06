# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- kebab-case for multi-word files: `ocorrenciaController.js`, `database.js`
- camelCase for single-concept service files: `api.js`, `mapa.js`
- Singular nouns for model and controller files: `ocorrencia.js`, `ocorrenciaController.js`
- Plural nouns for route files: `ocorrencias.js`

**Functions:**
- camelCase throughout: `validarOcorrencia`, `carregarStats`, `renderizarMarcadores`
- Portuguese verbs for action functions: `criar`, `listar`, `deletar`, `buscarPorId`
- Async frontend functions named with `carregar` prefix for data-loading: `carregarStats`, `carregarMapa`, `carregarHistorico`
- Helper/pure functions use descriptive names: `buildWhere`, `formatarData`, `formatarPopup`, `criarIcone`

**Variables:**
- camelCase: `paginaAtual`, `filtros`, `marcadores`, `tempMarker`
- Short conventional names accepted in narrow scope: `pag`, `lim`, `qs`, `btn`, `msg`
- Constants in SCREAMING_SNAKE_CASE: `NIVEIS_VALIDOS`, `NIVEL_COR`, `NIVEL_LABEL`, `BASE`, `DB_PATH`, `PORT`

**Object keys (API response):**
- Portuguese snake_case for domain data: `criado_em`, `atualizado_em`, `bairros_afetados`
- Portuguese camelCase in response envelope: `paginacao`, `paginas`, `pagina`, `limite`
- Error messages under `erro` key (singular): `{ erro: 'mensagem' }`

## Code Style

**Formatting:**
- No formatter config file present (no `.prettierrc`, no `biome.json` at project root)
- 2-space indentation used consistently throughout all `.js` files
- Single quotes for strings in backend (CommonJS): `require('express')`
- Double quotes avoided; template literals used for multiline SQL and HTML strings
- Trailing commas used in multi-line object/array literals

**Linting:**
- No ESLint config at project root or in `frontend/` or `backend/`
- No lint script in any `package.json`

**Module system:**
- Backend uses CommonJS (`require` / `module.exports`)
- Frontend uses ES Modules (`import` / `export`)

## Import Organization

**Backend (CommonJS) order in `app.js`:**
1. Third-party packages (`express`, `cors`, `helmet`, `path`)
2. Internal routes/modules

**Frontend (ES Modules) order in `main.js`:**
1. Internal service imports

**Path Aliases:**
- None configured. Relative paths used exclusively: `'../models/ocorrencia'`, `'./services/api.js'`
- Frontend imports include `.js` extension explicitly

## Error Handling

**Backend — controller layer:**
- Validation runs before try/catch; returns `400` with `{ erro: '...' }` immediately on failure
- All DB calls wrapped in `try/catch`; failures return `500` with generic Portuguese message
- 404 returned inline (no throw): `if (!ocorrencia) return res.status(404).json({ erro: '...' })`
- Global Express error handler in `app.js` catches unhandled errors and logs `err.stack`

```js
// Pattern: validate first, then try/catch DB work
function validarOcorrencia({ latitude, longitude, bairro, nivel }) {
  const erros = [];
  if (latitude == null || isNaN(latitude) || ...) erros.push('latitude inválida');
  return erros;
}

try {
  const result = Model.create(data);
  res.status(201).json(result);
} catch (err) {
  res.status(500).json({ erro: 'Erro ao registrar ocorrência' });
}
```

**Frontend — async functions:**
- All async data-loading wrapped in `try/catch`
- Errors logged to `console.error` with context label: `console.error('Erro ao carregar stats', e)`
- Form submit shows error text inline in `#form-msg` element using `err.message`
- List load errors render inline HTML: `<p class="loading" style="color:#fca5a5">Erro: ${e.message}</p>`

**API client (`frontend/src/services/api.js`):**
- Centralised `request()` function throws `new Error(body.erro || \`HTTP ${res.status}\`)` on non-ok responses
- `204 No Content` handled explicitly: returns `null`

## Logging

**Backend:**
- `console.log` for startup: `Servidor rodando em http://localhost:${PORT}`
- `console.error(err.stack)` in global error handler
- No structured logging library

**Frontend:**
- `console.error` only, always with a descriptive label string as first argument

## Comments

**Style:**
- Section dividers using `// ── Label ───` pattern in `frontend/src/main.js`
- Inline route documentation as comment block above route definitions in `routes/ocorrencias.js`
- Inline comments for non-obvious behaviour: `// node-sqlite3-wasm doesn't expose changes count easily`
- `/* global L */` JSDoc global declaration used in `mapa.js` to suppress lint warnings for Leaflet

**When to comment:**
- Mark logical sections in longer files with divider comments
- Document REST endpoints inline in route files
- Explain workarounds or library limitations inline

## Function Design

**Size:**
- Controller methods are short (5–15 lines); complex logic delegated to model or helper functions
- Model methods are pure data-access: no business logic
- Validation extracted into standalone function `validarOcorrencia`

**Parameters:**
- Destructuring used for multi-field inputs: `function validarOcorrencia({ latitude, longitude, bairro, nivel })`
- Default parameter values used on model methods: `findAll({ limite = 100, offset = 0, ... } = {})`
- Query-string params parsed and clamped at controller layer before passing to model

**Return Values:**
- Model methods return plain objects or arrays (SQLite rows)
- Controller methods always call `res.json()` or `res.status().json()` — no explicit returns except early-exit guard clauses

## Module Design

**Backend exports:**
- Single object export for controllers: `module.exports = OcorrenciaController`
- Named function export for config: `module.exports = { getDb }`

**Frontend exports:**
- Named exports for utility/service functions: `export function iniciarMapa()`, `export const api = { ... }`
- No default exports used

**Object-as-namespace pattern:**
- Controller and model are exported as plain objects with method properties (not classes):
  ```js
  const OcorrenciaController = { criar(req, res) {...}, listar(req, res) {...} };
  module.exports = OcorrenciaController;
  ```
- Frontend `api` service follows same pattern: `export const api = { criarOcorrencia: ..., listar... }`

## Validation

**Location:** `backend/src/controllers/ocorrenciaController.js` — `validarOcorrencia()`

**Pattern:**
- Accumulate all errors into an array, return them all at once (not fail-fast)
- Join errors with `'; '` before sending: `erros.join('; ')`
- Coordinate bounds checked: lat `[-90, 90]`, lng `[-180, 180]`
- Enum values checked against `NIVEIS_VALIDOS` constant array
- String fields checked for minimum length after trim

**Input sanitisation in controller:**
- `parseFloat()` for numeric inputs
- `.trim()` for string inputs
- Optional chaining for nullable fields: `descricao?.trim()`

---

*Convention analysis: 2026-04-06*
