---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-04-07T20:45:00.000Z"
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 43
---

# State: Floripa Alagamentos

*Project memory — updated at the end of every session*

---

## Project Reference

**Core Value:** Avisar o usuário antes de ir a um lugar que pode estar alagado — não depois.
**Milestone:** v1 — Sistema de Alerta de Alagamentos
**Current Focus:** Phase 04 — Dashboard de Previsão

---

## Current Position

Phase: 03 (motor-de-risco) — COMPLETE
**Phase:** Fase 4 — Dashboard de Previsão (next)
**Status:** Phase 03 complete — ready to plan Phase 04
**Overall Progress:** 9/9 plans complete (phases 1+2+3 done)

```
[████████████████░░░░░░░░░░░░░░░░] 43% (3 of 7 phases)
```

---

## Phase Status

| Phase | Status | Plans Done |
|-------|--------|-----------|
| 1. Autenticação | Complete | 3/3 |
| 2. Integração Meteorológica | Complete | 3/3 |
| 3. Motor de Risco | Complete | 3/3 |
| 4. Dashboard de Previsão | Not started | 0/3 |
| 5. Integração Google Calendar | Not started | 0/3 |
| 6. Alertas e Notificações Push | Not started | 0/3 |
| 7. Dados Históricos (Admin) | Not started | 0/3 |

---

## Accumulated Context

### Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Open-Meteo como fonte primária de precipitação | INMET tem baixa confiabilidade documentada (PITFALLS.md); Open-Meteo é REST+JSON sem API key, granularidade horária, SLA superior |
| Web Push (VAPID) incluído em v1 | REQUIREMENTS.md inclui ALERT-01; in-app polling como fallback (ALERT-05) para iOS/browsers sem subscription |
| Fase 7 (Admin/Histórico) separada das demais | Motor de risco (Fase 3) já usa `ocorrencias` existente; importação CSV é enriquecimento, não pré-requisito |
| node-cron no mesmo processo Express | Single-process deployment constraint; bull/agenda exigem Redis/Mongo |
| initScheduler() chamado antes de app.listen() | Garante que initSchema() já rodou via session middleware antes do warm-up do scheduler |
| stale=true threshold de 120min | 2x o intervalo do cron — tolera falhas transitórias de rede sem alarme falso |
| Criação de ocorrências permanece pública | AUTH-04 explícito; apenas deleção exige auth |
| Dual mount authRouter em /auth e /api/auth | Router único, dois prefixos — evita duplicar definições de rotas |
| prompt:'consent' obrigatório no generateAuthUrl | Sem ele, Google omite refresh_token em logins repetidos, quebrando silenciosamente a Fase 5 |

### Architecture Notes

- `googleapis` para OAuth2 + Calendar (não passport-google-oauth20 — esse é para login-only, não delegated Calendar access)
- `express-session` com store SQLite para sessão persistente (AUTH-02)
- `refresh_token` criptografado com AES-256-GCM, chave em `ENCRYPTION_KEY` env var
- Service worker em `frontend/public/sw.js` (Vite copia `public/` verbatim para `dist/`)
- GeoJSON dos bairros de Florianópolis necessário para choropleth — ainda não presente no codebase

### Blockers / Risks

- GeoJSON dos bairros de Florianópolis não está no repositório — precisa ser localizado ou criado antes da Fase 4
- Endpoints INMET têm confiança LOW (STACK.md) — validar empiricamente antes de implementar fallback na Fase 2
- Permissões Google Cloud Console (habilitar Calendar API, configurar redirect URIs) são pré-requisito humano antes da Fase 1

### Todos (cross-phase)

- [ ] Obter/criar GeoJSON dos bairros de Florianópolis (necessário para Fase 4)
- [ ] Criar projeto no Google Cloud Console e habilitar Calendar API antes de iniciar Fase 1
- [ ] Verificar empiricamente endpoints INMET antes de implementar Fase 2

---

## Session Continuity

**Last session:** 2026-04-07T20:45:00.000Z
**Next action:** Plan and execute Phase 04 — Dashboard de Previsão

---

*Last updated: 2026-04-06 after roadmap initialization*
