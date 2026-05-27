// CloudFront Function (cloudfront-js-2.0)
// Next.js static export: routes are flat *.html (e.g. /pricing.html).
// Rewrites extensionless paths so S3 REST origins resolve correctly.
function handler(event) {
  var req = event.request;
  var uri = req.uri;

  if (uri.endsWith("/")) {
    req.uri = uri + "index.html";
    return req;
  }

  var last = uri.substring(uri.lastIndexOf("/") + 1);
  if (last.indexOf(".") === -1) {
    req.uri = uri + ".html";
  }

  return req;
}
