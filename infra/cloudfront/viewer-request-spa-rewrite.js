// CloudFront Function (runtime: cloudfront-js-2.0)
// Attached to viewer-request on the docs.autoconnecto.in distribution
// (E30AD6N6537JGX) so that VitePress's directory-style URLs resolve
// against the S3 REST origin.
//
// CloudFront's "Default Root Object" setting only applies at the bucket
// root. Without this function, /dashboards/, /api/, /devices/, etc. are
// forwarded verbatim to S3, which has no index-document concept on its
// REST endpoint and returns 403 AccessDenied. The fix is to rewrite the
// URI before it leaves the edge:
//
//   /            -> (CloudFront's default root object handles this)
//   /foo/        -> /foo/index.html
//   /foo/bar/    -> /foo/bar/index.html
//   /foo         -> /foo/index.html  (extensionless, treat as folder)
//   /foo.html    -> unchanged
//   /assets/x.js -> unchanged
//
// This is the canonical CloudFront+S3+VitePress (or Next/SPA-export)
// rewrite. It is idempotent: re-applying the same function is a no-op.
function handler(event) {
    var req = event.request;
    var uri = req.uri;

    if (uri.endsWith("/")) {
        req.uri = uri + "index.html";
        return req;
    }

    var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
    if (lastSegment.indexOf(".") === -1) {
        req.uri = uri + "/index.html";
    }

    return req;
}
