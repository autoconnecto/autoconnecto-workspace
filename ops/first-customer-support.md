# First-customer support checks (founder)

Use when a tenant writes or calls. Customers see contact + self-help in [Get help](https://docs.autoconnecto.in/guide/get-help.html).

## What to ask them

- Tenant name / login email  
- Platform version (sidebar)  
- Device name + approximate IST time of the problem  
- Expected vs actual (no data, no mail, login, billing)

## Five checks (you)

1. **API** — `curl.exe -sS https://api.autoconnecto.in/healthz` → postgres/redis ok.  
2. **EC2 tag** — `ssh ec2-autoconnecto "cd ~/autoconnecto/backend && git describe --tags --always"` matches the release they should be on.  
3. **Device** — In their tenant (or ask them): Devices → Active? Last telemetry time? Token re-revealed only if they lost it.  
4. **Notify** — Tenant Settings → Mail and SMS connected? Users → email/Telegram on for that person? Quiet hours off unless they turned them on. Alarm on Alarms page ≠ mail sent.  
5. **Noise** — Show demos off? Plan capacity / suspended tenant? Sample Solution sandbox ≠ their field device.

## Backup (if data loss claimed)

See [`backend/docs/BACKUP_RESTORE.md`](../backend/docs/BACKUP_RESTORE.md). Confirm `~/backups/pg-*.sql.gz` on EC2 before promising restore.

## Do not

- Invent meter readings or acknowledge live alarms they did not ask about.  
- Turn on quiet hours / Monday energy mail for them unless they ask.  
- Promise agent / CMMS / WhatsApp.
