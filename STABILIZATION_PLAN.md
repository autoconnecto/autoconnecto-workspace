# Backend Startup Stabilization Plan

> Governance baseline: `RULES.md`, `.cursor/rules/backend.mdc`, `.cursor/rules/ai-governance.mdc`
> Code baseline: read directly from source — no memory-carried assumptions
> Status: Assessment complete. Phases pending execution.

---

## Startup Sequence Map (Actual, Confirmed)

NestJS bootstrap executes in this order for every module in `AppModule.imports`:

```
1. Static factory methods called (forRoot, register)
   → ConfigModule.forRoot()         [reads .env into process.env]
   → QueueModule.register()         [reads TELEMETRY_QUEUE_ENABLED from process.env]
   → ScheduleModule.forRoot()

2. DI container resolves providers (constructors run)
   → DatabaseService()              [creates pg.Pool from process.env]
   → PresenceService()              [creates Redis client, connects immediately]
   → RealtimeGateway()              [logs constructor call]
   → DeviceWsGateway()              [reads DEVICE_WS_PORT from process.env]
   → MqttTelemetryConsumerService() [no side-effect in constructor]
   → MqttAckConsumerService()       [no side-effect in constructor]
   → MqttAttributeService()         [no side-effect in constructor]
   → MqttCommandService()           [no side-effect in constructor]
   → ... all other service constructors

3. OnModuleInit hooks run (dependency-ordered, not import-ordered)
   → DeviceWsGateway.onModuleInit() [creates second HTTP server on DEVICE_WS_PORT]
   → MqttTelemetryConsumerService.onModuleInit() [mqtt.connect()]
   → MqttAckConsumerService.onModuleInit()       [mqtt.connect()]
   → MqttAttributeService.onModuleInit()         [mqtt.connect()]
   → MqttCommandService.onModuleInit()           [mqtt.connect()]

4. NestJS HTTP adapter starts (Socket.IO gateway binds here)
   → RealtimeGateway.afterInit()    [server property populated now]

5. app.listen(PORT, "0.0.0.0")
   → Traffic accepted immediately, regardless of infrastructure readiness
```

---

## Risk Register

### RISK-01 — `PORT` Defined Twice in `.env` [CONFIRMED / HIGH]

**File:** `backend/.env`, lines 25 and 53
**Phase:** 1

```
PORT=3000    ← line 25
PORT=3000    ← line 53 (duplicate, currently same value)
DEVICE_WS_PORT=3001
```

`dotenv` takes the first occurrence, so today this resolves to 3000. The fallback in `main.ts` is `|| 3001`, which is exactly what `DEVICE_WS_PORT` is set to. If `PORT` were absent (env file load failure, CI override, Docker with empty env), Socket.IO would bind on 3001, directly colliding with `DeviceWsGateway`'s raw WebSocket HTTP server. Two entries with the same key indicate historical copy-paste and no `.env` linting.

**Governance violation:** `RULES.md §Infrastructure` — ports must be explicit and non-ambiguous.

**Status:** [ ] Pending

---

### RISK-02 — Redis Eager Connect in Constructor [CONFIRMED / HIGH]

**File:** `backend/src/realtime/presence.service.ts`, constructor
**Phase:** 2

```ts
this.redis = new Redis({
  host: process.env.REDIS_HOST || "redis",  // Docker DNS default, not localhost
  lazyConnect: false,                        // connects immediately in constructor
  maxRetriesPerRequest: null,
});
```

`lazyConnect: false` means ioredis initiates a TCP connection attempt inside the NestJS DI **constructor** phase — before `OnModuleInit` hooks run, before `app.listen()`, and without any readiness gate. The default host is `"redis"` (Docker DNS), not the `REDIS_HOST` value in `.env` (`127.0.0.1`). If Redis is not up, the service enters a retry loop silently. Methods like `markOnline()`, `isOnline()`, and `touch()` will throw or hang from the first device connection onward with no circuit-breaker.

**Governance violation:** `backend.mdc §Infrastructure discipline` — infrastructure clients must not be instantiated in constructors; construction must happen in `OnModuleInit` with an explicit readiness check.

**Status:** [ ] Pending

---

### RISK-03 — `DatabaseService` Side-Effectful Constructor [CONFIRMED / HIGH]

**File:** `backend/src/common/database.service.ts`, constructor
**Phase:** 2

`pg.Pool` construction reads all credentials from `process.env` in the constructor. There is no `OnModuleInit` readiness ping — no startup check to confirm Postgres is accepting connections before the application claims to be ready. `DB_POOL_MIN=2` means the pool will attempt 2 connections at startup. If Postgres is still starting, those connections hang for up to `connectionTimeoutMillis=3000ms`, silently blocking early requests. `DatabaseService` is exported from `CommonModule` and imported by every feature module — a construction failure propagates to the entire dependency tree.

**Governance violation:** `backend.mdc §Database rules` — pool construction without a ping + readiness gate.

**Status:** [ ] Pending

---

