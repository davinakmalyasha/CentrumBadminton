// Browser-side proxy connector (landing availability + realtime
// shims). Reads the session/client token from readable cookies and
// sends them as headers. No server-only imports.
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";
const SESSION_COOKIE = "proxy_session";
const CLIENT_COOKIE = "proxy_client_token";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : undefined;
}

async function browserFetch<T>(path: string, init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> }): Promise<T> {
  let url = PROXY_URL + path;
  if (init?.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== "") qs.set(k, v);
    }
    const s = qs.toString();
    if (s) url += "?" + s;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const session = getCookie(SESSION_COOKIE);
  const client = getCookie(CLIENT_COOKIE);
  if (session) headers["X-Session-Token"] = session;
  else if (client) headers["X-Client-Token"] = client;

  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const proxyBrowser = {
  async rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> {
    try {
      switch (name) {
        case "get_day_busy": {
          const date = String(args?.p_date ?? "");
          // Use Next API route to avoid CORS/localhost and proxy downtime — always 200 with fallback
          const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const avail = (await res.json()) as {
            facilities: Array<{
              facility_id: string;
              name: string;
              busy: Array<{ start: string; end: string; kind: string }>;
            }>;
            degraded?: boolean;
          };
          // Backend down: the route returns 200-empty flagged degraded.
          // Surface it as an error so the board warns instead of
          // painting fake all-green slots.
          if (avail.degraded) {
            return { data: [], error: new Error("availability degraded — backend unreachable") };
          }
          const out: Array<Record<string, unknown>> = [];
          for (const f of avail.facilities ?? []) {
            for (const b of f.busy ?? []) {
              out.push({
                court_id: f.facility_id,
                court_name: f.name,
                start_time: b.start,
                end_time: b.end,
                kind: b.kind,
              });
            }
          }
          return { data: out, error: null };
        }
        default:
          return { data: null, error: new Error(`RPC ${name} not implemented in browser connector`) };
      }
    } catch (e) {
      return { data: null, error: e as Error };
    }
  },

  // Realtime shim: no websocket in the proxy — poll the availability
  // endpoint every 5s and fire the registered callback. The UI
  // components debounce + router.refresh(), so this is a drop-in.
  // Pauses while the tab is hidden so backgrounded visitors don't keep
  // hammering the proxy every 5s for the whole session.
  channel(_name: string) {
    const cbs: Array<(payload: unknown) => void> = [];
    let timer: ReturnType<typeof setInterval> | null = null;
    let visible = true;
    const tick = () => {
      if (!visible || document.hidden) return;
      cbs.forEach((cb) => {
        try {
          cb({});
        } catch {
          /* ignore */
        }
      });
    };
    const onVis = () => {
      visible = !document.hidden;
    };
    if (typeof document !== "undefined") {
      visible = !document.hidden;
      document.addEventListener("visibilitychange", onVis);
    }
    return {
      on(_event: string, _cfg: unknown, cb: (payload: unknown) => void) {
        cbs.push(cb);
        return this;
      },
      subscribe() {
        if (!timer && cbs.length > 0) {
          timer = setInterval(tick, 5000);
        }
        return { unsubscribe: () => {} };
      },
      unsubscribe() {
        if (timer) clearInterval(timer);
        timer = null;
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVis);
        }
      },
    };
  },

  async removeChannel(_channel?: unknown) {},
};

// Shim for legacy imports — `createClient` from the old Supabase browser layer.
export function createClient() {
  return proxyBrowser;
}
