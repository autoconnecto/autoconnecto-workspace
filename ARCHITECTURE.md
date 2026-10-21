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
  - Production backup/restore: `backend/docs/BACKUP_RESTORE.md` (code rollback ≠ DB restore). Daily `pg_dump` cron on EC2 → `~/backups/` (14-day retain); off-box copy still recommended.

### Frontend (`frontend/`) — confirmed

- React + Vite + TypeScript
- Dashboard/widget system with registry and per-widget configuration UI
- Realtime consumption via Socket.IO client; telemetry is normalized and streamed to listeners; attributes are merged into an in-memory store

### Device SDK (`sdk/`) — confirmed

- Arduino/ESP32 SDK (C++)
- `AutoconnectoSDK` orchestrates WiFi + `ConnectionManager`
- `ConnectionManager` owns `MQTTTransport`
- `MQTTTransport` builds broker URI as WSS (`wss://{host}:{wssPort}/mqtt`). The SDK default `wssPort` is 8084. It subscribes to shared attrs + RPC request topics. A top-level numeric `ts` on a telemetry publish is the reading time and is not stored as a key.

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

**Platform differentiator:** This attribute feedback loop solves a common IoT operator pain: after reboot, dashboards often show stale control state until someone re-issues a command. In Autoconnecto, the device self-heals on every boot — it reads its own retained shared attributes, restores hardware state, and pushes confirmed client attributes back — making the dashboard resync automatically with zero user intervention. This is a core platform USP and must be preserved in all future control widget designs.

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
| Backend (`api.autoconnecto.in`) | `v1.7.63` | 2026-10-21 | Sample pack interval; JoinedPlantScada plant overview + alarms; SDK · Solutions seeded. |
| Frontend (`app.autoconnecto.in`) | `v1.7.63` | 2026-10-21 | Solutions one searchable list; Sample stays on plant overview. |
| Docs (`docs.autoconnecto.in`) | `v1.7.63` | 2026-10-21 | JoinedPlantScada + SDK Solutions titles; device-sdk → Solutions. |
| Website (`www.autoconnecto.in`) | `v1.7.63` | 2026-10-21 | Version bump. |
| SDK (`autoconnecto-sdk`) | `v1.7.63` | 2026-10-21 | Docs point to Solutions for example dashboards. |
| Mobile (Android APK) | `v1.7.63` | 2026-10-21 | Tag v1.7.63. versionCode 24. |

**What v1.7.63 ships (delta vs v1.7.62):**

- Solutions: one catalog list + search (no Show inactive); Sample On stays on overview; Sample uses pack interval (not plan min). JoinedPlantScada plant overview (SCADA hero, KPIs, working alarms). SDK example Solutions titled `SDK · …` and seeded in production. SDK/docs tell integrators to find matching dashboards under Solutions.

**What v1.7.59 ships (delta vs v1.7.58):**

- Analytics audit: stored keys on bulk/batch ingest; fleet risk counts every sample; Ask next-period total; predictive worker wiring; IST day buckets. Documentation **Ask the guide** via local Qwen2.5-0.5B; Analytics Ask routes how-to to the same engine.

**What v1.7.58 ships (delta vs v1.7.57):**

- Device-path truth: RPC command log on the route the dashboard uses; MQTT shared attributes not gated only on profile transport list; OTA downloads finish chunk-by-chunk; examples respond to Switch (attr + RPC); Phase 7 widget Solutions + SDK-named Solutions; board-verify hard gate so external device-path findings stay exceptional.

**What v1.7.57 ships (delta vs v1.7.56):**

- Audit repairs: disable unauthenticated public create-tenant; command-log truth; SDK examples vs Free plan interval; OTA example order; backup runbook; swagger version; website on-prem claim removal; app edge security headers via CloudFront Function; TLS renewals and EC2 disk reclaim were live ops under the same audit wave.

**What v1.7.56 ships (delta vs v1.7.55):**

