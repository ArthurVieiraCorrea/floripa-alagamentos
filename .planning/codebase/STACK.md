# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- JavaScript (ES2022+) - All backend and frontend source code

**Secondary:**
- HTML5 - `frontend/index.html` (single-page shell)
- CSS3 - `frontend/src/styles/main.css`

## Runtime

**Environment:**
- Node.js (no version pinned; no `.nvmrc` or `.node-version` file present)

**Package Manager:**
- npm
- Lockfiles: `backend/package-lock.json`, `frontend/package-lock.json` (both present)

## Frameworks

**Backend:**
- Express 4.18.2 - HTTP server and REST API routing (`backend/src/app.js`)

**Frontend:**
- No JS framework — vanilla JavaScript ES modules (`frontend/src/main.js`)
- Leaflet 1.9.4 - Interactive map rendering (`frontend/src/services/mapa.js`)

**Build/Dev:**
- Vite 5.1.4 - Frontend dev server (port 5173) and production bundler (`frontend/vite.config.js`)
- nodemon 3.0.3 - Backend hot-reload during development (`backend/package.json`)

## Key Dependencies

**Backend - Critical:**
- `express` ^4.18.2 - REST API framework
- `node-sqlite3-wasm` ^0.8.28 - WebAssembly SQLite3 binding; no native compilation required (`backend/src/config/database.js`)
- `cors` ^2.8.5 - Cross-Origin Resource Sharing middleware
- `helmet` ^7.1.0 - HTTP security headers (CSP disabled: `contentSecurityPolicy: false`)

**Frontend - Critical:**
- `leaflet` ^1.9.4 - Map library; loaded from npm and also from unpkg CDN in `frontend/index.html`

## Configuration

**Environment:**
- `PORT` - Backend listen port (defaults to `3001` in `backend/src/app.js`)
- `CORS_ORIGIN` - Allowed CORS origin (defaults to `'*'` in `backend/src/app.js`)
- `.env` file listed in `.gitignore`; no `.env` file present in the repository

**Build:**
- `frontend/vite.config.js` - Vite config; sets dev port 5173 and proxies `/api` to `http://localhost:3001`
- No TypeScript config; no Babel config; no ESLint or Prettier config detected

## Monorepo Scripts (root `package.json`)

```bash
npm run install:all     # installs both backend and frontend dependencies
npm run dev:backend     # runs nodemon src/app.js in backend/
npm run dev:frontend    # runs vite in frontend/
npm start               # runs node src/app.js in backend/ (production)
```

## Production Serving

In production, the backend serves the compiled frontend from `frontend/dist/` as static files (`backend/src/app.js` lines 24-28). A catch-all route returns `index.html` for client-side navigation. Frontend must be built with `vite build` before starting the backend in production mode.

## Platform Requirements

**Development:**
- Node.js + npm
- Two processes running simultaneously: backend on port 3001, frontend dev server on port 5173

**Production:**
- Single Node.js process (backend serves frontend static bundle)
- Writable filesystem for SQLite database file at `backend/data/alagamentos.db`

---

*Stack analysis: 2026-04-06*
