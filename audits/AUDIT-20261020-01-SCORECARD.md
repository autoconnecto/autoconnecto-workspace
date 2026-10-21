# AUDIT-20261020-01 — Scorecard

**Standard:** PLATFORM_AUDIT_STANDARD v1.0.0 (FROZEN)  
**Opened:** 2026-10-20T15:45Z  
**Closed:** 2026-10-20T16:20Z  
**Status:** **CLOSED**  
**Platform claimed / verified:** v1.7.56  
**Constraint observed:** No deploy / push main/tags / prod DNS-S3 writes under this audit ID  
**ESP32 QA:** Incorporated (F-006..F-009); Wi‑Fi password out of scope per founder  

**Founder deliverables:**  
- Observations: `AUDIT-20261020-01-OBSERVATIONS.md`  
- Findings: `AUDIT-20261020-01-FINDINGS.md`  
- External pack: `AUDIT-20261020-01-PACK/`

---

## Live baseline (UTC close)

| Check | Result |
|-------|--------|
| healthz | `{"status":"ok","postgres":"ok","redis":"ok"}` @ 2026-10-20T16:14:38Z |
| EC2 `git describe` | `v1.7.56` |
| Docker | backend/emqx/timescaledb/redis all healthy |
| EC2 disk `/` | **75G/96G (78%)** → F-011 |
| FE Actions | success `daba6af` (open record) |
| Docs / Mobile | v1.7.56 release success (open record) |
| SES MAIL FROM | **Success** (`mail.autoconnecto.in`) |
| TLS notAfter | api **2026-11-18**; www **2026-11-12**; app 2027-04-08; docs 2027-04-07 → F-012 |
| Plans API | FREE `min_telemetry_interval_sec:30` (live) |
| Docs generate | POST `/api/documentation/generate-all` → **400 refuse** (Pass) |
| create-tenant | POST `/public/create-tenant` no auth → **500** on `{}` (not 401) → F-010 |
| Widget registry | **93** stable `type` strings |
| Customer pages | **85** pages / 5 sections (`customer-pages.json`) |
| Swagger committed | `info.version` **1.7.55** / 233 paths → F-001 |

---

## Domains (final)

| Domain | Pass | Fail | N/A | Deferred | Notes |
|--------|------|------|-----|----------|-------|
| BASE | 6 | 0 | 0 | 0 | Versions match; Hard gates present |
| BE-API | 12 | 2 | 0 | 0 | Fail: F-001 swagger lag; F-010 public create-tenant |
| BE-DATA | 4 | 1 | 0 | 0 | Fail: F-002 backup/RPO |
| BE-RT | 6 | 1 | 0 | 0 | Fail linked: F-006 interval + F-007 command log path |
| BE-MAIL | 6 | 0 | 0 | 0 | Brevo app; Cognito SES; MAIL FROM Success |
| FE | 9 | 2 | 0 | 0 | Fail: F-003 CSP; F-007 command log |
| MOB | 4 | 0 | 0 | 0 | Tag/CI/env OK |
| SDK | 2 | 4 | 0 | 0 | Fail: F-006..F-009 |
| DOCS | 5 | 1 | 0 | 0 | Fail linked: F-007 docs claim vs widget; interval documented Pass |
| WEB | 3 | 1 | 0 | 0 | Fail: F-003 (app headers); www Pass; no CoAP |
| INFRA | 8 | 2 | 0 | 0 | Fail: F-011 disk; F-012 certs |
| SEC | 5 | 2 | 0 | 0 | Fail: F-005 npm; F-010 create-tenant S0 |
| BILL | 3 | 0 | 1 | 0 | Webhook verify Pass; trial edge N/A (no full e2e) |
| SOL | 3 | 0 | 0 | 1 | JWT required; seed opt-in deploy; SOL-004 Deferred (no sandbox mutate) |
| OPS | 3 | 1 | 0 | 0 | Fail: F-002; rollback in deployment.md Pass |
| EXT | 6 | 0 | 0 | 0 | Pack written at close |

---

## Findings tally

| Severity | Open (Backlog) | Fixed / Info |
|----------|----------------|--------------|
| S0 | 1 (F-010) | 0 |
| S1 | 5 (F-002, F-006, F-007, F-008, F-012) | 0 |
| S2 | 3 (F-001, F-003, F-005) | 0 |
| S3 | 1 (F-009) | 0 |
| S4 | 0 | 1 (F-004) |
| S2 ops | 1 (F-011 disk) | 0 |

**Gate to claim audit-ready for external diligence:** close all S0 + S1 (or Accepted risk with date).

---

## Close statement

Every §8 domain has a scorecard row. Every Fail has a finding ID. Evidence pack index exists. No production push was made under this audit ID. Repair starts only when the founder orders a **single-intent ship**.
