"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type PushState = { error: string | null; ok?: boolean; state?: string };

/** Only well-known Web Push services — the server POSTs to these URLs later. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "push.service.mozilla.com",
];

function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

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

  if (
    !isValidPushEndpoint(subscription.endpoint) ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth ||
    subscription.keys.p256dh.length > 256 ||
    subscription.keys.auth.length > 64
  ) {
    return { error: "Langganan push tidak valid." };
  }

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

export type DeviceInfo = {
  id: string;
  user_agent: string | null;
  created_at: string;
};

/** List this user's registered push devices (Pengaturan → Perangkat Saya). */
export async function listMyDevices(): Promise<DeviceInfo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("push_subscriptions")
    .select("id,user_agent,created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as DeviceInfo[];
}

/** Delete one of this user's registered devices by row id. */
export async function removeDeviceById(id: string): Promise<PushState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Belum login." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: `Gagal hapus: ${error.message}` };
  return { error: null, ok: true, state: "removed" };
}
