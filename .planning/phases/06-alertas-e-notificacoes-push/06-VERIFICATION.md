---
phase: 06-alertas-e-notificacoes-push
verified: 2026-04-13T00:00:00Z
status: passed
score: 18/18 must-haves verified
---

# Phase 06: Alertas e Notificações Push — Verification Report

**Phase Goal:** Usuário com calendário conectado recebe push notification quando um evento cai em bairro com risco acima do threshold configurado. Usuários sem push subscription veem banner in-app. Cada evento é alertado no máximo 1x por ciclo. Sistema detecta `invalid_grant` e avisa o usuário para reconectar.
**Verified:** 2026-04-13
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Push subscribe/unsubscribe/threshold/vapid-public-key endpoints exist and are wired | VERIFIED | `backend/src/routes/push.js` has all four routes; mounted at `/api/push` in `app.js` line 73 |
| 2 | Service worker receives push events and handles notification clicks | VERIFIED | `frontend/public/sw.js` has `push` listener (line 5) and `notificationclick` listener (line 19) |
| 3 | push_subscriptions table and alert_threshold migration are in schema | VERIFIED | `database.js` lines 134–147 (table), lines 174–179 (ALTER TABLE migration) |
| 4 | Notifications section UI is present inside #cal-conectado | VERIFIED | `frontend/index.html` lines 169–170: `#secao-notificacoes` inside `#cal-conectado` |
| 5 | api.js exports push.subscribe, push.unsubscribe, push.setThreshold, push.getVapidPublicKey | VERIFIED | `api.js` lines 61–69 |
| 6 | main.js contains urlBase64ToUint8Array, swRegistration, atualizarStatusPush, verificarStatusPush | VERIFIED | `main.js` lines 22–30 (swRegistration + helper), lines 538 and 577 (functions) |
| 7 | alertService.js exists with checkAndSendAlerts function | VERIFIED | `backend/src/services/alertService.js` exists; `checkAndSendAlerts` exported at line 245 |
| 8 | alertas_enviados table is in schema | VERIFIED | `database.js` lines 149–172 with UNIQUE constraint and both indexes |
| 9 | scheduler.js imports and calls checkAndSendAlerts after calcularRiscos | VERIFIED | `scheduler.js` line 12 (import), line 41 (cron chain), line 68 (startup IIFE) |
| 10 | backend/src/routes/alertas.js exists with /pendentes and /marcar-visto endpoints | VERIFIED | File exists; GET `/pendentes` at line 15, POST `/marcar-visto` at line 39 |
| 11 | /api/alertas router is mounted in app.js | VERIFIED | `app.js` line 74: `app.use('/api/alertas', alertasRouter)` |
| 12 | #banner-alertas inside #tab-calendario, after #banner-cal-desconectado | VERIFIED | `index.html` lines 138–145: banner at correct position after `#banner-cal-desconectado` (line 133), before `#cal-nao-autenticado` (line 148) |
| 13 | api.js exports alertas.pendentes and alertas.marcarVisto | VERIFIED | `api.js` lines 71–75 |
| 14 | main.js contains verificarAlertasPendentes | VERIFIED | `main.js` line 671 |
| 15 | main.js contains atualizarBannerAlertas | VERIFIED | `main.js` line 632 |
| 16 | verificarAlertasPendentes is called in setInterval | VERIFIED | `main.js` line 822 |
| 17 | verificarAlertasPendentes is called when Calendário tab is opened | VERIFIED | `main.js` line 326 |
| 18 | VAPID setup and both routers (push, alertas) mounted in app.js | VERIFIED | `app.js` lines 37–42 (webpush.setVapidDetails), lines 33–34 (require), lines 73–74 (mount) |

