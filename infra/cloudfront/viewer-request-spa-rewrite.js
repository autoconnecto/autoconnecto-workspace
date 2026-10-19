// CloudFront Function (runtime: cloudfront-js-2.0)
// Attached to viewer-request on the docs.autoconnecto.in distribution
// (E30AD6N6537JGX).
//
// VitePress publishes each page as a file: /about/faq.html.
// An extensionless request forwarded to the S3 REST origin has no
// matching key and returns 403. Files that already have an extension
// are left alone.
//
//   /                 -> unchanged (default root object)
//   /about/faq        -> /about/faq.html
//   /about/faq/       -> /about/faq.html
//   /about/faq.html   -> unchanged
//   /assets/x.js      -> unchanged
function handler(event) {
    var req = event.request;
    var uri = req.uri;

    if (uri === "/" || uri === "") {
        return req;
    }

    if (uri.endsWith("/")) {
        uri = uri.slice(0, -1);
    }

    var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
    if (lastSegment.indexOf(".") === -1) {
        req.uri = uri + ".html";
    }

    return req;
}
