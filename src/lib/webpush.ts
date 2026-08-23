import "server-only";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY
  );
}

/** Send a push to every stored subscription (except one profile if excluded). */
export async function sendPushToAll(payload: PushPayload, excludeProfileId?: string) {
  if (!configured()) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:owner@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const supabase = await createClient();
  const { data } = await supabase
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
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
  );
}

export function pushConfigured(): boolean {
  return configured();
}
