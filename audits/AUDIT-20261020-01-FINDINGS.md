# AUDIT-20261020-01 — Findings

**Standard:** PLATFORM_AUDIT_STANDARD v1.0.0  
**Opened:** 2026-10-20  
**Closed:** 2026-10-20  
**Disposition default:** Backlog (no ship under this audit ID)

---

### F-001 — Swagger `info.version` lags package 1.7.56
- **Domain:** BE-API  
- **Checklist:** BE-API-014  
- **Severity:** S2  
- **Disposition:** Backlog  
- **Summary:** Committed `backend/docs/swagger.json` and `docs/docs/public/swagger.json` still report `info.version` **1.7.55** while `package.json` is **1.7.56**. Local `npm run swagger:check` re-exports cleanly to 1.7.56 and passes; the release bump did not commit the re-export. Path counts currently match (233).  
- **Evidence:** 2026-10-20 — committed swagger version 1.7.55; package 1.7.56.  
- **Recommended ship intent:** Single ship — re-export swagger, sync public JSON.  
- **Do not mix with:** control widgets, DNS, mobile.

---

### F-002 — No production DB backup/restore runbook
- **Domain:** BE-DATA / OPS  
- **Checklist:** BE-DATA-005, OPS-004  
- **Severity:** S1  
- **Disposition:** Backlog  
- **Summary:** Builder docs describe product restore of rule-engine graphs, not Postgres/Timescale backup/restore/RPO for EC2. External diligence will ask. Marked as gap, not “we have backups” without evidence.  
- **Evidence:** 2026-10-20 — grep ARCHITECTURE / backend docs for backup/pg_dump → no prod backup procedure. Rollback of *code* is in `deployment.md` (retag previous); that is not DB RPO.  
- **Recommended ship intent:** Document confirmed backup method (AMI snapshot / pg_dump / volume) or founder Accepted risk with review date.  
- **Do not mix with:** API feature work.

---

### F-003 — `app.autoconnecto.in` missing security headers present on www
- **Domain:** FE / WEB / INFRA  
- **Checklist:** WEB-004, FE-011  
- **Severity:** S2  
- **Disposition:** Backlog  
- **Summary:** `www.autoconnecto.in` returns CSP, HSTS, X-Content-Type-Options, X-Frame-Options. `app.autoconnecto.in` response headers from S3/CloudFront spot-check did not show the same set (`Server: AmazonS3`).  
- **Evidence:** 2026-10-20 — `curl -sSI` www vs app.  
- **Recommended ship intent:** Align CloudFront response headers for app distribution.  
- **Do not mix with:** widget features.

---

### F-004 — (Info) SES MAIL FROM recovered
- **Domain:** BE-MAIL / INFRA  
- **Checklist:** BE-MAIL-003, INFRA-002  
- **Severity:** S4  
- **Disposition:** Fixed (pre-audit remediation)  
- **Summary:** After NS move, MAIL FROM was TemporaryFailure; MX/SPF restored; status is **Success**.  
- **Evidence:** 2026-10-20 — SES MAIL FROM Success; DNS MX `feedback-smtp.ap-south-1.amazonses.com`.

---

### F-005 — npm audit: high/critical dependency findings
- **Domain:** SEC  
- **Checklist:** SEC-005  
- **Severity:** S2  
- **Disposition:** Backlog  
- **Summary:** Production `npm audit --omit=dev`: backend **27** vulns (15 high, 2 critical); frontend **32** (18 high, 2 critical). Includes `ws` via socket.io stacks. Needs triage — not a blind `npm audit fix --force`.  
- **Evidence:** 2026-10-20 — BE+FE audit summaries.  
- **Recommended ship intent:** Dependency triage ship only (lockfile + tested upgrades).  
- **Do not mix with:** feature releases.

---

