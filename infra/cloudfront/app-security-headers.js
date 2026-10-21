// CloudFront Function (runtime: cloudfront-js-2.0)
// Attach on viewer-response of app.autoconnecto.in (E21R9QJBLA5QZB).
// Free CloudFront pricing plans cannot use custom Response Headers Policies;
// this Function is the supported path (same pattern as www-security-headers).
function handler(event) {
    var res = event.response;
    var headers = res.headers;
    headers["strict-transport-security"] = { value: "max-age=31536000" };
    headers["x-content-type-options"] = { value: "nosniff" };
    headers["x-frame-options"] = { value: "DENY" };
    headers["referrer-policy"] = { value: "strict-origin-when-cross-origin" };
    headers["permissions-policy"] = { value: "camera=(), microphone=(), geolocation=()" };
    // connect-src includes wss: for Socket.IO realtime
    headers["content-security-policy"] = {
        value: "default-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; form-action 'self' https:; base-uri 'self'; frame-ancestors 'none'",
    };
    return res;
}
