#!/usr/bin/env bash
# Attach Response Headers Policy to the app.autoconnecto.in CloudFront distribution.
# Usage (from a machine with AWS admin/CloudFront rights):
#   bash infra/cloudfront/attach-app-security-headers.sh <DISTRIBUTION_ID>
set -euo pipefail
DIST_ID="${1:?distribution id required}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
POLICY_FILE="$ROOT/app-security-headers-policy.json"

echo "Creating or reusing response headers policy..."
POLICY_ID="$(aws cloudfront list-response-headers-policies --type custom \
  --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='autoconnecto-app-security-headers'].ResponseHeadersPolicy.Id | [0]" \
  --output text)"
if [[ -z "$POLICY_ID" || "$POLICY_ID" == "None" ]]; then
  POLICY_ID="$(aws cloudfront create-response-headers-policy \
    --response-headers-policy-config "file://${POLICY_FILE}" \
    --query 'ResponseHeadersPolicy.Id' --output text)"
  echo "Created policy $POLICY_ID"
else
  echo "Using existing policy $POLICY_ID"
fi

TMP="$(mktemp)"
aws cloudfront get-distribution-config --id "$DIST_ID" > "$TMP"
ETAG="$(jq -r '.ETag' "$TMP")"
jq --arg pid "$POLICY_ID" '
  .DistributionConfig
  | .DefaultCacheBehavior.ResponseHeadersPolicyId = $pid
' "$TMP" > "${TMP}.cfg"

aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config "file://${TMP}.cfg" >/dev/null
echo "Attached policy $POLICY_ID to distribution $DIST_ID. Wait for Deployed."
rm -f "$TMP" "${TMP}.cfg"
