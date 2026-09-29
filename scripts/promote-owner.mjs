/** Promote a user to role 'owner' via AgentsProxy.
 *  Run: node --env-file=.env.local scripts/promote-owner.mjs [email]
 *  Email defaults to OWNER_EMAIL env, then owner@example.com.
 *
 *  Requires: E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD (existing owner) or
 *  ADMIN credentials via PROXY. Falls back to direct DB via psql hint.
 */
const proxyUrl = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const tenantId = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";
const targetEmail = process.argv[2] ?? process.env.OWNER_EMAIL ?? "owner@example.com";
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? process.env.OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;

if (!ownerEmail || !ownerPassword) {
  console.error(
    "Missing owner credentials: set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD (owner login)\n" +
      "Or promote via psql:\n" +
      `  psql "$DATABASE_URL" -c "UPDATE sports_users SET role='owner' WHERE tenant_id='${tenantId}' AND email='${targetEmail}';"`
  );
  process.exit(1);
}

// login as owner
const loginRes = await fetch(`${proxyUrl}/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tenant_id: tenantId, email: ownerEmail, password: ownerPassword }),
});
const loginJson = await loginRes.json().catch(() => ({}));
if (!loginRes.ok || !loginJson.token) {
  console.error("OWNER_LOGIN_FAILED:", loginJson.error ?? loginRes.status);
  process.exit(1);
}
const token = loginJson.token;

// find user id via customers/users list — users endpoint is /v1/sports/users
// List users (proxy's sports_users) — use the users table via facilities? Actually users are via /v1/sports/users
// Fallback: query via proxy's customers? Safer to call PATCH directly if we know id via login /me search
// Try list users
let userId = null;
const listRes = await fetch(`${proxyUrl}/v1/sports/users/`, {
  headers: { "X-Session-Token": token },
});
if (listRes.ok) {
  const j = await listRes.json().catch(() => ({}));
  const items = j.items ?? j.data ?? [];
  const found = items.find((u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase());
  if (found) userId = found.id ?? found.ID;
}
if (!userId) {
  // Try get via /v1/auth/me if target is self
  if (targetEmail.toLowerCase() === ownerEmail.toLowerCase()) {
    const meRes = await fetch(`${proxyUrl}/v1/auth/me`, { headers: { "X-Session-Token": token } });
    const me = await meRes.json().catch(() => ({}));
    userId = me.user?.id ?? me.id;
  }
}
if (!userId) {
  console.error("USER_NOT_FOUND:", targetEmail, "(list /v1/sports/users returned 0 matches)");
  console.error(`Fallback psql: psql "$DATABASE_URL" -c "UPDATE sports_users SET role='owner' WHERE tenant_id='${tenantId}' AND email='${targetEmail}';"`);
  process.exit(1);
}

const patchRes = await fetch(`${proxyUrl}/v1/sports/users/${userId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", "X-Session-Token": token },
  body: JSON.stringify({ role: "owner" }),
});
const patchJson = await patchRes.json().catch(() => ({}));
if (!patchRes.ok) {
  console.error("PROMOTE_FAILED:", patchJson.error ?? patchRes.status);
  console.error(`Fallback psql: psql "$DATABASE_URL" -c "UPDATE sports_users SET role='owner' WHERE id='${userId}';"`);
  process.exit(1);
}
console.log("PROMOTED", targetEmail, userId);
