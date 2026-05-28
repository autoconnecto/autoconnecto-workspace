# Deployment (Standard Runbook)

This document is the **standard, copy‑paste deployment runbook** for the Autoconnecto workspace.

If you want the most detailed EC2 procedures (including docs sync + troubleshooting tables), also read:
- `backend/ops/DEPLOYMENT-EC2.md` (canonical EC2 release flow)
- `ARCHITECTURE.md` → “Backend API (`api.autoconnecto.in`)" (high-level flow + verification)

---

## Scope

- **Backend API** (`api.autoconnecto.in`): deployed on **EC2 using Docker Compose**.
- **Frontend app** (`app.autoconnecto.in`): **static build deployed to S3 + CloudFront** (summary below).
- **Website** (`www.autoconnecto.in`): **static export deployed to S3 + CloudFront** (summary below).
- **Docs**:
  - **Public docs** (`docs.autoconnecto.in`): **VitePress build deployed to S3 + CloudFront** (summary below).
  - **In-app docs** (Documentation page inside the web app): **generated in CI → uploaded to S3 → pulled onto EC2 host → backend restarted**.

---

## Preconditions (EC2 host)

- You are logged into the EC2 instance as `ubuntu`.
- Backend compose project exists at `~/autoconnecto/backend`.
- Production env lives on the host at `~/autoconnecto/backend/.env.production` (not committed).
- The compose project defines a **one-shot `migrate` service** and a `backend` service.

> **Important:** If `.env.production` sets `DB_HOST=timescaledb` (compose service name), then **migrations must be run via Docker Compose**, not `npm run migrate` on the host.

---

## Release rule (do this every time)

### 1) Always deploy by an immutable git ref

Use a **tag** (recommended) or a known commit SHA.

- **Do not reuse** a bad tag. If a tag pointed to the wrong commit once, cut a **new** tag (e.g. `v1.3.1`) and deploy that.
- A deploy ref must include **`Dockerfile`** and **`docker-compose.yml`** in the backend repo; otherwise Compose can’t build.

### 2) Migrations run before backend

Order is:

1. `migrate` (one-shot, must exit 0)
2. `backend` (recreated with `--no-deps`)

---

## Standard backend deploy (recommended)

### One command (preferred)

On EC2:

```bash
cd ~/autoconnecto/backend
bash scripts/ec2-release-deploy.sh vX.Y.Z
```

Notes:
- This is the canonical flow referenced by `ARCHITECTURE.md` and `backend/ops/DEPLOYMENT-EC2.md`.
- `scripts/deploy-ec2.sh` is a **deprecated wrapper** (per `backend/ops/DEPLOYMENT-EC2.md`).

### Manual (only if the script fails)

On EC2:

```bash
cd ~/autoconnecto/backend

# Ensure permissions are sane (common failure mode if docs bind-mount wrote as root)
sudo chown -R ubuntu:ubuntu ./docs || true

# Land on the release tag
git fetch --tags --force origin
git checkout -f vX.Y.Z
git describe --tags --always

# Ensure compose reads the production env (host convention)
[ -L .env ] || ln -sf .env.production .env

# Run migrations in the compose network
docker compose build migrate
docker compose up -d migrate
docker compose logs -n 200 migrate

# Rebuild/recreate backend only (leave db/redis/emqx untouched)
docker compose up -d --build --force-recreate --no-deps backend
docker compose ps backend
docker compose logs -n 200 backend
```

---

## Post-deploy verification (backend)

On EC2:

```bash
cd ~/autoconnecto/backend
git describe --tags --always --dirty
docker compose ps backend
curl -sS http://127.0.0.1:3000/healthz
curl -sS https://api.autoconnecto.in/healthz
```

If you need to confirm the container is running the expected package version:

```bash
docker compose exec backend sh -lc "node -p \"require('./package.json').version\""
```

---

## Rollback (backend)

Preferred rollback is **code rollback** (not DB rollback).

On EC2:

```bash
cd ~/autoconnecto/backend
git fetch --tags --force origin
git checkout -f vPREVIOUS
docker compose up -d migrate
docker compose up -d --build --force-recreate --no-deps backend
curl -sS https://api.autoconnecto.in/healthz
```

> Avoid destructive commands like `docker compose down -v` (destroys volumes).