### F-006 — MQTT example bursts lose telemetry (plan interval)
- **Domain:** SDK / BE-API / DOCS  
- **Checklist:** SDK-002, BE-API-004, DOCS-001  
- **Severity:** S1  
- **Disposition:** Backlog  
- **Summary:** Real ESP32 QA on SDK **1.7.56**. MQTT examples send **three readings in the same second**; production plan interval drops extras. Live FREE plan: `min_telemetry_interval_sec: **30**`. Customer guide correctly states Free=30s / Hobby=10 / Starter=5 / Growth+Enterprise=1. Examples and SDK README still teach same-second multi-send.  
- **Evidence:** ESP32 QA 2026-10-20; `GET /api/plans` FREE=30; `docs/docs/guide/telemetry-and-attributes.md`; `plan.service.ts` `checkTelemetryInterval`.  
- **Recommended ship intent:** Fix examples + README to space ≥ plan interval (product call if changing ingest semantics).  
- **Do not mix with:** OTA example fix, command-log fix.

---

### F-007 — Command log widget empty; attribute commands show unanswered
- **Domain:** FE / BE-API / DOCS  
- **Checklist:** FE-005, BE-API-008, DOCS-004, BE-RT-007  
- **Severity:** S1  
- **Disposition:** Backlog  
- **Summary:** On real ESP32, **13 commands** received by the board never appeared in the Command Log widget. Attribute writes showed as **unanswered** instead of **Saved**, contradicting customer docs. Backend has `insertCommandLog` on device-commands and device-attributes controllers — path may not fire for MQTT SHARED path used by board, or widget filter/poll misses rows.  
- **Evidence:** ESP32 QA 2026-10-20; `CommandLogWidget` / `insertCommandLog` source; docs command-log claim.  
- **Recommended ship intent:** Single ship — trace insert for SHARED attribute + RPC from production path; align widget/docs.  
- **Do not mix with:** telemetry interval docs.

---

### F-008 — OTA firmware example never downloads (callback after begin)
- **Domain:** SDK  
- **Checklist:** SDK-003, SDK-004  
- **Severity:** S1  
- **Disposition:** Backlog  
- **Summary:** Board received update details **4 times** but never downloaded firmware. Sketch registers update handling **after** `sdk.begin()`. `OTA.md` referenced from README is **missing** from SDK tree. Device download API requires valid device token (`api/v1/:deviceToken/firmware` → 404 on invalid).  
- **Evidence:** ESP32 QA 2026-10-20; no `sdk/OTA.md`; OTA device controller token path.  
- **Recommended ship intent:** Fix example order + restore OTA.md.  
- **Do not mix with:** telemetry interval example changes.

---

### F-009 — SDK release docs drift (CHANGELOG / README version)
- **Domain:** SDK  
- **Checklist:** SDK-001  
- **Severity:** S3  
- **Disposition:** Backlog  
- **Summary:** `library.properties` is 1.7.56; README still says **Version: 1.0.1**; CHANGELOG has **no 1.7.56** entry.  
- **Evidence:** 2026-10-20 — README Version line; library.properties 1.7.56.  
- **Recommended ship intent:** Docs-only SDK ship.  
- **Do not mix with:** behaviour fixes F-006..F-008 unless tagging a new SDK that includes those fixes.

---

### F-010 — Unauthenticated `POST /public/create-tenant` still mounted
- **Domain:** SEC / BE-API  
- **Checklist:** SEC-008, BE-API-002  
- **Severity:** S0  
- **Disposition:** Backlog  
- **Summary:** `PublicController` `POST /public/create-tenant` has **no JWT/guard** and can insert `tenants` + `users` (TENANT_ADMIN). Intended signup is `/api/auth/signup`. Live: empty body → **500** (not 401). Module registered in AppModule.  
- **Evidence:** 2026-10-20 — `public.controller.ts`; curl POST without auth → 500.  
- **Recommended ship intent:** Security ship only — remove or hard-disable in production.  
- **Do not mix with:** SDK example fixes.

