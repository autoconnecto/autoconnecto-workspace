# purplechilly.com — Website

Static marketing website for **Purple Chilly**, an IoT solutions company based in Jaipur, India.
Built with Next.js 15 (static export) + Tailwind CSS. Hosted on S3 + CloudFront in `ap-south-1`.

---

## Pages

| Route | Description |
|---|---|
| `/` | Home — hero, services overview, Autoconnecto feature, industries, CTA |
| `/solutions` | Detailed service descriptions with industry breakdown |
| `/products` | Autoconnecto platform — features, comparison table, CTAs |
| `/about` | Company story, values, tech stack, contact |
| `/contact` | Enquiry form + contact details |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |

---

## Local development

```bash
npm install
npm run dev        # http://localhost:4029
```

---

## Build

```bash
npm run build      # → out/ (static export, ready for S3 sync)
```

---

## AWS Setup (one-time, before first deploy)

### 1. Create S3 bucket

```
Bucket name: purplechilly-www-site
Region:      ap-south-1
```

Enable static website hosting. Set index document to `index.html` and error document to `404.html`.

### 2. Create CloudFront distribution

- Origin: `purplechilly-www-site.s3-website.ap-south-1.amazonaws.com`
- CNAME: `purplechilly.com`, `www.purplechilly.com`
- SSL: request a certificate in AWS Certificate Manager (ACM) for `purplechilly.com`
- Default root object: `index.html`
- Error pages: 404 → `/404.html`, 200 response

### 3. Update IAM policy

Merge `scripts/iam/purplechilly-deploy-s3-cloudfront-extension.policy.json` into the existing
**AutoconnectoWebsiteDeploy** customer-managed policy on the `autoconnecto-backend` IAM user.
Replace `DISTRIBUTION_ID_HERE` with the actual CloudFront distribution ID.

### 4. GitHub Actions secrets/variables

The workflow reuses the same `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets already
set on the repo for autoconnecto.in. Additionally set:

| Name | Where | Value |
|---|---|---|
| `PURPLECHILLY_CLOUDFRONT_DISTRIBUTION_ID` | Secret or Variable | CloudFront distribution ID |
| `PURPLECHILLY_SITE_URL` | Variable | `https://purplechilly.com` |
| `PURPLECHILLY_LEAD_WEBHOOK_URL` | Variable (optional) | Webhook for contact form leads |

### 5. DNS

Point `purplechilly.com` CNAME → CloudFront distribution domain (e.g. `d1abc123.cloudfront.net`).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes (build) | Canonical URL — `https://purplechilly.com` |
| `NEXT_PUBLIC_LEAD_WEBHOOK_URL` | No | Webhook URL for contact form submissions |