- Dashboard controls choose Shared attribute or RPC. Sent / Failed / Confirmed toasts. Indicators can read telemetry or an attribute. Scoped attribute store. Compact control/indicator tile sizes. Command-and-control customer guide. Backend swagger export gate and API hardenings from the audit wave.

**What v1.7.55 ships (delta vs v1.7.54):**

- `GET /api/devices/{id}/attributes?scope=` returns only that scope. A Modbus slave ID must be an integer from 1 to 247, from the platform or from the device. The gateway host is the address only. Asset and device-profile names stop at 200 characters. The app sidebar is v1.7.55. Website, SDK, and mobile are unchanged.

**What v1.7.54 ships (delta vs v1.7.53):**

- A flat numeric `ts` on MQTT telemetry is the reading time and is not stored as a key. The API nginx body limit is 100 MB. The guide states port 8084 and that checkout is in the app. The website drops the public CoAP claim, points Get Started at signup, and fixes the docs links. The SDK compiles ESP8266 and Pico W and does not repeat a firmware download.

After that tag, the Android app was rebuilt as v1.6.6 from the last build before solution demos. The website, the public docs, the in-app guide, and the signed-in app all download that APK.

**What v1.7.53 ships (delta vs v1.7.52):**

- A name or a key longer than 200 characters is refused. A blank name says "Name is required". A threshold that is not a finite number, or whose absolute value is over 1e12, is refused. The demo switch says Show solution demos. Shift board, Energy desk, and Service and lamp are sample solutions. Six rule-engine examples ship as drafts. Cancelling firmware is recorded as Cancelled. Website, SDK, and mobile are unchanged.

**What v1.7.52 ships (delta vs v1.7.50):**

- Gateway setup, the Modbus map, a child slave ID, and a typed LoRa DevEUI are stored as server attributes. A gateway can be deleted from the list and from its page after its child devices are gone. A slave ID, a port, a BACnet address, and an OPC UA endpoint that are not valid are refused. Device delete names the device. Editing an attribute changes the value and leaves the scope and the key. A profile or asset name made only of spaces is refused. The alarm row opens the dashboard. The device alarm tab counts the rows it shows. The scheduler refuses a timezone that is not a real zone. A deleted firmware package and a deleted user leave the list.
- Ten rule-engine checks are on the canvas. The operator widgets are on the dashboard, including asset calculated fields. A profile can store keys, and a site can total them. The app and the guide are v1.7.52. Website, SDK, and mobile are unchanged.

**What v1.7.50 ships (delta vs v1.7.48):**

- Assigning firmware after a cancel queues a new update. Both signed-in routes refuse a client attribute write. A missing dashboard is not found. A delete keeps the name in the audit log. Readings are JSON. MQTT connect is allowed when the username is the current device token. This server's own clients use a separate username. The connect check answers HTTP 200. The app is v1.7.49. Website and mobile are unchanged.

**What v1.7.48 ships (delta vs v1.7.47):**

- Average, minimum, maximum, and sum read the stored telemetry table. A queued batch item counts as accepted. The alarm list filters by severity. A person can read a client attribute and cannot change it. An asset stores server attributes only. The device token is masked and can be rotated. An OTA package that has not finished can be cancelled. A draft schedule has no next run. Home counts devices and gateways separately. The command log is stored. Website, SDK, and mobile are unchanged.

**What v1.7.47 ships (delta vs v1.7.44):**

- Accept takes a database connection sixteen at a time. A reading that finds the pool busy waits and is stored. A reading that is not stored is counted: too soon, plan cap, rule drop, hold, queue shed, empty payload, or a failed write. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.44 ships (delta vs v1.7.43):**

- MQTT ingest uses eight subscribers in one shared group. A device still publishes `devices/{token}/telemetry`. The broker session queue and the connection mailbox are 100,000. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.43 ships (delta vs v1.7.42):**