---

### F-011 — EC2 root disk at 78%
- **Domain:** INFRA / OPS  
- **Checklist:** INFRA-010  
- **Severity:** S2  
- **Disposition:** Backlog  
- **Summary:** Production EC2 `/` is **75G used / 96G (78%)**. Healthy containers, but capacity headroom is thin for logs/images/firmware growth before next audit.  
- **Evidence:** 2026-10-20 — `df -h /` via `ec2-autoconnecto`.  
- **Recommended ship intent:** Ops ship — prune docker images/logs; set disk alert threshold; document.  
- **Do not mix with:** feature releases.

---

### F-012 — TLS certificates for www and api expire within ~1 month
- **Domain:** INFRA  
- **Checklist:** INFRA-008  
- **Severity:** S1  
- **Disposition:** Backlog  
- **Summary:** Public TLS notAfter (UTC): **www 2026-11-12**, **api 2026-11-18**; app/docs into 2027. External diligence and uptime both fail if these expire.  
- **Evidence:** 2026-10-20 — Python SSL peer cert check.  
- **Recommended ship intent:** Cert renew ship only (ACM/nginx as applicable) before 2026-11-12.  
- **Do not mix with:** app features.

---

**Note:** Founder directed Wi‑Fi password in SDK examples **out of scope** for this audit — not recorded as a finding.

---

## Pass highlights (evidence short form)

| ID | Result | Evidence |
|----|--------|----------|
| BASE-001..006 | Pass | ARCHITECTURE v1.7.56; healthz; FE CI; EC2 tag; Hard gates; SES Success |
| BE-API-001 | Pass | Nest bootstrap / compose healthy |
| BE-API-003 | Pass | devices queries require tenant_id (spot) |
| BE-API-004 | Pass | Plans live FREE interval 30; docs match |
| BE-API-011 (OTA admin) | Pass | Jwt on `api/ota`; device chunk needs token |
| BE-API-013 (docs gen) | Pass | generate-all → 400 refuse written docs |
| BE-DATA-003 | Pass | Audit purge 1y (prior open evidence) |
| BE-RT-001 | Pass | Socket.IO `/socket.io` |
| BE-RT-004 | Pass | SHARED/CLIENT + requestId in release notes / code |
| BE-MAIL-* | Pass | Brevo app; Cognito SES; DKIM/MAIL FROM |
| FE-001 | Pass | tsc clean on audit revision |
| FE-003 | Pass | single `getSocket()` owner |
| FE-004 | Pass | 93 widget types in registry |
| MOB-* | Pass | v1.7.56 APK workflow |
| SDK-001 (library) | Pass* | library.properties 1.7.56; *README drift → F-009 |
| DOCS-001 interval | Pass | guide states Free 30s |
| DOCS-003 | Pass | no competitor names in docs/website src |
| WEB-001 | Pass | no CoAP in website src |
| WEB-004 www | Pass | CSP/HSTS on www |
| BILL-003 | Pass | Dodo unwrap + 401 bad sig |
| SOL-001/003 | Pass | seed opt-in; no founder device rename |
| SEC-003 | Pass | PlatformAdminGuard on platform-admin |
| OPS-001/003 | Pass | healthz; deployment.md release path + rollback retag |
| EXT-* | Pass | Pack at close |

---

## Recommended repair order (founder)

1. **F-010** (S0) — lock/remove `public/create-tenant`  
2. **F-012** (S1) — renew www + api TLS before 2026-11-12  
3. **F-007** (S1) — command log truth  
4. **F-006** (S1) — examples vs plan interval (product call if changing ingest)  
5. **F-008** (S1) — OTA example + OTA.md  
6. **F-002** (S1) — backup runbook or Accepted risk  
7. Then S2: F-001, F-003, F-005, F-011; S3: F-009  

One intent per ship. Say the finding ID when you want a ship.
