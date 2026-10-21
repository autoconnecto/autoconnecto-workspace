# Autoconnecto — Platform Audit Standard

**Status:** FROZEN  
**Version:** 1.0.0  
**Frozen by:** Founder, 2026-10-20  
**Owner (execution):** Cursor agent  
**Authority (freeze / ship):** Founder  
**Related:** `CHANGE_MANAGEMENT.md`, `deployment.md`, `.cursor/rules/release-deploy.mdc`, `ARCHITECTURE.md`

---

## 1. Purpose

This document is the **only** procedure for a platform audit of Autoconnecto.

It exists so that:

1. Every internal audit is **exhaustive, repeatable, and comparable** over time.
2. Findings never again spill into a mixed production release that breaks CI, DNS, or customer paths.
3. When an **external** auditor, buyer, or security assessor arrives, we already have evidence packs and a known backlog — not a scramble.

This standard is **future-proof**: new products, transports, or clouds are added as new **domains** under §8 without rewriting the operating rules in §2–§7.

**Out of scope of this document:** claiming ISO 27001 certification, on-prem install, WhatsApp, or camera — those wait for a contract (product fact). The standard still prepares the platform so those assessments can start from a clean baseline when a contract asks.

---

## 2. Hard laws (never waived)

| # | Law |
|---|-----|
| L1 | **Audit ≠ release.** An audit produces findings and evidence. It does **not** push, tag, deploy, or change production DNS unless the founder separately orders a **single-intent ship** under `CHANGE_MANAGEMENT.md` Hard gates. |
| L2 | **One intent per ship.** After audit, fixes ship as separate releases (or clearly sequenced ships), never “audit + feature + infra” in one go. |
| L3 | **No silent skip.** Every domain in §8 is marked **Pass / Fail / N/A (with reason) / Deferred (founder accepted)**. |
| L4 | **Evidence or it did not happen.** A Pass requires path, command, screenshot, curl, or commit SHA as defined in §6. |
| L5 | **Invented systems are Fail.** If the codebase or console does not show it, say **unconfirmed** — never invent “we have X.” |
| L6 | **Founder command.** Cursor may recommend severity and order. Only the founder freezes this standard, prioritises the backlog, and says deploy. |
| L7 | **Production safety.** Live probes use agreed test devices / tenants. Do not rename the founder’s test devices, invent meter readings, or acknowledge live alarms unless asked. |
| L8 | **External device-path faults stay exceptional.** Build and ship under `sdk/BOARD_VERIFY.md` / `CHANGE_MANAGEMENT.md` Hard gate 4 so telemetry, switch/RPC, command log, and OTA are proven before “fixed.” A Full audit that re-discovers those as routine Fail is a process breach, not only a product bug. |

---

## 3. Roles

| Role | Responsibility |
|------|----------------|
| **Founder** | Freeze this standard; set audit start; prioritise backlog; approve any production change; accept Deferred. |
| **Cursor (auditor)** | Execute every domain; write findings; attach evidence; never ship unless ordered. |
| **External auditor** | Receives the Evidence Pack (§10). Does not get secrets, production `.env`, or customer PII dumps. |

---

## 4. When to run

| Trigger | Type | Depth |
|---------|------|--------|
| Founder orders “full platform audit” | **Full** | All domains §8 |
| Before a known external assessment / buyer diligence | **Full** | All domains + Evidence Pack |
| After a major transport / auth / billing / DNS change | **Targeted** | Affected domains + regression of §8.0 Baseline |
| Quarterly (recommended) | **Full** | All domains |
| After critical production incident | **Incident** | Domains implicated + Baseline |

A **Targeted** audit still obeys L1–L7. It must list which domains were **out of scope** and why.

---

## 5. Severity and disposition

### 5.1 Severity

