# Autoconnecto Workspace

This repository is a multi-project workspace for the Autoconnecto IoT platform.

## Confirmed repository layout

- `backend/`: NestJS backend API + realtime + MQTT services.
- `frontend/`: React + Vite admin/dashboard UI with a large widget library and realtime subscriptions.
- `sdk/`: Arduino/ESP32 C++ SDK implementing device telemetry/attributes/RPC over MQTT (WSS).
- `docs/`: VitePress documentation site.
- `website/`: Next.js 15 marketing site configured for static export.

## Confirmed system overview

Autoconnecto consists of:

- **Backend**: REST API plus realtime delivery to browsers via Socket.IO. Also hosts device-facing transports (MQTT clients and a raw WebSocket device server).
- **Frontend**: Operator/admin UI (devices, dashboards, telemetry, alarms, etc.) that consumes REST APIs and Socket.IO realtime events.
- **Device SDK**: Embedded library used by devices to publish telemetry and attributes and handle RPC.
- **Docs/Website**: Documentation site (`docs/`) and a separate marketing/landing site (`website/`).

## Key confirmed transport layers

- **Browser realtime**: Socket.IO from frontend to backend (path `/socket.io`).
- **Device ingest/egress**:
  - MQTT topics for telemetry, client attributes, shared attribute requests/responses, and command publishing.
  - A separate raw WebSocket server for device connections on `DEVICE_WS_PORT` (backend).

## Current Status

- Backend startup includes multiple side-effectful initializers (DB pool, Redis, MQTT clients, raw WS listener).
- Frontend dashboards are registry-driven; realtime telemetry and attribute updates are merged client-side.
- SDK implements MQTT-over-WSS and subscribes/publishes to device-scoped topics.

## Next Priorities

- Stabilize backend startup ordering and config loading (`backend/STARTUP_FLOW.md`, `backend/ENVIRONMENT.md`).
- Consolidate frontend realtime socket creation to avoid duplicate connections/subscriptions.
- Align and document MQTT topic conventions between backend and SDK (notably RPC response topics).

