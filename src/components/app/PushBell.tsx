"use client";

import { useEffect, useState } from "react";
import {
  savePushSubscription,
  removePushSubscription,
} from "@/app/app/(protected)/push-actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushBell() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

    if (!ok) {
      void Promise.resolve().then(() => setSupported(false));
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => void Promise.resolve().then(() => setSupported(false)));
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      const res = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!res.error) setSubscribed(true);
    } catch {
      // ignore — button state stays as-is
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <span
        title="Notifikasi tidak didukung di browser ini"
        className="rounded-lg px-1.5 py-1 text-sm opacity-30"
      >
        🔔
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      title={subscribed ? "Matikan notifikasi" : "Aktifkan notifikasi booking"}
      className={`rounded-lg px-1.5 py-1 text-sm transition ${
        subscribed ? "text-emerald-600" : "text-navy-700/50 hover:text-navy-800"
      }`}
    >
      {subscribed ? "🔔" : "🔕"}
    </button>
  );
}
