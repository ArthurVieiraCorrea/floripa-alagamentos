# Roadmap: Floripa Alagamentos

## Milestones

- ✅ **v1.0 MVP** — Fases 1-7 (shipped 2026-04-17)
- ✅ **v1.1 Resiliência & UX** — Fases 8-10 (shipped 2026-04-28)
- 🔄 **v1.2 Investor Ready** — Fases 11-12 (em progresso)

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

### v1.2 Investor Ready (Fases 11-12)

- [ ] **Phase 11: Landing Page** — Infraestrutura Vite multi-page + roteamento Express + conteúdo completo da landing (hero, como funciona, roadmap, CTA demo)
- [ ] **Phase 12: UI Polish** — Migração de estilos para CSS vars, Inter font, legenda choropleth, touch targets, responsividade 375px

## Phase Details

### Phase 11: Landing Page
**Goal**: Investidor que acessa o site entende a proposta de valor, como o produto funciona e como solicitar uma demonstração — sem precisar fazer login
**Depends on**: Phase 10 (v1.1 completo)
**Requirements**: LP-01, LP-02, LP-03, LP-04, LP-05, LP-06, LP-07
**Success Criteria** (what must be TRUE):
  1. Visitante que acessa `/` vê o hero com UVP em 1 frase e o dado âncora de R$1bi/ano em perdas em SC, sem clicar em nada
  2. Visitante vê a seção "Como funciona" com 4 passos ilustrados por screenshots estáticos do app e entende o mecanismo do produto sem fazer login
  3. Visitante vê o roadmap de 3 horizontes (Floripa → SC → Brasil) sem datas absolutas
  4. Visitante consegue solicitar uma demo via CTA "Agendar uma demo" (email ou Calendly do fundador)
  5. App existente funciona normalmente em `/app` e todas as rotas de API respondem sem regressão; landing é legível em 375px
**Plans**: 2 plans
Plans:
- [ ] 11-01-PLAN.md — Infraestrutura multi-page: tokens.css + vite.config.js + app.js GET /app + stubs
- [ ] 11-02-PLAN.md — Conteúdo completo: landing.html 5 seções + landing.css completo + responsividade
**UI hint**: yes

### Phase 12: UI Polish
**Goal**: O app exibe tipografia consistente, paleta de cores unificada via CSS vars e é plenamente operável em mobile — pronto para ser aberto durante uma demo para investidores
**Depends on**: Phase 11
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05
**Success Criteria** (what must be TRUE):
  1. Todo texto visível no app usa Inter variable font (sem fallback para fonte do sistema em nenhum elemento)
  2. Nenhum valor hex hardcoded permanece no CSS ou HTML do app — todos os valores de cor passam por CSS custom properties
  3. O mapa choropleth exibe uma legenda visual com as 5 categorias de risco identificadas por cor e rótulo
  4. Tabs de navegação têm área de toque de no mínimo 44px de altura em viewport mobile
  5. Todas as funcionalidades do app são acessíveis e legíveis em viewport de 375px sem scroll horizontal
**Plans**: TBD
**UI hint**: yes

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
| 11. Landing Page | v1.2 | 0/2 | Planned | - |
| 12. UI Polish | v1.2 | 0/? | Not started | - |

---

*v1.0 shipped: 2026-04-17*
*v1.1 shipped: 2026-04-28*
*v1.2 started: 2026-04-28*
