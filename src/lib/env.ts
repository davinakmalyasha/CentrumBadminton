/**
 * Shared public configuration.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time,
 * so they must never hold a secret. Server-only settings (Google Places,
 * VAPID private key) stay in the deployment environment and are read where
 * they are used.
 *
 * The localhost fallback is deliberately development-only. A production
 * deploy without NEXT_PUBLIC_PROXY_URL should fail loudly at request time
 * instead of silently talking to localhost.
 */
const isProduction = process.env.NODE_ENV === "production";
const DEV_PROXY_URL = "http://localhost:8080";

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export const PROXY_URL =
  clean(process.env.NEXT_PUBLIC_PROXY_URL) || (isProduction ? "" : DEV_PROXY_URL);

const EXPECTED_PROXY_ORIGIN = clean(process.env.NEXT_PUBLIC_PROXY_EXPECTED_ORIGIN);

export const TENANT_ID = (process.env.NEXT_PUBLIC_TENANT_ID ?? "").trim() || "centrum";

/**
 * Tenant-scoped API prefix. Centrum is a project tenant and is reachable only
 * through its project router. The legacy /v1/sports alias has been removed.
 */
export const PROXY_PREFIX = "/v1/p/centrum";

/**
 * In production the session cookie uses the `__Host-` prefix, which forces
 * Secure + Path=/ and forbids a Domain attribute. Browsers then refuse to
 * let a subdomain overwrite it.
 *
 * The unprefixed name is kept as a fallback so existing staff sessions are
 * not silently logged out on deploy. New logins always write the prefixed
 * cookie.
 */
export const SESSION_COOKIE = isProduction ? "__Host-proxy_session" : "proxy_session";
export const LEGACY_SESSION_COOKIE = "proxy_session";
export const CLIENT_COOKIE = "proxy_client_token";

/** Throw a useful error instead of fetching a relative URL in production. */
export function assertProxyConfigured(): void {
  if (!PROXY_URL) {
    throw new Error(
      "NEXT_PUBLIC_PROXY_URL belum dikonfigurasi. Set variabel ini di environment deployment."
    );
  }
  if (EXPECTED_PROXY_ORIGIN) {
    let actual = "";
    try {
      actual = new URL(PROXY_URL).origin;
    } catch {
      throw new Error("NEXT_PUBLIC_PROXY_URL bukan URL yang valid.");
    }
    if (actual !== EXPECTED_PROXY_ORIGIN) {
      // A staging/preview backend copied into production would otherwise
      // serve the wrong tenant data without any visible failure.
      throw new Error(
        "NEXT_PUBLIC_PROXY_URL tidak cocok dengan origin produksi yang diharapkan."
      );
    }
  }
}
