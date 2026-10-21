# Evidence Pack — AUDIT-20261020-01

**Audience:** External auditor / buyer diligence (redacted)  
**Platform:** Autoconnecto IoT SaaS — claimed release **v1.7.56**  
**Audit standard:** PLATFORM_AUDIT_STANDARD v1.0.0 (FROZEN)  
**Audit closed:** 2026-10-20  
**Contact:** Founder / support@autoconnecto.in  

## Scope

Full platform audit: HTTP API, data, realtime/MQTT, mail, frontend, mobile, device SDK, customer docs, website, AWS/DNS/EC2/CI, security, billing, solutions, ops, external readiness.

## Not included (deliberate)

- Production `.env`, API keys, Cognito secrets  
- Customer PII dumps, raw DB exports  
- Live alarm payloads  
- Wi‑Fi credentials from device examples  

## How to use

1. Read `01-SCORECARD.md` for Pass/Fail by domain.  
2. Read `02-FINDINGS-SUMMARY.md` for open S0–S2.  
3. Use architecture / data-flow / subprocessors for system context.  
4. Treat open S0/S1 as blockers until Fixed or Accepted risk.

## Versions verified (production)

| Component | Evidence |
|-----------|----------|
| Backend | EC2 `git describe` = `v1.7.56`; healthz ok |
| Frontend | Deploy Action success for release line |
| Docs / Mobile / SDK | Tagged / released as 1.7.56 (SDK library.properties; README version drift noted in findings) |