- The database writes run on three separate threads. A device stays on one thread. The device is still answered when the reading is on the queue. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.42 ships (delta vs v1.7.41):**

- The device is answered when the reading is on the queue. HTTP, MQTT, CoAP, AMQP, and the device socket use that same queue. A bad token, a too-soon reading, and a plan cap are refused before the answer. The writers store the reading after the answer, and the next batch does not wait for alarms or the activity update. A rule-engine drop is not stored. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.41 ships (delta vs v1.7.40):**

- Telemetry is queued in memory and drained by three writers. A device stays on one writer. A writer flushes on 10,000 readings or 100 milliseconds and commits history, the latest value, and device runtime together. Alarm rules for a profile stay in memory for a minute. One activity update covers the batch. The queue warns when it is longer than one batch and drops only past 100,000 waiting readings. An HTTP post still answers after the row is stored. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.40 ships (delta vs v1.7.39):**

- The minute and day telemetry caps are kept in memory and corrected from the table once a minute. A device with no rule engine and no alarm rules does not look those up on every reading. Saving a profile or a rule engine clears that memory. The caps, the interval, a rule-engine drop, and the latest-value rule stay. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.39 ships (delta vs v1.7.38):**

- The hosted server writes a short window of device readings in one database transaction, then sends one live update per device. An older reading is still stored and does not replace the latest value. A rule-engine drop is still not stored. The plan interval and the minute and day caps still apply. Frontend, docs, website, SDK, and mobile are unchanged.

**What v1.7.38 ships (delta vs v1.7.37):**

- A dashboard copied from a solution can save its time range. A blank rule engine opens with Message in only, and one output can feed more than one node. The alarm list shows when an alarm cleared. A new tenant already has the Default profile. A command can stay locked until a reading matches. Metric Explorer shows the device name. OPC UA, BACnet, and Sparkplug cannot be switched on with an empty address. Platform Admin stays on the stored mail ids.

**What v1.7.37 ships (delta vs v1.7.36):**

- Firmware and software packages are stored on the server disk at `/var/lib/autoconnecto/ota`. A release checkout does not delete that folder. The hosted box and a single-server install use the same path. S3 is optional.

**What v1.7.36 ships (delta vs v1.7.35):**

- The latest value of a key is the reading with the newest time. An older row that arrives later stays in history. The plan interval is the gap between reading times, so a device can upload buffered rows. A 60-second scheduled job is counted from the time it was due. The checker still runs every 15 seconds.

**What v1.7.35 ships (delta vs v1.7.34):**

- Platform Admin delete writes the audit row with typed values, so Postgres accepts the delete. The tenant row and its data are removed after that.

**What v1.7.34 ships (delta vs v1.7.33):**

- The public site and the guide say what the platform does. Analytics answers from stored readings. The hosted app is the public service. An on-premises install is available, and one server installation is ready. Published plans run to Enterprise (500 devices). If more is needed, it can be scaled.

**What v1.7.33 ships (delta vs v1.7.32):**

- A profile alarm rule runs on the reading the device sent, including when a rule engine rewrites or drops that reading. The device is answered when the reading is on the queue. A too-soon reading and a plan cap are refused before that. A rule-engine drop is not stored. Solution Use shows the plan sentence. A latest-value card and a KPI stat card have no time window.

**What v1.7.32 ships (delta vs v1.7.31):**

- A reading the plan refuses is not a success. HTTP returns 429. CoAP returns 4.29. A batch counts only stored keys. The broker in Check connectivity is mqtt.autoconnecto.in port 8883. A generator interval cannot be shorter than the plan minimum. On Free that is 30 seconds.
- The screen says the plan limit when a second dashboard, a solution Use, or a second user is refused. Compare plans still lists the catalog when checkout is off. Upgrade stays disabled. Generic HTTP says it only receives. A gateway that does not answer stops loading. An analytics answer with no chart shows the sentence.

