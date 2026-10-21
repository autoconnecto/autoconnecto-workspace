# Autoconnecto — Change management

**Every change runs this checklist.** Cursor fills it; you do only the rows marked **You**.  
Deploy / commit / push / YouTube only when you ask. Release steps stay in `deployment.md`.

A change is not done until every row is **N/A**, **Updated** (Cursor), or **You — pending / done**.

---

## How this works for every change

```text
You ask for a change
        │
        ▼
Cursor does the code (and docs/swagger when needed)
        │
        ▼
Cursor MUST end with the Impact checklist (short form)
        │
        ├── rows 1–4, 8–14: Cursor updates or marks N/A
        ├── rows 5–6: Cursor flags + updates scripts/sources when in repo;
        │             rebuild MP4/PPSX may be You if tooling needs your machine
        ├── row 7: You — YouTube + confirm Platform Admin Presentations assets
        └── row 15: You ask to deploy → Cursor follows deployment.md
```

**Enforcement**

| Layer | Role |
|-------|------|
| `.cursor/rules/change-management.mdc` (`alwaysApply`) | Agents must walk the matrix and paste the short checklist before “done”. |
| `.cursor/hooks.json` → `stop` hook | If the agent finishes a coding turn without the checklist, Cursor follows up and forces it. |
| CI `swagger:check` | Hard gate for OpenAPI drift (`CI=true`). |
| You | Final say on commit, YouTube, Presentations publish, deploy. |

Trivial Q&A with no repo edits: checklist may be omitted. Any edit under the workspace: checklist required.

---

## Hard gates (non-negotiable)

These exist because skipping them caused real production failures. Cursor must not “ship and hope.”

### 1 — One intent per ship

- Ship **one** intent: a product feature, **or** an API/swagger audit wave, **or** infra/DNS — not two or three mixed into one release.
- **Audit ≠ release.** Audit findings go to a backlog. Only items you pick ship. No “while we’re here” onto production.

### 2 — Frontend: local build before any push

- In `frontend/`, run `npm run build` (`tsc -b && vite build`) and wait for **exit 0** before `git push` of `autoconnecto-frontend`.
- CI runs the same command. A local TypeScript failure means the S3 deploy will fail.
- Confirm the GitHub Action **Frontend — deploy to S3** is **success**, not only that push returned.

### 3 — AWS DNS / nameserver change: SES MAIL FROM checklist

Before changing **nameservers** or replacing the authoritative DNS zone for `autoconnecto.in` (or any domain that SES uses), restore or verify these records in the **new** zone, then wait for SES to leave TemporaryFailure:

| Record | Purpose |
|--------|---------|
| `mail.autoconnecto.in` **MX** → `10 feedback-smtp.ap-south-1.amazonses.com` | Custom MAIL FROM (Cognito / SES) |
| `mail.autoconnecto.in` **TXT** → `v=spf1 include:amazonses.com ~all` | SPF for MAIL FROM subdomain |
| `_amazonses.autoconnecto.in` **TXT** | Domain identity proof (token from SES) |
| Three `*._domainkey.autoconnecto.in` **CNAME** → `*.dkim.amazonses.com` | Easy DKIM |

Also keep app / API / www records (CloudFront / API host) and Brevo TXT if they were on the old zone.

**Note:** Platform app mail (OTP, alarms) uses **Brevo**, not SES. SES MAIL FROM still matters for **Cognito** (forgot password / Cognito-triggered mail). Behaviour on MX failure today is `UseDefaultValue` (falls back to Amazon MAIL FROM) — still restore the records; do not rely on the fallback.

Release command detail: `deployment.md` and `.cursor/rules/release-deploy.mdc`.

### 4 — Board / device path: verify before “fixed”

**Policy:** An external auditor finding faults on telemetry, switches, RPC, command log, or OTA must be an **exception**, not routine.

Applies when the change touches SDK transport/examples/OTA, backend device push (MQTT shared attrs, commands/RPC, OTA chunks, command log), or FE widgets that **send** control.

- Follow [`sdk/BOARD_VERIFY.md`](sdk/BOARD_VERIFY.md) (rows B1–B7).
- Cursor rule: `.cursor/rules/board-verify.mdc` (`alwaysApply`).
- **Do not** claim fixed / verified / confirmed working for those surfaces unless each relevant row is **Pass**, or mark **Code review + static only — not board-verified** (board offline / founder blocked).
- `tsc`, seed audits, and reading source are **not** board proof.
- Always trace the **widget’s real HTTP route** before adding logging or device push.

---

## Who does what

