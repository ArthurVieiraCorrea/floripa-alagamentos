# Floripa Alagamentos

## What This Is

Sistema de monitoramento e alerta de alagamentos para Florianópolis voltado ao público geral. Cruza previsão horária de precipitação do Open-Meteo com histórico de ocorrências por bairro para calcular score de risco (0-100), exibe mapa choropleth interativo, e envia push notifications quando um evento do Google Calendar do usuário cai em bairro com risco acima do threshold configurado.

## Core Value

Avisar o usuário antes de ir a um lugar que pode estar alagado — não depois.

## Requirements

### Validated

- ✓ Registrar ocorrências de alagamento no mapa (lat/lng, bairro, nível, descrição) — existing
- ✓ Listar ocorrências recentes no mapa Leaflet com auto-refresh de 60s — existing
- ✓ Histórico paginado com filtros por bairro e nível — existing
- ✓ Estatísticas básicas de ocorrências — existing
- ✓ Google OAuth login com sessão persistente — v1.0 (AUTH-01, AUTH-02, AUTH-03)
- ✓ Criação pública, deleção autenticada — v1.0 (AUTH-04)
- ✓ Previsão Open-Meteo cacheada, atualização automática a cada 1h — v1.0 (PREV-01, PREV-02, PREV-03)
- ✓ Fator de saturação 48h acumulado — v1.0 (PREV-04)
- ✓ Score de risco 0-100 por bairro, recalculado a cada 4h — v1.0 (RISCO-01, RISCO-02, RISCO-03)
- ✓ Flag "dados limitados" para bairros com histórico insuficiente — v1.0 (RISCO-04)
- ✓ Mapa choropleth com seletor 24h/48h/72h e popup por bairro — v1.0 (DASH-01, DASH-02, DASH-03, DASH-04)
- ✓ Integração Google Calendar: conectar, ler eventos 72h, resolver bairro, desconectar — v1.0 (CAL-01..05)
- ✓ Web Push (VAPID) com opt-in, deduplicação e threshold configurável — v1.0 (ALERT-01..04)
- ✓ Fallback in-app banner para usuários sem push subscription — v1.0 (ALERT-05)
- ✓ Detecção de invalid_grant com aviso ao usuário — v1.0 (ALERT-06)
- ✓ Painel admin CSV: upload, validação, deduplicação, preview/confirm — v1.0 (HIST-01, HIST-02, HIST-03)

### Active

- [ ] Trigger manual de recálculo de risco após importação CSV (eliminar lag de 4h)
- [ ] Retry com backoff para fetch Open-Meteo + banner de dados stale
- [ ] Antecedência de alerta configurável por usuário (1h a 48h)
- [ ] Onboarding guiado (wizard 3 passos: login → calendar → push)
- [ ] Painel de status do sistema (forecast freshness, calendar sync, push ativo)
- [ ] Histórico de alertas recebidos pelo usuário

### Out of Scope

- Notificações por WhatsApp ou SMS — complexidade de integração e custo; app-first para v1
- App mobile nativo — web responsiva atende o caso de uso; mobile pode ser v2
- Previsão de enchentes em rodovias ou rios — foco em bairros urbanos de Florianópolis
- Crowdsourcing de ocorrências sem moderação — risco de dados falsos contaminando o modelo de risco
- INMET como fonte primária — TLS failure confirmado empiricamente; Open-Meteo superior em confiabilidade
- Machine learning / modelos preditivos avançados — regressão simples suficiente até ter volume de dados

## Context

**Codebase:** ~4,762 LOC (3,815 JS + 465 HTML + 482 CSS). Stack: Node.js + Express + SQLite + Vite + Leaflet + vanilla JS.

**v1.0 shipped 2026-04-17.** Sistema end-to-end funcional: OAuth → Calendar → risco → push. 69 commits, 9 dias de desenvolvimento.

**Open-Meteo** escolhido sobre INMET (TLS failure confirmado). Dados de precipitação horária, sem API key, SLA superior.

**SQLite single-file** suficiente para v1 com volume de Florianópolis. Sem Redis, sem filas, node-cron no mesmo processo Express.

**Próximo foco:** melhorias de resiliência e UX (v1.1) — as 3 features de alto impacto já implementadas, médias a planejar.

## Constraints

- **Stack:** Node.js + Express + SQLite + vanilla JS — manter para v1.x; sem migração de banco ou framework
- **Auth:** OAuth Google — define o provedor de toda a plataforma
- **Deploy:** Single Node.js process servindo frontend estático — sem Kubernetes ou microservices
- **Geo:** Florianópolis only — escopo geográfico fixo para v1.x

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google Calendar como mecanismo de agenda | Usuário já tem agenda lá; evita construir calendário do zero | ✓ Bom — integração transparente para o usuário |
| SQLite como banco de dados | Já estava em uso; suficiente para v1 com volume de Florianópolis | ✓ Bom — zero operações, funciona bem |
| Web Push (VAPID) em vez de só in-app | ALERT-01 no escopo; in-app como fallback para iOS/browsers sem suporte | ✓ Bom — cobre maioria dos casos |
| Open-Meteo em vez de INMET | INMET TLS failure confirmado empiricamente; Open-Meteo REST+JSON sem API key | ✓ Bom — zero falhas em produção |
| node-cron no mesmo processo Express | Single-process constraint; bull/agenda exigem Redis/Mongo | ✓ Bom — simples, suficiente para v1 |
| prompt:'consent' obrigatório no OAuth | Sem ele, Google omite refresh_token em logins repetidos | ✓ Crítico — evitou bug silencioso na Fase 5 |
| Dual mount authRouter em /auth e /api/auth | Router único, dois prefixos — evita duplicar definições | ✓ Bom — simplifica roteamento |
| initScheduler() antes de app.listen() | Garante initSchema() rodado antes do warm-up do scheduler | ✓ Bom — evita race condition no startup |

---
*Last updated: 2026-04-17 after v1.0 milestone*
