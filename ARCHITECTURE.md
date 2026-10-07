# Autoconnecto Architecture (System-level)

This document reflects the architecture confirmed from the current codebase. Any future/planned items are explicitly marked as recommendations.

## Components

### Backend (`backend/`) — confirmed

- NestJS application (`src/main.ts`, `src/app.module.ts`)
- REST endpoints via controllers (including `/api/reports` and user invite `/api/users/:userId/invite/*`)
- **Browser realtime** via Socket.IO gateway (`@WebSocketGateway`, path `/socket.io`)
- **Device raw WebSocket** server (standalone `ws` server on `DEVICE_WS_PORT`)
- MQTT services (multiple clients) for telemetry ingest, RPC/ack consume, attribute flows, and command publishing
- Storage dependencies:
  - Postgres via `pg` pool (`DatabaseService`)
  - Redis via `ioredis` (presence; also BullMQ when enabled)

### Frontend (`frontend/`) — confirmed

- React + Vite + TypeScript
- Dashboard/widget system with registry and per-widget configuration UI
- Realtime consumption via Socket.IO client; telemetry is normalized and streamed to listeners; attributes are merged into an in-memory store

### Device SDK (`sdk/`) — confirmed

- Arduino/ESP32 SDK (C++)
- `AutoconnectoSDK` orchestrates WiFi + `ConnectionManager`
- `ConnectionManager` owns `MQTTTransport`
- `MQTTTransport` builds broker URI as WSS (`wss://{host}:{wssPort}/mqtt`) and subscribes to shared attrs + RPC request topics

### Docs (`docs/`) — confirmed

- VitePress site with content under `docs/docs/*`
- Developer and user docs exist, including detailed dashboard widget docs

### Website (`website/`) — confirmed

- Next.js 15 App Router site, configured for static export (`output: 'export'`)
- SEO metadata + sitemap/robots routes

## Confirmed data flows

### Device → Backend → Frontend (telemetry)

- Device sends telemetry via MQTT (`devices/+/telemetry`) and/or device raw WS message type `"telemetry"`.
- Backend ingests and emits to browser clients via Socket.IO (`telemetry_update` / `telemetry_update_global`), using rooms named `device:{deviceId}`.
- Frontend normalizes telemetry payloads and distributes them through `telemetry.store.ts`.

### Attributes (client/shared)

- Device client attributes can arrive via MQTT (`devices/+/attributes/client`) and are persisted to DB.
- Backend emits attribute updates to browser via Socket.IO (`attribute_update`), and the frontend merges partial updates keyed by `deviceId`.
- Shared attributes are stored in DB and published to devices via MQTT snapshots (retained), and can also be requested by devices via MQTT request/response topics.

### Attribute-based control (stateful, persistent across power cycles)

This is the primary control pattern for widgets that manage device state: **Switch**, **AttributeControlCard**, **SliderControl**.

**Write path (dashboard → device):**
1. User changes a value on the dashboard widget (e.g. toggles a switch).
2. Frontend writes to the **shared attribute** via `POST /api/devices/:deviceId/attributes` with `scope: "SHARED"`.
3. Backend persists the shared attribute to DB and publishes it to the device via MQTT (retained, so the device receives it even after reconnection).

**Confirmation path (device → dashboard):**
4. Device receives the shared attribute update.
5. Device applies the change to its hardware state and writes a matching **client attribute** back to the backend as confirmation (e.g. `channel1: 1`).
6. Backend persists the client attribute and emits `attribute_update` to browser clients via Socket.IO.
7. Dashboard receives the client attribute update and reflects the confirmed state in the widget.

**Power-cycle behaviour:**
On device restart, the device subscribes to its shared attributes (MQTT retained) at startup, restores its working state from them, and immediately publishes its client attributes back. This brings the dashboard into sync automatically — without any user action — because the confirmed state is driven by the device reading its own shared attributes on boot.

**Design intent:** Shared attributes are the source of truth for desired state. Client attributes are the source of truth for confirmed device state. The feedback loop ensures the dashboard always reflects actual hardware state, not just the last command sent.

**Platform differentiator:** This attribute feedback loop solves a known pain point in platforms like ThingsBoard, where a device reboot causes the dashboard to show stale state until the user manually re-issues a command. In Autoconnecto, the device self-heals on every boot — it reads its own retained shared attributes, restores hardware state, and pushes confirmed client attributes back — making the dashboard resync automatically with zero user intervention. This is a core platform USP and must be preserved in all future control widget designs.

