# Autoconnecto Architecture (System-level)

This document reflects the architecture confirmed from the current codebase. Any future/planned items are explicitly marked as recommendations.

## Components

### Backend (`backend/`) — confirmed

- NestJS application (`src/main.ts`, `src/app.module.ts`)
- REST endpoints via controllers
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
| Backend (`api.autoconnecto.in`) | `v0.1.4` | 2026-05-12 ~14:50 UTC | `git -C ~/autoconnecto/backend describe --tags --always --dirty` → `v0.1.4`; `docker compose ps backend` reports `healthy`; `curl -sS http://127.0.0.1:3000/healthz` returns `{status:"ok", postgres:"ok", redis:"ok", ...}` |
| Frontend (`app.autoconnecto.in`) | `v0.1.4` | 2026-05-12 ~14:55 UTC | `curl -sS https://app.autoconnecto.in/` references hashed bundle `index-B5RsLEGi.js` (CSS hash `index-CqJNeAJo.css` unchanged from v0.1.3 — no style changes shipped); CloudFront invalidation `I6IUNTL51XASM8XK5IRHQ9O6UC` |
| SDK (`autoconnecto-sdk`) | `v0.1.4` | 2026-05-12 ~14:30 UTC | `git -C ~/autoconnecto/sdk describe --tags --always --dirty` → `v0.1.4`. SDK has no server-side deploy; in-field devices keep running whatever firmware they were last flashed with. Existing fleet remains on the v0.1.3 single-root (ISRG Root X1) trust bundle; reflash to v0.1.4 to pick up the X1 + X2 multi-CA bundle. |

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

**Confirmed release flow (used for v0.1.3 and v0.1.4, 2026-05-12):**

```bash
# On EC2 host (ubuntu@<instance>):
cd ~/autoconnecto/backend
git fetch --tags origin
git checkout v0.1.4                       # or: git pull origin main
docker compose up -d --build --no-deps backend
```

`--no-deps backend` is intentional: it rebuilds and recreates only the `backend` container, leaving `timescaledb` / `redis` / `autoconnecto-emqx` untouched so dependencies don't restart on every release.

**Verify after deploy (confirmed sequence):**

```bash
# 1. Source tree is on the tag you intended:
git -C ~/autoconnecto/backend describe --tags --always --dirty

# 2. Container is up and healthy:
docker compose ps backend

# 3. API responds. Note: the liveness endpoints are registered at the
#    application root (no `/api` prefix). `/health` is the cheap
#    "is the process alive?" check; `/healthz` is the deep check
#    that pings Postgres + Redis and is what compose's healthcheck
#    uses internally. Run either of these from your workstation:
curl -sS https://api.autoconnecto.in/healthz
curl -sS https://api.autoconnecto.in/health
```

> Caveat: if a release contains **no source changes that affect the image** (e.g. only `docs/`, `.github/`, or other build-context-excluded paths), `docker compose up --build` will rebuild but the resulting image digest can equal the previous one, in which case compose does **not** recreate the container. The container will keep running the prior image (which is functionally identical). This is why "container `.Created` timestamp" alone is not a reliable "what version is running?" signal — see **Version visibility (gap)** above.

**Migrations:** SQL migrations under `backend/migrations/*.sql` are applied automatically on backend container startup (see `backend/src/common/migration.runner.ts`). A failed migration aborts startup; the container exits non-zero and is restarted by compose's restart policy until the migration succeeds.

**Configuration:** production secrets and env live **on the server** in `~/autoconnecto/backend/.env.production` (loaded by compose via `env_file`; not committed). See `backend/ENVIRONMENT.md` for the full variable list, including **self-serve signup OTP** (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `SIGNUP_OTP_HMAC_SECRET`), Cognito pool config, and AWS region.

**IAM:** the runtime identity (EC2 instance role) must include Cognito **admin** actions required by `CognitoSignupAdminService` (scoped to the user pool ARN). Confirmed working on the current EC2 instance role as of v0.1.4. See `backend/ENVIRONMENT.md` for the policy shape.

**Rollback (backend):** `git checkout` the previous known-good tag on the host, then `docker compose up -d --build --no-deps backend`. Run forward migrations only if the prior tag actually had unmigrated changes; otherwise prefer pure code rollback that matches the DB schema already in place.

### Documentation site (separate pipeline)

