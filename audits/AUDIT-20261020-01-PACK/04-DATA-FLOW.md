# Data flow — AUDIT-20261020-01

```text
Device (SDK)
  │  MQTT telemetry / attributes / RPC  OR  HTTPS
  ▼
Broker (EMQX) / HTTP API
  ▼
Backend Nest consumers / controllers
  ├─ Plan interval + caps (e.g. FREE min 30s) ──► drop or accept
  ├─ Persist Postgres / Timescale
  ├─ Optional rule engine / profile alarms
  └─ Emit Socket.IO to room device:{id}
        ▼
     Browser / mobile dashboards & controls
        │
        └─ SHARED attributes / RPC commands ──► device
             (command log expected in UI — see F-007)
```

OTA: platform assigns package → device notified → device downloads chunks with **device token** → apply firmware (SDK example order gap: F-008).
