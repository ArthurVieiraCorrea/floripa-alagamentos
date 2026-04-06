# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Tile Map Service:**
- OpenStreetMap tile server - Provides map tiles for Leaflet
  - URL pattern: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Used in: `frontend/src/services/mapa.js` (line 21)
  - Auth: None required (public service)
  - Attribution: rendered in map UI as required by OSM license

**CDN (frontend assets):**
- unpkg.com - Delivers Leaflet CSS and JS at build time via `<link>` and `<script>` tags in `frontend/index.html`
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
  - Note: Leaflet is also installed as an npm dependency (`frontend/package.json`). The CDN copies are loaded at runtime; the npm package is available for bundling but not explicitly imported via npm in current source.

## Data Storage

**Databases:**
- SQLite (via `node-sqlite3-wasm` ^0.8.28)
  - File location: `backend/data/alagamentos.db`
  - Directory is created at startup if absent (`backend/src/config/database.js` lines 11-13)
  - WAL journal mode enabled for concurrency
  - Connection: file path resolved relative to `backend/src/config/database.js`
  - Client: `node-sqlite3-wasm` — pure WebAssembly binding, no native compilation
  - Schema managed in code: `backend/src/config/database.js` `initSchema()` function
  - `backend/data/` is gitignored; the `.db`, `.db-shm`, `.db-wal` files are not committed

**File Storage:**
- Local filesystem only (SQLite database file)

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — no authentication or authorization layer exists
- All API endpoints (`/api/ocorrencias`) are publicly accessible without credentials
- CORS is open by default (`origin: '*'`) unless `CORS_ORIGIN` env var is set

## Monitoring & Observability

**Error Tracking:**
- None — no error tracking service integrated

**Logs:**
- `console.error` used in the backend error handler (`backend/src/app.js` line 32) and frontend catch blocks
- `console.log` for server startup message (`backend/src/app.js` line 36)
- No structured logging library

**Health Check:**
- `GET /api/health` endpoint returns `{ status: 'ok', timestamp }` (`backend/src/app.js` lines 19-22)

## CI/CD & Deployment

**Hosting:**
- Not configured — no deployment manifests, Dockerfiles, or platform config files detected

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- None strictly required; the application runs with defaults

**Optional env vars:**
- `PORT` - Backend HTTP port (default: `3001`)
- `CORS_ORIGIN` - Allowed CORS origin (default: `'*'`)

**Secrets location:**
- `.env` file path is gitignored but no `.env` file is present in the repository

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Internal API Surface

The backend exposes a REST JSON API consumed by the frontend via `frontend/src/services/api.js`. All calls go through the `/api` path prefix, which Vite proxies to `http://localhost:3001` in development.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/ocorrencias` | List with filters and pagination |
| POST | `/api/ocorrencias` | Create new occurrence |
| GET | `/api/ocorrencias/recentes` | Occurrences from last N hours |
| GET | `/api/ocorrencias/stats` | 24h aggregate statistics |
| GET | `/api/ocorrencias/:id` | Fetch single occurrence |
| DELETE | `/api/ocorrencias/:id` | Remove occurrence |

---

*Integration audit: 2026-04-06*
