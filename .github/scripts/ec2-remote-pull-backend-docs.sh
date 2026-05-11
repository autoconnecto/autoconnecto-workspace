#!/usr/bin/env bash
# Runs ON EC2 via SSH from GitHub Actions (docs workflow).
#
# IMPORTANT: Writes ONLY under ~/autoconnecto/artifacts/ — NOT under the backend
# Git checkout. Syncing generated markdown into docs/generated inside the repo
# caused git pull merges to fail (untracked vs tracked overlap).
#
# Mount this directory into the backend container at docs/generated (e.g.
# .../artifacts/backend-generated -> /app/docs/generated:ro).
#
# Override:
#   DOCS_ARTIFACT_ROOT  base dir (default: /home/ubuntu/autoconnecto/artifacts)
#
set -euo pipefail

ARTIFACT_ROOT="${DOCS_ARTIFACT_ROOT:-/home/ubuntu/autoconnecto/artifacts}"
DOCS="${ARTIFACT_ROOT}/backend-generated"
CACHE="/home/ubuntu/autoconnecto/backend/docs/cache"
BUCKET_URI="s3://autoconnecto-docs-site/backend-generated/"
REGION="${AWS_REGION:-ap-south-1}"
BACKEND_DIR="/home/ubuntu/autoconnecto/backend"

sudo mkdir -p "$DOCS" "$CACHE"
sudo chown -R ubuntu:ubuntu "$ARTIFACT_ROOT" "$CACHE"

aws s3 sync "$BUCKET_URI" "$DOCS/" --delete --region "$REGION"
echo "[ec2-remote-pull-backend-docs] S3 markdown -> ${DOCS} ($(find "$DOCS" -type f 2>/dev/null | wc -l) files)"
echo "[ec2-remote-pull-backend-docs] Backend container must bind-mount this path at docs/generated — see backend/ENVIRONMENT.md"

if [ -f "$BACKEND_DIR/docker-compose.yml" ]; then
  (cd "$BACKEND_DIR" && docker compose up -d --no-deps backend) || echo "[warn] docker compose skipped"
fi
