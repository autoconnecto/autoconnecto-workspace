#!/usr/bin/env bash
# Runs ON EC2 via SSH from GitHub Actions (inapp-docs.yml).
#
# Writes generated markdown under the backend checkout at docs/generated/
# (.gitignored — safe for git pull) and docs/cache/ (writable runtime cache).
# This MUST match docker-compose.yml: ./docs:/app/docs (container path /app/docs/generated).
#
# Overrides:
#   BACKEND_DIR         repo root on host (default: /home/ubuntu/autoconnecto/backend)
#   DOCS_GENERATED_DIR  sync target directory (default: $BACKEND_DIR/docs/generated)
#
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/home/ubuntu/autoconnecto/backend}"
DOCS_GENERATED="${DOCS_GENERATED_DIR:-${BACKEND_DIR}/docs/generated}"
CACHE="${BACKEND_DIR}/docs/cache"
BUCKET_URI="s3://autoconnecto-docs-site/backend-generated/"
REGION="${AWS_REGION:-ap-south-1}"

sudo mkdir -p "$DOCS_GENERATED" "$CACHE"
sudo chown -R ubuntu:ubuntu "${BACKEND_DIR}/docs"

aws s3 sync "$BUCKET_URI" "$DOCS_GENERATED/" --delete --region "$REGION"
FILE_COUNT="$(find "$DOCS_GENERATED" -type f 2>/dev/null | wc -l)"
echo "[ec2-remote-pull-backend-docs] S3 markdown -> ${DOCS_GENERATED} (${FILE_COUNT} files)"

if [ -f "${DOCS_GENERATED}/navigation.json" ]; then
  DOCS_GENERATED="$DOCS_GENERATED" python3 - <<'PY'
import json, os, sys
path = os.path.join(os.environ["DOCS_GENERATED"], "navigation.json")
with open(path, encoding="utf-8") as f:
    n = len(json.load(f).get("sections") or [])
print(f"[ec2-remote-pull-backend-docs] navigation.json: {n} sections")
if n < 1:
    sys.exit("navigation.json has no sections after S3 sync")
PY
else
  echo "[ec2-remote-pull-backend-docs] ERROR: navigation.json missing after sync" >&2
  exit 1
fi

echo "[ec2-remote-pull-backend-docs] Backend container expects bind-mount ./docs:/app/docs (see backend/docker-compose.yml)"

if [ -f "$BACKEND_DIR/docker-compose.yml" ]; then
  (cd "$BACKEND_DIR" && docker compose up -d --no-deps backend) || echo "[warn] docker compose skipped"
fi