---

## Production env notes (`.env.production`)

`.env.production` is host-local and loaded by compose (often via `.env` symlink).

When adding new features that affect ingest, prefer a **kill switch** env flag for rollback.

Examples currently used:
- `DATA_PIPELINES_ENABLED` (telemetry pipeline hook)
- `ATTRIBUTE_PIPELINES_ENABLED` (client attribute pipeline hook)

For the full variable list, see `backend/ENVIRONMENT.md`.

---

## In-app docs sync (optional)

In-app docs are generated in CI and synced from S3 to the EC2 host into `~/autoconnecto/backend/docs/generated/`.

If the Documentation page shows only Swagger and no sections, sync docs:

```bash
cd ~/autoconnecto/backend
bash scripts/sync-generated-docs-from-s3.sh
docker compose up -d --no-deps backend
```

---

## Docs site deployment (`docs.autoconnecto.in`)

**Owner:** workspace workflow `.github/workflows/public-docs-site.yml` and docs repo workflow `docs/.github/workflows/deploy.yml`.

### CI (recommended)

- Trigger: push/dispatch/schedule.
- Outcome: VitePress site built and deployed to `s3://autoconnecto-docs-site/` plus CloudFront invalidation.

### Manual (if CI is down)

From a machine with AWS credentials that can write the docs bucket and invalidate CloudFront:

```bash
# From workspace root
cd docs
npm ci
npm run docs:build

# Upload immutable assets (exclude HTML + sitemap)
aws s3 sync docs/.vitepress/dist/ s3://autoconnecto-docs-site/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" \
  --exclude "sitemap.xml"

# Upload HTML + sitemap with short cache
aws s3 sync docs/.vitepress/dist/ s3://autoconnecto-docs-site/ \
  --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" \
  --include "sitemap.xml"

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id E30AD6N6537JGX --paths "/*"
```

---

## Website deployment (`www.autoconnecto.in`)

**Owner:** `website/.github/workflows/deploy-s3.yml` (static export to `out/` → S3 → CloudFront invalidation).

### CI (recommended)

- Trigger: push to `website` repo main (and optional repository_dispatch).
- Default bucket: `autoconnecto-www-site`
- Default CloudFront distribution: `E3UPPLM5N2GQ5Z`

### Manual (if CI is down)

```bash
cd website
npm install
npm run build

aws s3 sync out/ "s3://autoconnecto-www-site/" --delete --region ap-south-1
aws cloudfront create-invalidation --distribution-id E3UPPLM5N2GQ5Z --paths "/*"
```

---

## Frontend app deployment (`app.autoconnecto.in`)

**S3 bucket:** `app.autoconnecto.in`  
**CloudFront distribution:** `E21R9QJBLA5QZB`

The frontend is a separate repo (`autoconnecto-frontend`).

### Manual (if CI is down)

```bash
cd frontend
npm ci
npm run build

# Upload immutable assets with long cache (exclude index.html)
aws s3 sync dist/ "s3://app.autoconnecto.in/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# Upload index.html with short cache (so releases propagate quickly)
aws s3 cp dist/index.html "s3://app.autoconnecto.in/index.html" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "text/html"

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id E21R9QJBLA5QZB --paths "/*"
```

### SPA routing note

If deep links like `/devices/123` 404 in production, CloudFront/S3 needs an SPA rewrite
(`/foo` → `/index.html`). Implement this via a CloudFront Function or equivalent rewrite rules.

---

## Common failure modes (quick fixes)

- **Tag deploy builds wrong code (e.g. shows v1.2.8):**
  - The tag points to the wrong commit. Create a new tag on the correct commit (e.g. `v1.3.1`) and deploy that.
- **`npm run migrate` fails with `getaddrinfo EAI_AGAIN timescaledb`:**
  - You ran migrations on the host while `DB_HOST=timescaledb`. Run `docker compose up -d migrate` instead.
- **`docker compose` says “no configuration file provided”:**
  - You’re not in `~/autoconnecto/backend`, or the checked-out ref doesn’t include `docker-compose.yml`.
- **Checkout fails with permission denied under `docs/`:**
  - `sudo chown -R ubuntu:ubuntu ~/autoconnecto/backend/docs` then retry checkout.

