# Autoconnecto Roadmap (Engineering-focused)

This roadmap distinguishes confirmed current state from recommended next work.

## Current Status (confirmed)

- Backend:
  - NestJS API
  - Socket.IO realtime gateway (`/socket.io`)
  - Raw device WebSocket server on `DEVICE_WS_PORT`
  - Multiple MQTT clients for telemetry ingest, attribute flows, RPC/ack consumption, and command publishing
  - Postgres and Redis dependencies
- Frontend:
  - Vite + React + TypeScript UI
  - Dashboard widget system with registry + per-widget config components
  - Socket.IO consumption for realtime telemetry + attributes
- SDK:
  - Arduino/ESP32 MQTT-over-WSS transport
  - Telemetry publish, attributes, RPC callback + response publish
- Docs/Website:
  - VitePress docs site (`docs/`)
  - Next.js static-export marketing site (`website/`)

## Known Risks (confirmed)

- Backend startup nondeterminism due to direct env reads and early env-dependent module registration.
- Realtime coupling between startup of Socket.IO and early MQTT/device WS events.
- Frontend realtime socket duplication risk (more than one socket creation path).
- SDK vs backend topic mismatch risk for RPC responses (must be verified and aligned).

## Next Priorities (recommended)

1. Deterministic backend startup
   - Introduce readiness phases and defer consumer start until dependencies are ready.
2. Transport contract consolidation
   - One authoritative document for MQTT topics + Socket.IO events + payload shapes.
3. Frontend realtime consolidation
   - Single socket instance and explicit subscription lifecycle per device/page.
4. Secret hygiene
   - Ensure no real secrets are committed in `.env` files; rotate any leaked keys.
5. Multi-instance strategy
   - Decide how device raw WS connection state and command routing should work across multiple backend instances.