| Severity | Meaning | Typical examples |
|----------|---------|------------------|
| **S0 Critical** | Active production break, data loss risk, auth bypass, secret exposure | Public secret; unauthenticated write; DNS that stops Cognito/SES or app |
| **S1 High** | Will fail a competent external review or break a paying customer path | Broken swagger contract; missing tenant isolation; deploy that fails CI |
| **S2 Medium** | Material gap; fix in a planned ship | Incomplete docs for a shipped feature; weak timeouts; missing metrics |
| **S3 Low** | Hygiene / consistency | Naming drift; unused code; cosmetic UI |
| **S4 Info** | Observation; no defect | “Brevo used for OTP; SES for Cognito” |

### 5.2 Disposition (per finding)

| Disposition | Meaning |
|-------------|---------|
| **Open** | Confirmed; not yet scheduled |
| **Accepted risk** | Founder accepts; record reason and review date |
| **Backlog** | Prioritised for a future single-intent ship |
| **In ship** | Assigned to a named release intent |
| **Fixed** | Verified with evidence; closed |
| **False positive** | Evidence shows not a defect |

---

## 6. Evidence standard

For every **Pass** or **Fail**:

1. **What** was checked (checklist item ID, e.g. `BE-API-014`).
2. **How** (command, console path, file path, URL).
3. **When** (UTC timestamp).
4. **Result** (Pass / Fail / N/A / Deferred).
5. **Artifact** — at least one of:  
   - command output snippet (no secrets)  
   - file path + line or commit SHA  
   - screenshot under `screenshots/audit/<audit-id>/`  
   - curl / health response  
   - CI run URL  

**Never** paste into evidence: `.env` values, API keys, Cognito secrets, customer tokens, live alarm payloads the founder did not ask to inspect.

---

## 7. Operating procedure (every Full audit)

### 7.1 Open the audit

1. Founder: “Start Full audit under PLATFORM_AUDIT_STANDARD vX.Y.Z (frozen).”
2. Cursor creates:
   - Audit ID: `AUDIT-YYYYMMDD-NN`
   - Working folder: `screenshots/audit/AUDIT-YYYYMMDD-NN/` (evidence only)
   - Findings file: `audits/AUDIT-YYYYMMDD-NN-FINDINGS.md`
   - Scorecard: `audits/AUDIT-YYYYMMDD-NN-SCORECARD.md`
3. Record platform versions from production table in `ARCHITECTURE.md` and live `healthz` / FE version.

### 7.2 Execute domains in order

Run §8 domains **in sequence**. Do not skip ahead to “interesting” code. Parallel work is allowed **within** a domain, not across unclosed domains unless noted in the scorecard.

Expected calendar (guidance, not a deadline): a Full audit may take **multiple days**. Prefer completeness over speed.

### 7.3 Close the audit

Audit is **complete** only when:

1. Every domain has a scorecard row.  
2. Every Fail has a finding ID and severity.  
3. Evidence pack index exists (§10).  
4. Founder has the backlog summary (S0/S1 first).  
5. **No production push** was made under the audit ID unless the founder ordered a separate ship.

### 7.4 After freeze of findings

Founder picks ship intents. Cursor executes under Hard gates. Each ship references finding IDs closed.

---

## 8. Domain catalogue (exhaustive)

Each domain has an ID prefix. New domains get a new letter prefix and are appended; old IDs never renumber.

When a domain does not apply yet (e.g. on-prem), mark **N/A — product deferred** and cite the product fact.

### 8.0 BASE — Baseline (always first)

| ID | Check |
|----|--------|
| BASE-001 | Production version table in `ARCHITECTURE.md` matches live BE tag / FE package / docs / mobile as claimed |
| BASE-002 | `GET https://api.autoconnecto.in/healthz` → postgres/redis ok |
| BASE-003 | FE deploy Action last run success for current main |
| BASE-004 | EC2 `git describe` equals released backend tag |
| BASE-005 | No secrets in git history of this audit’s changed files (spot-check) |
| BASE-006 | Hard gates document present: FE build, DNS SES checklist, audit≠release |

### 8.1 BE-API — Backend HTTP API