**Score:** 18/18 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/routes/push.js` | subscribe, unsubscribe, threshold, vapid-public-key endpoints | VERIFIED | All 4 routes present with requireAuth on protected routes |
| `frontend/public/sw.js` | push and notificationclick event listeners | VERIFIED | Both listeners implemented, tag-based dedup, openWindow fallback |
| `backend/src/config/database.js` | push_subscriptions table + alert_threshold migration + alertas_enviados table | VERIFIED | All three present: lines 134–147, 149–172, 174–179 |
| `frontend/index.html` | #secao-notificacoes inside #cal-conectado; #banner-alertas inside #tab-calendario | VERIFIED | Both elements present in correct nesting order |
| `frontend/src/services/api.js` | push.{subscribe,unsubscribe,setThreshold,getVapidPublicKey} + alertas.{pendentes,marcarVisto} | VERIFIED | All 6 methods exported |
| `frontend/src/main.js` | urlBase64ToUint8Array, swRegistration, atualizarStatusPush, verificarStatusPush, verificarAlertasPendentes, atualizarBannerAlertas | VERIFIED | All 6 present and wired |
| `backend/src/services/alertService.js` | checkAndSendAlerts function | VERIFIED | Full implementation with per-user try/catch, stale sub cleanup, dedup |
| `backend/src/routes/alertas.js` | /pendentes and /marcar-visto endpoints | VERIFIED | Both routes present, scoped to req.session.userId |
| `backend/src/app.js` | mounts /api/push and /api/alertas, sets VAPID details | VERIFIED | All three present |
| `backend/src/jobs/scheduler.js` | imports and calls checkAndSendAlerts after calcularRiscos | VERIFIED | Import at line 12, cron chain at line 41, startup IIFE at line 68 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.js` | `routes/push.js` | `require + app.use('/api/push')` | WIRED | Line 33 + 73 |
| `app.js` | `routes/alertas.js` | `require + app.use('/api/alertas')` | WIRED | Line 34 + 74 |
| `app.js` | `web-push` | `webpush.setVapidDetails()` | WIRED | Lines 37–42 |
| `scheduler.js` | `alertService.checkAndSendAlerts` | `require + await after calcularRiscos()` | WIRED | Import line 12, cron line 41, IIFE line 68 |
| `alertService.js` | `push_subscriptions` table | `db.all SELECT endpoint,p256dh,auth` | WIRED | Lines 195–199 |
| `alertService.js` | `alertas_enviados` table | `INSERT OR IGNORE + SELECT 1 dedup` | WIRED | Lines 72–76 (registrar), lines 181–189 (dedup) |
| `main.js` | `api.push.*` | `btn-push-optin click handler` | WIRED | Lines 698–728 use api.push.getVapidPublicKey + api.push.subscribe |
| `main.js` | `api.alertas.pendentes` | `verificarAlertasPendentes()` | WIRED | Line 673 |
| `main.js` | `setInterval` | `verificarAlertasPendentes()` at line 822 | WIRED | 60s polling confirmed |
| `main.js` | `carregarSessao().then(...)` | `verificarAlertasPendentes()` on init | WIRED | Line 801 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `alertService.js` | `scores` | `db.all('SELECT ... FROM risk_scores WHERE window_hours = 24')` | Yes — DB query | FLOWING |
| `alertService.js` | `eventos` | `db.all('SELECT ... FROM calendar_events_cache WHERE usuario_id = ?')` | Yes — DB query | FLOWING |
| `alertas.js /pendentes` | `alertas` | `db.all('SELECT ... FROM alertas_enviados WHERE ... AND visto_em IS NULL')` | Yes — DB query | FLOWING |
| `main.js banner` | `alertas` from `api.alertas.pendentes()` | GET /api/alertas/pendentes → alertas_enviados table | Yes — live polling | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server and authenticated session to verify push subscription flow end-to-end. Static code analysis confirms all wiring is present.

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| ALERT-01 | Push opt-in UI with explanatory text before Notification.requestPermission() | SATISFIED | `#secao-notificacoes` with `.notif-explainer` paragraph; btn-push-optin requests permission on click |
| ALERT-02 | Send push via webpush.sendNotification when event bairro risk >= threshold | SATISFIED | `alertService.js` `enviarPush()` + `checkAndSendAlerts()` |
| ALERT-03 | Deduplication per cycle via alertas_enviados UNIQUE constraint | SATISFIED | `UNIQUE(usuario_id, google_event_id, risk_cycle_key)` + `INSERT OR IGNORE` |
| ALERT-04 | Threshold selector UI (Verde/Amarelo/Laranja/Vermelho) + PATCH /api/push/threshold | SATISFIED | `#sel-threshold` in HTML; PATCH route in push.js with whitelist `[1,26,51,76]` |
| ALERT-05 | Fallback in-app banner with 60s polling for users without push subscription | SATISFIED | `#banner-alertas` + `verificarAlertasPendentes()` in setInterval |
| ALERT-06 | Respect invalid_grant flag — skip users with calendar_disconnected=1 | SATISFIED | `alertService.js` query: `WHERE calendar_connected = 1 AND calendar_disconnected = 0` |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `backend/src/app.js` | `VAPID_PUBLIC_KEY \|\| ''` and `VAPID_PRIVATE_KEY \|\| ''` empty string fallbacks | Info | Intentional — prevents startup crash in dev without .env; documented as deviation in 06-01-SUMMARY.md |

No stubs, placeholder returns, or disconnected wiring found.

---

## Human Verification Required

None required for code-level completeness. The following items need a real browser + VAPID keys for end-to-end testing, but they are outside the scope of static code verification:

1. **Push notification delivery** — Requires VAPID keys in `.env`, a compatible browser, and HTTPS/localhost to test that `webpush.sendNotification()` actually delivers to the browser.
2. **Service worker registration** — Requires serving the frontend over HTTP to verify `/sw.js` is registered and `PushManager.subscribe()` returns a valid subscription object.
3. **Banner visibility cycle** — Requires an authenticated user with calendar events in `calendar_events_cache` and computed risk scores to verify the 60s poll shows/hides the banner correctly.

These are integration-level tests, not code gaps. All code paths are present and wired.

---

## Gaps Summary

No gaps. All 18 must-haves verified. Phase 06 goal is fully achieved at the code level:

- Web Push infrastructure (VAPID, service worker, subscribe/unsubscribe/threshold endpoints) is complete and wired.
- Alert engine (`alertService.js`) correctly crosses calendar events against risk scores, deduplicates per cycle, and chains into the scheduler after `calcularRiscos()`.
- Fallback in-app banner is present, polling is wired into the existing 60s setInterval, and sessionStorage dismissal is implemented.
- All six ALERT requirements (ALERT-01 through ALERT-06) are satisfied.

---

_Verified: 2026-04-13_
_Verifier: Claude (gsd-verifier)_
