# Autoconnecto — Deployment (single source of truth)

**Use only this file for every release.**  
Do not use ad-hoc `docker compose`, `git pull main`, or PM2 commands.

Superseded docs (do not follow these for releases):

- `backend/ops/DEPLOYMENT-EC2.md` → pointer only
- `backend/ops/RUNBOOK-EC2.md` → legacy PM2 bootstrap (historical)
- Duplicate deploy sections in `ARCHITECTURE.md` → summary only; commands live here

Broker TLS one-time setup: `backend/ops/letsencrypt/README.md`

---

## Surfaces at a glance

| Surface | URL / target | Repo (GitHub) | Deploy |
|---------|----------------|---------------|--------|
| Backend API | `api.autoconnecto.in` | `autoconnecto/autoconnecto-backend` | EC2: `scripts/ec2-release-deploy.sh` |
| Frontend app | `app.autoconnecto.in` | `autoconnecto/autoconnecto-frontend` | Actions `deploy-s3.yml` |
| Website | `www.autoconnecto.in` | `autoconnecto/website` | Actions `deploy-s3.yml` |
| Public docs | `docs.autoconnecto.in` | `autoconnecto/autoconnecto-docs` | Actions `deploy.yml` |
| Mobile (Android) | Play / APK artifact | `autoconnecto/autoconnecto-mobile` | Actions on tag `v*` |
| Device SDK | Arduino Library Manager | `autoconnecto/autoconnecto-sdk` | Tag + `library.properties` version |
| Workspace | Submodule pointers | `autoconnecto/autoconnecto` (monorepo) | Commit + tag after submodules |

---

## Release rules

1. Pick one version: `vX.Y.Z` (same across repos for a platform release).
2. **Bump version strings in every repo before tagging** (see checklist below). Arduino Library Manager only sees a new SDK when `sdk/library.properties` `version=` increases.
3. **Tag an immutable git ref** per repo. Never deploy “whatever is on `main`” on EC2.
4. **Order:** version bumps → commit → tag → push → **backend (EC2)** → frontend / website / docs (CI) → mobile (tag) → workspace pointer.
5. **One command per surface** when possible. Manual blocks below are **fallback only**.
6. **Never** `docker compose down -v` on production.
7. **Never** `npm run migrate` on the EC2 host if `DB_HOST=timescaledb` — use compose `migrate` service.

---

## Step 0 — Bump versions (before any tag)

Replace `X.Y.Z` with the release (e.g. `1.3.4`). Commit in each repo.

| Repo | File | Field |
|------|------|--------|
| **backend** | `package.json` | `"version": "X.Y.Z"` |
| **frontend** | `package.json` | `"version": "X.Y.Z"` |
| **docs** | `package.json` | `"version": "X.Y.Z"` |
| **website** | `package.json` | `"version": "X.Y.Z"` |
| **sdk** | `library.properties` | `version=X.Y.Z` ← **required for Arduino Library Manager** |
| **mobile** | `package.json` | `"version": "X.Y.Z"` |
| **mobile** | `android/app/build.gradle` | `versionName "X.Y.Z"` and **increment** `versionCode` (integer, must go up every store release) |

Example (mobile `versionCode`): if current is `11`, set `12` for the new release.

**Verify SDK version locally:**

```bash
grep '^version=' sdk/library.properties
# must equal X.Y.Z (no v prefix in library.properties)
```

---

## Step 1 — Commit, tag, push (each repo)

Run in **backend**, **frontend**, **docs**, **website**, **sdk**, **autoconnecto-mobile**:

