# Subprocessors / processors (draft) — AUDIT-20261020-01

Non-exhaustive operational list for diligence. Legal DPA wording is founder-owned.

| Provider | Use |
|----------|-----|
| Amazon Web Services (ap-south-1 and related) | EC2 API host, S3/CloudFront (app/docs/website), SES (Cognito mail), Route53 DNS, ACM/TLS where used |
| Amazon Cognito | User authentication |
| Brevo | Application email (OTP, alarms, tenant mail) |
| Dodo Payments | Checkout / billing webhooks |
| GitHub | Source + Actions CI/CD |
| MQTT broker (self-hosted EMQX on EC2) | Device messaging |

**Deferred by product policy (not claimed):** WhatsApp, on-prem install packaging, ISO 27001 certification, camera/RTSP.
