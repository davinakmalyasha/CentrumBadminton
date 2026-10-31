import type { NextConfig } from "next";

/**
 * Static security headers.
 *
 * CSP is not here: it contains a per-request nonce and is generated in
 * `src/proxy.ts`. Keeping the static headers in next.config means they also
 * apply to API routes and static assets, which the proxy matcher skips.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Isolate the app from cross-origin openers/windows. Maps embeds are
  // iframes (frame-src), not openers, so this does not affect them.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Only meaningful over HTTPS; harmless on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

// Authenticated HTML must never sit in a shared cache or be restored from
// bfcache with another user's data on a shared device.
const privateHeaders = [
  ...noIndexHeaders,
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // ExcelJS pulls in Node-only dependencies; keep it external instead of
  // asking Turbopack/webpack to bundle it into the server route.
  serverExternalPackages: ["exceljs"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/app/:path*", headers: privateHeaders },
      { source: "/app", headers: privateHeaders },
      { source: "/api/:path*", headers: noIndexHeaders },
    ];
  },
  // Legacy /favicon.ico lookup → generated PNG icon (internal rewrite,
  // no extra round-trip). Modern browsers use the metadata link instead.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon-32.png" }];
  },
};

export default nextConfig;