| ID | Check |
|----|--------|
| BE-API-001 | Nest bootstrap and readiness (`main.ts`, startup docs) |
| BE-API-002 | Auth: Cognito JWT on protected routes; public routes intentional and listed |
| BE-API-003 | Tenant isolation on device, dashboard, alarm, attribute, telemetry queries |
| BE-API-004 | Role / plan enforcement (FREE vs paid limits) where claimed |
| BE-API-005 | Input validation (DTOs, pipes, UUID params) |
| BE-API-006 | Error shapes consistent; no stack traces to clients in production |
| BE-API-007 | Idempotent writes where MQTT/QoS duplicates expected |
| BE-API-008 | Destructive ops: NotFound on missing; audit row when required |
| BE-API-009 | Rate / body limits (nginx / Nest) documented |
| BE-API-010 | Webhooks / integrations: auth, body validation, failure modes |
| BE-API-011 | OTA, billing, platform-admin: privilege checks |
| BE-API-012 | Scheduler, geofence, reports: validation and tenant scope |
| BE-API-013 | Documentation / swagger HTTP surfaces match export |
| BE-API-014 | `npm run swagger:export` + `swagger:check` clean; public `docs` swagger synced |
| BE-API-015 | OpenAPI: no silent required-query traps; enums; status codes |

### 8.2 BE-DATA — Database & migrations

| ID | Check |
|----|--------|
| BE-DATA-001 | Migrations ordered; prod migrate path only via release compose |
| BE-DATA-002 | No `docker compose down -v` in release docs |
| BE-DATA-003 | Retention / audit_logs retention job matches claimed period |
| BE-DATA-004 | Indexes for hot paths (telemetry query, attributes) — spot-check |
| BE-DATA-005 | Backup / restore story documented or marked gap |
| BE-DATA-006 | PII fields identified; no unnecessary logging of PII |

### 8.3 BE-RT — Realtime, MQTT, device WS

| ID | Check |
|----|--------|
| BE-RT-001 | Socket.IO path `/socket.io`; rooms `device:{id}` |
| BE-RT-002 | Device WS gateway lifecycle and auth |
| BE-RT-003 | MQTT clients: connect, reconnect, offline logging without flood |
| BE-RT-004 | Attribute SHARED/CLIENT scopes; command `requestId` |
| BE-RT-005 | Presence / Redis failure mode documented in code or ARCHITECTURE |
| BE-RT-006 | Telemetry ingest: plan caps, bulk mode, duplicate safety |
| BE-RT-007 | RPC / command path: log, response event, timeout behaviour |

### 8.4 BE-MAIL — Mail, SMS, Cognito messaging

| ID | Check |
|----|--------|
| BE-MAIL-001 | App OTP / alarms / tenant mail path = Brevo (or configured provider) — not silent SES |
| BE-MAIL-002 | Cognito EmailConfiguration SourceArn / SES identity verified |
| BE-MAIL-003 | SES custom MAIL FROM `mail.` MX + SPF present; status Success or tracked TemporaryFailure |
| BE-MAIL-004 | `_amazonses` + DKIM CNAMEs present after any NS change |
| BE-MAIL-005 | Secrets only in `.env.production` / secret store — not in git |
| BE-MAIL-006 | SMS providers and sender IDs match ENVIRONMENT.md |

### 8.5 FE — Frontend app

| ID | Check |
|----|--------|
| FE-001 | `npm run build` exit 0 on audit revision |
| FE-002 | Env: no hardcoded prod URLs; `VITE_*` documented |
| FE-003 | One Socket.IO ownership model; no ad-hoc sockets in features |
| FE-004 | Widget registry: stable `type` strings; configs have defaults |
| FE-005 | Controls: transport attribute\|rpc; confirm toasts; scoped attributes |
| FE-006 | Indicators: telemetry \| attribute source where claimed |
| FE-007 | Dashboard create/save/execute paths; no silent drop of widgets |
| FE-008 | Auth login / token refresh / logout |
| FE-009 | Tenant branding, integrations panel, platform admin surfaces |
| FE-010 | Accessibility / expert UI: no unwanted wizardisation of expert screens |
| FE-011 | Bundle / console errors on main dashboards (spot-check) |

