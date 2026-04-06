# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Monolithic fullstack application with a clear client/server split. The backend is a layered Express REST API; the frontend is a vanilla JS SPA served as static files by the same Express server in production.

**Key Characteristics:**
- Backend follows a 3-layer pattern: Routes → Controllers → Models (with a shared DB config singleton)
- Frontend is a module-based vanilla JS SPA — no framework, no component tree, one entry point
- In production the backend serves the frontend's built `dist/` folder via `express.static`, making the app a single deployable Node process
- In development, Vite runs on port 5173 and proxies `/api` requests to Express on port 3001

## Layers

**Routes Layer:**
- Purpose: Maps HTTP verbs and URL patterns to controller methods; owns no business logic
- Location: `backend/src/routes/ocorrencias.js`
- Contains: `express.Router` definitions only
- Depends on: Controller layer
- Used by: `backend/src/app.js` (mounted at `/api/ocorrencias`)

**Controller Layer:**
- Purpose: Handles HTTP request/response lifecycle, input validation, and pagination logic
- Location: `backend/src/controllers/ocorrenciaController.js`
- Contains: Request parsing, validation function `validarOcorrencia`, response serialization, try/catch error mapping to HTTP status codes
- Depends on: Model layer
- Used by: Routes layer

**Model Layer:**
- Purpose: All SQL queries; the only layer that touches the database
- Location: `backend/src/models/ocorrencia.js`
- Contains: `OcorrenciaModel` object with `create`, `findById`, `findAll`, `count`, `findRecentes`, `estatisticas`, `delete` methods; dynamic WHERE clause builder `buildWhere`
- Depends on: DB config singleton
- Used by: Controller layer

**Database Config:**
- Purpose: Lazy-initializes and returns a singleton SQLite connection; runs schema migration on first connect
- Location: `backend/src/config/database.js`
- Contains: `getDb()` function, `initSchema()` that creates the `ocorrencias` table
- Depends on: `node-sqlite3-wasm`, filesystem (`backend/data/alagamentos.db`)
- Used by: Model layer

**Frontend API Service:**
- Purpose: Thin wrapper over `fetch` that maps application operations to HTTP calls; throws on non-OK responses
- Location: `frontend/src/services/api.js`
- Contains: `api` object with `criarOcorrencia`, `listarOcorrencias`, `ocorrenciasRecentes`, `estatisticas`, `deletarOcorrencia`
- Depends on: Browser `fetch`
- Used by: `frontend/src/main.js`

**Frontend Map Service:**
- Purpose: Initializes the Leaflet map and provides marker rendering utilities
- Location: `frontend/src/services/mapa.js`
- Contains: `iniciarMapa`, `criarIcone`, `formatarPopup`, `renderizarMarcadores`
- Depends on: Leaflet (`window.L`, loaded via CDN script tag)
- Used by: `frontend/src/main.js`

**Frontend Entry Point (Orchestrator):**
- Purpose: Owns the global `state` object, wires DOM events, and calls service functions; acts as the single controller for the entire SPA
- Location: `frontend/src/main.js`
- Contains: State object, async data loaders (`carregarStats`, `carregarMapa`, `carregarHistorico`), form submit handler, tab switching, filter logic, 60-second auto-refresh interval
- Depends on: `api.js`, `mapa.js`, browser DOM

## Data Flow

**Reporting a New Flood Occurrence:**

1. User clicks on the Leaflet map in `frontend/index.html`; `main.js` captures `lat`/`lng` into the form fields and places a temporary marker
2. User fills in `bairro`, `nivel`, optional `descricao` and submits the form
3. `main.js` calls `api.criarOcorrencia(data)` which POSTs to `/api/ocorrencias`
4. Express routes to `OcorrenciaController.criar` → validates fields via `validarOcorrencia` → calls `OcorrenciaModel.create`
5. Model inserts a row via `node-sqlite3-wasm`, retrieves it with `last_insert_rowid()`, returns full row
6. Controller responds `201` with the created object
7. `main.js` re-fetches stats, map markers, and history in parallel via `Promise.all`

**Map Load / Auto-Refresh:**

