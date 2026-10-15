// PWA push subscription flow (Phase 2): subscribe/unsubscribe this
// browser against the backend registry (POST/DELETE
// /v1/push/subscriptions), so due reminders can reach staff devices.
//
// Auth reuses the readable session cookie (same mechanism as
// lib/proxy/browser.ts): the backend resolves tenant + user from it.
// VAPID public key comes from NEXT_PUBLIC_VAPID_PUBLIC_KEY (set in the
// env sweep; without it the toggle hides itself).
//
// No "use client" here: pure helpers are imported by vitest (node).

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const SESSION_COOKIE = "proxy_session";

export type PushState = "unsupported" | "denied" | "off" | "on" | "working" | "unconfigured";

/** base64url → Uint8Array for PushManager.subscribe applicationServerKey. Pure; unit-tested. */
export function vapidKeyToUint8(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** ArrayBuffer (or null) → base64url for the backend shape. Pure; unit-tested. */
export function bufToB64url(buf: ArrayBuffer | null): string | null {
  if (!buf) return null;
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export interface BackendSubscription {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

/** Shape a PushSubscription for POST /v1/push/subscriptions. */
export function toBackendShape(sub: {
  endpoint: string;
  getKey: (name: "p256dh" | "auth") => ArrayBuffer | null;
}): BackendSubscription | null {
  const p256dh = bufToB64url(sub.getKey("p256dh"));
  const auth = bufToB64url(sub.getKey("auth"));
  if (!p256dh || !auth) return null;
  return { endpoint: sub.endpoint, p256dh, auth };
}

function sessionToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie
    .split("; ")
    .find((c) => c.startsWith(SESSION_COOKIE + "="));
  return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : undefined;
}

async function backend(path: string, init: RequestInit): Promise<Response> {
  const token = sessionToken();
  if (!token) throw new Error("no session — log in first");
  return fetch(`${PROXY_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": token,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

/** Current state for the toggle. Never throws. */
export async function getPushState(): Promise<PushState> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Request permission, subscribe, register server-side. Returns false with an alert-safe message on failure. */
export async function subscribePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!VAPID_PUBLIC_KEY) return { ok: false, message: "push belum dikonfigurasi" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, message: "izin notifikasi ditolak" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKeyToUint8(VAPID_PUBLIC_KEY),
  });
  const shape = toBackendShape(sub);
  if (!shape) return { ok: false, message: "gagal membaca kunci subscription" };
  const res = await backend("/v1/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(shape),
  });
  if (!res.ok) {
    // Server rejected it — drop the local subscription so state stays
    // consistent (subscribed-but-unknown would silently never deliver).
    await sub.unsubscribe().catch(() => {});
    return { ok: false, message: `server menolak (${res.status})` };
  }
  return { ok: true };
}

/** Remove server-side registration, then the local subscription. */
export async function unsubscribePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await backend(`/v1/push/subscriptions?endpoint=${encodeURIComponent(sub.endpoint)}`, {
        method: "DELETE",
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "gagal berhenti" };
  }
}
