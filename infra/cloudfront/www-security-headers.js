// CloudFront Function (runtime: cloudfront-js-2.0)
// Not attached. Attach on viewer-response of distribution E3UPPLM5N2GQ5Z
// when the site is next deployed.
//
// Static export headers() in next.config do not reach S3. Unknown keys
// still return the bucket's raw 403 until the distribution custom error
// response sends 403 and 404 to /404.html with response code 404.
function handler(event) {
    var res = event.response;
    var headers = res.headers;
    headers["strict-transport-security"] = { value: "max-age=31536000" };
    headers["x-content-type-options"] = { value: "nosniff" };
    headers["x-frame-options"] = { value: "DENY" };
    headers["referrer-policy"] = { value: "strict-origin-when-cross-origin" };
    headers["permissions-policy"] = { value: "camera=(), microphone=(), geolocation=()" };
    headers["content-security-policy"] = {
        value: "default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; form-action 'self' https: mailto:; base-uri 'self'; frame-ancestors 'none'",
    };
    return res;
}
