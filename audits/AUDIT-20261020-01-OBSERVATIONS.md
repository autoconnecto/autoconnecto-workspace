# AUDIT-20261020-01 — Platform observations (founder)

**Standard:** PLATFORM_AUDIT_STANDARD v1.0.0 (FROZEN)  
**Closed:** 2026-10-20  
**Platform under audit:** v1.7.56 (production)  
**Method:** Checklist §8 all domains + live probes + real ESP32 QA (SDK 1.7.56)  
**This document:** observations only. **No repairs shipped under this audit.**

---

## Executive verdict

Autoconnecto **runs** as a coherent IoT platform: API healthy, FE/docs/mobile/SDK on the 1.7.56 line, SES MAIL FROM Success, Shared vs RPC documented, MQTT reconnect/logging present, billing webhooks verify signatures, tenant scoping on core device APIs, docs generate endpoints refuse, OTA download gated by device token.

It is **not yet “100% correct” for external diligence**. One **S0** and five **S1** findings block that claim. Repair in **single-intent ships**. Do not mix SDK example fixes with security disables in one release.

---

## What is solid (keep)

1. **Release line matches** — EC2 `v1.7.56`, FE CI green, docs/mobile/SDK tagged with ARCHITECTURE table.  
2. **Health** — `/healthz` postgres+redis ok; compose stack healthy.  
3. **Auth model** — JWT on tenant APIs; PlatformAdminGuard on platform-admin; OTA chunks need device token; solutions unauthenticated → 401.  
4. **Realtime contract** — Socket.IO `/socket.io`; FE single `getSocket()`; SHARED/CLIENT + `requestId` on command path.  
5. **Mail split** — App → Brevo; Cognito → SES; MAIL FROM **Success**.  
6. **Docs product facts** — Telemetry store without save-node; Free=30s interval stated correctly; no competitor names.  
7. **Billing** — Dodo webhook unwrap + invalid signature → 401.  
8. **Plans explicit** — Live `/api/plans` FREE interval **30s**.  
9. **Widgets** — 93 registry types; customer guide **85** pages.  
10. **Hard gates** — CHANGE_MANAGEMENT + audit standard + permissions.

---

## Must fix before “audit-ready” (S0–S1)

| ID | Sev | Observation |
|----|-----|-------------|
| **F-010** | **S0** | `POST /public/create-tenant` unauthenticated; can create tenant+admin. Signup is `/api/auth/signup`. Live empty body → 500 not 401. |
| **F-012** | **S1** | TLS: **www ~2026-11-12**, **api ~2026-11-18**. Renew before expiry. |
| **F-006** | **S1** | MQTT examples burst same-second; FREE allows 30s. Board lost most keys. Docs already correct; examples wrong. |
| **F-007** | **S1** | Command Log empty for 13 board-received commands; attributes “unanswered” vs docs “Saved”. |
| **F-008** | **S1** | OTA handler after `begin`; `OTA.md` missing. |
| **F-002** | **S1** | No Postgres backup/restore/RPO runbook. |

---

## Should fix soon (S2–S3)

| ID | Observation |
|----|-------------|
| **F-001** | Swagger still `1.7.55` in committed JSON. |
| **F-003** | `app` lacks www CSP/HSTS/XFO. |
| **F-005** | npm audit BE 27 / FE 32 high/critical — triage. |
| **F-011** | EC2 disk **78%**. |
| **F-009** | SDK README still 1.0.1; no CHANGELOG 1.7.56. |

Wi‑Fi password in examples: **out of scope** this audit.

---

## Scorecard / pack

- Full scorecard: `AUDIT-20261020-01-SCORECARD.md` (**CLOSED**)  
- Findings: `AUDIT-20261020-01-FINDINGS.md`  
- External pack: `AUDIT-20261020-01-PACK/`  
- ESP32 QA folded into F-006..F-009  

---

## Repair sequence (when you say ship)

1. **F-010** — kill/lock create-tenant  
2. **F-012** — renew www + api certs  
3. **F-007** — command log truth  
4. **F-006** — examples vs interval (product call if changing ingest)  
5. **F-008** — OTA example + OTA.md  
6. **F-002** — backup runbook or Accepted risk  
7. S2/S3 hygiene one ship at a time  

---

## Honest line on “100% correct”

Close every S0; close or **Accepted-risk** every S1 with your date; re-run Full audit with no new undisposed S0/S1. This audit is that map. Say the finding ID when you want the first ship.
