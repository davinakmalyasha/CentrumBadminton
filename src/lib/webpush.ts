import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Send a push to every stored subscription (except one profile if excluded).
 *
 * Uses the service-role client because RLS (`subs_manage_own`) scopes
 * regular queries to the caller's own rows — with the anon/user client the
 * recipient list would always be empty after excluding the actor.
 * Requires SUPABASE_SERVICE_ROLE_KEY to be configured.
 */
export async function sendPushToAll(
  payload: PushPayload,
  excludeProfileId?: string
): Promise<void> {
  if (!configured()) return;

  const admin = createAdminClient();
  if (!admin) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:owner@centrumbadminton.id",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,keys,profile_id");

  const subs = (data ?? []) as Array<{
    id: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    profile_id: string;
  }>;

  await Promise.allSettled(
    subs
      .filter((s) => s.profile_id !== excludeProfileId)
      .map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            JSON.stringify(payload)
          );
        } catch (err) {
          // 404/410 = subscription expired → clean up
          const status =
            typeof err === "object" && err && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
  );
}