---

### RPC commands (fire-and-forget, imperative triggers)

This is the control pattern for **one-time actions that do not have persistent state**: reboot device, open door, reset counter, trigger OTA update, etc.

**Write path (dashboard → device):**
1. User clicks an action button on the **RPC Widget**.
2. Frontend calls `POST /api/devices/:deviceId/commands` with `{ method, params, requestId }`.
3. Backend routes the command to the device via raw device WS (if connected) or MQTT publish (`devices/{token}/commands`).

**Response path (device → dashboard, optional):**
4. Device receives the RPC command, executes the action, and publishes an RPC response via MQTT (`devices/{token}/rpc/response/{requestId}`).
5. Backend consumes the MQTT RPC/ack topic and emits `device_rpc_response` to browser clients via Socket.IO.
6. Frontend RPC Widget receives the response (matched by `requestId`), displays it inline, and logs it to the execution history.

**Design intent:** RPC is stateless and non-persistent. There is no attribute written, no power-cycle restoration, and no confirmation loop. The action either succeeds (with optional response) or times out. The RPC Widget supports configurable timeout, retry, and confirmation dialogs for safety-critical actions.

---

### Commands and ACK/RPC (transport layer)

- Backend attempts to send commands to connected devices via raw device WS; falls back to MQTT publish (`devices/{token}/commands`).
- Backend consumes MQTT RPC/ack response topics and re-emits to browser clients via Socket.IO (`device_rpc_response`).
- SDK implements RPC request handling and publishes RPC responses; topic alignment must be verified across SDK and backend (`sdk/TRANSPORT_ARCHITECTURE.md`).

## Deployment and release (confirmed)

Source code lives in **separate Git repositories** (typical remotes):

- Backend: `https://github.com/autoconnecto/autoconnecto-backend.git`
- Frontend: `https://github.com/autoconnecto/autoconnecto-frontend.git`

Operational values below are confirmed for the current production layout; substitute your own buckets or IDs if the account changes.

### Current production release (confirmed)

| Component | Tag | Deployed (UTC) | Verification |
|---|---|---|---|
| Backend (`api.autoconnecto.in`) | `v1.7.15` | 2026-10-07 | EC2: `bash scripts/ec2-release-deploy.sh v1.7.15 --sync-docs`. Docs sync abort no longer fails release. |
| Frontend (`app.autoconnecto.in`) | `v1.7.14` | 2026-10-07 | CI deploy from `main` on push (`9bb17de`). Gateways onboarding + Active UX. |
| Docs (`docs.autoconnecto.in`) | `v1.7.9`+ | 2026-10-07 | Public site + fleet checklists for Modbus fleets (`5c7cee9`); in-app nav via S3 `backend-generated/`. |
| Website (`www.autoconnecto.in`) | `v1.7.0` | 2026-10-06 | Unchanged this cut. |
| SDK (`autoconnecto-sdk`) | `v1.6.2` | 2026-10-07 | Tag `v1.6.2` — gateway-relay webhook samples + Integrations Hub README. |
| Mobile (Android APK) | `v1.6.3` | 2026-10-07 | Unchanged this cut (Show demos preference). |

**What v1.7.16 ships (delta vs v1.7.15):**

- Plan telemetry enforcement on the live path: bulk writer + BullMQ pre-enqueue soft-ignore for subscription, `min_telemetry_interval_sec`, and minute/day caps (production uses `TELEMETRY_BULK_MODE` + queue).

**What v1.7.15 ships (delta vs v1.7.14):**

- Backend deploy: `--sync-docs` warns (does not fail the release) when S3 staging is empty; live in-app docs stay intact.
- Workspace: wipe-safe EC2 docs pull wrapper; `inapp-docs.yml` refuses unsafe fallback; public docs `aws s3 sync` excludes `backend-generated/` + `manual-inapp/`.

**What v1.7.14 ships (delta vs v1.7.13):**

- Modbus fleets (Energy / Climate / Fuel / Water / Generator): Sample On = demo gateway + children; hub `gateway.heartbeat` pulse; setup guides match hub topology.
- Gateway **Active** = hub telemetry/heartbeat **or** any linked child Active; Gateways create/detail onboarding steps (hub → link → child → data).

**What v1.7.10–1.7.13 shipped (selected):**

