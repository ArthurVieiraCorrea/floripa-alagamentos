---
status: complete
phase: 09-frontend-ux
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md]
started: 2026-04-24T00:00:00Z
updated: 2026-04-24T01:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Status Tab - Auth Gating
expected: Log out (or open in incognito). The "Status" tab button should NOT be visible in the top nav. Log in with a valid account — the "Status" tab button should appear between "Calendário" and "Admin".
result: pass

### 2. Status Tab - Three Health Indicators
expected: Click the "Status" tab while logged in. The panel should show three indicators: "Previsão" (forecast freshness), "Calendário" (calendar connection), and "Push" (push subscription). Each has a colored dot and a label.
result: pass

### 3. Status Tab - Forecast Indicator Color
expected: Open the Status tab. The "Previsão" dot should be green if forecast data is fresh (< 2 h old), yellow if stale (≥ 2 h), or red if data is unavailable. The detail text should reflect the actual status.
result: skipped
reason: Ponto aparece verde mas usuário não consegue confirmar se os dados estão realmente atualizados — coberto pelo teste 11 (banner stale via botão Admin)

### 4. Status Tab - Calendar Indicator
expected: With no Google Calendar connected, the "Calendário" dot should be muted/gray. After connecting a calendar via the Calendário tab, opening the Status tab should show a green dot.
result: pass

### 5. Status Tab - Push Indicator
expected: With push notifications not subscribed, the "Push" dot should be muted/gray. After enabling push notifications, re-opening the Status tab should show a green dot.
result: pass
note: Amarelo é comportamento correto em navegadores sem suporte completo a push (Firefox, Safari). Verde esperado apenas em Chrome/Edge com push ativo.

### 6. Alertas Tab - Auth Gating
expected: While logged out the "Alertas" tab button should NOT be visible. After logging in it should appear after "Status" and before "Admin" in the tab bar.
result: pass

### 7. Alertas Tab - Card Layout
expected: Click the "Alertas" tab while logged in (with at least one alert sent to this account). The panel should display cards with: bairro name, date formatted in pt-BR (e.g. "19 de abril de 2026"), and the event summary text.
result: skipped
reason: Usuário ainda não recebeu alertas — não há dados para renderizar cards

### 8. Alertas Tab - Empty State
expected: Log in with an account that has never received any alerts. Open the "Alertas" tab. The page should show the message "Você ainda não recebeu alertas." with no cards.
result: pass

### 9. Alertas Tab - Pagination
expected: If the account has more than one page of alerts, pagination controls should appear below the list. Clicking next/previous should load the next/previous page of cards without reloading the entire page.
result: skipped
reason: Usuário ainda não recebeu alertas — impossível testar paginação

### 10. Alertas Tab - Resets to Page 1 on Re-open
expected: Navigate to page 2 of Alertas, then switch to another tab and back to Alertas. The list should reset to page 1 (not stay on page 2).
result: skipped
reason: Usuário ainda não recebeu alertas — impossível testar reset de página

### 11. Stale Forecast Banner
expected: In the Admin tab, click "Simular previsão stale". A banner (#banner-stale-forecast) should appear at the top of the forecast panel warning that data is outdated. Clicking "Resetar" removes the banner.
result: pass

### 12. Alert Lead Time Selector
expected: With push notifications active, open the Alertas or Settings area. A selector (#sel-alert-hours) for alert lead time (antecedência) should be visible. If push is not active, the selector should be hidden.
result: pass

## Summary

total: 12
passed: 8
issues: 0
pending: 0
skipped: 4

## Gaps

[none]
