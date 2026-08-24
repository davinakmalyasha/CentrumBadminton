/**
 * One-time local provisioning: creates the owner account via Supabase
 * admin API. Run with:  node --env-file=.env.local scripts/provision-owner.mjs
 *
 * Credentials are NOT stored in this repo. The password is generated
 * randomly and printed ONCE — copy it immediately. Never commit it.
 * If this account already exists, the script exits without changes.
 */
import { randomBytes } from "node:crypto";
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

const email = process.argv[2] ?? "owner@centrum.dev";
const password = randomBytes(12).toString("base64url") + "!Aa1";

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Owner Centrum" },
});

if (error) {
  if (/already|registered/i.test(error.message)) {
    console.log("EXISTS — nothing done.");
  } else {
    console.error("CREATE_FAILED:", error.message);
    process.exit(1);
  }
} else {
  console.log("CREATED", data.user?.id);
  console.log("EMAIL:", email);
  console.log("PASSWORD (copy now, shown once):", password);
}