**What v1.7.31 ships (delta vs v1.7.30):**

- Eleven solution examples, one per protocol: HTTP, MQTT, WebSocket, CoAP, AMQP, LoRaWAN webhook, Gateway, Modbus, OPC UA, BACnet, and Sparkplug B. Sample sends a reading about every 5 seconds on that protocol. The chart stays empty until the packet arrives. Sample turns off 30 minutes after the preview is closed. CoAP listens on UDP 5683. AMQP stays idle until a broker URL is set.

**What v1.7.30 ships (delta vs v1.7.29):**

- Rule engines named Example are created for each account the first time the list opens. Each node appears in one of them. They stay drafts, they are not on a device profile, and they cannot be deleted, started, or saved over. Duplicate makes an editable copy. Preview does not send mail, create an alarm, or store a reading.

**What v1.7.29 ships (delta vs v1.7.28):**

- The customer guide is written. The public site and the in-app Documentation menu serve those pages. Swagger in the app stays the API reference. The generate endpoints no longer rebuild the guide.
- Rule engine: profile switch, alarm status, alarm count, history, delete attribute, split, continue as, MQTT publish, and command and wait. Run another engine executes on preview. A schedule can start an engine. The line joins the next node.
**What v1.7.28 ships (delta vs v1.7.26):**

- Rule engine nodes: shift clock, rate per minute, sequence, roll-up, and period total. Profile Duration is unchanged. Profile alarm rules still run when a chain also has an alarm node.
- Tenant email can be Gmail, Microsoft 365, or another mail server, in addition to the accounts already there. An empty account still does not send. Monday energy mail and quiet hours stay off.
- The server-install code is in the API. The public site does not set `AUTH_MODE`, so login stays on Cognito.

**What v1.7.26 ships (delta vs v1.7.25):**

- A device no longer has a target dashboard. The devices list opens the device page. A dashboard table, alarm row, asset row, device count, or navigation button opens another dashboard only when that widget names one. The form shows the dashboard name.
- A gateway can poll OPC UA or BACnet, or take Sparkplug B from the broker. OPC UA and BACnet run from the API host. Sparkplug matches group, edge node, and device id.
- Tenant Settings connects one email account and one SMS account. Email: Brevo, Resend, Postmark, SendGrid. SMS in India: MSG91, Fast2SMS, SMSLane. SMS elsewhere: Twilio, Plivo. Alarm mail, reports, Monday energy mail, and rule-engine mail use the email account. Alarm texts use the SMS account. An empty account does not send. Signup, password reset, email verification, and invites stay on the platform Brevo account. Telegram is unchanged.
- Monday energy mail and quiet hours stay off.

**What v1.7.25 ships (delta vs v1.7.24):**

- Audit log for one year. Home shows the latest lines to a tenant owner or tenant admin. Account → Audit log is the full search. Platform admin → Audit is every tenant. Device readings are not audit rows. A failed audit write does not undo the action.
- Tenant owner and tenant admin keep full access. Site users stay on the assets, devices, and dashboards they are given. Fleet tools stay with an admin or a user who has global device access.
- Rule engine: change since last, compare with previous, window, key gone quiet, geofence, and act on a related device. Saved graphs can be restored. Dedupe, throttle, and delay survive a restart. Profile alarm rules still run when the chain also has an alarm node. A blank engine is valid. Drag from a coloured output into the grey dot.
- The platform films were not rebuilt. Home is still the plant at a glance.

**What v1.7.24 ships (delta vs v1.7.23):**

- Analytics Ask answers a sentence for any fleet this tenant already has. Suggestion buttons are built from those device types and readings. The device type and reading dropdowns still drive Run.
- A learned watch stays off until someone asks. It opens a warning alarm when a reading leaves its normal band, and clears the alarm when the reading returns.
- Ask can say when a limit will be hit, what the next period totals, and can draw a vibration spectrum when a vibration reading exists.
- Platform Admin has a Presentations tab. The two films play in the page. The slideshows download.
- Public docs describe Ask, the watch, and how to say a device type and a reading.