- In-app Documentation restore; staged S3 docs sync (empty S3 cannot wipe live files).
- Device profiles uuid/text tenant cast; Devices list independent of profile fetch failures.
- EnergyFleet/ClimateFleet Sample On gateway topology (extended to five fleets in 1.7.14).

**What v1.7.9 ships (delta vs v1.7.8):**

- Integrations: in-app **Examples & recipes** (sample JSON, docs/SDK links, Create shortcuts); gateway relay + Modbus/DTU Solutions pointers.
- Docs/SDK: runnable ChirpStack/TTN/generic/gateway-relay scripts surfaced; CONNECTIVITY paths corrected.

**What v1.7.0 ships (delta vs v1.6.1):**

- Solution sandboxes + Sample On; analytics hub (forecast caps / fleet risk / saved views); optional StatsForecast worker; geofences; multi-fleet solution packs; map/route industry UX (cluster/stale/geofence/playback/trips).

**What v1.6.1 shipped (delta vs v1.6.0):**

- Admin `ENERGYFLEET_TRIAL` plan + day-15 docs; OTA safety + SOTA SDK path; public Telegram community; marketing/docs honesty pass.

**Versioning convention (confirmed in repos):**

- Tags follow `vMAJOR.MINOR.PATCH` and are created on `main` in each repo separately.
- Backend and frontend versions are advanced together when a release is cut, even when only one side has source changes (avoids drift between halves of a release).
- `git describe --tags --always --dirty` on each working tree is currently the authoritative answer to "what is deployed?" — see **Version visibility (gap)** below.

### Version visibility (gap — recommendation)

Neither `/health` nor `/healthz` returns a version field today (`backend/src/app.controller.ts`). Determining "what is running in production" requires shell access to the EC2 host (git tag on the working tree + `docker compose ps`).

Recommended (deferred from `v0.1.4` — did not ship in that release; tracked as a future release item):
1. Bake the git tag into the backend Docker image via a `--build-arg APP_VERSION` and expose it on `/health` as `{ status, service, version, commit, timestamp }`.
2. Frontend exposes the same value at build time via `VITE_APP_VERSION` and renders it in the footer / About dialog.

Until that lands, treat the table above as the authoritative record of what is deployed.

### Browser app (`app.autoconnecto.in`)

**Build:**

- Working directory: `frontend/`
- Production env: `frontend/.env.production` defines `VITE_API_BASE_URL`, `VITE_COGNITO_REDIRECT_URI`, etc.

```bash
cd frontend
npm ci
npm run build
```

**Artifact:** static files under `frontend/dist/`.

**S3 bucket (origin for the app):** `s3://app.autoconnecto.in/` (Region: `ap-south-1`).

**Publish (AWS CLI example):**

```bash
aws s3 sync frontend/dist s3://app.autoconnecto.in/ --delete --region ap-south-1
```

**CloudFront:** distribution ID **`E21R9QJBLA5QZB`** fronts the browser app.

After uploading new `dist` assets, **invalidate** the edge cache so users receive fresh `index.html` and hashed bundles:

```bash
aws cloudfront create-invalidation --distribution-id E21R9QJBLA5QZB --paths "/*"
```

`--region` is accepted by the CLI but invalidation is a global CloudFront operation; IAM must allow **`cloudfront:CreateInvalidation`** on that distribution. Confirmed empirically on the `autoconnecto-backend` IAM user (account `813417990382`): `cloudfront:CreateInvalidation` succeeds even though `cloudfront:GetDistribution` is denied. Do not assume access to `Get*`/`List*` actions when wiring CI.

**Verify after deploy (confirmed sequence):**

```bash
# 1. Built artifact matches what S3 origin now serves:
aws s3 cp s3://app.autoconnecto.in/index.html - --region ap-south-1

# 2. CloudFront edge serves the same bundles (look for X-Cache: Miss right after invalidation):
curl -sSI https://app.autoconnecto.in/
curl -sS  https://app.autoconnecto.in/ | grep -E 'index-[A-Za-z0-9_-]+\.(js|css)'
```

`Last-Modified` on the CloudFront response should match the S3 upload time within seconds. `X-Cache: Miss from cloudfront` confirms the invalidation forced an origin pull; subsequent requests will flip to `Hit from cloudfront` once the new object is cached at the POP.

**Rollback (frontend):** redeploy a previous `dist` (from git tag or CI artifact), sync to S3 again, invalidate `/*`.

### Backend API (`api.autoconnecto.in`)

