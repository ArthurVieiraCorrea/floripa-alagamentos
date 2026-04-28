---
phase: 10-onboarding-wizard
plan: "02"
subsystem: frontend
tags: [onboarding, wizard, modal, css, focus-trap, push, calendar]
dependency_graph:
  requires:
    - phase: 10-01
      provides: PATCH /api/usuarios/me, onboarding_done em /api/auth/me, api.usuarios.setOnboardingDone
  provides: [wizard modal 3 passos, abrirWizard, fecharWizard, ativarPushNotificacoes, CSS wizard]
  affects: [frontend/src/main.js, frontend/src/styles/main.css]
tech_stack:
  added: []
  patterns: [modal injetado por JS no DOM, focus-trap via keydown/Tab, shake animation via CSS keyframes, degradação silenciosa em PATCH]
key_files:
  created: []
  modified:
    - frontend/src/main.js
    - frontend/src/styles/main.css
decisions:
  - "Modal injetado por JS (não HTML estático) para evitar exibição antes da sessão ser carregada"
  - "abrirWizard() chamado ANTES de carregarCalendario() em carregarSessao() — garante que modal aparece sem bloqueio"
  - "fecharWizard() chamado ANTES do PATCH setOnboardingDone() — degradação silenciosa se PATCH falhar (T-10-05)"
  - "Escape e clique fora disparam shake animation em vez de fechar — onboarding não pode ser ignorado acidentalmente"
  - "ativarPushNotificacoes() criada como função standalone (não inline no wizard) para reutilização futura"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-28"
  tasks_completed: 2
  tasks_total: 3
  files_created: 0
  files_modified: 2
requirements:
  - UX-04
---

# Phase 10 Plan 02: Frontend Wizard Modal de Onboarding Summary

**Wizard modal de 3 passos injetado por JS com focus trap, shake animation e persistência do flag via PATCH ao pular ou concluir.**

## What Was Built

Modal de onboarding completo que aparece automaticamente no primeiro login do usuário:

1. **CSS do wizard em `main.css`** — bloco de estilos adicionado ao final do arquivo:
   - `#wizard-backdrop` + `#wizard-modal` com layout centrado e z-index alto
   - `@keyframes wizard-shake` + classe `.shaking` para feedback de clique fora/Escape
   - `.wizard-dot`, `.wizard-dot.ativo`, `.wizard-dot.visitado` para indicador de progresso
   - Botões `#wizard-btn-pular` (transparente) e `#wizard-btn-proximo` (accent color)
   - Responsive `@media (max-width: 640px)`

2. **`fecharWizard()`** — remove `#wizard-backdrop` do DOM via `?.remove()`.

3. **`ativarPushNotificacoes(feedbackEl, btnEl)`** — função standalone que encapsula a lógica de push:
   - Verifica suporte (`Notification` + `serviceWorker`)
   - Verifica permissão `denied` antes de solicitar
   - Chama `Notification.requestPermission()`, subscreve via `pushManager.subscribe()`
   - Exibe feedback inline (success/error) nos elementos passados por parâmetro
   - Remove botão após sucesso; restaura após erro

4. **`abrirWizard()`** — cria e injeta o modal no DOM com 3 passos:
   - **Passo 1:** Informativo — apresenta o app, botão Próximo
   - **Passo 2:** Calendar — botão "Conectar Calendário" chama `api.conectarCalendario()` com feedback inline; Próximo sempre habilitado
   - **Passo 3:** Push — botão "Ativar notificações" chama `ativarPushNotificacoes()`; botão principal diz "Concluir"
   - Shake ao clicar fora do modal (click no backdrop)
   - Escape dispara shake em vez de fechar (focus trap + prevenção de Escape)
   - Focus trap: Tab circula apenas entre elementos focáveis visíveis do modal
   - "Pular configuração" → `fecharWizard()` + `api.usuarios.setOnboardingDone()` (silencioso)
   - "Concluir" (passo 3) → `fecharWizard()` + `api.usuarios.setOnboardingDone()` (silencioso)

5. **Disparo em `carregarSessao()`** — adicionado `if (!usuario.onboarding_done) { abrirWizard(); }` antes de `await carregarCalendario(usuario)`.

## Commits

| Hash | Mensagem |
|------|----------|
| 43b3ac7 | feat(10-02): adicionar CSS do wizard de onboarding em main.css |
| 8487786 | feat(10-02): implementar wizard modal (abrirWizard, fecharWizard, ativarPushNotificacoes) + disparo em carregarSessao |

## Human Checkpoint Result

Verificação humana aprovada: wizard abre automaticamente, navegação entre passos funciona, pular e concluir gravam o flag, reload não reabre o wizard.

## Deviations from Plan

None — plano executado exatamente como escrito.

## Self-Check: PASSED

- `frontend/src/styles/main.css` contém `#wizard-backdrop` — FOUND
- `frontend/src/styles/main.css` contém `wizard-shake` — FOUND
- `frontend/src/main.js` contém `function abrirWizard()` — FOUND
- `frontend/src/main.js` contém `function fecharWizard()` — FOUND
- `frontend/src/main.js` contém `async function ativarPushNotificacoes` — FOUND
- `frontend/src/main.js` contém `if (!usuario.onboarding_done)` em carregarSessao — FOUND
- `frontend/src/main.js` contém `await api.usuarios.setOnboardingDone()` (2 ocorrências) — FOUND
- `carregarSessao()` NÃO aparece dentro de `abrirWizard()` — CONFIRMED
- Commits 43b3ac7, 8487786 — FOUND
