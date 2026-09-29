import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The CSP ships enforced in production (script-src keeps 'unsafe-inline'
 * because Next's hydration bootstrap requires it; 'unsafe-eval' is dropped
 * outside dev where React refresh needs it). In development the policy runs
 * Report-Only so HMR/dev tooling never breaks. Known origins: AgentsProxy
 * + Google Maps embed + directions, wa.me navigations.
 */
const isProd = process.env.NODE_ENV === "production";

// Proxy URL host for landing data + authenticated app calls. Falls back
// to localhost for dev; allow any http(s) localhost variant and the
// configured proxy origin.
const proxyHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080").origin;
  } catch {
    return "http://localhost:8080";
  }
})();

const connectSrc = [
  "'self'",
  proxyHost,
  // Dev-only localhost fallbacks — not exposed in production CSP
  ...(isProd ? [] : ["http://localhost:8080", "http://127.0.0.1:8080"]),
].join(" ");

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Only meaningful over HTTPS; harmless on localhost
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  ...(isProd
    ? [{ key: "Content-Security-Policy", value: cspDirectives }]
    : [
        {
          key: "Content-Security-Policy-Report-Only",
          value: cspDirectives,
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Legacy /favicon.ico lookup → generated PNG icon (internal rewrite,
  // no extra round-trip). Modern browsers use the metadata link instead.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon-32.png" }];
  },
};

export default nextConfig;
