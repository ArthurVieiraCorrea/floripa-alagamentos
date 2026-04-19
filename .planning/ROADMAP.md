# Roadmap: Floripa Alagamentos

## Milestones

- ✅ **v1.0 MVP** — Fases 1-7 (shipped 2026-04-17)
- 🚧 **v1.1 Resiliência & UX** — Fases 8-10 (in progress)

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

### 🚧 v1.1 Resiliência & UX (In Progress)

**Milestone Goal:** Tornar o sistema robusto a falhas de rede e guiar novos usuários do zero ao primeiro alerta funcional.

- [ ] **Phase 8: Backend Resilience** - Retry backoff no fetch Open-Meteo e endpoint de recálculo manual pós-CSV
- [ ] **Phase 9: Frontend UX** - Banner de dados stale, seletor de antecedência, painel de status do sistema e histórico de alertas
- [ ] **Phase 10: Onboarding Wizard** - Wizard de 3 passos guiando novos usuários até push ativo

## Phase Details

### Phase 8: Backend Resilience
**Goal**: O backend tolera falhas transitórias do Open-Meteo sem perder dados e permite ao admin sincronizar riscos imediatamente após importação CSV
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: RESIL-01, RESIL-02
**Success Criteria** (what must be TRUE):
  1. Após uma falha de rede no fetch Open-Meteo, o sistema retenta automaticamente com backoff exponencial sem intervenção manual
  2. O forecast em cache permanece servido durante as retentativas — o sistema não retorna erro 500 para o frontend enquanto estiver retentando
  3. Admin clica em confirmar importação CSV e o motor de risco recalcula imediatamente, sem aguardar o ciclo de 4h
  4. A rota de recálculo manual é protegida — apenas admins autenticados podem acioná-la
**Plans**: 2 plans
Plans:
- [x] 08-01-PLAN.md — Backoff exponencial em fetchWithRetry() (RESIL-02)
- [x] 08-02-PLAN.md — Auto-trigger recálculo em confirmar() + checkAndSendAlerts em recalcular() + frontend cleanup (RESIL-01)

### Phase 9: Frontend UX
**Goal**: O usuário vê em tempo real se os dados são confiáveis, controla quando quer ser alertado e consulta o histórico de alertas que recebeu
**Depends on**: Phase 8
**Requirements**: RESIL-03, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Quando o forecast está desatualizado (>120 min), um banner visível avisa o usuário que os dados podem estar stale
  2. Usuário autenticado pode mover um seletor de 1h a 48h e o novo valor de antecedência é salvo e aplicado nos alertas seguintes
  3. Usuário vê painel de status com o estado atual de: frescor do forecast, sincronização do calendar e push ativo/inativo
  4. Usuário vê lista dos alertas que recebeu, com bairro, horário e evento do calendar associado
**Plans**: 3 plans
Plans:
- [ ] 09-01-PLAN.md — Aba Status: 3 indicadores de sistema em tempo real (UX-02)
- [ ] 09-02-PLAN.md — Aba Alertas: backend /historico + lista paginada de alertas recebidos (UX-03)
- [ ] 09-03-PLAN.md — Smoke test: verificar RESIL-03 (banner stale) e UX-01 (seletor antecedência)

### Phase 10: Onboarding Wizard
**Goal**: Novo usuário que faz login pela primeira vez é guiado por um wizard de 3 passos e sai com calendar conectado e push ativo
**Depends on**: Phase 9
**Requirements**: UX-04
**Success Criteria** (what must be TRUE):
  1. Na primeira vez que um novo usuário faz login, o wizard abre automaticamente — sem necessidade de encontrar configurações
  2. O usuário consegue conectar o Google Calendar diretamente do wizard, no passo 2, sem sair do fluxo
  3. O usuário consegue ativar push notifications no passo 3 e recebe confirmação visual de sucesso
  4. Após completar o wizard, o flag de onboarding é gravado — reloads e sessões futuras não reexibem o wizard
  5. Usuário que pula o wizard pode completá-lo depois via configurações
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
| 8. Backend Resilience | v1.1 | 0/2 | Not started | - |
| 9. Frontend UX | v1.1 | 0/3 | Not started | - |
| 10. Onboarding Wizard | v1.1 | 0/TBD | Not started | - |

---

*v1.0 shipped: 2026-04-17*
*v1.1 roadmap created: 2026-04-17*