```bash
git add -A
git commit -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

---

## Step 2 — Backend (EC2)

**Host:** `ubuntu@<ec2>`  
**Path:** `~/autoconnecto/backend`  
**Prerequisite:** `.env.production` includes `PORT=3000`

### Preferred (always use this)

```bash
cd ~/autoconnecto/backend
bash scripts/ec2-release-deploy.sh vX.Y.Z
```

With in-app docs refresh after backend is healthy:

```bash
bash scripts/ec2-release-deploy.sh vX.Y.Z --sync-docs
```

### Verify

```bash
cd ~/autoconnecto/backend
git describe --tags --always
docker compose ps backend
curl -sS http://127.0.0.1:3000/healthz
curl -sS https://api.autoconnecto.in/healthz
docker compose exec backend sh -lc "node -p \"require('./package.json').version\""
```

### Manual fallback (only if script fails)

```bash
cd ~/autoconnecto/backend
sudo chown -R ubuntu:ubuntu ./docs || true
git fetch --tags --force origin
git checkout -f vX.Y.Z
git describe --tags --always
test -f scripts/run-migrations.mjs && test -f Dockerfile && echo "tree OK"
[ -L .env ] || ln -sf .env.production .env
grep -q '^PORT=3000' .env.production || echo 'WARN: add PORT=3000'
docker compose build migrate
docker compose up -d migrate
docker inspect -f '{{.State.ExitCode}}' autoconnecto-migrate   # expect 0
docker compose up -d --build --force-recreate --no-deps backend
sleep 15
curl -sS http://127.0.0.1:3000/healthz
curl -sS https://api.autoconnecto.in/healthz
```

### Rollback

```bash
cd ~/autoconnecto/backend
bash scripts/ec2-release-deploy.sh vPREVIOUS
```

Prefer forward-fix on a **new** tag if the bad tag pointed at the wrong commit.

### Kill switches (no redeploy)

Edit `~/autoconnecto/backend/.env.production`, then:

```bash
docker compose up -d --no-deps backend
```

- `DATA_PIPELINES_ENABLED=false`
- `ATTRIBUTE_PIPELINES_ENABLED=false`

Full list: `backend/ENVIRONMENT.md`

---

## Step 3 — Frontend, website, docs (GitHub Actions)

From your laptop (after `main` contains the tagged commits):

```bash
gh workflow run deploy-s3.yml -R autoconnecto/autoconnecto-frontend --ref main
gh workflow run deploy-s3.yml -R autoconnecto/website --ref main
gh workflow run deploy.yml -R autoconnecto/autoconnecto-docs --ref main
```

Workflows also run automatically on push to `main`.

| Surface | Workflow | S3 bucket | CloudFront ID |
|---------|----------|-----------|----------------|
| Frontend | `deploy-s3.yml` | `app.autoconnecto.in` | `E21R9QJBLA5QZB` |
| Website | `deploy-s3.yml` | `autoconnecto-www-site` | `E3UPPLM5N2GQ5Z` |
| Docs | `deploy.yml` | `autoconnecto-docs-site` | `E30AD6N6537JGX` |

**Verify:** Actions conclusion `success`, then open:

- https://app.autoconnecto.in
- https://www.autoconnecto.in
- https://docs.autoconnecto.in

---

## Step 4 — Mobile app (Android)

**Repo:** `autoconnecto/autoconnecto-mobile`  
**CI:** `.github/workflows/release-android.yml` runs on push of tag `v*`.

After Step 0 version bumps and Step 1 tag push, CI builds the release APK. Download from the Actions run artifacts or attach to store listing manually.

**Verify:** `package.json` / `build.gradle` versions match `vX.Y.Z`; Actions run for tag succeeded.

### Worker app (factory floor, BLE-only)

**Path:** `tools/machine-worker-app` in workspace repo `autoconnecto/autoconnecto-workspace`  
**CI:** `.github/workflows/release-worker-android.yml` on tag `worker-v*`.

```bash
# After bumping tools/machine-worker-app/package.json + app.json
git tag worker-v1.2.1
git push origin worker-v1.2.1
```

**Download:** https://github.com/autoconnecto/autoconnecto-workspace/releases/latest/download/autoconnecto-worker.apk

**Verify:** Actions run for `worker-vX.Y.Z` succeeded; Release shows `autoconnecto-worker.apk`.

---

## Step 5 — SDK (Arduino Library Manager)

No server deploy. Users get updates when:

1. `sdk/library.properties` has a **new** `version=X.Y.Z` (semver, no `v` prefix).
2. Tag `vX.Y.Z` is pushed to `autoconnecto/autoconnecto-sdk`.
3. Library is published / indexed per your Arduino Library Manager process (GitHub release or library registry).

**Verify:**

```bash
git -C sdk describe --tags --always
grep '^version=' sdk/library.properties
```

---

## Step 6 — Workspace monorepo (optional)

If you use the workspace repo with submodules:

```bash
cd ~/autoconnecto   # workspace root
git add backend frontend docs website sdk autoconnecto-mobile
git commit -m "Release vX.Y.Z submodule pointers"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --tags
```

---

## In-app documentation (EC2)

Product guides inside the web app are **not** in git on EC2. They live under `~/autoconnecto/backend/docs/generated/` (CI → S3 → host sync).

If the Documentation page shows only Swagger:

```bash
cd ~/autoconnecto/backend
bash scripts/sync-generated-docs-from-s3.sh
docker compose up -d --no-deps backend
curl -sS http://127.0.0.1:3000/api/documentation/navigation \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('sections', len(d.get('sections',[])))"
```

Ensure `.env.production` has `DOCS_GENERATED_DIR=/app/docs/generated`.

---

## Post-deploy verification (full platform)

| Check | Command / action |
|-------|------------------|
| Backend tag | `git -C ~/autoconnecto/backend describe --tags --always` → `vX.Y.Z` |
| API health | `curl -sS https://api.autoconnecto.in/healthz` |
| Cognito login | Sign in at https://app.autoconnecto.in |
| Telemetry + realtime | Ingest test device; dashboard updates |
| MQTT | Device connects; broker healthy in `docker compose ps` |
| Static sites | Spot-check www, docs, app URLs |
| SDK | `library.properties` version matches release |
| Mobile | Tag build green in Actions |

