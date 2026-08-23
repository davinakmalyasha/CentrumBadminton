/**
 * One-time local provisioning: creates the owner account via Supabase
 * admin API. Run with:  node --env-file=.env.local scripts/provision-owner.mjs
 * Never prints the service key; safe to delete after first run.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("MISSING_ENV");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = "owner@centrum.dev";
const password = "Centrum-Owner-2026!";

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Owner Centrum" },
});

if (error) {
  if (/already|registered/i.test(error.message)) {
    console.log("EXISTS");
  } else {
    console.error("CREATE_FAILED:", error.message);
    process.exit(1);
  }
} else {
  console.log("CREATED", data.user?.id);
}