**What v1.7.23 ships (delta vs v1.7.22):**

- Monday energy mail is off until an admin turns it on from Reports. On Monday at 8:00 am India time it mails last week's energy for the plant's meters to owners and admins.
- Android app v1.6.5 is the download on the app, the docs, and the website. The file name is `autoconnecto-mobile-v1.6.5.apk`. The installed app shows v1.6.5 on the sign-in screen and on Home. The phone home lists each energy meter with live power, voltage, current, and the open alarm.

**What v1.7.22 ships (delta vs v1.7.21):**

- Quiet hours are off until an admin turns them on. When on, the alarm still appears on the Alarms page. Mail, Telegram, and messages wait, then go out when the India-time window ends. The default window is 22:00–06:00.
- Public docs describe the Help Wizard setup order, Simple / Duration / Repeating alarm opens, the mail table, and quiet hours.

**What v1.7.21 ships (delta vs v1.7.20 frontend / v1.7.19 backend):**

- Help Wizard is the setup order and covers every left-menu item. A solution is the start, so the copied profile is edited rather than created again.
- Alarm rules open as Simple, Duration, or Repeating. Clear uses the same three choices.
- Alarm mail follows a tenant table. With no saved policy, Critical mail and messages go immediately, Major mail goes immediately, and Warning, Minor, and Clear wait for one combined mail. A flickering alarm stops call-outs after three returns in one minute. New users start with mail off.
- Operator screens use one day-first date, such as 08 Oct 2026, 07:20 pm. Analytics forecast choices appear after a ranking exists.
- Billing tells the customer when checkout is unavailable. The current plan stays.

**What v1.7.20 ships (delta vs v1.7.19):**

- Sidebar groups: Monitor, Build, Account. Header is the product name and one Account menu.
- Home status counts the customer’s own devices. Sample devices stay out of that summary.
- Dashboard view mode keeps state, time, and live status. Theme and structure controls appear in Edit. Widget cards keep one title.

**What v1.7.19 ships (delta vs v1.7.18):**

- Alarm rules: static number, or one device attribute as a dynamic limit (percent or offset per severity). Saving that attribute rechecks the latest value immediately. A missing attribute does not fire the rule.
- Solution sample devices echo a shared attribute write as a client attribute about one second later. Real devices are unchanged.
- Alarm list and details: shorter actions, Ack and Clear on the details page, severity colors aligned.
- Video panels play HLS and MJPEG. EnergyFleet trial countdown stays visible in the app.

**What v1.7.18 ships (delta vs v1.7.17):**

- Remove competitor-name references from website, app UI, public docs, SDK guides, and backend docs. Delete public competitor comparison page.
- Website: **80+ widgets**, add **ClimateFleet** solution.

**What v1.7.17 ships (delta vs v1.7.16):**

- Frontend dashboard widgets: `htmlPanel`, `videoPanel` (URL/HLS/embed), `dualColorLed`, `timeWindowControl`, `attributeForm`, `hierarchyTree`, `heatmap`, `floorPlanZones`, richer mimic symbols, table/LED/nav actions.
- Mobile routes the new widget types (`v1.6.4`).

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

**Host:** EC2 instance (Ubuntu) running the backend in **Docker Compose**. Compose project root: `~/autoconnecto/backend/` on the host. Services include `backend`, `timescaledb` (Postgres + Timescale), `redis`, `autoconnecto-emqx` (MQTT broker), optional `qwen-worker` / forecast sidecars.

**SCADA Boards:** Nest module `scada-boards` persists plant mimic documents (`scada_boards` table). FE builder at `/scada-boards`; dashboards embed via widget type `scadaBoard`. Fleet-tool ACL (same class as Rule Engines).

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

