# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:** None configured

No test framework is installed or configured in this project. Neither `backend/package.json` nor `frontend/package.json` includes a test dependency (e.g. Jest, Vitest, Mocha) or a `test` script.

**Assertion Library:** None

**Config files:** None found (`jest.config.*`, `vitest.config.*` — absent)

**Run Commands:**
```bash
# No test commands available
# npm test would use the default "echo Error: no test specified && exit 1"
```

## Test File Organization

**Location:** No test files exist in the project source directories.

The only `.test.js` and `.spec.ts` files present are inside `backend/node_modules/` (third-party packages), not in project source code.

**Naming:** No established pattern (no tests to observe)

**Structure:**
```
backend/src/       # No test files
frontend/src/      # No test files
```

## Test Structure

**Suite Organization:** Not established — no tests exist.

**Patterns:** Not established.

## Mocking

**Framework:** None

**Patterns:** Not established.

**What to Mock (recommendations for when tests are added):**
- `backend/src/config/database.js` — the `getDb()` singleton should be mocked in controller/model unit tests to avoid real DB I/O
- `fetch` in `frontend/src/services/api.js` — mock with `vi.stubGlobal('fetch', ...)` (Vitest) or `jest.spyOn(global, 'fetch')` when testing frontend service functions
- `window.L` (Leaflet) in `frontend/src/services/mapa.js` — declared as `/* global L */`; should be stubbed in any map unit tests

## Fixtures and Factories

**Test Data:** Not established.

**Location:** No fixtures directory exists.

**Recommended fixture shape** (based on DB schema in `backend/src/config/database.js`):
```js
const ocorrenciaFixture = {
  id: 1,
  latitude: -27.5954,
  longitude: -48.5480,
  bairro: 'Centro',
  nivel: 'alto',
  descricao: 'Rua alagada',
  fonte: 'manual',
  criado_em: '2026-04-06 12:00:00',
  atualizado_em: '2026-04-06 12:00:00'
};
```

## Coverage

**Requirements:** None enforced (no coverage config, no CI pipeline).

**View Coverage:** Not available.

## Test Types

**Unit Tests:** Not present.

**Integration Tests:** Not present.

**E2E Tests:** Not present.

## Gaps and Recommendations

The entire test surface is uncovered. The following areas carry the highest risk without tests:

**High priority — backend:**

- `backend/src/controllers/ocorrenciaController.js` — `validarOcorrencia()` function contains coordinate bounds logic and enum validation; easily unit-testable as a pure function
- `backend/src/models/ocorrencia.js` — `buildWhere()` helper constructs SQL fragments dynamically; SQL injection risk if logic changes
- `backend/src/controllers/ocorrenciaController.js` — pagination clamping (`Math.min(200, ...)`, `Math.max(1, ...)`) has no test coverage

**High priority — frontend:**

- `frontend/src/services/api.js` — `request()` function handles all HTTP error mapping; critical path with no tests
- `frontend/src/services/mapa.js` — `criarIcone()` and `renderizarMarcadores()` are pure enough to unit-test without a browser

**Recommended setup when adding tests:**

- **Backend:** Add Jest or Node's built-in `node:test` runner to `backend/package.json`
  ```json
  "scripts": { "test": "node --test" }
  ```
- **Frontend:** Add Vitest (already uses Vite) to `frontend/package.json`
  ```json
  "devDependencies": { "vitest": "^1.x" },
  "scripts": { "test": "vitest" }
  ```
- Place test files co-located with source: `backend/src/controllers/ocorrenciaController.test.js`
- Use an in-memory SQLite DB or mock `getDb()` for backend tests to avoid touching `backend/data/alagamentos.db`

---

*Testing analysis: 2026-04-06*
