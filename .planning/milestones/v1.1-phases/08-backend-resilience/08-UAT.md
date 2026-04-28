---
status: complete
phase: 08-backend-resilience
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md]
started: 2026-04-24T00:00:00.000Z
updated: 2026-04-24T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start the backend from scratch (cd backend && node src/server.js or npm start). Server boots without errors, schema initialises, and a basic request (GET /api/previsao or the homepage) returns live data — no crash, no unhandled exception in the terminal.
result: pass

### 2. Manual Recalculate Button Gone
expected: Open the admin panel (route /admin or the admin section of the app while logged in as admin). The "Recalcular Riscos" / manual recalculate button should no longer appear anywhere on the page.
result: pass

### 3. CSV Import Auto-triggers Recalculation
expected: In the admin panel, upload a valid CSV file of historical flood occurrences and click Confirm. The confirmation response (visible in the UI or in DevTools network tab) includes a `recalculo` field — either `"ok"` (recalculation ran) or `"erro"` (recalculation failed but import still succeeded). No manual step is needed to trigger risk recalculation after import.
result: pass

## Summary

total: 3
passed: 3
issues: 0
skipped: 0
pending: 0

## Gaps

[none yet]
