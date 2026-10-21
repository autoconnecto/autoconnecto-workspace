# AUDIT-20261020-01 — Repair status

**Updated:** 2026-10-21  
**Release:** **v1.7.57 deployed** (BE EC2 + FE/docs/website/mobile CI success)

| ID | Sev | Disposition |
|----|-----|-------------|
| F-010 | S0 | **Fixed** — create-tenant → 410 in prod |
| F-012 | S1 | **Fixed** — api TLS Jan 2027; www May 2027 |
| F-011 / F-015 | S2 | **Fixed** — EC2 disk reclaimed |
| F-006 / F-008 / F-009 | S1/S3 | **Fixed** — SDK v1.7.57 |
| F-007 | S1 | **Fixed** — BE + docs v1.7.57 |
| F-002 | S1 | **Fixed** — runbook + daily cron installed on EC2 |
| F-001 | S2 | **Fixed** — swagger 1.7.57 |
| F-014 | S2 | **Fixed** — website on-prem claims removed |
| F-013 | S1 | **Fixed** — env files untracked; workspace gitignore |
| F-003 | S2 | **Fixed** — app CloudFront Function security headers |
| F-004 | S4 | Fixed (pre-audit) |
| F-005 | S2 | **Accepted risk** — residual npm vulns (protobufjs/sparkplug, breaking upgrades deferred). Review by 2026-12-21. |
| F-016 | S3 | **Accepted risk** — no v1/ attribute dual-compat; SDK uses non-v1. Reopen if needed. |

## Production verification (2026-10-21)

- `git describe` on EC2 = `v1.7.57`
- healthz ok; create-tenant 410
- app headers: CSP/HSTS/XFO present
- FE / docs / website / mobile Actions: success for v1.7.57
