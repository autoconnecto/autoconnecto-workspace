#!/usr/bin/env bash
# Runs ON EC2 via SSH from GitHub Actions (docs workflow).
set -euo pipefail

DOCS="/home/ubuntu/autoconnecto/backend/docs/generated"
CACHE="/home/ubuntu/autoconnecto/backend/docs/cache"
BUCKET_URI="s3://autoconnecto-docs-site/backend-generated/"
REGION="${AWS_REGION:-ap-south-1}"
BACKEND_DIR="/home/ubuntu/autoconnecto/backend"

sudo mkdir -p "$DOCS" "$CACHE"
sudo chown -R ubuntu:ubuntu /home/ubuntu/autoconnecto/backend/docs

aws s3 sync "$BUCKET_URI" "$DOCS/" --delete --region "$REGION"
echo "[ec2-remote-pull-backend-docs] files under generated: $(find "$DOCS" -type f 2>/dev/null | wc -l)"

if [ -f "$BACKEND_DIR/docker-compose.yml" ]; then
  (cd "$BACKEND_DIR" && docker compose up -d --no-deps backend) || echo "[warn] docker compose skipped"
fi
