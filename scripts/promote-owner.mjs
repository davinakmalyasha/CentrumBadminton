/** Promote owner@example.com → role 'owner'. Run: node --env-file=.env.local scripts/promote-owner.mjs */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 50 });
if (listErr) { console.error("LIST_FAILED:", listErr.message); process.exit(1); }

const u = users.users.find((x) => x.email === "owner@example.com");
if (!u) { console.error("USER_NOT_FOUND"); process.exit(1); }

const { error } = await admin.from("profiles").update({ role: "owner" }).eq("id", u.id);
if (error) { console.error("PROMOTE_FAILED:", error.message); process.exit(1); }
console.log("PROMOTED", u.id);
