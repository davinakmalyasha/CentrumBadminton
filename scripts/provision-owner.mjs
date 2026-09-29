/**
 * One-time provisioning: creates the owner account via AgentsProxy.
 * Run:  node --env-file=.env.local scripts/provision-owner.mjs [email] [password]
 *
 * If password omitted, a random one is generated and printed ONCE.
 * Requires: NEXT_PUBLIC_PROXY_URL + NEXT_PUBLIC_TENANT_ID.
 * The proxy's POST /v1/auth/register needs an owner session OR a client token.
 * For the very first owner (no owner exists), use the direct psql seed instead:
 *   psql "$DATABASE_URL" -c "INSERT INTO sports_users (tenant_id,email,password_hash,role,full_name) VALUES ('centrum','owner@...', crypt('pass', gen_salt('bf')), 'owner','Owner') ON CONFLICT DO NOTHING;"
 */
import { randomBytes } from "node:crypto";

const proxyUrl = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const tenantId = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";
const email = (process.argv[2] ?? "owner@centrum.dev").toLowerCase().trim();
let password = process.argv[3];
let generated = false;
if (!password) {
  password = randomBytes(12).toString("base64url") + "!Aa1";
  generated = true;
}

// Try register via proxy — needs owner session or client token if first owner
// Attempt unauthenticated register with X-Client-Token fallback not set — proxy will 401
// So we try register with no token; if 401, print psql fallback
const headers = { "Content-Type": "application/json" };
const clientToken = process.env.PROXY_CLIENT_TOKEN ?? process.env.CLIENT_TOKEN;
if (clientToken) headers["X-Client-Token"] = clientToken;
// also try owner session if provided
const ownerToken = process.env.OWNER_SESSION_TOKEN;
if (ownerToken) headers["X-Session-Token"] = ownerToken;

const res = await fetch(`${proxyUrl}/v1/auth/register`, {
  method: "POST",
  headers,
  body: JSON.stringify({ email, password, full_name: "Owner Centrum", role: "owner" }),
});
const json = await res.json().catch(() => ({}));

if (res.ok && json.user) {
  console.log("CREATED", json.user.id);
  console.log("EMAIL:", email);
  if (generated) console.log("PASSWORD (copy now, shown once):", password);
  else console.log("PASSWORD: (provided)");
} else if (res.status === 409 || /already|registered/i.test(json.error ?? "")) {
  console.log("EXISTS — nothing done.");
} else if (res.status === 401) {
  console.error("REGISTER_NEEDS_AUTH: first owner cannot be created via proxy without a client token or existing owner session.");
  console.error("Use psql seed instead:");
  console.error(`  psql "$DATABASE_URL" -c "INSERT INTO sports_users (tenant_id,email,password_hash,role,full_name) VALUES ('${tenantId}','${email}', crypt('${password}', gen_salt('bf')), 'owner','Owner') ON CONFLICT DO NOTHING;"`);
  if (generated) console.error("Generated password (save now):", password);
  process.exit(1);
} else {
  console.error("CREATE_FAILED:", json.error ?? `HTTP ${res.status}`);
  if (generated) console.error("Generated password (save now):", password);
  process.exit(1);
}
