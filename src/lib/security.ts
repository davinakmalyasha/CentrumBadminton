/**
 * Same-origin check for authenticated state-changing route handlers.
 *
 * Server Actions already enforce an Origin check; custom POST/DELETE route
 * handlers need the equivalent. Requests without an Origin header are
 * allowed for non-browser callers (curl, uptime scripts) because they still
 * need the session token. Browsers send Origin on cross-site POST/DELETE.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const forwarded = request.headers.get("x-forwarded-host");
  const host =
    forwarded?.split(",")[0]?.trim() || request.headers.get("host")?.trim() || "";

  return host !== "" && originHost === host;
}
