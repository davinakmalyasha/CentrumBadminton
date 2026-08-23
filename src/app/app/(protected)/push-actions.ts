"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type PushState = { error: string | null; ok?: boolean; state?: string };

/** Store (or refresh) this device's push subscription for the logged-in user. */
export async function savePushSubscription(
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
): Promise<PushState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Belum login." };

  const h = await headers();
  const ua = h.get("user-agent") ?? null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      user_agent: ua,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { error: `Gagal simpan langganan push: ${error.message}` };
  return { error: null, ok: true, state: "subscribed" };
}

/** Remove this device's subscription (e.g., user turned notifications off). */
export async function removePushSubscription(endpoint: string): Promise<PushState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Belum login." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", user.id);

  if (error) return { error: `Gagal hapus: ${error.message}` };
  return { error: null, ok: true, state: "unsubscribed" };
}
