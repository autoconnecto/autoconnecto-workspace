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

## Confirmed deployment assumptions (implicit in code)

- Backend expects:
  - Postgres reachable via env config
  - Redis reachable via env config (presence; and queue if enabled)
  - MQTT broker reachable (default `mqtt://emqx:1883` if `MQTT_BROKER_URL` not set)
- Frontend expects:
  - REST API reachable at `/api` (proxied in dev) and websocket base URL `VITE_WS_BASE_URL`
- Website is static-export oriented (suitable for S3/Netlify static hosting)

## Engineering risks (confirmed)

- Backend startup ordering and environment loading can be nondeterministic (multiple modules read `process.env` directly; some env reads occur during dynamic module registration).
- Realtime coupling: some MQTT consumers and the device WS gateway can attempt to emit to Socket.IO server early in startup.
- Frontend contains multiple Socket.IO client creation patterns (risk of duplicate connections/subscriptions).
- SDK uses a global singleton pointer for MQTT event dispatch (single-instance assumption).

## Current Status

- Core platform functionality exists across backend/frontend/sdk, with realtime dashboards and MQTT ingest flows.
- Documentation exists in `docs/` but platform continuity docs at the repo root were missing until now.

## Next Priorities (recommended)

- Define a single authoritative transport contract (MQTT topics + Socket.IO events + payload shapes) and keep backend/frontend/sdk aligned.
- Introduce explicit backend readiness phases so realtime/mqtt consumers do not run before dependencies are ready.
- Consolidate frontend realtime connection lifecycle.

