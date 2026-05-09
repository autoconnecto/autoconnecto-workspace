# Autoconnecto (Cursor Project Overview)

This file provides Cursor-native, persistent context for AI-assisted development in this workspace.

## Workspace projects (confirmed)

- `backend/`: NestJS backend (HTTP API + Socket.IO realtime + raw device WS + MQTT clients + Postgres + Redis).
- `frontend/`: Vite/React dashboard/admin UI (widget registry + realtime consumption via Socket.IO).
- `sdk/`: Arduino/ESP32 SDK (C++) implementing MQTT-over-WSS telemetry/attributes/RPC.
- `docs/`: VitePress docs site.
- `website/`: Next.js 15 App Router marketing site, static export.

## Autoconnecto runtime architecture (confirmed)

### Backend transport layers

- **HTTP API**: NestJS app in `backend/src/main.ts`.
- **Browser realtime**: Socket.IO gateway with `path: "/socket.io"` (frontend must match).
- **Device raw WS**: separate `ws` server listening on `DEVICE_WS_PORT`.
- **MQTT**: multiple MQTT clients for:
  - telemetry ingest (`devices/+/telemetry`)
  - rpc/ack consume (`devices/+/rpc/response/+`)
  - client attributes consume (`devices/+/attributes/client`)
  - shared attribute request/response (`devices/+/attributes/shared/request` → `devices/{token}/attributes/shared/response`)
  - command publish fallback (`devices/{token}/commands`)

### Storage dependencies

- Postgres via `pg` pool (`backend/src/common/database.service.ts`)
- Redis via `ioredis` (presence; BullMQ queue when enabled)

### Frontend realtime patterns (confirmed)

- Socket.IO client uses `VITE_WS_BASE_URL` and should use `path: "/socket.io"`.
- Telemetry is normalized and distributed via `frontend/src/realtime/telemetry.store.ts`.
- Attribute updates are merged in `frontend/src/features/dashboards/context/DashboardContext.tsx`.

### SDK transport (confirmed)

- MQTT-over-WSS transport under `sdk/src/transport/MQTTTransport.*`.
- Subscribes to device-scoped shared attrs and RPC request topics.
- Uses a global singleton pointer for MQTT callback routing (single-instance constraint).

## Engineering focus areas (confirmed risks)

- Backend startup ordering is sensitive (multiple side-effectful initializers; env reads can occur early).
- Contract drift risk across backend ↔ frontend ↔ sdk (topics/events/payloads).
- Frontend socket ownership must be controlled to avoid duplicate listeners/subscriptions.

## Governance entrypoints

- Workspace governance: `.cursor/rules/ai-governance.mdc`
- Backend rules: `.cursor/rules/backend.mdc`
- Frontend rules: `.cursor/rules/frontend.mdc`
- SDK rules: `.cursor/rules/sdk.mdc`