| # | Surface | Cursor | You |
|---|---------|--------|-----|
| 1 | Frontend | Code + widget/registry rules | Review UI if you want |
| 2 | Backend | Code + migrations when needed | — |
| 3 | Customer docs | Update `docs/docs/`, screenshots, `customer-pages.json` | Ask to publish docs when ready |
| 4 | Swagger | `swagger:export`, sync public JSON, `swagger:check` | — |
| 5 | Video lessons | Update `training-videos/lessons.json` (EN/HI); flag which lesson numbers; rebuild if scripts allow | Approve / re-record if capture needs your login or machine |
| 6 | Presentations (source) | Update `presentations/platform-film` / `platform-live` sources when claims changed; flag rebuild | Run rebuild if you prefer to own film tooling |
| 7 | **Platform Admin → Presentations** + YouTube | Update `PlatformAdminPresentations.tsx` if names/paths change; copy rebuilt MP4/PPSX into `frontend/public/presentations/` (served as `/presentations/…`) | **YouTube upload/replace** (manual). Confirm the Presentations tab Play/Download still works after FE deploy. |
| 8 | Website | Update `website/` when public claim changes | Ask to deploy website |
| 9 | Mobile | Update app when API/UI shared | Ask to tag/release APK |
| 10 | SDK | Update SDK + transport docs | Ask to publish library version |
| 11 | Architecture notes | Update builder ARCHITECTURE files | — |
| 12 | Migrations | Add migration files | Ask to run prod migrate via release |
| 13 | Solutions / demos | Update templates/docs; never rename your test devices | — |
| 14 | CI | Keep / extend gates if we agree | — |
| 15 | Deploy | Run full release **only when you ask** | Say “deploy” / “ship” |

**Platform Admin note:** The tab is labeled **Presentations** (not “Videos”). It plays/downloads the platform film and live film from app-static URLs (`/presentations/Autoconnecto-Platform-Film.mp4`, etc.). That is the in-app video surface. YouTube stays separate and manual.

---

## Impact matrix (detail)

| # | Ask | Update when | Where |
|---|-----|-------------|--------|
| 1 | FE screen/widget/API client/realtime? | UI, routes, widget `type`, Socket.IO | `frontend/` |
| 2 | HTTP/MQTT/WS/DB/plans/ingest? | Controllers, services, env | `backend/` |
| 3 | Operator/integrator reads a different step? | Screens, setup, behaviour, prices | `docs/docs/` + screenshots |
| 4 | Route/DTO/guard/query/status? | Nest OpenAPI | Export → `backend/docs/swagger.json` + `docs/docs/public/swagger.json` |
| 5 | Help Wizard / filmed lesson flow? | Spoken script or UI in lesson | `training-videos/lessons.json` + MP4s |
| 6 | Sales/story film claim? | Demo path or product claim | `presentations/` |
| 7 | Published film/lesson URL or Admin list? | New/replaced media | Admin Presentations assets + YouTube (You) |
| 8 | Public website claim? | Marketing copy | `website/` |
| 9 | Phone app same behaviour? | Shared APIs/UI | `autoconnecto-mobile/` |
| 10 | Device transport contract? | Topics/payloads | `sdk/` |
| 11 | Contract/startup ownership? | Builder notes | `ARCHITECTURE.md` family |
| 12 | Schema/seed? | Migrations | backend migrate path |
| 13 | Catalog/demo template? | Solutions | solutions + docs |
| 14 | Contract drift risk? | OpenAPI/build | `platform-ci.yml` |
| 15 | Production must match? | Only when asked | `deployment.md` |

---

## Short checklist (Cursor pastes this)

```text
Change management — <one sentence>

1  Frontend           N/A | Updated
2  Backend            N/A | Updated
3  Customer docs      N/A | Updated
4  Swagger            N/A | Export+sync | check passed
5  Video lessons      N/A | Flagged: lesson #… | Updated script
6  Presentations src  N/A | Flagged | Updated
7  Admin Presentations + YouTube
                      N/A | Assets updated (Cursor) | You: YouTube / verify tab
8  Website            N/A | Updated
9  Mobile             N/A | Updated
10 SDK                N/A | Updated
11 Architecture notes N/A | Updated
12 Migrations         N/A | Added
13 Solutions/demos    N/A | Updated
14 CI gates           Passed | N/A
15 Deploy             Not asked | Asked → follow deployment.md
   Hard gates         FE build 0 before push | DNS SES MAIL FROM N/A or done | One intent
   Board verify       N/A | Pass B1–B7 (see sdk/BOARD_VERIFY.md) | Not board-verified (static only)

You (founder): <bullet list of only your actions, or “none”>
```

---

## Product facts (do not “fix away”)

- Telemetry/attributes store without a save node; **drop** is the only skip.
- Profile alarms and chain alarms **both** run.
- Quiet hours / Monday energy mail default **off**.
- Camera, WhatsApp, ISO 27001, on-prem wait for a contract.
- Do not rename his test devices or invent readings / live alarms.

---

## Deferred

If media (5–7) must trail: say **Deferred — founder accepted** with reason. Do not call the product fully updated until you accept the deferral.

---

## Related

- Release: `deployment.md`
- **Board / device path:** `sdk/BOARD_VERIFY.md` + `.cursor/rules/board-verify.mdc` — external device-path findings should stay exceptional
- **Platform audit (exhaustive / external-ready):** `PLATFORM_AUDIT_STANDARD.md` — audit ≠ release; freeze before Full audit
- Docs rule: `.cursor/rules/documentation.mdc`
- Agent rule: `.cursor/rules/change-management.mdc`
- Stop hook: `.cursor/hooks.json`
- Admin UI: `frontend/src/features/platform-admin/PlatformAdminPresentations.tsx`
