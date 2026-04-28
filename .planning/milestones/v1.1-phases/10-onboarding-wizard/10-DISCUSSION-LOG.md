# Phase 10: Onboarding Wizard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 10-onboarding-wizard
**Areas discussed:** Flag de onboarding, Apresentação visual, Comportamento ao pular

---

## Flag de Onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Coluna no banco (`onboarding_done`) | Persiste entre devices; requer migration | ✓ |
| localStorage | Simples; perde ao trocar device/browser | |

**User's choice:** Coluna no banco
**Notes:** Preferência por persistência cross-device; migration é aceitável.

---

## Detectar Primeiro Login

| Option | Description | Selected |
|--------|-------------|----------|
| Campo `onboarding_done` no `/api/sessao` | Backend explícito; claro para o frontend | ✓ |
| Heurística frontend | `!calendar_connected && !push` — sem mudança de backend, mas falso positivo possível | |

**User's choice:** Campo no `/api/sessao`
**Notes:** Abordagem explícita preferida.

---

## Apresentação Visual

| Option | Description | Selected |
|--------|-------------|----------|
| Modal com backdrop | Overlay + wizard centralizado; novo padrão CSS no codebase | ✓ |
| Tab "Boas-vindas" na sidebar | Reutiliza padrão de tabs; menos disruptivo mas ignorável | |

**User's choice:** Modal com backdrop

---

## Comportamento ao Pular

| Option | Description | Selected |
|--------|-------------|----------|
| Grava `onboarding_done=1` e fecha | Pular = concluir definitivamente | ✓ |
| Fecha sem gravar, botão na aba Calendário | Wizard reaparece; success criteria 5 literal | |

**User's choice:** Pular é definitivo — grava flag e fecha

---

## Claude's Discretion

- Copy e texto dos passos do wizard
- Estilo visual do modal (cores, sombra, tamanho)
- Indicador de progresso (dots, barra, "1 / 3")
- Comportamento ao clicar fora do modal

## Deferred Ideas

- Botão "Refazer onboarding" via configurações — descartado; pular é definitivo
- Heurística `!calendar_connected && !push` para trigger — descartada em favor de flag explícito
