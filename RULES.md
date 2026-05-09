---
title: Autoconnecto Engineering Rules
scope: workspace-wide
purpose: deterministic engineering governance for long-term AI-assisted development
---

# Autoconnecto Engineering Rules (Production-Grade)

This document is **engineering governance**, not product marketing. It exists to keep Autoconnecto maintainable across long-lived, multi-repo AI-assisted work.

Autoconnecto’s confirmed architecture patterns this rulebook is designed for:
- **Backend**: NestJS API + Socket.IO gateway (`/socket.io`) + separate raw device WebSocket server (`DEVICE_WS_PORT`) + multiple MQTT clients + Postgres + Redis.
- **Frontend**: Vite/React dashboards with a registry-driven widget system + realtime consumption via Socket.IO.
- **SDK**: Arduino/ESP32 C++ SDK using MQTT-over-WSS with a global singleton event dispatch constraint.
- **Docs**: VitePress docs site plus backend-generated artifacts.
- **Website**: Next.js static-export marketing site.

## 1) Deterministic engineering (default posture)

- **Prefer explicitness over convenience**: prefer typed interfaces, explicit ordering, explicit ownership, explicit lifecycle.
- **One obvious place** for each system concern:
  - one socket client ownership model (frontend)
  - one source of truth for transport contracts (topics/events/payloads)
  - one boot sequence definition (backend)
- **No “works on my machine” dependencies**: working directory, implicit env, timing-sensitive side effects, and undocumented runtime services are treated as bugs.

## 2) Terminology and contracts (non-negotiable)

### Canonical terms
- **Telemetry**: device-produced time-series key/value data.
- **Client attributes**: device → cloud attributes (`CLIENT` scope in backend storage semantics).
- **Shared attributes**: cloud → device attributes (`SHARED` scope).
- **Browser realtime**: Socket.IO events to browser clients.
- **Device transport**: MQTT and/or raw device WebSocket server.

### Contract governance
- **Transport contracts are versioned**. Any change to MQTT topics, WS message types, Socket.IO event names, or payload shapes requires:
  - a doc update (see §8)
  - a compatibility decision: **backward-compatible**, **dual-write/dual-read**, or **breaking with explicit version bump**
  - a rollback plan (see §10)

### Known fixed points (confirmed today)
- Socket.IO path is **`/socket.io`**.
- Room naming convention is **`device:{deviceId}`**.

## 3) Git discipline (rollback-first, reviewable change sets)

- **Small, atomic commits**: one intent per commit; no “misc fixes”.
- **Commit messages explain why**: include the failure mode or requirement, not just what changed.
- **No drive-by refactors** mixed into functional changes.
- **Always keep `main` releasable**:
  - avoid half-migrations
  - avoid “temporary” flags without explicit removal plan
- **No secret material in git**: `.env` files are treated as secret-bearing by default.
- **Reverts must be safe**:
  - avoid changes that require manual data repair to revert
  - if not possible, document why and provide a rollback playbook

## 4) Infrastructure discipline (explicit dependencies, explicit failure modes)

Autoconnecto runtime dependencies (confirmed in code):
- Postgres
- Redis
- MQTT broker

Rules:
- **Every dependency must have a health/readiness definition**: “what does it mean to be ready”.
- **Every networked client must have a failure mode**: retry, backoff, degrade, or fail-fast.
- **No implicit defaults in production**:
  - defaults like `mqtt://emqx:1883` are acceptable for local dev but must be explicit in production deployment configuration.

## 5) Backend startup stability rules (NestJS + realtime + MQTT)

This repo’s backend has multiple side-effectful startup paths (DB pool constructor, Redis constructor, `OnModuleInit` listeners, MQTT connects, raw WS server listen).

Rules:
- **No env reads at module registration time** for behavior toggles.
  - Example risk: dynamic module registration that checks `process.env.*` before env files are loaded.
- **No side-effectful constructors** for critical services unless they are intentionally part of boot.
  - Prefer explicit `onModuleInit` with visible ordering and error handling.
- **Boot sequence must be explicit and testable**:
  - config loaded
  - required env validated
  - storage reachable (or explicit degraded mode)
  - realtime ready
  - device transport consumers start (MQTT subscriptions, device WS)