**Host:** EC2 instance (Ubuntu) running the backend in **Docker Compose**. Compose project root: `~/autoconnecto/backend/` on the host. Services include `backend`, `timescaledb` (Postgres + Timescale), `redis`, `autoconnecto-emqx` (MQTT broker).

**Confirmed release flow:** see **[`deployment.md`](deployment.md)** (single source of truth for backend, frontend, website, docs, SDK, and mobile).

```bash
# On EC2 host (ubuntu@<instance>):
cd ~/autoconnecto/backend
bash scripts/ec2-release-deploy.sh vX.Y.Z
```

`--no-deps backend` is intentional: it rebuilds and recreates only the `backend` container, leaving `timescaledb` / `redis` / `autoconnecto-emqx` untouched.

**Verify after deploy:**

```bash
git -C ~/autoconnecto/backend describe --tags --always --dirty
docker compose ps backend
curl -sS https://api.autoconnecto.in/healthz
curl -sS https://api.autoconnecto.in/health
```

> Caveat: if a release contains **no source changes that affect the image**, compose may not recreate the container. Use `git describe` on the host, not container `.Created` time — see **Version visibility (gap)** above.

**Migrations:** applied by the one-shot **`migrate`** compose service (`npm run migrate` → `scripts/run-migrations.mjs`) before `backend` starts (`depends_on: migrate: service_completed_successfully`). Failed migrate blocks backend startup.

**Configuration:** production secrets and env live **on the server** in `~/autoconnecto/backend/.env.production` (loaded by compose via `env_file`; not committed). See `backend/ENVIRONMENT.md` for the full variable list, including **self-serve signup OTP** (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `SIGNUP_OTP_HMAC_SECRET`), Cognito pool config, and AWS region.

**IAM:** the runtime identity (EC2 instance role) must include Cognito **admin** actions required by `CognitoSignupAdminService` (scoped to the user pool ARN). Confirmed working on the current EC2 instance role (verified through v1.6.0). See `backend/ENVIRONMENT.md` for the policy shape.

**Rollback (backend):** `git checkout` the previous known-good tag on the host, then `docker compose up -d --build --no-deps backend`. Run forward migrations only if the prior tag actually had unmigrated changes; otherwise prefer pure code rollback that matches the DB schema already in place.

### Documentation site (separate pipeline)

Marketing/docs delivery uses other artifacts (VitePress under `docs/`, scripts under `backend/scripts/publish-docs.mjs`, bucket `autoconnecto-docs-site`, CloudFront **`E30AD6N6537JGX`** for the docs hostname). That path is **not** the same as the browser app bucket above.

**EC2 delivery:** CI uploads generated markdown to S3; the EC2 pull script syncs into **`~/autoconnecto/backend/docs/generated/`** (output is **`.gitignored`**). **`docker-compose.yml`** uses **`./docs:/app/docs`** so the API serves **`/app/docs/generated`**. Detail: **`backend/ENVIRONMENT.md`** (Documentation pipeline section).

---

## Confirmed deployment assumptions (implicit in code)

- Backend expects:
  - Postgres reachable via env config
  - Redis reachable via env config (presence; and queue if enabled)
  - MQTT broker reachable (default `mqtt://emqx:1883` if `MQTT_BROKER_URL` not set)
- Frontend expects:
  - REST API reachable at `/api` (proxied in dev) and websocket base URL `VITE_WS_BASE_URL`
- Website is static-export oriented (suitable for S3/Netlify static hosting)

## Strategic decisions pending

### MQTT broker (EMQX) — license posture and version policy

**Current state (confirmed):** the production broker is pinned to `emqx/emqx:6.0.0` in `backend/docker-compose.yml`. Single-node deployment on the EC2 host. No clustering.

