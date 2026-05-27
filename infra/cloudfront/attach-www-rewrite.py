#!/usr/bin/env python3
"""Attach www-static-rewrite to the marketing site CloudFront distribution."""
import json
import subprocess
import sys
import tempfile

DIST_ID = "E3UPPLM5N2GQ5Z"
FN_ARN = "arn:aws:cloudfront::813417990382:function/www-static-rewrite"


def main() -> int:
    raw = subprocess.check_output(
        ["aws", "cloudfront", "get-distribution-config", "--id", DIST_ID],
        text=True,
    )
    data = json.loads(raw)
    etag = data["ETag"]
    cfg = data["DistributionConfig"]

    current = (
        cfg.get("DefaultCacheBehavior", {})
        .get("FunctionAssociations", {})
        .get("Items", [])
    )
    for item in current:
        if (
            item.get("EventType") == "viewer-request"
            and item.get("FunctionARN") == FN_ARN
        ):
            print(f"Function already attached on {DIST_ID}")
            return 0

    cfg["DefaultCacheBehavior"]["FunctionAssociations"] = {
        "Quantity": 1,
        "Items": [{"FunctionARN": FN_ARN, "EventType": "viewer-request"}],
    }

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(cfg, f)
        path = f.name

    file_url = "file://" + path.replace("\\", "/")
    subprocess.check_call(
        [
            "aws",
            "cloudfront",
            "update-distribution",
            "--id",
            DIST_ID,
            "--if-match",
            etag,
            "--distribution-config",
            file_url,
        ]
    )
    print(f"Attached {FN_ARN} to {DIST_ID}. Wait 3-5 min for deploy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