- **Realtime emits must be safe during early boot**:
  - code emitting to Socket.IO must not assume server readiness unless enforced by lifecycle.
- **Ports are configuration, not folklore**:
  - document `PORT` (HTTP) vs `DEVICE_WS_PORT` (raw device WS) and prevent accidental collisions.

## 6) Websocket + MQTT ordering rules (cross-component discipline)

Rules:
- **No consumer should assume downstream availability**:
  - MQTT consumers must not assume DB/realtime readiness at message arrival time.
  - device raw WS gateway must not assume Socket.IO server exists.
- **At-least-once semantics are explicit**:
  - MQTT QoS and retained publish behavior must be documented per topic class.
- **Message processing must be idempotent** where feasible:
  - duplicate telemetry/attribute messages should not corrupt state.

## 7) Frontend anti-chaos rules (large widget codebases)

Confirmed patterns:
- widget registry is large and mostly manual
- realtime telemetry store exists
- dashboard context merges attributes via Socket.IO events
- more than one Socket.IO client creation pattern exists in code today

Rules:
- **Single socket client ownership**:
  - exactly one module/provider creates the Socket.IO client
  - all listeners are registered through a controlled API
  - subscribe/unsubscribe must be ref-counted or explicitly lifecycle-bound
- **Widget runtime is deterministic**:
  - widget config defaults must be stable
  - avoid implicit dependency on localStorage keys without a documented contract
- **No hidden cross-widget coupling**:
  - widgets read data via shared hooks/stores, not via ad-hoc global mutable state.

## 8) Documentation maintenance rules (persisted engineering truth)

Docs are not optional because the system spans backend/frontend/sdk.

Whenever you change a contract or lifecycle behavior, update:
- `ARCHITECTURE.md` (root)
- `backend/ARCHITECTURE.md`, `backend/STARTUP_FLOW.md`, `backend/ENVIRONMENT.md`
- `frontend/WIDGET_ARCHITECTURE.md`, `frontend/STATE_MANAGEMENT.md`
- `sdk/TRANSPORT_ARCHITECTURE.md`, `sdk/DEVICE_LIFECYCLE.md`
- `docs/README.md` if docs pipeline or sources change
- `website/*` docs if static export, env usage, or routing changes

Rules:
- **Docs must distinguish confirmed behavior vs recommendations**.
- **Docs must name source files** when describing non-obvious behavior.
- **Docs are updated in the same PR** as the behavior change.

## 9) AI workflow rules (multi-session, multi-agent safety)

- **AI must not invent systems**: if the codebase doesn’t show it, it’s “unconfirmed”.
- **Always anchor claims to code paths**: name the files/modules.
- **Prefer minimal diffs**:
  - small changes that preserve behavior
  - avoid widespread formatting churn
- **Make implicit contracts explicit**:
  - when AI discovers a contract mismatch (topics/events), document it and propose a deterministic resolution plan.
- **Do not silently change operational behavior**:
  - new retries, timeouts, topic names, ports, or env vars require explicit change notes + rollback.

## 10) Deployment safety rules (rollback-first engineering)

- **Rollback is the first-class path**:
  - every change that can affect runtime must be safely revertible or must include a rollback playbook.
- **Feature flags must be explicit and documented**:
  - define flag name, default, scope (env/tenant), and removal plan.
- **No breaking transport changes without dual compatibility**:
  - prefer dual-publish / dual-subscribe windows for MQTT and realtime.
- **Secrets management**:
  - secrets are injected via environment/secret stores in deployment, not committed.

## 11) Anti-chaos rules for large codebases

- **Ownership boundaries are enforced**:
  - backend transport code changes require corresponding SDK/frontend contract review.
- **Avoid “global state creep”**:
  - backend: avoid singleton mutable registries unless they are the intentional source of truth.
  - frontend: avoid module-level socket instances scattered across features.
  - sdk: treat singleton dispatch patterns as constraints.
- **Consistency beats cleverness**:
  - prefer repeatable patterns over one-off implementations for new modules/widgets/services.