Marketing/docs delivery uses other artifacts (VitePress under `docs/`, scripts under `backend/scripts/publish-docs.mjs`, bucket `autoconnecto-docs-site`, CloudFront **`E30AD6N6537JGX`** for the docs hostname). That path is **not** the same as the browser app bucket above.

**EC2 hygiene:** Generated behaviour markdown consumed by **`DocumentationService`** must **not** be written into **`~/autoconnecto/backend/docs/generated`** on the EC2 host by CI (that overlaps the Git checkout). CI uploads to S3 → SSH syncs **`/home/ubuntu/autoconnecto/artifacts/backend-generated/`** → bind-mount that path into **`backend`'s container** at **`.../docs/generated`**. Detail: **`backend/ENVIRONMENT.md`** (Documentation pipeline section).

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

**Production release (as of 2026-05-12):** all three halves of `v0.1.4` (backend, frontend, SDK) are live and verified.

- Backend `api.autoconnecto.in` — container rebuilt from tag `v0.1.4`, reported `healthy`, no new SQL migrations in this release (schema unchanged from v0.1.3).
- Frontend `app.autoconnecto.in` — built from tag `v0.1.4`, synced to `s3://app.autoconnecto.in/`, CloudFront `E21R9QJBLA5QZB` invalidation `I6IUNTL51XASM8XK5IRHQ9O6UC` issued and edge confirmed serving fresh bundles.
- SDK `autoconnecto-sdk` — tagged `v0.1.4`. SDK has no continuous deploy; in-field devices keep running whatever firmware they were last flashed with. Reflash to `v0.1.4` example sketches to pick up the X1 + X2 multi-CA trust bundle (otherwise existing devices keep working on the X1-only bundle they were flashed with).
- Self-serve signup (Brevo OTP + Cognito Admin) and login flows continue to function end-to-end in production.
- In-app documentation pipeline (Swagger + developer + user docs) operational; runs nightly at 02:30 UTC and on demand via `repository_dispatch` from backend/frontend pushes.
- Public documentation site `docs.autoconnecto.in` operational with CloudFront SPA-rewrite function deployed via CI (`infra/cloudfront/deploy-spa-rewrite.sh`).

**What v0.1.4 actually shipped** (delta against v0.1.3):

- **Backend** — two commits under the same tag:
  - `fix(infra)`: certbot deploy-hook now writes `privkey.pem` at mode `0644` (was `0640`) so the in-container `emqx` user (uid 1000) can read it after every auto-renewal. Without this, the silent failure mode was: renewal succeeds, hook copies the new file, `emqx ctl listeners restart` fails to bind, broker keeps serving the cached cert until restart. See `backend/ops/letsencrypt/README.md` for full rationale.
  - `feat(solutions)`: new `PATCH /api/solutions/:id` endpoint accepting `{ title?, description? }`. Allow-listed against `PLATFORM_ADMIN_EMAILS` using the same inline check as the existing `POST`/`DELETE`. No schema migration.
- **Frontend** — single commit: Solutions page now exposes an `Edit` button on each card (gated on `canPublishSolutions()` like Delete already is); admin actions row was restructured from a single `flex-wrap` row to a deterministic two-row vertical container so the per-card action layout is no longer viewport-width-dependent.
- **SDK** — single commit: `AUTOCONNECTO_ROOT_CA` raw-string literal in all four example sketches (`AllFunctionTest`, `BasicTelemetry`, `RPCCommands`, `SwitchControl`) now contains BOTH `ISRG Root X1` (RSA, → 2035) and `ISRG Root X2` (ECDSA, → 2040). `mbedtls` validates if the broker chain terminates at any root in the bundle. No transport-layer code change required.

**Known gaps (tracked):**

- No runtime version reporting on `/health` — "what's deployed" is verified by SSH + git tag, not via HTTP. See **Version visibility (gap)** above; was scoped for `v0.1.4` but did not ship in that release. Carried forward as a future release item.
- First-login UX on tenants with zero dashboards/devices may transiently show "failed to load resources" splash errors (observation pending field reports — defer until reproduced).
- Several GitHub Actions workflows still on Node.js 20 (deprecation warning, not blocking).

## Next Priorities (recommended)

- Version-self-reporting on `/health` and in the frontend footer (deferred from `v0.1.4`; carried into the next release).
- Define a single authoritative transport contract (MQTT topics + Socket.IO events + payload shapes) and keep backend/frontend/sdk aligned.
- Introduce explicit backend readiness phases so realtime/mqtt consumers do not run before dependencies are ready.
- Consolidate frontend realtime connection lifecycle.

