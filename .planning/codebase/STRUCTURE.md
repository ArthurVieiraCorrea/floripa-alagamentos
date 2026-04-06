# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
floripa-alagamentos/
├── package.json              # Root workspace scripts (install:all, dev:backend, dev:frontend, start)
├── backend/
│   ├── package.json          # Express app manifest
│   ├── src/
│   │   ├── app.js            # Express server entry point
│   │   ├── config/
│   │   │   └── database.js   # SQLite singleton + schema init
│   │   ├── routes/
│   │   │   └── ocorrencias.js # Route definitions for /api/ocorrencias
│   │   ├── controllers/
│   │   │   └── ocorrenciaController.js # Request handling + validation
│   │   ├── models/
│   │   │   └── ocorrencia.js  # All SQL queries for occurrences
│   │   └── middleware/        # Directory exists, currently empty
│   └── data/
│       └── alagamentos.db     # SQLite database file (runtime-generated, not committed)
└── frontend/
    ├── package.json           # Vite app manifest
    ├── vite.config.js         # Vite config (port 5173, /api proxy to :3001)
    ├── index.html             # Single HTML shell with all DOM structure
    └── src/
        ├── main.js            # SPA entry point — state, event wiring, data loaders
        ├── services/
        │   ├── api.js         # fetch wrapper for all backend API calls
        │   └── mapa.js        # Leaflet map init and marker rendering utilities
        └── styles/
            └── main.css       # All application CSS
```

## Directory Purposes

**`backend/src/`:**
- Purpose: All server-side application code
- Contains: Entry point, configuration, routes, controllers, models
- Key files: `app.js` (server bootstrap), `config/database.js` (DB singleton)

**`backend/src/config/`:**
- Purpose: Infrastructure-level configuration modules
- Contains: Database initialization; a natural home for future env-config or logging setup
- Key files: `database.js`

**`backend/src/routes/`:**
- Purpose: HTTP routing only — one file per resource
- Contains: `express.Router` instances that map verbs + paths to controller methods
- Key files: `ocorrencias.js`

**`backend/src/controllers/`:**
- Purpose: HTTP request/response handling and input validation
- Contains: Controller objects; one file per resource
- Key files: `ocorrenciaController.js`

**`backend/src/models/`:**
- Purpose: Data access — all SQL lives here
- Contains: Model objects with CRUD and query methods; one file per entity
- Key files: `ocorrencia.js`

**`backend/src/middleware/`:**
- Purpose: Custom Express middleware (currently empty; reserved for future auth, rate-limiting, etc.)
- Contains: Nothing yet

**`backend/data/`:**
- Purpose: Persistent SQLite database storage
- Contains: `alagamentos.db` — created automatically on first server start
- Generated: Yes (by `database.js`)
- Committed: No (runtime artifact)

**`frontend/src/services/`:**
- Purpose: Logic modules that are imported by `main.js` but have no DOM dependencies of their own
- Contains: API client (`api.js`) and Leaflet utilities (`mapa.js`)

**`frontend/src/styles/`:**
- Purpose: All application CSS in a single file
- Key files: `main.css`

## Key File Locations

**Entry Points:**
- `backend/src/app.js`: Express server — start here for any backend concern
- `frontend/index.html`: HTML shell — all DOM element IDs referenced in JS are declared here
- `frontend/src/main.js`: SPA logic entry — all frontend state and event handlers

**Configuration:**
- `backend/src/config/database.js`: SQLite connection and schema
- `frontend/vite.config.js`: Vite dev server settings and API proxy
- `package.json` (root): Convenience scripts for the whole project

**Core Logic:**
- `backend/src/models/ocorrencia.js`: All database queries
- `backend/src/controllers/ocorrenciaController.js`: Validation and HTTP response shaping
- `backend/src/routes/ocorrencias.js`: API surface definition

**Frontend Services:**
- `frontend/src/services/api.js`: All backend calls originate here
- `frontend/src/services/mapa.js`: All Leaflet interactions

## Naming Conventions

**Backend Files:**
- Route files: camelCase resource noun — `ocorrencias.js`
- Controller files: camelCase resource noun + `Controller` suffix — `ocorrenciaController.js`
- Model files: camelCase singular resource noun — `ocorrencia.js`
- Config files: camelCase functional name — `database.js`

**Frontend Files:**
- Service files: camelCase functional name — `api.js`, `mapa.js`
- CSS files: lowercase — `main.css`
- Entry: `main.js`

**JavaScript Identifiers:**
- Functions: camelCase — `getDb`, `buildWhere`, `criarIcone`, `renderizarMarcadores`
- Exported objects: camelCase noun — `api`, `OcorrenciaModel`, `OcorrenciaController`
- Constants (lookup maps): UPPER_SNAKE_CASE — `NIVEL_COR`, `NIVEL_LABEL`, `NIVEIS_VALIDOS`
- DOM element IDs: kebab-case — `form-ocorrencia`, `lista-ocorrencias`, `stat-total`
- CSS classes: kebab-case — `card-ocorrencia`, `nivel-critico`, `stats-bar`

**Language:** Variable and identifier names are in Portuguese (reflecting the domain) — `ocorrencia`, `bairro`, `nivel`, `criado_em`.

## Where to Add New Code

**New API Resource (e.g., `alertas`):**
- Model: `backend/src/models/alerta.js`
- Controller: `backend/src/controllers/alertaController.js`
- Router: `backend/src/routes/alertas.js`
- Mount in: `backend/src/app.js` with `app.use('/api/alertas', alertasRouter)`

**New Frontend Service (e.g., notifications):**
- Implementation: `frontend/src/services/notificacoes.js`
- Import in: `frontend/src/main.js`

**New Middleware (e.g., auth, rate limiting):**
- Implementation: `backend/src/middleware/<name>.js`
- Apply in: `backend/src/app.js` before the route registrations

**Database Schema Changes:**
- Edit `initSchema` in `backend/src/config/database.js`
- Note: There is no migration system — schema changes must be additive `ALTER TABLE` statements or require manual DB deletion during development

**CSS Changes:**
- All styles: `frontend/src/styles/main.css`

## Special Directories

**`backend/data/`:**
- Purpose: Holds the SQLite `.db` file
- Generated: Yes — auto-created by `getDb()` on first server start
- Committed: No — should be in `.gitignore`

**`frontend/dist/`:**
- Purpose: Vite production build output; served by Express in production
- Generated: Yes (`npm run build` inside `frontend/`)
- Committed: No

**`.planning/`:**
- Purpose: GSD planning documents and codebase analysis
- Generated: No (manually maintained)
- Committed: Yes

---

*Structure analysis: 2026-04-06*
