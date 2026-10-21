#!/usr/bin/env python3
"""
Attach app-security-headers CloudFront Function (viewer-response)
to distribution E21R9QJBLA5QZB.

Free CloudFront plans reject custom Response Headers Policies; use a
Function instead (matches www-security-headers on the marketing site).
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

DIST_ID = sys.argv[1] if len(sys.argv) > 1 else "E21R9QJBLA5QZB"
FN_NAME = "app-security-headers"
FN_FILE = Path(__file__).with_name("app-security-headers.js")
PROFILE = ["--profile", "admin"]


def aws_raw(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["aws", *PROFILE, *args],
        text=True,
        capture_output=True,
        check=False,
    )


def aws(*args: str) -> str:
    proc = aws_raw(*args)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr or proc.stdout or "aws failed\n")
        raise SystemExit(proc.returncode)
    return (proc.stdout or "").strip()


def ensure_function() -> str:
    desc = aws_raw("cloudfront", "describe-function", "--name", FN_NAME, "--stage", "DEVELOPMENT")
    if desc.returncode != 0:
        print(f"creating function {FN_NAME}")
        created = json.loads(
            aws(
                "cloudfront",
                "create-function",
                "--name",
                FN_NAME,
                "--function-config",
                "Comment=Security headers for app.autoconnecto.in,Runtime=cloudfront-js-2.0",
                "--function-code",
                f"fileb://{FN_FILE.as_posix()}",
                "--output",
                "json",
            )
        )
        etag = created["ETag"]
    else:
        meta = json.loads(desc.stdout)
        etag = meta["ETag"]
        print(f"updating function {FN_NAME}")
        updated = json.loads(
            aws(
                "cloudfront",
                "update-function",
                "--name",
                FN_NAME,
                "--if-match",
                etag,
                "--function-config",
                "Comment=Security headers for app.autoconnecto.in,Runtime=cloudfront-js-2.0",
                "--function-code",
                f"fileb://{FN_FILE.as_posix()}",
                "--output",
                "json",
            )
        )
        etag = updated["ETag"]

    published = json.loads(
        aws(
            "cloudfront",
            "publish-function",
            "--name",
            FN_NAME,
            "--if-match",
            etag,
            "--output",
            "json",
        )
    )
    arn = published["FunctionSummary"]["FunctionMetadata"]["FunctionARN"]
    print(f"published {arn}")
    return arn


def attach(arn: str) -> None:
    raw = json.loads(
        aws(
            "cloudfront",
            "get-distribution-config",
            "--id",
            DIST_ID,
            "--output",
            "json",
        )
    )
    etag = raw["ETag"]
    cfg = raw["DistributionConfig"]
    assoc = cfg["DefaultCacheBehavior"].setdefault(
        "FunctionAssociations", {"Quantity": 0, "Items": []}
    )
    items = list(assoc.get("Items") or [])
    already = any(
        i.get("EventType") == "viewer-response"
        and i.get("FunctionARN", "").endswith(f"/{FN_NAME}")
        for i in items
    )
    if already:
        # refresh ARN in place
        for i in items:
            if i.get("EventType") == "viewer-response" and FN_NAME in i.get(
                "FunctionARN", ""
            ):
                i["FunctionARN"] = arn
        print("viewer-response already attached; ARN refreshed")
    else:
        items.append({"EventType": "viewer-response", "FunctionARN": arn})
        print("attaching viewer-response function")
    assoc["Items"] = items
    assoc["Quantity"] = len(items)
    cfg["DefaultCacheBehavior"]["FunctionAssociations"] = assoc

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(cfg, fh)
        path = fh.name
    aws(
        "cloudfront",
        "update-distribution",
        "--id",
        DIST_ID,
        "--if-match",
        etag,
        "--distribution-config",
        f"file://{path}",
    )
    print(f"updated distribution {DIST_ID}")


def main() -> None:
    arn = ensure_function()
    attach(arn)


if __name__ == "__main__":
    main()
