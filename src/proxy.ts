import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIX = "/app";
const LOGIN_PATH = "/app/login";
const SESSION_COOKIE = "proxy_session";

/**
 * Optimistic redirect gate for /app using the proxy session cookie.
 * Real role/is_active validation stays in (protected)/layout.tsx
 * (which calls /v1/auth/me). The session is validated there, not in
 * the middleware — this is just the fast pre-check.
 */
export async function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(APP_PREFIX) && pathname !== LOGIN_PATH && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  // Do NOT redirect LOGIN -> /app on hasSession. Stale/invalid cookies caused
  // infinite loop: login (hasSession true) -> /app -> layout 401 -> /app/login -> /app ...
  // Real validation lives in (protected)/layout.tsx which clears invalid cookies.
  // If session is valid, the login page's server action will setSession and redirect anyway.

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/app/:path*", "/app"],
};
