/** Promote an auth user to role 'owner'.
 *  Run: node --env-file=.env.local scripts/promote-owner.mjs [email]
 *  Email defaults to OWNER_EMAIL env, then owner@centrum.dev. */
import { createClient } from "@supabase/supabase-js";

const targetEmail =
  process.argv[2] ?? process.env.OWNER_EMAIL ?? "owner@centrum.dev";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 50 });
if (listErr) { console.error("LIST_FAILED:", listErr.message); process.exit(1); }

const u = users.users.find((x) => x.email === targetEmail);
if (!u) { console.error("USER_NOT_FOUND:", targetEmail); process.exit(1); }

const { error } = await admin.from("profiles").update({ role: "owner" }).eq("id", u.id);
if (error) { console.error("PROMOTE_FAILED:", error.message); process.exit(1); }
console.log("PROMOTED", targetEmail, u.id);
