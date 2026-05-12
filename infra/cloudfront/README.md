# CloudFront infrastructure (docs.autoconnecto.in)

This folder owns the edge config for `docs.autoconnecto.in`, applied
automatically by the `Docs — Public site` GitHub Actions workflow on
every run.

## Files

| File | Purpose |
|---|---|
| `viewer-request-spa-rewrite.js` | CloudFront Function: rewrites `/foo/` → `/foo/index.html` so VitePress directory URLs work over the secure S3 REST origin. |
| `deploy-spa-rewrite.sh` | Idempotent reconcile script (used by CI). Creates/updates the function and attaches it to distribution `E30AD6N6537JGX`. |

## How it runs in CI

`.github/workflows/public-docs-site.yml` runs `deploy-spa-rewrite.sh`
on every workflow execution, right before the CloudFront invalidation
step. Decision flow inside the script:

```
              ┌───────────────────────────┐
              │ list-functions preflight  │── fails → print IAM policy
              └────────────┬──────────────┘             & exit 1
                           │ ok
              ┌────────────▼──────────────┐
              │ describe-function LIVE    │
              └────────────┬──────────────┘
              not present  │   present
        ┌─────────────────┘   └─────────────────┐
        ▼                                        ▼
   create-function                       get-function LIVE
   publish-function                       │
        │                                  ▼
        │                          cmp -s with local source?
        │                                  │
        │                            no diff │   diff
        │                                  │   │
        │             ┌────────────────────┘   ▼
        │             │                update + publish
        │             │                        │
        ▼             ▼                        ▼
              describe-function LIVE → ARN
                          │
              get-distribution-config E30AD6N6537JGX
                          │
              already attached on viewer-request?
              ├── yes  → done (no-op fast path, ~2s)
              └── no   → update-distribution + wait → done
```

All AWS writes use `--if-match` ETags, so two concurrent CI runs cannot
corrupt the distribution. The `concurrency:` group at the top of the
workflow makes concurrent runs unlikely anyway.

## One-time IAM setup (required only the first time)

The CI IAM user behind `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
must have these CloudFront actions. The script's preflight prints the
exact JSON policy to attach if any are missing:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DocsSpaRewriteFunction",
    "Effect": "Allow",
    "Action": [
      "cloudfront:ListFunctions",
      "cloudfront:DescribeFunction",
      "cloudfront:GetFunction",
      "cloudfront:CreateFunction",
      "cloudfront:UpdateFunction",
      "cloudfront:PublishFunction",
      "cloudfront:GetDistributionConfig",
      "cloudfront:UpdateDistribution"
    ],
    "Resource": "*"
  }]
}
```

(The existing `cloudfront:CreateInvalidation` permission on the
distribution stays as it is. S3 sync permissions are unrelated.)

## Manual deploy / rollback

You should not need this once IAM is set up; CI keeps everything in
sync. Kept here for emergency operations.

```bash
# Run from this folder, with AWS CLI v2 and credentials configured.
cd infra/cloudfront
bash deploy-spa-rewrite.sh        # same script CI uses
```

To detach the function (rollback to pre-fix behaviour where
`/dashboards/` returns 403):

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

The function definition stays around (use `aws cloudfront
delete-function --name docs-spa-rewrite` if you want it fully gone)
so re-attaching later is a one-line CI run.

## Verifying the fix is live

```bash
for p in / /dashboards/ /api/ /devices/ /alarms/; do
  printf '%-15s -> ' "$p"
  curl -s -o /dev/null -w '%{http_code}\n' "https://docs.autoconnecto.in$p"
done
# expected: all 200
```
