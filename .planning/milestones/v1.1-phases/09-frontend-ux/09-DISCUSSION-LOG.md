# Phase 9: Frontend UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-19
**Phase:** 09-frontend-ux
**Mode:** discuss
**Areas analyzed:** RESIL-03/UX-01 verification, UX-02 Status panel, UX-03 Alert history

## Pre-Analysis Findings

| Finding | Evidence |
|---------|----------|
| RESIL-03 already implemented | `#banner-stale-forecast` in index.html; JS check in main.js:1002-1007; backend stale:true in previsao.js:54 |
| UX-01 already implemented | `#sel-alert-hours` + `#push-hours-row` in index.html; listener in main.js:982; `api.push.setAlertHours()` in api.js:68 |
| UX-02 not implemented | No dedicated status panel or tab exists |
| UX-03 not implemented | No alert history UI or backend endpoint (only `/pendentes`) |

## Assumptions Presented

### RESIL-03 and UX-01
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Already fully implemented | Confident | HTML elements, JS handlers, API methods all present and wired |

### UX-02 Status panel location
| Option | Confidence | Notes |
|--------|-----------|-------|
| New "Status" tab | Confident | User confirmed |
| Section in Calendar tab | Rejected | |
| Collapsible header banner | Rejected | |

### UX-03 Alert history location
| Option | Confidence | Notes |
|--------|-----------|-------|
| New "Alertas" tab | Confident | User confirmed |
| Inside Calendar tab | Rejected | |
| Inside Status tab | Rejected | |

## Decisions Made

| Area | Decision |
|------|---------|
| RESIL-03 | Already done — verify only |
| UX-01 | Already done — verify only |
| UX-02 location | Nova aba "Status" na sidebar (autenticado only) |
| UX-02 content | Três indicadores simples (● ícone colorido): Forecast, Calendário, Push |
| UX-02 actions | Nenhuma — só leitura |
| UX-03 location | Nova aba "Alertas" na sidebar (autenticado only) |
| UX-03 backend | Novo endpoint GET /api/alertas/historico, 20/página, paginado |
| UX-03 fields | bairro, enviado_em, summary (sem score) |

## Corrections Made

No corrections — all recommendations confirmed by user.
