# Phase 8: Backend Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-17
**Phase:** 08-backend-resilience
**Mode:** discuss
**Areas discussed:** Backoff parameters, Recalculate trigger, Alerts after recalculate

---

## Codebase State at Discussion

Key findings before discussion:
- `forecastService.fetchWithRetry()` already exists with 3 retries, but fixed 5s delay — not exponential
- `POST /api/admin/recalcular` already exists and is requireAuth-protected
- `btn-admin-recalcular` already in frontend (appears after confirmar)
- `adminController.recalcular()` only calls `calcularRiscos()`, not `checkAndSendAlerts()`
- RESIL-01 backend endpoint already implemented; question was about trigger UX and alert behavior

---

## Decisions Made

### Backoff parameters
**Question:** What exponential backoff shape?
**Options presented:** 5s→10s→20s / 2s→4s→8s / 5s→10s→20s+jitter / You decide
**Decision:** 5s → 10s → 20s (no jitter)
**Rationale:** Keep existing base delay, simple doubling per attempt. Total max wait ~35s before serving stale cache.

### Recalculate trigger
**Question:** Auto-trigger in confirmar, or keep explicit button?
**Options presented:** Keep explicit button / Auto-trigger in confirmar
**Decision:** Auto-trigger in confirmar
**Rationale:** One fewer step for the admin. confirmar should insert rows + recalculate + respond with combined result.

### Alerts after recalculate
**Question:** Should POST /api/admin/recalcular also call checkAndSendAlerts()?
**Options presented:** Yes — recalc + alerts / No — recalc only
**Decision:** Yes — recalculate + alerts
**Rationale:** Consistent with scheduler behavior. CSV import may elevate risk scores; alerts should fire immediately, not wait for next scheduler cycle.

---

## Consequential Implications Noted

- `confirmar` auto-trigger is best-effort: if calcularRiscos() fails, import result should still succeed
- `admin-recalcular-section` and `btn-admin-recalcular` in frontend can be removed (no longer needed)
- `POST /api/admin/recalcular` standalone endpoint remains useful (reachable outside CSV flow)
