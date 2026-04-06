# Floripa Alagamentos

## What This Is

Sistema de monitoramento e previsão de alagamentos para Florianópolis voltado ao público geral. Cruza previsão de chuva do INMET/CPTEC com histórico de ocorrências por bairro para calcular risco de alagamento, e avisa usuários via notificações no app quando uma área que eles planejam visitar (via Google Calendar) tem previsão de risco elevado.

## Core Value

Avisar o usuário antes de ir a um lugar que pode estar alagado — não depois.

## Requirements

### Validated

- ✓ Registrar ocorrências de alagamento no mapa (lat/lng, bairro, nível, descrição) — existing
- ✓ Listar ocorrências recentes no mapa Leaflet com auto-refresh de 60s — existing
- ✓ Histórico paginado com filtros por bairro e nível — existing
- ✓ Estatísticas básicas de ocorrências — existing

### Active

- [ ] Integração com API INMET/CPTEC para previsão de precipitação por bairro/região
- [ ] Motor de risco: cruza previsão de chuva com histórico de alagamentos para calcular probabilidade de alagamento por bairro
- [ ] Cadastro de usuários com autenticação básica (necessário para associar calendário e enviar alertas personalizados)
- [ ] Integração com Google Calendar: usuário conecta conta e o sistema monitora eventos na semana
- [ ] Alertas in-app: notificação quando evento do calendário cai em área com risco de alagamento previsto
- [ ] Dashboard de previsão: visualização do mapa com camada de risco previsto (próximas 24h, 48h, 72h)
- [ ] Painel admin para importar/validar dados históricos de fontes oficiais (Defesa Civil, CASAN)

### Out of Scope

- Notificações por WhatsApp ou SMS — complexidade de integração e custo; app-first para v1
- App mobile nativo — web responsiva atende o caso de uso; mobile pode ser v2
- Previsão de enchentes em rodovias ou rios — foco em bairros urbanos de Florianópolis
- Crowdsourcing de ocorrências sem moderação — risco de dados falsos contaminando o modelo de risco

## Context

O codebase já tem a infraestrutura base: Express + SQLite + Leaflet + vanilla JS. A tabela `ocorrencias` registra eventos com lat/lng, bairro, nível de severidade e timestamp. O frontend é SPA sem framework, o que é bom para manter simples mas limitará componentes mais ricos (calendário, notificações) — pode ser necessário adicionar uma biblioteca leve.

A autenticação é zero atualmente (API totalmente aberta). Para v1 com Google Calendar precisamos pelo menos OAuth básico.

Florianópolis tem dados históricos de alagamentos disponíveis via Defesa Civil SC e prefeitura — precisam ser importados e normalizados.

## Constraints

- **Stack:** Node.js + Express + SQLite + vanilla JS — manter stack atual para v1; sem migração de banco ou framework
- **API meteorológica:** INMET/CPTEC — APIs públicas brasileiras, sem custo, mas com limites de taxa e formato que precisam ser mapeados
- **Auth:** OAuth Google (necessário para Calendar) — define o provedor de auth de toda a plataforma
- **Deploy:** Single Node.js process servindo frontend estático — sem Kubernetes ou microservices para v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google Calendar como mecanismo de agenda | Usuário já tem agenda lá; evita construir calendário do zero | — Pending |
| SQLite como banco de dados | Já está em uso; suficiente para v1 com volume de Florianópolis | — Pending |
| Notificação in-app (não push nativo) | Evita complexidade de service workers e certificados para v1 | — Pending |
| INMET/CPTEC como fonte meteorológica | Dados oficiais, gratuitos, brasileiros | — Pending |

## Evolution

Este documento evolui a cada fase e milestone.

**Após cada fase:**
1. Requirements invalidados? → Mover para Out of Scope com motivo
2. Requirements validados? → Mover para Validated com referência de fase
3. Novos requirements? → Adicionar em Active
4. Decisões para registrar? → Adicionar em Key Decisions

**Após cada milestone:**
1. Revisão completa de todas as seções
2. Core Value ainda correto?
3. Out of Scope ainda válido?
4. Atualizar Context com estado atual

---
*Last updated: 2026-04-06 after initialization*
