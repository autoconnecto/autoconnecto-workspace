# CloudFront infrastructure (docs.autoconnecto.in)

This folder owns the small, deterministic CloudFront tweaks needed to
serve the VitePress site that the `Docs — Public site` GitHub Actions
workflow uploads to S3.

## What is in here

| File | Purpose |
|---|---|
| `viewer-request-spa-rewrite.js` | CloudFront Function that rewrites `/foo/` → `/foo/index.html` so VitePress's directory URLs work with the secure S3 REST origin. |

## Why this is needed

The deploy step in `.github/workflows/public-docs-site.yml` runs
`vitepress build` and `aws s3 sync` to `s3://autoconnecto-docs-site/`.
VitePress emits files at e.g. `dashboards/index.html`, `api/index.html`.
CloudFront's *Default Root Object* setting only rewrites the bucket
root (`/` → `/index.html`); nested paths like `/dashboards/` are
forwarded verbatim to S3, and the REST endpoint returns `403
AccessDenied` for keys ending in `/`.

A viewer-request CloudFront Function fixes this without weakening the
origin (no need to switch to the public S3 website endpoint).

## One-time deploy (AWS CLI)

> Requires AWS CLI v2 with credentials that have
> `cloudfront:CreateFunction`, `cloudfront:PublishFunction`,
> `cloudfront:DescribeFunction`, `cloudfront:GetDistributionConfig`,
> and `cloudfront:UpdateDistribution` on the docs distribution.

```bash
DIST_ID=E30AD6N6537JGX
FN_NAME=docs-spa-rewrite

# 1) Create the function (one time)
aws cloudfront create-function \
  --name "$FN_NAME" \
  --function-config 'Comment="VitePress directory URL rewrite",Runtime=cloudfront-js-2.0' \
  --function-code "fileb://viewer-request-spa-rewrite.js"

# 2) Publish the DEVELOPMENT stage to LIVE. Capture the ETag.
DEV_ETAG=$(aws cloudfront describe-function --name "$FN_NAME" \
  --query 'ETag' --output text)
aws cloudfront publish-function --name "$FN_NAME" --if-match "$DEV_ETAG"

# 3) Capture the function's ARN (needed by UpdateDistribution).
FN_ARN=$(aws cloudfront describe-function --name "$FN_NAME" --stage LIVE \
  --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)
echo "FunctionARN=$FN_ARN"

# 4) Attach to the default-cache-behavior on viewer-request.
#    This is a read-modify-write of the whole distribution config.
aws cloudfront get-distribution-config --id "$DIST_ID" \
  --output json > /tmp/dist.json
ETAG=$(jq -r '.ETag' /tmp/dist.json)
jq --arg arn "$FN_ARN" '
  .DistributionConfig.DefaultCacheBehavior.FunctionAssociations = {
    Quantity: 1,
    Items: [{ FunctionARN: $arn, EventType: "viewer-request" }]
  } | .DistributionConfig
' /tmp/dist.json > /tmp/new-dist.json
aws cloudfront update-distribution --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/new-dist.json

# 5) Wait for the new config to deploy (~3-5 min), then invalidate.
aws cloudfront wait distribution-deployed --id "$DIST_ID"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*'
```

## Verify

```bash
# All four should now return 200 OK.
for p in / /dashboards/ /api/ /devices/; do
  printf '%-15s -> ' "$p"
  curl -s -o /dev/null -w '%{http_code}\n' "https://docs.autoconnecto.in$p"
done
```

## Rollback

Detach the function from the distribution (keeps the function around
in case we want to reattach later):

```bash
DIST_ID=E30AD6N6537JGX
aws cloudfront get-distribution-config --id "$DIST_ID" \
  --output json > /tmp/dist.json
ETAG=$(jq -r '.ETag' /tmp/dist.json)
jq '.DistributionConfig.DefaultCacheBehavior.FunctionAssociations =
      { Quantity: 0 } | .DistributionConfig' \
   /tmp/dist.json > /tmp/new-dist.json
aws cloudfront update-distribution --id "$DIST_ID" --if-match "$ETAG" \
  --distribution-config file:///tmp/new-dist.json
aws cloudfront wait distribution-deployed --id "$DIST_ID"
```

## When to redeploy

Only when this folder's `.js` source changes. Repeat steps 1-5 above,
substituting `update-function` for `create-function` on the second
and subsequent deploys:

```bash
FN_ETAG=$(aws cloudfront describe-function --name docs-spa-rewrite \
  --query 'ETag' --output text)
aws cloudfront update-function \
  --name docs-spa-rewrite \
  --if-match "$FN_ETAG" \
  --function-config 'Comment="VitePress directory URL rewrite",Runtime=cloudfront-js-2.0' \
  --function-code "fileb://viewer-request-spa-rewrite.js"
# then publish-function + update-distribution as in steps 2-4.
```
