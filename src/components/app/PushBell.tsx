"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
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
  const [err, setErr] = useState<string | null>(null);

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
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const rm = await removePushSubscription(sub.endpoint);
          if (!rm.error) await sub.unsubscribe();
        }
        setSubscribed(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setErr("Izin notifikasi ditolak di pengaturan browser.");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setErr("Langganan tidak valid, coba lagi.");
        return;
      }
      const res = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (res.error) {
        setErr(res.error);
        return;
      }
      setSubscribed(true);
    } catch (e) {
      console.error("push toggle failed:", e);
      setErr(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Notifikasi diblokir browser — cek pengaturan situs."
          : "Gagal mengaktifkan notifikasi, coba lagi."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <span
        title="Notifikasi tidak didukung di browser ini"
        className="rounded-lg px-1.5 py-1 opacity-30"
      >
        <Bell className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        title={
          err ?? (subscribed ? "Matikan notifikasi" : "Aktifkan notifikasi booking")
        }
        aria-label={
          err ?? (subscribed ? "Matikan notifikasi" : "Aktifkan notifikasi booking")
        }
        className={`rounded-lg p-2 transition ${
          err
            ? "text-red-500"
            : subscribed
              ? "text-emerald-600"
              : "text-navy-700/50 hover:text-navy-800"
        }`}
      >
        {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
      {err && (
        <span
          className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500"
          title={err}
          role="status"
        />
      )}
    </span>
  );
}