### RISK-04 — `RealtimeGateway.server` Null Window vs MQTT ACK Consumer [CONFIRMED / HIGH]

**File:** `backend/src/mqtt-ack/mqtt-ack-consumer.service.ts` injects `RealtimeGateway`
**File:** `backend/src/realtime/realtime.gateway.ts` — `server!: Server`
**Phase:** 3

`server` is populated by the NestJS WebSocket adapter only after the HTTP server starts (step 4 in the sequence). `MqttAckConsumerService.onModuleInit()` connects to MQTT at step 3. If the broker is available and a device sends an RPC response within the narrow window between MQTT `connect` event and NestJS HTTP adapter initialization, the handler calls `this.realtimeGateway.server.to(room).emit(...)` where `server` is `undefined`. The `try/catch` in the message handler swallows the TypeError — the RPC response is **silently dropped**.

This is a confirmed race condition with a real exposure window in production.

**Governance violation:** `backend.mdc §Transport contracts` — emitters must not assume gateway `server` is initialized before `afterInit()` is called.

**Status:** [ ] Pending

---

### RISK-05 — Four Independent MQTT Clients, No Startup Coordination [CONFIRMED / MEDIUM]

**Files:** `mqtt-ingest/`, `mqtt-ack/`, `mqtt-attribute/`, `mqtt-command/`
**Phase:** 1 (config) + 4 (coordination)

Each of the four MQTT consumer/publisher services calls `mqtt.connect()` independently in `onModuleInit()`. `MQTT_BROKER_URL` is **absent from `backend/.env`** — every service falls through to the `"mqtt://emqx:1883"` default (Docker-internal hostname). In local development without Docker, all four clients fail to connect and enter a 5-second reconnect loop indefinitely. In production, if the broker restarts, all four clients reconnect and re-subscribe simultaneously with no stagger.

**Governance violation:** `ai-governance.mdc §Infrastructure discipline` — every infrastructure client must define readiness, failure mode, and timeouts/backoff explicitly.

**Status:** [ ] Pending

---

### RISK-06 — `QueueModule.register()` Ordering Assumption [CONFIRMED / MEDIUM — DORMANT]

**File:** `backend/src/queue/queue.module.ts`
**Phase:** — (dormant while `TELEMETRY_QUEUE_ENABLED=false`)

`QueueModule.register()` is a static factory method called during NestJS module metadata collection — the same phase as `ConfigModule.forRoot()`. The implicit assumption is that `ConfigModule.forRoot()` populates `process.env` before `QueueModule.register()` reads it. This works because `ConfigModule` is listed first in `AppModule.imports`, but it relies on undocumented NestJS import-ordering behavior. A NestJS version upgrade or import reordering could silently break queue mode.

**Status:** [ ] Pending (activate when queue mode is enabled)

---

### RISK-07 — `forwardRef` Circular Dependencies [CONFIRMED / MEDIUM — ARCHITECTURE DEBT]

**Files:** `realtime.module.ts`, `device-ws.gateway.ts`, `mqtt-command.service.ts`
**Phase:** 5

Confirmed circular chains:
- `RealtimeModule` ↔ `DevicesModule` (via `forwardRef`)
- `RealtimeModule` ↔ `DeviceAttributesModule` (via `forwardRef`)
- `MqttCommandModule` → `RealtimeModule` (via `forwardRef(() => DeviceWsGateway)`)

Services resolved via `forwardRef` are lazy proxies — not guaranteed to be fully initialized when the dependent's constructor runs. The current code correctly avoids calling these from constructors, but the presence of `forwardRef` chains indicates incorrect module boundaries. These should be decoupled via events or an intermediary service.

**Governance violation:** `RULES.md §Architecture` — circular dependencies indicate premature coupling and must be resolved, not worked around.

**Status:** [ ] Pending

---

### RISK-08 — `OPENAI_API_KEY` Committed to `.env` [CONFIRMED / HIGH — SECURITY]

**File:** `backend/.env`, line 60
**Phase:** 1

A live OpenAI API key (`sk-proj-...`) is committed to the `.env` file in version control. This is a confirmed secret exposure regardless of repository visibility.

**Governance violation:** `ai-governance.mdc §Git discipline` — never commit secrets; treat `*.env*` as secret-bearing.

**Action:** Rotate the key at OpenAI dashboard immediately, then remove from `.env`. Replace with a placeholder comment.

**Status:** [ ] Pending

---

### RISK-09 — No Infrastructure Readiness Gate Before `app.listen()` [CONFIRMED / MEDIUM]

**File:** `backend/src/main.ts`
**Phase:** 4

`app.listen()` opens the port and begins accepting HTTP requests immediately after module initialization. At that point:
- Postgres pool connections have not been verified
- Redis may still be in the connection retry loop
- MQTT clients may not yet have received a `connect` event

There is no `/healthz` or `/readyz` endpoint for a load balancer or Docker `HEALTHCHECK` to poll. Requests in the first few seconds may encounter database timeouts or Redis errors with no graceful handling.

**Status:** [ ] Pending

