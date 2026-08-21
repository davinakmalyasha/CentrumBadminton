import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIX = "/app";
const LOGIN_PATH = "/app/login";

/**
 * Optimistic auth check only (cookie presence — no network/DB calls here).
 * Real session validation happens in src/app/app/(protected)/layout.tsx
 * via supabase.auth.getUser().
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = hasSessionCookie(request);

  if (pathname.startsWith(APP_PREFIX) && pathname !== LOGIN_PATH && !loggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  if (pathname === LOGIN_PATH && loggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/app"],
};
