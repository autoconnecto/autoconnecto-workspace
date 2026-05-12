#!/usr/bin/env bash
# Idempotent CloudFront Function deploy for docs.autoconnecto.in.
#
# Reconciles AWS state with this repo:
#   1. CloudFront Function `docs-spa-rewrite` exists in LIVE stage with
#      code matching infra/cloudfront/viewer-request-spa-rewrite.js.
#   2. Distribution E30AD6N6537JGX has that function attached on
#      default-cache-behavior viewer-request.
#
# Safe to run on every CI execution:
#   - No-op fast path (~2s) when both invariants already hold.
#   - Creates, updates, or attaches only what is actually drifted.
#   - All AWS writes are conditional (--if-match ETag) so concurrent
#     runs cannot corrupt the distribution.
#
# Required IAM (printed by the preflight failure path if missing):
#   cloudfront:ListFunctions
#   cloudfront:DescribeFunction
#   cloudfront:GetFunction
#   cloudfront:CreateFunction
#   cloudfront:UpdateFunction
#   cloudfront:PublishFunction
#   cloudfront:GetDistributionConfig
#   cloudfront:UpdateDistribution

set -euo pipefail

DIST_ID="${CF_DIST_ID:-E30AD6N6537JGX}"
FN_NAME="${CF_FN_NAME:-docs-spa-rewrite}"
FN_COMMENT="VitePress directory URL rewrite (managed by infra/cloudfront/deploy-spa-rewrite.sh)"
FN_RUNTIME="cloudfront-js-2.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FN_SOURCE="${SCRIPT_DIR}/viewer-request-spa-rewrite.js"

log()  { printf '[cf-deploy] %s\n' "$*"; }
fail() { printf '::error::[cf-deploy] %s\n' "$*" >&2; exit 1; }

[ -f "$FN_SOURCE" ] || fail "Function source not found at $FN_SOURCE"

log "Preflight: checking IAM has cloudfront:ListFunctions ..."
if ! aws cloudfront list-functions --max-items 1 >/dev/null 2>&1; then
    fail "CI IAM lacks CloudFront Function permissions. Attach this policy
to the IAM user/role behind AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY:

{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"DocsSpaRewriteFunction\",
    \"Effect\": \"Allow\",
    \"Action\": [
      \"cloudfront:ListFunctions\",
      \"cloudfront:DescribeFunction\",
      \"cloudfront:GetFunction\",
      \"cloudfront:CreateFunction\",
      \"cloudfront:UpdateFunction\",
      \"cloudfront:PublishFunction\",
      \"cloudfront:GetDistributionConfig\",
      \"cloudfront:UpdateDistribution\"
    ],
    \"Resource\": \"*\"
  }]
}"
fi

ensure_function_live() {
    if aws cloudfront describe-function --name "$FN_NAME" --stage LIVE >/dev/null 2>&1; then
        local tmp_live
        tmp_live="$(mktemp)"
        trap 'rm -f "$tmp_live"' RETURN
        aws cloudfront get-function --name "$FN_NAME" --stage LIVE "$tmp_live" >/dev/null
        if cmp -s "$tmp_live" "$FN_SOURCE"; then
            log "Function $FN_NAME LIVE matches local source. No update."
            return
        fi
        log "Function $FN_NAME source drift. Updating DEVELOPMENT stage ..."
        local dev_etag
        dev_etag="$(aws cloudfront describe-function --name "$FN_NAME" \
                       --query 'ETag' --output text)"
        aws cloudfront update-function \
            --name "$FN_NAME" \
            --if-match "$dev_etag" \
            --function-config "Comment=${FN_COMMENT},Runtime=${FN_RUNTIME}" \
            --function-code "fileb://${FN_SOURCE}" >/dev/null
        log "Publishing $FN_NAME to LIVE ..."
        local new_dev_etag
        new_dev_etag="$(aws cloudfront describe-function --name "$FN_NAME" \
                           --query 'ETag' --output text)"
        aws cloudfront publish-function --name "$FN_NAME" \
            --if-match "$new_dev_etag" >/dev/null
        return
    fi

    log "Function $FN_NAME does not exist. Creating ..."
    aws cloudfront create-function \
        --name "$FN_NAME" \
        --function-config "Comment=${FN_COMMENT},Runtime=${FN_RUNTIME}" \
        --function-code "fileb://${FN_SOURCE}" >/dev/null
    log "Publishing $FN_NAME to LIVE ..."
    local dev_etag
    dev_etag="$(aws cloudfront describe-function --name "$FN_NAME" \
                   --query 'ETag' --output text)"
    aws cloudfront publish-function --name "$FN_NAME" \
        --if-match "$dev_etag" >/dev/null
}

ensure_attached() {
    local function_arn
    function_arn="$(aws cloudfront describe-function --name "$FN_NAME" --stage LIVE \
                       --query 'FunctionSummary.FunctionMetadata.FunctionARN' \
                       --output text)"
    [ -n "$function_arn" ] && [ "$function_arn" != "None" ] \
        || fail "Could not resolve LIVE ARN of function $FN_NAME"
    log "LIVE function ARN: $function_arn"

    local cfg_file etag current_arn
    cfg_file="$(mktemp)"
    trap 'rm -f "$cfg_file"' RETURN
    aws cloudfront get-distribution-config --id "$DIST_ID" --output json > "$cfg_file"
    etag="$(jq -r '.ETag' "$cfg_file")"
    current_arn="$(jq -r '
        (.DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items // [])
        | map(select(.EventType=="viewer-request"))
        | (.[0].FunctionARN // "")
    ' "$cfg_file")"

    if [ "$current_arn" = "$function_arn" ]; then
        log "Function already attached to viewer-request on $DIST_ID. No distribution update."
        return
    fi

    log "Attaching function on viewer-request of distribution $DIST_ID ..."
    local new_cfg
    new_cfg="$(mktemp)"
    jq --arg arn "$function_arn" '
        .DistributionConfig.DefaultCacheBehavior.FunctionAssociations = {
            Quantity: 1,
            Items: [{ FunctionARN: $arn, EventType: "viewer-request" }]
        } | .DistributionConfig
    ' "$cfg_file" > "$new_cfg"

    aws cloudfront update-distribution \
        --id "$DIST_ID" \
        --if-match "$etag" \
        --distribution-config "file://${new_cfg}" >/dev/null

    log "Waiting for distribution $DIST_ID to redeploy (3-5 min) ..."
    aws cloudfront wait distribution-deployed --id "$DIST_ID"
    log "Distribution redeployed."
    rm -f "$new_cfg"
}

ensure_function_live
ensure_attached

log "OK. CloudFront Function $FN_NAME is LIVE and attached to $DIST_ID."