1. On init and every 60 seconds, `main.js` calls `carregarMapa()` and `carregarStats()` concurrently
2. `carregarMapa` calls `api.ocorrenciasRecentes(24)` → GET `/api/ocorrencias/recentes?horas=24`
3. Controller calls `OcorrenciaModel.findRecentes(24)` which queries rows from the last N hours
4. `renderizarMarcadores` removes old Leaflet markers from `state.marcadores` and places new ones

**Paginated History View:**

1. User opens "Histórico" tab or changes filters/page
2. `carregarHistorico` calls `api.listarOcorrencias({ nivel, bairro, pagina, limite })`
3. Controller calls `OcorrenciaModel.findAll` (data) + `OcorrenciaModel.count` (total) using the same `buildWhere` helper
4. Returns `{ dados, paginacao }` envelope; `renderizarLista` renders cards and pagination buttons

**State Management:**
- All frontend state lives in a single plain object in `frontend/src/main.js`:
  ```js
  const state = {
    marcadores: [],   // active Leaflet marker instances
    tempMarker: null, // transient click marker
    paginaAtual: 1,
    filtros: { nivel: '', bairro: '' }
  };
  ```
- No reactive framework — state changes trigger explicit re-render calls

## Key Abstractions

**`OcorrenciaModel`:**
- Purpose: Represents the full lifecycle of a flood-event record in SQLite
- Examples: `backend/src/models/ocorrencia.js`
- Pattern: Plain object with method functions (not a class); synchronous because `node-sqlite3-wasm` is synchronous

**`buildWhere` Helper:**
- Purpose: Composes parameterized SQL WHERE clauses from optional filter arguments; avoids SQL injection via `?` placeholders
- Examples: `backend/src/models/ocorrencia.js` (lines 3–11)
- Pattern: Returns `{ where, params }` tuple consumed by `findAll` and `count`

**`api` Service Object:**
- Purpose: Hides `fetch` mechanics from `main.js`; centralizes the base URL and error unwrapping
- Examples: `frontend/src/services/api.js`
- Pattern: Named ES module export; all methods return Promises

## Entry Points

**Backend Server:**
- Location: `backend/src/app.js`
- Triggers: `node src/app.js` (production) or `nodemon src/app.js` (dev)
- Responsibilities: Creates Express app, registers Helmet/CORS/JSON middleware, mounts the `/api/ocorrencias` router, adds health check at `/api/health`, serves `frontend/dist` as static files in production, registers global error handler, binds to `PORT` (default 3001)

**Frontend SPA:**
- Location: `frontend/index.html` (Vite entry), `frontend/src/main.js` (JS entry)
- Triggers: Vite dev server (`npm run dev` in `frontend/`) or browser loading the built `index.html`
- Responsibilities: Loads Leaflet from CDN, bootstraps the map, runs initial data fetches, sets up all DOM event listeners

## Error Handling

**Strategy:** Catch at the controller boundary; re-throw generic 500 responses to avoid leaking internals.

**Patterns:**
- Controller methods wrap model calls in `try/catch`; caught errors return `{ erro: '...' }` JSON with appropriate HTTP status
- `validarOcorrencia` accumulates error strings and returns them as a joined `400` response before any DB call
- Frontend `api.js` throws an `Error` with the backend's `erro` field (or `HTTP <status>`) on non-OK responses
- `main.js` catches these in each async loader and either renders an inline error message or logs to `console.error`
- Global Express error handler in `app.js` catches anything unhandled and returns `500`

## Cross-Cutting Concerns

**Logging:** `console.error` only; no structured logger. Error stacks are logged server-side in the global error handler.

**Validation:** Done in the Controller layer via the standalone `validarOcorrencia` function. The DB layer also enforces a `CHECK` constraint on `nivel`.

**Authentication:** None. The API is fully open — any client can create or delete occurrences.

**Security Headers:** `helmet` is applied globally in `app.js` with `contentSecurityPolicy: false` (disabled to allow the Leaflet CDN script).

**CORS:** Configured via the `CORS_ORIGIN` environment variable; defaults to `'*'` (open).

---

*Architecture analysis: 2026-04-06*
