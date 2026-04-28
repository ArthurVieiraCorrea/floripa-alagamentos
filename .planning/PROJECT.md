# Floripa Alagamentos

## What This Is

Sistema de monitoramento e alerta de alagamentos para Florianópolis voltado ao público geral. Cruza previsão horária de precipitação do Open-Meteo com histórico de ocorrências por bairro e observações reais (Visual Crossing + REDEMET METAR) para calcular score de risco (0-100), exibe mapa choropleth interativo, e envia push notifications quando um evento do Google Calendar do usuário cai em bairro com risco acima do threshold configurado. Novos usuários são guiados por wizard de onboarding de 3 passos.

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
- ✓ Retry com backoff exponencial para fetch Open-Meteo — v1.1 (RESIL-02)
- ✓ Auto-trigger de recálculo de risco após importação CSV — v1.1 (RESIL-01)
- ✓ Banner de dados stale quando forecast desatualizado >120min — v1.1 (RESIL-03)
- ✓ Antecedência de alerta configurável por usuário (1h a 48h) — v1.0/v1.1 verificado (UX-01)
- ✓ Painel de status do sistema (forecast freshness, calendar sync, push ativo) — v1.1 (UX-02)
- ✓ Histórico de alertas recebidos pelo usuário — v1.1 (UX-03)
- ✓ Onboarding wizard de 3 passos (login → calendar → push) — v1.1 (UX-04)
- ✓ Precipitação observada real (Visual Crossing mm + REDEMET METAR) no motor de risco — v1.1 (D-01..16)

### Active

*(Nenhum requirement ativo — aguardando definição de v1.2)*

### Out of Scope

- Notificações por WhatsApp ou SMS — complexidade de integração e custo; app-first para v1.x
- App mobile nativo — web responsiva atende o caso de uso; mobile pode ser v2
- Previsão de enchentes em rodovias ou rios — foco em bairros urbanos de Florianópolis
- Crowdsourcing de ocorrências sem moderação — risco de dados falsos contaminando o modelo de risco
- INMET como fonte primária — TLS failure confirmado empiricamente; Open-Meteo superior em confiabilidade
- Machine learning / modelos preditivos avançados — regressão simples suficiente até ter volume de dados

## Context

**Codebase:** ~5.855 LOC (2819 backend JS + 1992 frontend JS + 366 HTML + 678 CSS). Stack: Node.js + Express + SQLite + Vite + Leaflet + vanilla JS.

**v1.0 shipped 2026-04-17.** Sistema end-to-end funcional: OAuth → Calendar → risco → push. 69 commits, 9 dias de desenvolvimento.

**v1.1 shipped 2026-04-28.** Resiliência + UX + dados reais. 52 commits, 11 dias. Backend resiliente (backoff, auto-trigger CSV), UX expandida (painel status, histórico alertas, banner stale), fontes reais integradas (Visual Crossing + REDEMET), onboarding wizard completo.

**Open-Meteo** escolhido sobre INMET (TLS failure confirmado). Dados de precipitação horária, sem API key, SLA superior. **Visual Crossing** adicionado em v1.1 para precipitação observada (mm reais). **REDEMET** adicionado para METAR SBFL qualitativo. Ambos com degradação graceful quando API keys ausentes.

**SQLite single-file** suficiente para v1 com volume de Florianópolis. Sem Redis, sem filas, node-cron no mesmo processo Express.

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
| stale=true threshold de 120min (v1.1) | 2x o intervalo do cron — tolera falhas transitórias sem alarme falso | ✓ Bom — sem falsos positivos em operação |
| Best-effort auto-trigger pós-CSV (v1.1) | Import stats sempre retornados; recalculo field sinaliza falha sem bloquear | ✓ Bom — admin não perde import por falha no side-effect |
| Modal wizard injetado por JS (v1.1) | Evita flash do modal antes da sessão ser carregada | ✓ Bom — sem flash de conteúdo não autenticado |
| Visual Crossing + REDEMET paralelos no scheduler (v1.1) | Independentes; falha de um não bloqueia o outro; degradação graceful | ✓ Bom — sistema funciona mesmo sem API keys |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-28 after v1.1 milestone*
