#!/usr/bin/env bash
# Runs ON EC2 via SSH from GitHub Actions (inapp-docs.yml) or operators.
#
# SAFE: never `--delete` into live docs against an unverified S3 prefix.
# Prefer backend/scripts/sync-generated-docs-from-s3.sh (stage + validate).
# This wrapper also refreshes docs/manual the same way.
#
# Overrides:
#   BACKEND_DIR         repo root on host (default: /home/ubuntu/autoconnecto/backend)
#   DOCS_GENERATED_DIR  host generated dir (default: $BACKEND_DIR/docs/generated)
#   DOCS_MANUAL_DIR     host manual dir (default: $BACKEND_DIR/docs/manual)
#
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/home/ubuntu/autoconnecto/backend}"
DOCS_GENERATED="${DOCS_GENERATED_DIR:-${BACKEND_DIR}/docs/generated}"
DOCS_MANUAL="${DOCS_MANUAL_DIR:-${BACKEND_DIR}/docs/manual}"
CACHE="${BACKEND_DIR}/docs/cache"
REGION="${AWS_REGION:-ap-south-1}"
S3_BUCKET="${S3_BUCKET:-autoconnecto-docs-site}"
MANUAL_URI="s3://${S3_BUCKET}/manual-inapp/"
MIN_SECTIONS="${DOCS_SYNC_MIN_SECTIONS:-1}"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "[ec2-remote-pull-backend-docs] ERROR: BACKEND_DIR not found: $BACKEND_DIR" >&2
  exit 1
fi

sudo mkdir -p "$DOCS_GENERATED" "$DOCS_MANUAL" "$CACHE"
sudo chown -R "$(id -un)":"$(id -gn)" "${BACKEND_DIR}/docs" 2>/dev/null \
  || sudo chown -R ubuntu:ubuntu "${BACKEND_DIR}/docs"

SAFE_SYNC="${BACKEND_DIR}/scripts/sync-generated-docs-from-s3.sh"
if [ -x "$SAFE_SYNC" ] || [ -f "$SAFE_SYNC" ]; then
  echo "[ec2-remote-pull-backend-docs] Using ${SAFE_SYNC}"
  # Restart once after both trees are updated.
  RESTART_BACKEND=0 BACKEND_DIR="$BACKEND_DIR" \
    DOCS_HOST_GENERATED_DIR="$DOCS_GENERATED" \
    bash "$SAFE_SYNC"
else
  echo "[ec2-remote-pull-backend-docs] WARN: safe sync script missing — staging generated docs inline" >&2
  STAGING="$(mktemp -d /tmp/autoconnecto-docs-staging.XXXXXX)"
  cleanup_gen() { rm -rf "$STAGING"; }
  trap cleanup_gen EXIT
  aws s3 sync "s3://${S3_BUCKET}/backend-generated/" "${STAGING}/" --region "$REGION"
  if [ ! -s "${STAGING}/navigation.json" ]; then
    echo "[ec2-remote-pull-backend-docs] ERROR: staging missing navigation.json — live docs untouched" >&2
    exit 1
  fi
  DOCS_GENERATED="$STAGING" MIN_SECTIONS="$MIN_SECTIONS" python3 - <<'PY'
import json, os, sys
path = os.path.join(os.environ["DOCS_GENERATED"], "navigation.json")
min_sections = int(os.environ.get("MIN_SECTIONS") or "1")
with open(path, encoding="utf-8") as f:
    n = len(json.load(f).get("sections") or [])
print(f"[ec2-remote-pull-backend-docs] navigation.json: {n} sections")
if n < min_sections:
    sys.exit(f"need >= {min_sections} sections, got {n}")
PY
  mkdir -p "$DOCS_GENERATED"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${STAGING}/" "${DOCS_GENERATED}/"
  else
    find "$DOCS_GENERATED" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "${STAGING}/." "${DOCS_GENERATED}/"
  fi
  trap - EXIT
  cleanup_gen
fi

# Manual in-app overlays (stage then replace; skip wipe if prefix empty).
MANUAL_STAGING="$(mktemp -d /tmp/autoconnecto-manual-staging.XXXXXX)"
cleanup_manual() { rm -rf "$MANUAL_STAGING"; }
trap cleanup_manual EXIT
aws s3 sync "$MANUAL_URI" "${MANUAL_STAGING}/" --region "$REGION" || true
MANUAL_COUNT="$(find "$MANUAL_STAGING" -type f 2>/dev/null | wc -l | tr -d ' ')"
if [ "${MANUAL_COUNT}" -gt 0 ]; then
  mkdir -p "$DOCS_MANUAL"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${MANUAL_STAGING}/" "${DOCS_MANUAL}/"
  else
    find "$DOCS_MANUAL" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "${MANUAL_STAGING}/." "${DOCS_MANUAL}/"
  fi
  echo "[ec2-remote-pull-backend-docs] S3 manual -> ${DOCS_MANUAL} (${MANUAL_COUNT} files)"
else
  echo "[ec2-remote-pull-backend-docs] manual-inapp empty — leaving ${DOCS_MANUAL} unchanged"
fi
trap - EXIT
cleanup_manual

echo "[ec2-remote-pull-backend-docs] Backend container expects bind-mount ./docs:/app/docs"

if [ -f "$BACKEND_DIR/docker-compose.yml" ]; then
  (cd "$BACKEND_DIR" && docker compose up -d --no-deps backend) \
    || echo "[ec2-remote-pull-backend-docs] WARN: docker compose skipped"
fi
