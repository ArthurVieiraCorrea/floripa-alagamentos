# Roadmap: Floripa Alagamentos

## Milestones

- ✅ **v1.0 MVP** — Fases 1-7 (shipped 2026-04-17)
- ✅ **v1.1 Resiliência & UX** — Fases 8-10 (shipped 2026-04-28)

## Phases

<details>
<summary>✅ v1.0 MVP (Fases 1-7) — SHIPPED 2026-04-17</summary>

- [x] Fase 1: Autenticação (3/3 plans) — Google OAuth, sessão persistente, proteção de deleção
- [x] Fase 2: Integração Meteorológica (3/3 plans) — Open-Meteo cache SQLite, scheduler 1h
- [x] Fase 3: Motor de Risco (3/3 plans) — Score 0-100 por bairro, recálculo 4h
- [x] Fase 4: Dashboard de Previsão (3/3 plans) — Choropleth Leaflet, seletor 24h/48h/72h
- [x] Fase 5: Integração Google Calendar (3/3 plans) — Eventos 72h, resolução de bairro
- [x] Fase 6: Alertas e Notificações Push (3/3 plans) — VAPID, deduplicação, fallback in-app
- [x] Fase 7: Dados Históricos Admin (3/3 plans) — CSV upload, validação, preview/confirm

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 Resiliência & UX (Fases 8-10) — SHIPPED 2026-04-28</summary>

- [x] Phase 8: Backend Resilience (2/2 plans) — Backoff exponencial Open-Meteo, auto-trigger recálculo pós-CSV — completed 2026-04-19
- [x] Phase 9: Frontend UX (3/3 plans) — Painel status, histórico alertas, banner stale, seletor antecedência — completed 2026-04-22
- [x] Phase 09.1: Integração Dados Meteorológicos Reais (4/4 plans, INSERTED) — Visual Crossing + REDEMET METAR + fallback Open-Meteo — completed 2026-04-24
- [x] Phase 10: Onboarding Wizard (2/2 plans) — Wizard 3 passos login→calendar→push com flag persistente — completed 2026-04-28

See `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

### 📋 v1.2 (Planned)

*Next milestone to be defined via `/gsd-new-milestone`*

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Autenticação | v1.0 | 3/3 | Complete | 2026-04-08 |
| 2. Integração Meteorológica | v1.0 | 3/3 | Complete | 2026-04-10 |
| 3. Motor de Risco | v1.0 | 3/3 | Complete | 2026-04-11 |
| 4. Dashboard de Previsão | v1.0 | 3/3 | Complete | 2026-04-12 |
| 5. Integração Google Calendar | v1.0 | 3/3 | Complete | 2026-04-13 |
| 6. Alertas e Notificações Push | v1.0 | 3/3 | Complete | 2026-04-14 |
| 7. Dados Históricos Admin | v1.0 | 3/3 | Complete | 2026-04-15 |
| 8. Backend Resilience | v1.1 | 2/2 | Complete | 2026-04-19 |
| 9. Frontend UX | v1.1 | 3/3 | Complete | 2026-04-22 |
| 9.1. Integração Dados Meteorológicos Reais | v1.1 | 4/4 | Complete | 2026-04-24 |
| 10. Onboarding Wizard | v1.1 | 2/2 | Complete | 2026-04-28 |

---

*v1.0 shipped: 2026-04-17*
*v1.1 shipped: 2026-04-28*
