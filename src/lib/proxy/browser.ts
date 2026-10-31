// Browser-side proxy connector for the landing page.
//
// The authenticated session cookie is httpOnly by design, so browser code
// must never try to read it. Every landing request goes through a
// same-origin Next route (/api/availability), which attaches server-side
// credentials where needed. There are no server-only imports in this file.
const AVAILABILITY_TIMEOUT_MS = 10_000;

// Every channel created by the realtime shim, so removeChannel() can stop
// all of them. Without this a channel outlives the component that made it.
const channels = new Set<unknown>();

export const proxyBrowser = {
  async rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> {
    try {
      switch (name) {
        case "get_day_busy": {
          const date = String(args?.p_date ?? "");
          // Use the Next API route to avoid CORS/localhost coupling and to
          // keep the proxy origin out of the browser bundle.
          const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(AVAILABILITY_TIMEOUT_MS),
          });
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

  // Realtime shim: the proxy has no browser websocket, so poll the
  // availability endpoint every 5s and fire the registered callbacks. The
  // UI components debounce + router.refresh(), so this is a drop-in.
  // Pauses while the tab is hidden so backgrounded visitors don't keep
  // hammering the proxy for the whole session.
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
          /* ignore one bad subscriber */
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
    // stop() tears down the timer and the visibility listener. It used to
    // be inline, and `unsubscribe()` returned an empty object -- so a
    // component that called the RETURNED unsubscribe (rather than the
    // channel's own) leaked a live 5s poller that kept calling its
    // callbacks forever.
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
    const ch = {
      on(_event: string, _cfg: unknown, cb: (payload: unknown) => void) {
        cbs.push(cb);
        return ch;
      },
      subscribe() {
        if (!timer && cbs.length > 0) {
          timer = setInterval(tick, 5000);
        }
        return { unsubscribe: stop };
      },
      unsubscribe: stop,
    };
    // Tracked so removeChannel can stop it. The old removeChannel was an
    // empty async no-op, so every channel a component created — and did
    // not unsubscribe from by the exact object identity it held — kept
    // polling for the life of the tab.
    channels.add(ch);
    return ch;
  },

  async removeChannel(channel?: unknown) {
    if (channel) {
      (channel as { unsubscribe?: () => void }).unsubscribe?.();
      channels.delete(channel);
      return;
    }
    // No argument: stop everything this module started.
    for (const ch of [...channels]) {
      (ch as { unsubscribe?: () => void }).unsubscribe?.();
    }
    channels.clear();
  },
};

// Shim for legacy imports — `createClient` from the old Supabase browser layer.
export function createClient() {
  return proxyBrowser;
}
