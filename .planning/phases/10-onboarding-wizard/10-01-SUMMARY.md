---
phase: 10-onboarding-wizard
plan: "01"
subsystem: backend + frontend-api
tags: [onboarding, migration, sqlite, express, auth]
dependency_graph:
  requires: []
  provides: [PATCH /api/usuarios/me, onboarding_done em /api/auth/me, api.usuarios.setOnboardingDone]
  affects: [backend/src/config/database.js, backend/src/routes/auth.js, backend/src/routes/usuarios.js, backend/src/app.js, frontend/src/services/api.js]
tech_stack:
  added: []
  patterns: [migration segura try/catch ALTER TABLE, requireAuth middleware, sub-objeto de API no frontend]
key_files:
  created:
    - backend/src/routes/usuarios.js
  modified:
    - backend/src/config/database.js
    - backend/src/routes/auth.js
    - backend/src/app.js
    - frontend/src/services/api.js
decisions:
  - "UPDATE usa WHERE id = req.session.userId (nunca req.body.userId) para prevenir Elevation of Privilege (T-10-01)"
  - "Validacao strict onboarding_done === 1 retorna 400 para qualquer outro valor (T-10-02)"
  - "Campo onboarding_done tratado como accept para Information Disclosure pois e inteiro binario sem dado sensivel (T-10-03)"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 4
requirements:
  - UX-04
---

# Phase 10 Plan 01: Backend Onboarding — Migration, Endpoint e API Client Summary

**One-liner:** Migration idempotente de `onboarding_done` + endpoint `PATCH /api/usuarios/me` protegido por `requireAuth` + método `api.usuarios.setOnboardingDone()` no cliente frontend.

## What Was Built

Camada backend completa para persistir o estado do wizard de onboarding:

1. **Migration segura** — coluna `onboarding_done INTEGER NOT NULL DEFAULT 0` adicionada à tabela `usuarios` via bloco `try/catch ALTER TABLE`, seguindo o padrão já estabelecido para `alert_threshold` e `alert_hours_before`. Idempotente em banco existente.

2. **GET /api/auth/me ampliado** — SELECT expandido para incluir `onboarding_done`; campo `onboarding_done: usuario?.onboarding_done ?? 0` adicionado ao JSON de resposta. O frontend consegue determinar se o wizard deve ser exibido sem chamadas extras.

3. **PATCH /api/usuarios/me (novo router)** — `backend/src/routes/usuarios.js` criado do zero com:
   - `requireAuth` middleware bloqueando requisições sem sessão (401)
   - Validação `onboarding_done !== 1` retornando 400 (previne tampering — T-10-02)
   - `UPDATE usuarios SET onboarding_done = 1 ... WHERE id = req.session.userId` (nunca `req.body.userId` — T-10-01)
   - Tratamento de erros com `console.error` e 500

4. **Mount em app.js** — `app.use('/api/usuarios', usuariosRouter)` registrado após o bloco de rotas existentes.

5. **api.usuarios.setOnboardingDone()** — sub-objeto `usuarios` adicionado ao objeto `api` exportado em `frontend/src/services/api.js`, inserido entre `push` e `alertas`. Envia `PATCH /api/usuarios/me` com `{ onboarding_done: 1 }`.

## Commits

| Hash | Mensagem |
|------|----------|
| 3fd44ca | feat(10-01): migration segura onboarding_done + expor campo em /api/auth/me |
| 6a77007 | feat(10-01): criar usuarios.js com PATCH /me + mount em app.js |
| c6a1bb1 | feat(10-01): adicionar api.usuarios.setOnboardingDone() em api.js |

## Success Criteria Verification

| Critério | Status |
|----------|--------|
| Migration `onboarding_done` no banco após startup (try/catch idêntico ao padrão) | PASS |
| GET /api/auth/me retorna `onboarding_done` no JSON | PASS |
| PATCH /api/usuarios/me com sessão válida e `{ onboarding_done: 1 }` → 200 `{ ok: true }` | PASS |
| PATCH /api/usuarios/me sem sessão → 401 | PASS (requireAuth) |
| PATCH /api/usuarios/me com `{ onboarding_done: 0 }` → 400 | PASS (validação strict !== 1) |
| `api.usuarios.setOnboardingDone()` disponível no frontend | PASS |

## Deviations from Plan

None — plano executado exatamente como escrito.

## Known Stubs

None — todas as implementações são funcionais e sem placeholders.

## Threat Surface Scan

Nenhuma superfície nova além das descritas no `<threat_model>` do plano:

| Flag | File | Description |
|------|------|-------------|
| Novo endpoint autenticado | backend/src/routes/usuarios.js | PATCH /api/usuarios/me — mitigações T-10-01 e T-10-02 aplicadas conforme threat_model |

## Self-Check: PASSED

- `backend/src/routes/usuarios.js` — FOUND
- `backend/src/config/database.js` contém `onboarding_done` — FOUND
- `backend/src/routes/auth.js` contém `onboarding_done` (2 ocorrências) — FOUND
- `backend/src/app.js` contém `app.use('/api/usuarios'` — FOUND
- `frontend/src/services/api.js` contém `setOnboardingDone` — FOUND
- Commits 3fd44ca, 6a77007, c6a1bb1 — FOUND
