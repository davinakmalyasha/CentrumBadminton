# Security Policy

## Supported Versions

Only the `main` branch is supported. Deployments should track `main` and apply updates promptly.

## Reporting a Vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Include affected URL/route, reproduction steps, impact, and any suggested fix.

You can also use this direct link:

<https://github.com/davinakmalyasha/CentrumBadminton/security/advisories/new>

Reports are acknowledged as soon as possible. Please allow time for a fix before public disclosure.

## Scope

In scope:

- Authentication/session handling in this frontend (`proxy_session`, server actions, route guards)
- XSS, CSRF, open redirects, and injection in UI/API shims
- Exposure of secrets or personal data in the repository or build output
- Authorization bugs (owner/pegawai separation)
- Dependency vulnerabilities reachable from this app

Out of scope:

- The AgentsProxy backend itself (report it in the backend repository)
- Denial of service through volumetric traffic
- Findings that require a compromised device or browser extension

## Deployment Hardening Checklist

- [ ] Set `NEXT_PUBLIC_PROXY_URL` and `NEXT_PUBLIC_TENANT_ID` in the hosting environment. Never rely on the development localhost fallback.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS domain.
- [ ] Keep the session cookie `Secure`, `httpOnly`, and `SameSite=Lax` (the code does this automatically in production).
- [ ] Terminate TLS at the edge and keep HSTS enabled.
- [ ] Configure AgentsProxy CORS to allow only the frontend origin.
- [ ] Rotate owner/staff passwords and API keys on a schedule; use a password manager.
- [ ] Keep `LLM_API_KEY`, `ADMIN_API_KEY`, `DATABASE_URL`, `REDIS_URL`, and VAPID **private** keys only in the backend environment.
- [ ] Keep GitHub secret scanning + push protection, Dependabot alerts, and private vulnerability reporting enabled.
- [ ] Configure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or Vercel KV equivalents) for distributed rate limiting; without them the local fallback is per-instance.
- [ ] Keep nonce CSP, `__Host-` session cookie, and `Cache-Control: private, no-store` on `/app` enabled.
- [ ] Run `npm run check` and `npm audit --omit=dev` before each release.
- [ ] Monitor `GET /api/health` and alert when it returns `503`.

## Secret Handling

- `.env.local` is ignored and must never be committed.
- `NEXT_PUBLIC_*` values are public by definition. Do not put secrets in them.
- Ops scripts read credentials from the environment; do not hardcode them.
- If a secret is exposed, **rotate it first**, then remove it from history. Removing history alone does not revoke a leaked credential.

## Repository History Notice

On **2026-10-31** this repository's history was rewritten to remove accidentally committed credentials and Playwright test artifacts (which included a login form with a typed password).

If you cloned the repository before that date:

1. Delete your clone and re-clone, or reset hard to `origin/main`.
2. Treat any credential that ever appeared in the old history as compromised and rotate it.
3. Do not restore old branches or commits from local backups into this repository.

GitHub may retain unreachable objects for a period after a force-push. If you need an old object purged immediately, contact GitHub Support and reference the affected commit hashes.

## Dependency Notes

- `npm audit --omit=dev` reports **0 vulnerabilities** as of 2026-10-31.
- XLSX export uses `write-excel-file` (Node build) and `fflate`; ExcelJS was
  removed because its transitive dependencies carried moderate advisories.
- XLSX/CSV cells are guarded against formula injection, and export runs only
  on the server behind authentication and rate limiting.
- Dev-only tooling (ESLint/Vitest) may still report moderate advisories; it
  is not shipped to production. Re-check `npm audit` after dependency bumps.