### 8.6 MOB — Mobile

| ID | Check |
|----|--------|
| MOB-001 | versionName / versionCode aligned with platform release policy |
| MOB-002 | Android release workflow success for current tag |
| MOB-003 | Widget / API compatibility with backend contracts |
| MOB-004 | Auth and API base URL configuration |

### 8.7 SDK — Device SDK

| ID | Check |
|----|--------|
| SDK-001 | `library.properties` version matches release tag |
| SDK-002 | Topics / payloads match `sdk/TRANSPORT_ARCHITECTURE.md` and backend |
| SDK-003 | CLIENT confirm / RPC documented for controls |
| SDK-004 | Examples compile for claimed boards (spot-check or CI) |

### 8.8 DOCS — Customer & builder docs

| ID | Check |
|----|--------|
| DOCS-001 | Customer pages match product (telemetry store, alarms both run, quiet hours off) |
| DOCS-002 | `customer-pages.json` / CONTENTS / in-app bundle consistency |
| DOCS-003 | No competitor product names in customer or website copy |
| DOCS-004 | Command-and-control / widget pages match shipped widgets |
| DOCS-005 | Builder ARCHITECTURE / ENVIRONMENT / STARTUP updated when contracts changed |
| DOCS-006 | Public docs site deploy success when docs changed |

### 8.9 WEB — Marketing website

| ID | Check |
|----|--------|
| WEB-001 | Claims match product (no false CoAP / features) |
| WEB-002 | Download / signup / docs links live |
| WEB-003 | Deploy Action success |
| WEB-004 | Security headers present (CloudFront / edge) |

### 8.10 INFRA — AWS, DNS, EC2, CI

| ID | Check |
|----|--------|
| INFRA-001 | Nameservers and hosted zone ownership clear |
| INFRA-002 | SES MAIL FROM checklist (CHANGE_MANAGEMENT Hard gate 3) |
| INFRA-003 | app / api / docs / www DNS targets correct |
| INFRA-004 | EC2 release script only path; no ad-hoc compose down -v |
| INFRA-005 | IAM: deploy user least privilege; root login not used for routine deploy |
| INFRA-006 | S3 buckets / CloudFront distributions for FE, docs, website |
| INFRA-007 | GitHub Actions secrets present; workflows green on main |
| INFRA-008 | TLS certificates valid for public hosts |
| INFRA-009 | Broker (EMQX) version and TLS story matches ops docs |
| INFRA-010 | Backups / disk / docker health spot-check on EC2 |

### 8.11 SEC — Security & access control

| ID | Check |
|----|--------|
| SEC-001 | No secrets in repos; `.gitignore` covers env |
| SEC-002 | CORS / cookie / token storage appropriate |
| SEC-003 | Admin routes platform-admin only |
| SEC-004 | Integration webhook auth |
| SEC-005 | Dependency high/critical vulns triaged (npm audit — disposition required) |
| SEC-006 | Audit log: human actions recorded; telemetry not mistaken for audit |
| SEC-007 | Password reset / signup OTP paths verified end-to-end on test account |
| SEC-008 | Public endpoints enumerated and justified |

### 8.12 BILL — Billing & plans

| ID | Check |
|----|--------|
| BILL-001 | Plan catalogue matches website/docs claims |
| BILL-002 | Enforcement on telemetry / users / dashboards as claimed |
| BILL-003 | Checkout / webhook signature verification |
| BILL-004 | Trial / cancel / change-plan edge cases |

### 8.13 SOL — Solutions & demos

| ID | Check |
|----|--------|
| SOL-001 | Catalog seed path documented; not destructive on prod by default |
| SOL-002 | Sample data flag behaviour; demos don’t count to plan if claimed |
| SOL-003 | No rename of founder test devices during audit |
| SOL-004 | Widget defaults not garbled |

### 8.14 OPS — Observability & runbooks