**Licensing context (verified against EMQ's own documentation as of 2026-05):**

- EMQX **5.8.x and earlier** ship under **Apache License 2.0** — fully open source, no commercial-use restrictions, no clustering restrictions.
- EMQX **5.9 onward (including 6.0.x)** switched to the **Business Source License 1.1 (BSL)** with an "Additional Use Grant" carve-out. Each released minor version automatically reverts to Apache 2.0 four years after its publication date.

**What BSL 1.1 actually allows for free (Additional Use Grant):**

- Single-node production deployment of any size — ✅ this is our current configuration.
- Education / non-profit production deployments without node limits.

**What BSL 1.1 restricts (requires a commercial license from EMQ):**

- Clustering multiple nodes — not on our roadmap today, but limits future horizontal scaling on the broker tier.
- "Offering the software as-a-service to third parties" — this is the clause that genuinely applies to Autoconnecto. The platform's tenants connect their devices to the broker we operate; whether that constitutes "offering EMQX-as-a-service" vs. "operating EMQX as one internal component of a larger SaaS product" is a legal question, not a technical one.

**Three options, ordered by cost/risk to Autoconnecto:**

| Option | Cost | What it costs you | What you keep |
|---|---|---|---|
| **A. Stay on `6.0.0` Community (today)** | $0 cash | Legal ambiguity on the SaaS clause; no clustering path; depends on EMQ not enforcing the SaaS restriction against single-node small-scale deployments. | All EMQX 6.0 features; no migration work; no downtime. |
| **B. Roll back to EMQX 5.8.x (Apache 2.0)** | $0 cash + one scheduled maintenance window | Loss of EMQX 6.0 features (operator dashboard refresh, MQTT 5 enhancements, gateway updates). Need to verify mnesia state / named volume compatibility — likely needs starting fresh, which means re-creating any dashboard config (we don't use the dashboard for config, so impact is small). Eventually 5.x reaches end-of-maintenance. | Apache 2.0 freedom — no commercial restrictions of any kind, clustering remains free if we ever need it. |
| **C. Buy EMQX Enterprise** | $$ annual | Commercial subscription with EMQ; license model becomes per-node / per-connection. Vendor lock to EMQ commercial terms. | Full clustering, full SaaS rights, vendor support, all 6.x+ features. |

**Recommended path (assistant's read, not a decision):** **B** — roll back to EMQX 5.8.x at the next maintenance window. Our deployment is single-node and not using any 6.0-only feature today. Apache 2.0 eliminates the SaaS ambiguity entirely with zero recurring cost. We re-evaluate **C** only when clustering or 6.x-specific features become real product requirements.

**Operator call required:** pick A / B / C and record the decision date in this section. Until then we are on A by default, with the SaaS clause as an open legal risk.

**Tracked as:** workspace todo `p8`.

## Engineering risks (confirmed)

- Backend startup ordering and environment loading can be nondeterministic (multiple modules read `process.env` directly; some env reads occur during dynamic module registration).
- Realtime coupling: some MQTT consumers and the device WS gateway can attempt to emit to Socket.IO server early in startup.
- Frontend contains multiple Socket.IO client creation patterns (risk of duplicate connections/subscriptions).
- SDK uses a global singleton pointer for MQTT event dispatch (single-instance assumption).

## Current Status

**Production release (as of 2026-10-05):** platform **v1.6.1** is the current release line (CI for app/docs/website; EC2 backend via `ec2-release-deploy.sh v1.6.1`). See the production table above.

- Backend — deploy tag `v1.6.1` on EC2; ensure migration `0036` and `BILLING_LIFECYCLE_CRON_ENABLED=true` for EnergyFleet trial expiry.
- Frontend / docs / website — CI deploys from `main` for the v1.6.1 release line.
- Self-serve signup (Brevo OTP + Cognito Admin) and login flows continue to function.
- Public documentation site `docs.autoconnecto.in` and marketing site `www.autoconnecto.in` operational.
- Community Telegram: https://t.me/autoconnecto_community

**Earlier releases:** `v1.6.0` (2026-09-25) shipped Rule Engine polish, Telegram L1–L3, EnergyFleet free offer on the website. `v0.1.5` (2026-05-12) shipped solutions admin toggle / icon picker and Docker governance.

**Known gaps (tracked):**

- No runtime version reporting on `/health` — "what's deployed" is verified by SSH + git tag (or this table), not via HTTP. See **Version visibility (gap)** above; deferred through `v1.6.0`.
- Single Nest process on one EC2 host: cloud Modbus auto-poll stops if that process is down.
- First-login UX on tenants with zero dashboards/devices may transiently show splash errors (defer until reproduced).
- Several GitHub Actions workflows still on Node.js 20 (deprecation warning, not blocking).

## Next Priorities (recommended)

- Version-self-reporting on `/health` and in the frontend footer.
- Land one named EnergyFleet plant; keep commercial packaging (`ENERGYFLEET_TRIAL`) aligned with ops.
- Define a single authoritative transport contract (MQTT topics + Socket.IO events + payload shapes) and keep backend/frontend/sdk aligned.
- Explicit backend readiness phases; consolidate frontend realtime connection lifecycle.

