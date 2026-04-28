# Project Retrospective

*Documento vivo atualizado após cada milestone. Lições alimentam o planejamento futuro.*

---

## Milestone: v1.1 — Resiliência & UX

**Shipped:** 2026-04-28
**Phases:** 4 (8, 9, 09.1, 10) | **Plans:** 11 | **Commits:** 52 | **Timeline:** 11 dias

### What Was Built

- Backoff exponencial no fetch Open-Meteo (5s → 10s → throw) e auto-trigger de recálculo após import CSV
- Painel de status do sistema com 3 indicadores em tempo real (forecast freshness, calendar, push)
- Histórico de alertas recebidos com paginação e auth-gating
- Banner de dados stale (>120min) e seletor de antecedência de alertas (pré-existente, verificado)
- Integração de precipitação observada real: Visual Crossing (mm) + REDEMET METAR SBFL com fallback Open-Meteo
- Wizard de onboarding de 3 passos (login → calendar → push) com focus trap, shake animation e flag persistente

### What Worked

- **Execução com subagentes GSD** foi consistentemente rápida — plans de 5-35 min com commits atômicos e SUMMARYs automáticos
- **Pattern de best-effort para side-effects** (auto-trigger pós-CSV) funcionou bem: response principal nunca bloqueada por falha no side-effect
- **Degradação graceful para API keys opcionais** (Visual Crossing, REDEMET) foi a abordagem correta — sistema funcional mesmo sem configuração
- **Phase 09.1 como decimal inserida** foi o mecanismo certo para integração urgente de dados reais sem re-numerar as fases planejadas
- **Focus trap + shake no wizard** entregou UX polida sem complexidade excessiva — decisão de design acertada

### What Was Inefficient

- **Progress table no ROADMAP.md** ficou desatualizada durante toda a execução das fases — nenhum plano atualizou a tabela de progresso; corrigida apenas no fechamento do milestone
- **UX-01 (seletor de antecedência)** foi planejado como feature nova mas descobriu-se em 09-03 que já existia desde v1.0; o research/plan poderia ter verificado o banco antes de planejar implementação
- **REQUIREMENTS.md** ficou com todos os requirements marcados como "Pending" durante todo o milestone — nenhuma atualização automática durante execução das fases
- **RETROSPECTIVE.md** não foi criado no fechamento do v1.0; entrou apenas no v1.1

### Patterns Established

- **Modal injetado por JS**: evitar HTML estático para componentes que dependem de estado de sessão — sem flash de conteúdo não autenticado
- **Tab lazy-load**: `if (tab.dataset.tab === X) carregarX()` no tab click handler — consultas só quando necessário
- **Auth-gating com show/hide em carregarSessao()**: padrão consolidado para Status, Alertas e Admin tabs
- **Decimal phase para inserção urgente**: 09.1 demonstrou que o mecanismo funciona bem sem interromper fases planejadas
- **fecharWizard() antes do PATCH**: UX first — UI não depende de sucesso do servidor para resposta visual

### Key Lessons

1. **Verificar o banco antes de planejar implementação** — UX-01 estava pronto desde v1.0; research de fase deveria incluir `SELECT * FROM schema` antes de escrever o plan
2. **Progress table precisa de atualização automática** — a tabela de progresso no ROADMAP.md não se atualiza sozinha; ou automatizar ou não manter tabela de progresso no roadmap
3. **REQUIREMENTS.md deveria ser atualizado após cada fase** — marcar requirements como Complete no REQUIREMENTS.md ao concluir cada plan, não acumular para o final
4. **Degradação graceful é o contrato correto para APIs opcionais** — build sem API key deve funcionar; a feature é aditiva, nunca bloqueante

### Cost Observations

- Model mix: ~80% Sonnet, ~20% Opus (subagentes de research e planning)
- Sessions: ~8-10 sessões ao longo de 11 dias
- Notable: Execução com subagentes GSD manteve contexto principal limpo — cada plan em worktree isolado sem poluir a sessão principal

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Dias | Fases | Plans | Observação |
|-----------|------|-------|-------|------------|
| v1.0 MVP | 9 | 7 | 21 | Greenfield — fundação completa do sistema |
| v1.1 Resiliência & UX | 11 | 4 (+1 inserida) | 11 | Consolidação + dados reais; decimal phase bem-sucedida |

### Cumulative Quality

| Milestone | LOC Total | Novas deps | Zero falhas prod |
|-----------|-----------|------------|-----------------|
| v1.0 | ~4.762 | passport, node-cron, web-push | ✓ |
| v1.1 | ~5.855 | nenhuma nova | ✓ |

### Top Lessons (Validados em Múltiplos Milestones)

1. **SQLite single-file + node-cron no mesmo processo** é suficiente para Florianópolis — sem pressão para adicionar Redis/queues
2. **Google OAuth com prompt:'consent'** é obrigatório para garantir refresh_token — não negociar isso
3. **Subagentes GSD em worktrees isolados** mantêm contexto principal limpo e permitem execução paralela sem colisão
