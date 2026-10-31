import { NextResponse, type NextRequest } from "next/server";
import {
  LEGACY_SESSION_COOKIE,
  PROXY_URL,
  SESSION_COOKIE,
} from "@/lib/env";

const APP_PREFIX = "/app";
const LOGIN_PATH = "/app/login";
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Per-request nonce so the CSP can drop 'unsafe-inline' from script-src.
 * Every page that uses this policy is dynamically rendered (landing + app),
 * which is what lets Next.js attach the nonce to its own scripts.
 *
 * style-src keeps 'unsafe-inline' because the app uses a handful of inline
 * style attributes (progress widths, timeline heights). Those are governed
 * by style-src and cannot be nonce'd.
 */
function contentSecurityPolicy(nonce: string): string {
  const connectSrc = [
    "'self'",
    PROXY_URL,
    ...(isProduction
      ? []
      : ["http://localhost:8080", "http://127.0.0.1:8080", "ws://localhost:3000"]),
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    // <style> elements require the nonce; dynamic style attributes
    // (progress widths, timeline heights) are explicitly allowed by
    // style-src-attr instead of opening all of style-src.
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-src https://www.google.com https://maps.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Optimistic redirect gate for /app using the proxy session cookie.
 * Real role/is_active validation stays in (protected)/layout.tsx
 * (which calls /v1/auth/me). The session is validated there, not in
 * the middleware — this is just the fast pre-check.
 *
 * Also generates the CSP nonce for every HTML route. API and static
 * asset routes are excluded by the matcher below.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next parses this request header to apply the nonce to framework scripts.
  requestHeaders.set("Content-Security-Policy", policy);

  const responseHeader = isProduction
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

  const { pathname } = request.nextUrl;
  // Accept the legacy cookie so a deploy does not sign everyone out; new
  // logins write the hardened __Host- cookie.
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value ??
      request.cookies.get(LEGACY_SESSION_COOKIE)?.value
  );

  if (pathname.startsWith(APP_PREFIX) && pathname !== LOGIN_PATH && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set(responseHeader, policy);
    return redirect;
  }

  // Do NOT redirect LOGIN -> /app on hasSession. Stale/invalid cookies caused
  // infinite loop: login (hasSession true) -> /app -> layout 401 -> /app/login -> /app ...
  // Real validation lives in (protected)/layout.tsx which clears invalid cookies.
  // If session is valid, the login page's server action will setSession and redirect anyway.

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(responseHeader, policy);
  return response;
}

export const config = {
  matcher: [
    // HTML routes only. Skip API, Next internals, and static metadata/assets.
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|apple-icon|icon-32.png).*)",
  ],
};