| ID | Check |
|----|--------|
| OPS-001 | Health endpoints; what “version in prod” means (no version on healthz — use git describe) |
| OPS-002 | Log noise vs unique failure states |
| OPS-003 | `deployment.md` is single source of truth for release |
| OPS-004 | Rollback path stated for last release |
| OPS-005 | On-call / founder contact for AWS Health (SES, etc.) |

### 8.15 EXT — External-auditor readiness

| ID | Check |
|----|--------|
| EXT-001 | Evidence Pack index complete (§10) |
| EXT-002 | Architecture diagram / narrative current |
| EXT-003 | Data flow: device → MQTT/WS → store → UI |
| EXT-004 | Subprocessor list (AWS, Brevo, Cognito, DNS, …) drafted |
| EXT-005 | Known Accepted risks listed with dates |
| EXT-006 | Gaps explicitly marked for future contract items (ISO, on-prem, …) |

---

## 9. Finding record format

Each finding in `audits/AUDIT-…-FINDINGS.md`:

```markdown
### F-001 — <title>
- **Domain:** BE-API
- **Checklist:** BE-API-014
- **Severity:** S1
- **Disposition:** Backlog
- **Summary:** …
- **Evidence:** …
- **Recommended ship intent:** (single sentence)
- **Do not mix with:** (other intents)
```

Scorecard row per domain:

```markdown
| Domain | Pass | Fail | N/A | Deferred | Notes |
```

---

## 10. Evidence Pack (for external parties)

When founder requests an external pack, Cursor produces a **redacted** folder or zip:

```text
audits/AUDIT-YYYYMMDD-NN-PACK/
  00-README.md          # scope, date, versions, contact
  01-SCORECARD.md
  02-FINDINGS-SUMMARY.md  # no secrets; S0–S2
  03-ARCHITECTURE.md      # or excerpt + pointer to public claims
  04-DATA-FLOW.md
  05-SUBPROCESSORS.md
  06-ACCEPTED-RISKS.md
  07-CI-AND-RELEASE.md    # how we ship; hard gates
  evidence/               # redacted screenshots / curl
```

Never include: `.env`, keys, customer lists, raw DB dumps, Cognito app secrets.

---

## 11. Amending this standard (future-proofing)

1. Propose change as a PR / commit to this file only.  
2. Bump **Version** (semver):  
   - MAJOR — laws or severity semantics change  
   - MINOR — new domain or new checklist IDs  
   - PATCH — wording / examples  
3. Founder **freezes** by stating: “PLATFORM_AUDIT_STANDARD vX.Y.Z frozen.”  
4. Status line at top becomes **FROZEN**.  
5. Next Full audit must use the frozen version ID in the audit open record.

Checklist IDs are **append-only**. Deprecated checks are marked **Retired** with date; never reused for a different meaning.

---

## 12. Relationship to day-to-day change management

| Document | Job |
|----------|-----|
| `CHANGE_MANAGEMENT.md` | Every product change; impact matrix; hard gates; short checklist |
| `PLATFORM_AUDIT_STANDARD.md` | Periodic / ordered exhaustive assurance; backlog for later ships |
| `deployment.md` | How to release when founder asks |

An audit finding that needs a product change still runs **change management** when that ship is ordered.

---

## 13. Freeze checklist (founder)

Before the first Full audit under this document:

- [ ] Founder has read §§1–7 and Hard laws  
- [ ] Founder accepts severity table and audit≠release  
- [ ] Status set to **FROZEN** and version set to `1.0.0` (or agreed)  
- [ ] Founder says: “Start Full audit AUDIT-… under frozen v…”

**Frozen 2026-10-20.** Amendments require a version bump and a new founder freeze (§11).

---

## Document history

| Version | Date | Note |
|---------|------|------|
| 1.0.0-draft | 2026-10-20 | Initial comprehensive standard for founder freeze |
| 1.0.0 | 2026-10-20 | Founder freeze; Full audit AUDIT-20261020-01 authorised |
