# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Delete always returns `true` regardless of outcome:**
- Issue: `OcorrenciaModel.delete()` always returns `true` even when the target row does not exist. The comment in the code explicitly acknowledges that `node-sqlite3-wasm` does not expose an affected-rows count.
- Files: `backend/src/models/ocorrencia.js` (line 65–70), `backend/src/controllers/ocorrenciaController.js` (line 81–84)
- Impact: `DELETE /api/ocorrencias/:id` always responds 204, never 404. Callers cannot distinguish a successful delete from a no-op.
- Fix approach: After `db.run('DELETE ...')`, call `this.findById(id)` before the delete and verify the row existed, or use `db.get('SELECT changes() as c')` if the SQLite WASM binding supports it.

**`NIVEL_LABEL` duplicated across frontend modules:**
- Issue: The `{ baixo, medio, alto, critico }` label map is defined identically in both `frontend/src/main.js` (line 57) and `frontend/src/services/mapa.js` (line 10–13).
- Files: `frontend/src/main.js`, `frontend/src/services/mapa.js`
- Impact: Any label change must be made in two places; easy to diverge.
- Fix approach: Extract into a shared `frontend/src/constants.js` and import in both modules.

**`NIVEL_COR` defined only in `mapa.js` but popup HTML uses inline styles:**
- Issue: `formatarPopup()` in `frontend/src/services/mapa.js` (line 50) embeds color values directly from `NIVEL_COR`. If colors change, popup styles are updated but other badge elements referencing CSS classes (`badge-${o.nivel}`) are not, and vice versa.
- Files: `frontend/src/services/mapa.js`
- Impact: Visual inconsistency between map popups and sidebar badges if colors are adjusted in only one place.
- Fix approach: Use CSS custom properties or a single source-of-truth constants file so map SVG icons, popup inline styles, and CSS class colors all derive from the same values.

**No dev-time environment variable management:**
- Issue: There is no `.env.example` or documented list of required environment variables. The only variables referenced in code are `process.env.PORT` and `process.env.CORS_ORIGIN`, but neither is documented anywhere.
- Files: `backend/src/app.js` (lines 9, 12)
- Impact: New contributors or deployment environments have no guidance on what to set; CORS defaults to `*` silently.
- Fix approach: Add a `.env.example` (committed) listing `PORT` and `CORS_ORIGIN` with safe defaults and explanatory comments.

**No concurrent-write protection on the SQLite database:**
- Issue: `getDb()` in `backend/src/config/database.js` uses WAL mode but there is no connection pooling, write queuing, or transaction wrapping around the multi-step `INSERT … SELECT last_insert_rowid()` sequence in `OcorrenciaModel.create()`.
- Files: `backend/src/config/database.js`, `backend/src/models/ocorrencia.js` (lines 17–23)
- Impact: Under concurrent POST requests the `last_insert_rowid()` call could race and return the wrong row's ID, returning stale or incorrect data to the caller.
- Fix approach: Wrap the insert + rowid fetch in a `BEGIN IMMEDIATE` transaction, or use `db.run` return value if the binding exposes `lastInsertRowid`.

---

## Security Considerations

**CORS wildcard in production:**
- Risk: `app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))` falls back to `'*'` when the env var is not set. In production this allows any origin to make credentialed-style requests to the API.
- Files: `backend/src/app.js` (line 12)
- Current mitigation: None — the fallback is the unsafe value.
- Recommendations: Require `CORS_ORIGIN` to be set explicitly in production; fail fast at startup if it is missing and `NODE_ENV=production`.

**No authentication on write/delete endpoints:**
- Risk: `POST /api/ocorrencias` and `DELETE /api/ocorrencias/:id` are completely open. Any user (or bot) on the network can create or delete records without any identity check.
- Files: `backend/src/routes/ocorrencias.js`, `backend/src/controllers/ocorrenciaController.js`
- Current mitigation: None.
- Recommendations: Add at minimum a shared secret header check or simple token-based auth middleware before the write routes.

**`bairro` field not length-capped:**
- Risk: Validation in `validarOcorrencia()` only requires `bairro.trim().length >= 2` with no upper bound. An attacker can POST arbitrarily large strings that are written directly to the database.
- Files: `backend/src/controllers/ocorrenciaController.js` (line 11–12)
- Current mitigation: None.
- Recommendations: Add `bairro.trim().length <= 100` (or similar) to the validation function.

**`descricao` and `fonte` fields have no validation or length cap:**
- Risk: Both fields are written to the database without any sanitization or size limit. `fonte` is not even validated to be a string.
- Files: `backend/src/controllers/ocorrenciaController.js` (line 20), `backend/src/models/ocorrencia.js` (line 15)
- Current mitigation: None.
- Recommendations: Validate `fonte` against an allowlist (e.g., `['manual', 'sensor', 'api']`) and cap `descricao` at a reasonable character limit (e.g., 500).

**`ContentSecurityPolicy` disabled globally:**
- Risk: `helmet({ contentSecurityPolicy: false })` turns off CSP entirely. Combined with the fact that `formatarPopup()` injects `o.descricao` directly into popup HTML without escaping, a stored XSS payload in `descricao` would execute in every browser that views the popup.
- Files: `backend/src/app.js` (line 11), `frontend/src/services/mapa.js` (line 54)
- Current mitigation: None.
- Recommendations: (1) HTML-escape `o.descricao` before inserting into the popup template string. (2) Re-enable and configure CSP properly.

**Leaflet loaded from `unpkg` CDN without Subresource Integrity (SRI):**
- Risk: `index.html` loads Leaflet CSS and JS from `https://unpkg.com` with no `integrity` attribute. A CDN compromise or supply-chain attack would execute arbitrary code in every user's browser.
- Files: `frontend/index.html` (lines 7, 118)
- Current mitigation: None.
- Recommendations: Add `integrity="sha384-..."` and `crossorigin="anonymous"` attributes, or bundle Leaflet through Vite so it is served from the same origin.