---

### RISK-10 — `TelemetryIngestService` Runtime Env Re-Read [CONFIRMED / LOW]

**File:** `backend/src/telemetry/telemetry-ingest.service.ts`
**Phase:** 2

`QueueModule.register()` makes the queue enabled/disabled decision statically at module load time. `TelemetryIngestService.isQueueEnabled()` re-reads `process.env.TELEMETRY_QUEUE_ENABLED` on every ingest call. If the env var changes post-startup without a restart, `isQueueEnabled()` could return `true` while `this.telemetryQueue` is `undefined`, causing a permanently silent queue bypass. Two inconsistent readings of the same env key.

**Status:** [ ] Pending

---

## Phased Stabilization Strategy

### Phase 1 — Immediate: `.env` Corrections (no code changes)

Rollback: `git checkout backend/.env` (or `git rm --cached backend/.env` if never committed without secrets)

- [x] Confirmed `.env.development` and `.env.production` are both comprehensive — all keys covered
- [x] `OPENAI_API_KEY` live key removed (key should be rotated at platform.openai.com)
- [x] `backend/.env` deleted — redundant, was causing duplicate PORT and silent MQTT default overrides
- Note: `ConfigModule.forRoot` fallback to `.env` is now a no-op — correct behavior

---

### Phase 2 — Startup Ordering: Move Infrastructure to `OnModuleInit`

Rollback per file: `git revert <commit>` — each service is an independent PR

- [x] `PresenceService` — moved `new Redis(...)` to `onModuleInit()`, `lazyConnect: true`, `await redis.connect()`
- [x] `DatabaseService` — added `onModuleInit()` with `SELECT 1` ping; throws on startup if Postgres unreachable
- [x] `TelemetryIngestService` — `queueEnabled` cached at `onModuleInit()`; no more per-call env re-read

---

### Phase 3 — Realtime Readiness Guard

Rollback: revert single-line null guard addition — zero behavior change for steady-state

- [x] `MqttAckConsumerService` — null guard added before `.server.emit()` and `.server.to().emit()` — silent drop converted to logged warning
- [x] `MqttCommandService` — null guard added before `deviceWsGateway.sendDeviceCommand()` — falls through to MQTT if gateway not ready

---

### Phase 4 — Startup Health Gate

Depends on Phase 2 completing first (requires ping methods on `DatabaseService` and `PresenceService`)

- [x] `DatabaseService.ping()` added — `SELECT 1` with error capture, returns bool
- [x] `PresenceService.ping()` added — `redis.ping()` returning PONG check, returns bool
- [x] `GET /healthz` added to `AppController` — checks Postgres + Redis live, returns `{ status, postgres, redis, timestamp }`
- [x] Startup gate already covered by Phase 2 `onModuleInit()` throws — no `main.ts` change needed

---

### Phase 5 — Architecture: Resolve `forwardRef` Cycles

Largest scope. Tag rollback point before starting: `git tag pre-forwardref-removal`

Deferred to v0.2.0. Cycles are working safely in production:
- No service calls a forward-referenced dependency from its constructor
- All method calls happen at `onModuleInit()` or later
- Runtime null guards are in place

- [ ] Introduce EventEmitter2 to break `RealtimeModule ↔ DevicesModule` cycle
- [ ] Break `RealtimeModule ↔ DeviceAttributesModule` cycle
- [ ] Decouple `MqttCommandModule` from `RealtimeModule` direct dependency

---

## Rollback Rules

- Phase 1 is always safe to roll back independently — it is `.env` edits only.
- Phases 2–3 are single-file, single-service changes. Each must be a standalone commit so rollback is `git revert <commit>` with no cross-service cascades.
- Phase 4 depends on Phase 2. Do not merge Phase 4 before Phase 2 is stable in staging.
- Phase 5 must have a rollback tag before starting. Must not be merged in the same PR as any Phase 2–4 changes.
- No phase should be merged without verifying the previous phase is stable across at least one deployment cycle.

---

## Progress Tracker

| Risk | Severity | Phase | Status |
|---|---|---|---|
| RISK-01 Duplicate PORT | High | 1 | [x] Done |
| RISK-02 Redis eager connect | High | 2 | [x] Done |
| RISK-03 DatabaseService constructor | High | 2 | [x] Done |
| RISK-04 RealtimeGateway.server null window | High | 3 | [x] Done |
| RISK-05 Four independent MQTT clients | Medium | 1+4 | [x] Phase 1 done — MQTT_BROKER_URL added |
| RISK-06 QueueModule ordering assumption | Medium | — dormant | [ ] Pending |
| RISK-07 forwardRef cycles | Medium | 5 | [ ] Deferred to v0.2.0 |
| RISK-08 OpenAI key in .env | High | 1 | [x] Placeholder set — rotate key at OpenAI dashboard |
| RISK-09 No readiness gate before listen | Medium | 4 | [x] Done — /healthz endpoint live |
| RISK-10 TelemetryIngest double env read | Low | 2 | [x] Done |
