# Architecture pointer — AUDIT-20261020-01

Authoritative builder narrative: workspace `ARCHITECTURE.md`, `backend/ARCHITECTURE.md`, `sdk/TRANSPORT_ARCHITECTURE.md`, `frontend/WIDGET_ARCHITECTURE.md`.

## Confirmed runtime (production)

- **API:** NestJS on EC2 (`api.autoconnecto.in`), Postgres/Timescale + Redis + EMQX (compose).  
- **Realtime UI:** Socket.IO path `/socket.io`, rooms `device:{deviceId}`.  
- **Devices:** MQTT (and HTTPS for some boards) via Autoconnecto SDK; OTA chunk download under `api/v1/:deviceToken/...`.  
- **App UI:** Vite React SPA on S3/CloudFront (`app.autoconnecto.in`).  
- **Docs:** VitePress-style site (`docs.autoconnecto.in`); in-app menu from written pages (HTTP generate endpoints refuse).  
- **Auth:** Cognito JWT for tenants; PlatformAdminGuard for platform-admin.  
- **Mail:** Application OTP/alarms via Brevo; Cognito messaging via SES (`help@`) with custom MAIL FROM `mail.autoconnecto.in`.  
- **Billing:** Dodo Payments webhooks with signature verification.

## Product facts (must not be contradicted)

- Telemetry/attributes stored by platform; drop is the only non-store path.  
- Profile alarm rules and rule-engine alarm nodes both may run.  
- Quiet hours / Monday energy mail default off unless configured.
