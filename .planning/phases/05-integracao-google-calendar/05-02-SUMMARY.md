---
phase: 05-integracao-google-calendar
plan: 02
subsystem: backend/calendar-http
tags: [calendar, http, routes, controller, scheduler, auth]
dependency_graph:
  requires: [05-01]
  provides: [calendar-http-routes, calendar-scheduler-job, auth-me-calendar-fields]
  affects: [frontend-calendar-ui]
tech_stack:
  added: []
  patterns: [inline-requireAuth, background-sync-fire-and-forget, cron-30min]
key_files:
  created:
    - backend/src/controllers/calendarController.js
    - backend/src/routes/calendar.js
  modified:
    - backend/src/app.js
    - backend/src/jobs/scheduler.js
    - backend/src/routes/auth.js
decisions:
  - "requireAuth inline em routes/calendar.js (mesmo padrão de ocorrencias.js) em vez de importar middleware central"
  - "desconectar reseta calendar_disconnected para 0 para limpar flag de invalid_grant anterior"
  - "atualizarBairro verifica existência do evento via db.get após UPDATE (node-sqlite3-wasm não expõe changes)"
metrics:
  duration_minutes: 10
  completed_at: "2026-04-09T03:20:51Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 05 Plan 02: Calendar Routes, Controller, Scheduler Job e auth/me Summary

HTTP layer da integração Google Calendar: 4 rotas protegidas por requireAuth, job cron de sync a cada 30 minutos, e campos de estado do calendário expostos em GET /api/auth/me.

## Tasks Executadas

| Task | Nome | Commit | Arquivos |
|------|------|--------|----------|
| 1 | Criar calendarController.js e routes/calendar.js | 4f53c12 | backend/src/controllers/calendarController.js, backend/src/routes/calendar.js |
| 2 | Registrar router, adicionar job, atualizar GET /me | 7615c01 | backend/src/app.js, backend/src/jobs/scheduler.js, backend/src/routes/auth.js |

## O que foi construído

**calendarController.js** — 4 handlers:
- `conectar`: verifica `refresh_token_enc`, seta `calendar_connected=1, calendar_disconnected=0`, dispara `syncUserCalendar` em background (`.catch` only), responde imediatamente com 200
- `desconectar`: seta `calendar_connected=0, calendar_disconnected=0`, DELETE de `calendar_events_cache WHERE usuario_id = req.session.userId`, NÃO toca `refresh_token_enc`
- `listarEventos`: SELECT de `calendar_events_cache ORDER BY start_time ASC`, retorna `{ eventos: [...] }`
- `atualizarBairro`: valida bairro como string não-vazia, UPDATE filtrado por `usuario_id AND google_event_id`, retorna 404 se evento não encontrado

**routes/calendar.js** — Router Express com `requireAuth` inline protegendo todas as rotas:
- `POST /connect` → `conectar`
- `DELETE /disconnect` → `desconectar`
- `GET /eventos` → `listarEventos`
- `PATCH /eventos/:googleEventId` → `atualizarBairro`

**app.js** — `calendarRouter` registrado em `/api/calendar`

**scheduler.js** — Job `cron.schedule('*/30 * * * *', syncAllConnectedUsers, { timezone: 'America/Sao_Paulo' })` adicionado em `initScheduler()`

**auth.js** — GET /me agora consulta `calendar_connected` e `calendar_disconnected` do banco e os inclui no payload de resposta

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — todos os handlers fazem operações reais no banco via `getDb()`.

## Threat Flags

Nenhum novo surface encontrado. Todas as rotas estão protegidas por `requireAuth` (T-05-06). UPDATE e DELETE filtrados por `usuario_id = req.session.userId` (T-05-07, T-05-08). Validação de `bairro` como string não-vazia implementada (T-05-07).

## Self-Check: PASSED

Arquivos criados:
- FOUND: backend/src/controllers/calendarController.js
- FOUND: backend/src/routes/calendar.js

Commits:
- FOUND: 4f53c12
- FOUND: 7615c01

Verificações:
- `Object.keys(ctrl)` = `conectar, desconectar, listarEventos, atualizarBairro`
- `grep "api/calendar" backend/src/app.js` = match
- `grep "syncAllConnectedUsers" backend/src/jobs/scheduler.js` = match (2 linhas)
- `grep "calendar_connected" backend/src/routes/auth.js` = match (2 linhas)
