---
phase: 05-integracao-google-calendar
plan: 01
subsystem: backend/calendar
tags: [calendar, google-api, sqlite, oauth2, bairros]
dependency_graph:
  requires: []
  provides: [calendarService.fetchEventsFor72h, calendarService.resolverBairro, calendarService.syncUserCalendar, calendarService.syncAllConnectedUsers, constants.BAIRROS_FLORIANOPOLIS, constants.normalizarNome, calendar_events_cache]
  affects: [backend/src/services/riskEngine.js, backend/src/config/database.js]
tech_stack:
  added: []
  patterns: [AES-256-GCM decrypt via crypto.js, googleapis OAuth2 auto-refresh, SQLite INSERT OR REPLACE, invalid_grant soft-disconnect]
key_files:
  created:
    - backend/src/constants/bairros.js
    - backend/src/services/calendarService.js
  modified:
    - backend/src/services/riskEngine.js
    - backend/src/config/database.js
decisions:
  - "BAIRROS_FLORIANOPOLIS extraído para constants/bairros.js para evitar duplicação entre riskEngine e calendarService"
  - "resolverBairro implementado em 2 níveis: exact match normalizado, depois substring — retorna null sem bloquear sync"
  - "Eventos all-day normalizados para UTC midnight (date + T00:00:00.000Z) antes de persistir em start_time"
  - "invalid_grant: detectado por err.message e err.response.data.error; seta calendar_disconnected=1, não relança"
  - "syncUserCalendar faz DELETE antes de INSERT para evitar acúmulo de eventos expirados fora da janela de 72h"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-09"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 05 Plan 01: Calendar Service Foundation Summary

**One-liner:** Sincronização de eventos Google Calendar com resolução de bairro em 2 níveis, cache SQLite e tratamento de invalid_grant via AES-256-GCM decrypt.

## What Was Built

### Task 1: constants/bairros.js + riskEngine.js refactor

Criado `backend/src/constants/bairros.js` como módulo canônico compartilhado contendo:
- `BAIRROS_FLORIANOPOLIS`: array de 50 bairros oficiais de Florianópolis (Ilha Norte/Leste/Sul/Central e Continental)
- `normalizarNome(nome)`: normalização Unicode NFD + lowercase + strip diacríticos para comparação tolerante

`riskEngine.js` foi refatorado para importar de `constants/bairros.js` via destructuring, eliminando as definições locais duplicadas (redução de 37 linhas).

### Task 2: calendar_events_cache schema + calendarService.js

**database.js** — dois novos DDL em `initSchema()`:
- Tabela `calendar_events_cache` com `UNIQUE(usuario_id, google_event_id)` e FK `ON DELETE CASCADE` para `usuarios`
- Índice `idx_cal_cache_usuario_start` em `(usuario_id, start_time)` para queries de eventos por período

**calendarService.js** — 4 funções exportadas:

| Função | Responsabilidade |
|--------|-----------------|
| `buildOAuth2ClientForUser(refreshTokenEnc)` | Descriptografa token via crypto.js, configura OAuth2Client (não exportada, usada internamente) |
| `fetchEventsFor72h(oauth2Client)` | Busca eventos primários nas próximas 72h com `singleEvents:true, orderBy:startTime, maxResults:250` |
| `resolverBairro(locationText)` | Match 2 níveis: exato normalizado → substring; retorna bairro canônico ou null |
| `syncUserCalendar(usuario)` | Sync completo: decrypt → fetch → DELETE anterior → INSERT OR REPLACE em transação; captura invalid_grant |
| `syncAllConnectedUsers()` | Itera `WHERE calendar_connected=1 AND calendar_disconnected=0 AND refresh_token_enc IS NOT NULL` |

## Decisions Made

1. **Lista canônica em módulo separado:** `riskEngine.js` e `calendarService.js` precisam dos mesmos bairros. Extrair para `constants/bairros.js` evita divergência futura e respeita DRY.

2. **resolverBairro 2 níveis:** Nível 1 (exact match) garante precisão. Nível 2 (substring) cobre casos como "Rua das Flores, Agronômica, Florianópolis". Ambos normalizam acentos e case.

3. **DELETE antes de re-inserir:** Em vez de confiar no `INSERT OR REPLACE` (que só substitui por google_event_id), o DELETE limpa eventos expirados fora da janela de 72h que não aparecem mais na API.

4. **invalid_grant não relança:** Falha de um usuário não deve interromper a sincronização dos demais. O flag `calendar_disconnected=1` é a notificação persistente para o ALERT-06 da Fase 6.

5. **Sem novas dependências npm:** Todo o plano usa apenas `googleapis` (já instalado), `node-sqlite3-wasm` (já instalado) e módulos built-in do Node.

## Deviations from Plan

None — plano executado exatamente como especificado.

## Commits

| Hash | Message |
|------|---------|
| c4a97cb | feat(05-01): extract BAIRROS_FLORIANOPOLIS and normalizarNome to constants/bairros.js |
| 3899513 | feat(05-01): calendarService, bairros constants, calendar_events_cache schema |

## Verification Results

```
count: 50
normaliza: agronomica
riskEngine ok
exports: fetchEventsFor72h, resolverBairro, syncUserCalendar, syncAllConnectedUsers
table ok
resolverBairro(null): null
resolverBairro(Agronômica): Agronômica
resolverBairro(Av. Beiramar Norte, Agronômica): Agronômica
resolverBairro(sem localização relevante): null
```

## Self-Check: PASSED
