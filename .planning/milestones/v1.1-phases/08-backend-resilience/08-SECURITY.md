---
phase: 08
slug: backend-resilience
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-24
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Backend → Open-Meteo | Outbound HTTP fetch for forecast data | Public weather data (no PII) |
| Admin UI → Backend | POST /api/admin/confirmar and /recalcular | CSV rows (flood occurrences), auth session cookie |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Denial of Service | forecastService.fetchWithRetry() | mitigate | Exponential backoff (5s→10s→throw) reduces pressure on Open-Meteo during outages. fetchAndCacheForecasts() never throws — stale cache continues serving frontend. Verified: Math.pow(2, attempt-1) present in source (08-01-SUMMARY.md). | closed |
| T-08-02 | Information Disclosure | forecastService retry logs | accept | Retry logs include waitMs timing and error messages. Logs are server-side only, never forwarded to frontend or external service. Acceptable for operational visibility. | closed |
| T-08-03 | Elevation of Privilege | POST /api/admin/recalcular | mitigate | requireAuth middleware applied at route registration (routes/admin.js:26). No change to auth layer in this phase — existing protection confirmed. | closed |
| T-08-04 | Denial of Service | adminController.confirmar() → checkAndSendAlerts() | mitigate | alertas_enviados UNIQUE constraint (user_id + bairro + cycleKey hourly) silently deduplicates repeated calls. Spamming confirmar() cannot amplify alert sends beyond one per hour per user-bairro pair. | closed |
| T-08-05 | Tampering | adminController.confirmar() response | mitigate | Auto-trigger uses best-effort try/catch: import stats (inseridos, duplicatas_ignoradas, erros) always returned with HTTP 200 regardless of recalc outcome. recalculo field signals partial failure without blocking response. Verified: all 6 SUMMARY checks passed. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-02 | Retry timing logs (waitMs values) exposed in server stdout are operational data, not sensitive. No PII or credentials in log output. Risk is informational only. | Arthur Vieira | 2026-04-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-24 | 5 | 5 | 0 | gsd-secure-phase (automated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-24