---

## Manual deploy fallback (static sites)

Use only if GitHub Actions is unavailable.

### Frontend

```bash
cd frontend && npm ci && npm run build
aws s3 sync dist/ "s3://app.autoconnecto.in/" --delete \
  --cache-control "public, max-age=31536000, immutable" --exclude "index.html"
aws s3 cp dist/index.html "s3://app.autoconnecto.in/index.html" \
  --cache-control "public, max-age=0, must-revalidate" --content-type "text/html"
aws cloudfront create-invalidation --distribution-id E21R9QJBLA5QZB --paths "/*"
```

### Website

```bash
cd website && npm ci && npm run build
aws s3 sync out/ "s3://autoconnecto-www-site/" --delete --region ap-south-1
aws cloudfront create-invalidation --distribution-id E3UPPLM5N2GQ5Z --paths "/*"
```

### Docs

```bash
cd docs && npm ci && npm run docs:build
aws s3 sync docs/.vitepress/dist/ s3://autoconnecto-docs-site/ --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "sitemap.xml"
aws s3 sync docs/.vitepress/dist/ s3://autoconnecto-docs-site/ --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" --include "sitemap.xml"
aws cloudfront create-invalidation --distribution-id E30AD6N6537JGX --paths "/*"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| Arduino Library Manager shows old SDK | `library.properties` not bumped | Set new `version=X.Y.Z`, commit, tag, push |
| `Cannot find module '@aws-sdk/client-s3'` on Docker build | Missing npm dependency | Deploy a tag that includes the fix in `package.json` |
| `getaddrinfo EAI_AGAIN timescaledb` | Host `npm run migrate` | Use `docker compose up -d migrate` in `~/autoconnecto/backend` |
| `no configuration file provided` | Wrong directory or bad tag | `cd ~/autoconnecto/backend`; tag must include `docker-compose.yml` |
| Checkout: `Permission denied` under `docs/` | Root-owned bind mount | `sudo chown -R ubuntu:ubuntu ~/autoconnecto/backend/docs` |
| Tag deploy shows old version | Tag on wrong commit | Cut **new** tag `vX.Y.Z+1`, redeploy |
| `git fetch`: tag rejected (would clobber) | Stale local tags on EC2 | `git fetch --tags --force origin` |
| `curl: Connection reset` right after start | Nest still booting | Wait 15–30s, retry `/healthz` |
| Different commands every time | Not using this doc | **Stop** — follow this file only |

---

## What not to use

| Do not use | Use instead |
|------------|-------------|
| `scripts/deploy-ec2.sh` | `scripts/ec2-release-deploy.sh` |
| `systemctl start autoconnecto-backend` | Docker Compose `backend` service (legacy unit masked) |
| `backend/ops/RUNBOOK-EC2.md` (PM2) | Docker Compose flow in Step 2 |
| `git pull main` on EC2 without tag | `ec2-release-deploy.sh vX.Y.Z` |
| `docker compose down -v` | Never on production |

---

## Appendix — production architecture (reference)

Current production shape on EC2:

- **Runtime:** single NestJS container (`APP_RUNTIME=all`), not split API/worker yet.
- **Queue:** `TELEMETRY_QUEUE_ENABLED=true` (BullMQ + Redis).
- **Data:** Postgres/Timescale + Redis + EMQX in Compose.
- **Proxy:** Nginx → `127.0.0.1:3000`.

Deferred: API/worker split until shared realtime propagation exists.