---

## Known Bugs

**Delete endpoint never returns 404:**
- Symptoms: `DELETE /api/ocorrencias/99999` (non-existent ID) returns HTTP 204 instead of 404.
- Files: `backend/src/models/ocorrencia.js` (line 65–70), `backend/src/controllers/ocorrenciaController.js` (line 81–84)
- Trigger: Any DELETE request with an ID that does not exist in the database.
- Workaround: None from the client side.

**`formatarData` silently produces "Invalid Date" for unexpected timestamps:**
- Symptoms: `formatarData()` calls `new Date(str.replace(' ', 'T'))` on `criado_em`. If the SQLite datetime format changes (e.g., includes timezone offset) or a null sneaks through, the rendered card shows "Invalid Date".
- Files: `frontend/src/main.js` (lines 59–62)
- Trigger: Any `criado_em` value that is not in `YYYY-MM-DD HH:MM:SS` format.
- Workaround: None — the error is silent.

**Map marker click matching uses coordinate proximity instead of ID:**
- Symptoms: When a user clicks a history card, the map opens the popup of the *first* marker within 0.0001 degrees. If two occurrences are at the same location, the wrong popup may open.
- Files: `frontend/src/main.js` (lines 92–97)
- Trigger: Two or more occurrences within ~11 meters of each other.
- Workaround: None.

---

## Performance Bottlenecks

**No database index on `criado_em` or `nivel`:**
- Problem: `findAll`, `count`, `findRecentes`, and `estatisticas` all filter or sort on `criado_em` and/or `nivel`. The schema creates no indexes on these columns.
- Files: `backend/src/config/database.js` (lines 22–34)
- Cause: As the `ocorrencias` table grows, these queries require full table scans.
- Improvement path: Add `CREATE INDEX IF NOT EXISTS idx_criado_em ON ocorrencias(criado_em DESC)` and `CREATE INDEX IF NOT EXISTS idx_nivel ON ocorrencias(nivel)` inside `initSchema()`.

**Pagination renders all page buttons at once:**
- Problem: `renderizarLista()` renders one `<button>` per page with `Array.from({ length: totalPags })`. For large datasets (e.g., 10 000 records at `limite=20` = 500 buttons) the DOM becomes very large.
- Files: `frontend/src/main.js` (lines 105–107)
- Cause: No windowed/ellipsis pagination logic.
- Improvement path: Render only prev/next and a small window of numbered buttons around the current page.

**Map reload replaces all markers on every refresh:**
- Problem: `renderizarMarcadores()` removes and re-adds every marker on every 60-second auto-refresh, even if the data has not changed.
- Files: `frontend/src/services/mapa.js` (lines 60–69), `frontend/src/main.js` (line 193)
- Cause: No diffing or ETag-based caching.
- Improvement path: Either compare incoming data against existing markers by ID before replacing, or implement HTTP caching headers on the `/api/ocorrencias/recentes` endpoint.

---

## Fragile Areas

**`getDb()` singleton with no error recovery:**
- Files: `backend/src/config/database.js`
- Why fragile: If the database file becomes corrupted or the WASM module fails to initialize, `db` is set to `undefined` and every subsequent call to `getDb()` retries initialization, potentially throwing on every request with no circuit breaker.
- Safe modification: Add a try/catch in `getDb()` that logs and re-throws clearly, and consider resetting `db = undefined` on failure so the next request gets a fresh attempt.
- Test coverage: No tests exist for the database layer.

**`app.get('*', ...)` catch-all before error middleware:**
- Files: `backend/src/app.js` (lines 26–28)
- Why fragile: The SPA fallback route (`app.get('*', ...)`) is registered before the error-handling middleware. Express error handlers must be registered last, but the wildcard route means any unhandled error thrown inside a route after the static middleware is skipped by the error handler registration order. Placing additional routes after this wildcard will also silently fail to match.
- Safe modification: Move the error handler registration to immediately after `app.use('/api/...')` routes, before the static middleware and wildcard.
- Test coverage: None.

---

## Test Coverage Gaps

**Zero test coverage across the entire project:**
- What's not tested: All business logic — model CRUD, controller validation, API route responses, frontend rendering, form submission, map interactions.
- Files: All files under `backend/src/` and `frontend/src/`
- Risk: Any regression in validation logic, SQL queries, or UI behavior goes undetected until manual testing or a user report.
- Priority: High

**`validarOcorrencia` edge cases untested:**
- What's not tested: Boundary values for lat/lng (`-90`, `90`, `-180`, `180`), empty strings, very long strings, numeric strings coerced via `parseFloat`.
- Files: `backend/src/controllers/ocorrenciaController.js` (lines 5–15)
- Risk: Silent acceptance of invalid geographic coordinates or oversized payloads.
- Priority: High

---

## Scaling Limits

**SQLite as the production database:**
- Current capacity: Suitable for low-concurrency single-instance deployments (tens of concurrent users).
- Limit: SQLite WAL mode supports multiple readers but only one writer at a time. High write concurrency (multiple simultaneous form submissions) will queue and may timeout.
- Scaling path: Migrate to PostgreSQL or MySQL if concurrent write load increases, or if the app needs to run across multiple server processes.

**No rate limiting on the API:**
- Current capacity: Unlimited requests accepted from any IP.
- Limit: A single client can flood the POST endpoint and fill the database or exhaust server memory.
- Scaling path: Add `express-rate-limit` middleware on write endpoints; consider a global limiter on all routes.

---

*Concerns audit: 2026-04-06*
