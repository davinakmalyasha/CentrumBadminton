// Proxy connector — the thin client that talks to the AgentsProxy
// backend. Replaces Supabase. The UI is untouched; only the data
// layer points at the proxy.
//
// Environment:
//   NEXT_PUBLIC_PROXY_URL   e.g. http://localhost:8080 (or the deployed proxy)
//   NEXT_PUBLIC_TENANT_ID   the tenant slug, e.g. "centrum" (used for login)
//
// Two identities:
//   - staff:  X-Session-Token (from /v1/auth/login)
//   - client: X-Client-Token (full access; fallback for API/agent)
// The connector prefers the session token; falls back to the client
// token when set.
// The connector uses cookies() (server-only), but the module must NOT
// carry a top-level "server-only" import: the login PAGE (a client
// component) imports the signIn server action, and bundlers pull the
// action's module graph into the client boundary check. The server
// action itself enforces server context via cookies().
import { cookies } from "next/headers";
import { cache } from "react";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";

export const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";

const SESSION_COOKIE = "proxy_session";
const CLIENT_COOKIE = "proxy_client_token";

export class ProxyError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    // Map HTTP statuses to the Postgres error codes Centrum's UI
    // checks (e.g. 409 exclusion_violation → "23P01").
    if (status === 409) this.code = "23P01";
  }
}

async function getTokens(): Promise<{ session?: string; client?: string }> {
  const store = await cookies();
  return {
    session: store.get(SESSION_COOKIE)?.value,
    client: store.get(CLIENT_COOKIE)?.value,
  };
}

export async function setSession(token: string) {
  const store = await cookies();
  // NOT httpOnly: the browser connector (landing availability) reads
  // the same cookie to send X-Session-Token. SameSite=Lax + Secure in
  // prod mitigate XSS exfiltration; the token is a scoped session.
  store.set(SESSION_COOKIE, token, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Core fetch: attaches auth headers, JSON in/out, ProxyError on non-2xx. */
export async function proxyFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> }
): Promise<T> {
  const { session, client } = await getTokens();
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
      /* non-JSON error */
    }
    throw new ProxyError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const proxyAuth = {
  async signInWithPassword(creds: { email: string; password: string }): Promise<{
    error: ProxyError | null;
  }> {
    try {
      const res = await fetch(`${PROXY_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: TENANT_ID, email: creds.email, password: creds.password }),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new ProxyError("Email atau kata sandi salah.", res.status);
      }
      const data = await res.json();
      await setSession(data.token as string);
      return { error: null };
    } catch (e) {
      return { error: e as ProxyError };
    }
  },
  async signOut(): Promise<void> {
    await clearSession();
  },
  async getUser(): Promise<{ data: { user: { id: string; email: string; role?: string } | null } }> {
    return cachedGetUser();
  },
};

// React cache(): within one server request the layout, page guard and
// page body all resolve the session; without memoization each does its
// own /v1/auth/me round-trip (plus the role rpc does another). One
// cached call per request removes the duplicates.
const cachedGetUser = cache(async () => {
  try {
    const me = await proxyFetch<{ user: { id: string; email: string; role?: string } }>("/v1/auth/me");
    return { data: { user: me.user } };
  } catch (e) {
    const status = (e as ProxyError)?.status;
    if (status === 429) {
      // Rate limited — don't treat as logged out. Rethrow to let layout show retry instead of redirect.
      // eslint-disable-next-line no-console
      console.warn("[getUser] rate limited 429");
      throw e;
    }
    return { data: { user: null } };
  }
});

/** Current user id (used as created_by / recorded_by on the proxy). */
export async function currentUserId(): Promise<string | null> {
  const { data } = await proxyAuth.getUser();
  return data.user?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Generic query builder (subset of the Supabase chain the UI uses)    */
/* ------------------------------------------------------------------ */

export type Filter = Record<string, string | number | boolean | null>;

export type QueryResult<T> = { data: T; error: ProxyError | null };

/**
 * Internal result of one request. Deliberately loose: the Supabase chain
 * this replaces returns different payloads for the same builder — rows
 * for a list select, one row for `.single()`, `{ created }` for a batch
 * insert, `null` for updates/deletes — so the payload cannot honestly be
 * typed as `T` here. Callers see `QueryResult<T>`; `then()` reconciles the
 * two in a single documented cast.
 */
type LooseResult = { data: unknown; error: ProxyError | null };

export class QueryBuilder<T> implements PromiseLike<QueryResult<T>> {
  private path: string;
  private filters: Filter = {};
  private orderCol?: string;
  private orderDesc = false;
  private limitN?: number;
  private singleMode = false;
  private writeOp?: { kind: "insert" | "update" | "delete"; row?: Record<string, unknown> };

  constructor(private table: string) {
    this.path = `/v1/sports/${table}`;
  }

  /** PromiseLike: makes `await supabase.from(...)` work. */
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    // Single boundary cast from the loose internal payload to the shape
    // callers code against (see LooseResult).
    return (this.execute() as Promise<QueryResult<T>>).then(onfulfilled, onrejected);
  }

  select(_cols = "*"): this {
    return this;
  }

  eq(col: string, val: string | number | boolean | null): this {
    if (val !== null) this.filters[col] = val;
    return this;
  }

  neq(col: string, val: string | number | boolean): this {
    this.filters[`${col}.neq`] = val;
    return this;
  }

  not(col: string, _op: string, val: string | number | boolean | null): this {
    this.filters[`${col}.neq`] = val as string;
    return this;
  }

  upsert(row: Record<string, unknown>, _opts?: unknown): this {
    this.writeOp = { kind: "insert", row };
    return this;
  }

  gte(col: string, val: string): this {
    this.filters[`${col}.gte`] = val;
    return this;
  }

  lt(col: string, val: string): this {
    this.filters[`${col}.lt`] = val;
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderDesc = opts?.ascending === false;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  maybeSingle(): Promise<QueryResult<T>> {
    this.singleMode = true;
    return this.execute() as Promise<QueryResult<T>>;
  }

  single(): Promise<QueryResult<T>> {
    this.singleMode = true;
    return this.execute() as Promise<QueryResult<T>>;
  }

  private async execute(): Promise<LooseResult> {
    // Push subscriptions: the proxy has no web-push infra (it's a
    // browser service-worker feature). Accept writes as a no-op so
    // the UI's "enable notifications" flow doesn't error.
    if (this.table === "push_subscriptions") {
      if (this.writeOp) return { data: null, error: null };
      return { data: [], error: null };
    }

    // If a write is pending, execute it instead of reading.
    if (this.writeOp) {
      const feature = this.pathFor();
      try {
        if (this.writeOp.kind === "insert") {
          const row = this.writeOp.row as unknown;
          // Batch insert: the proxy POST accepts one object — loop.
          if (Array.isArray(row)) {
            let created = 0;
            let firstErr: ProxyError | null = null;
            for (const r of row as Record<string, unknown>[]) {
              try {
                await proxyFetch<{ id: string }>(feature, {
                  method: "POST",
                  body: this.mapRow(this.table, r),
                });
                created++;
              } catch (e) {
                // Overlap (409): skip that week, continue (Centrum's
                // fallback semantics).
                if (!firstErr) firstErr = e as ProxyError;
              }
            }
            if (firstErr && created === 0) return { data: null, error: firstErr };
            return { data: { created }, error: null };
          }
          // Collection POST: proxy matches with and without trailing slash.
          const created = await proxyFetch<{ id: string }>(feature, {
            method: "POST",
            body: this.mapRow(this.table, this.writeOp.row ?? {}),
          });
          return { data: (created as unknown as T) ?? null, error: null };
        }
        const id = this.filters["id"] as string | undefined;
        if (!id) return { data: null, error: new ProxyError("write needs id filter", 400) };
        if (this.writeOp.kind === "update") {
          await proxyFetch(`${feature}/${id}`, {
            method: "PATCH",
            body: this.mapRow(this.table, this.writeOp.row ?? {}),
          });
          return { data: null, error: null };
        }
        // delete
        await proxyFetch(`${feature}/${id}`, { method: "DELETE" });
        return { data: null, error: null };
      } catch (e) {
        return { data: null, error: e as ProxyError };
      }
    }

    const feature = this.tableMap()[this.table] ?? this.table;
    this.path = `/v1/sports/${feature}/`;

    const query: Record<string, string> = {};
    if (this.filters["date"] !== undefined) query.date = String(this.filters["date"]);
    if (this.filters["facility_id"] !== undefined)
      query.facility_id = String(this.filters["facility_id"]);
    if (this.filters["booking_date"] !== undefined)
      query.date = String(this.filters["booking_date"]);
    if (this.filters["booking_id"] !== undefined)
      query.booking_id = String(this.filters["booking_id"]);
    if (this.filters["court_id"] !== undefined)
      query.facility_id = String(this.filters["court_id"]);
    if (this.filters["block_date"] !== undefined) query.date = String(this.filters["block_date"]);
    if (this.filters["spent_at"] !== undefined) query.date = String(this.filters["spent_at"]);
    if (this.filters["is_active"] !== undefined) query.status = "active";
    if (this.filters["type"] !== undefined) query.type = String(this.filters["type"]);
    // Forward range/neq filters to proxy when supported; client-side fallback below also handles them
    for (const [k, v] of Object.entries(this.filters)) {
      if (k.includes(".gte") || k.includes(".lt") || k.includes(".neq")) {
        // Keep original key for client-side eval; also send as query for future proxy support
        query[k] = String(v);
      }
    }
    // Include raw gte/lt from direct calls (paid_at, created_at etc.) for proxy passthrough
    for (const [k, v] of Object.entries(this.filters)) {
      if (k.startsWith("paid_at") || k.startsWith("created_at") || k.startsWith("kantin_sales")) {
        if (v !== undefined && v !== "") query[k] = String(v);
      }
    }
    // Map range filters to the proxy's from/to params (payments/expenses/
    // kantin honor them server-side; the raw keys above stay as fallback).
    const gtePaid = this.filters["paid_at.gte"];
    const ltPaid = this.filters["paid_at.lt"];
    if (gtePaid !== undefined && gtePaid !== "") query.from = String(gtePaid).slice(0, 10);
    if (ltPaid !== undefined && ltPaid !== "") query.to = String(ltPaid).slice(0, 10);
    const gteKantin = this.filters["created_at.gte"];
    const ltKantin = this.filters["created_at.lt"];
    if (this.table === "kantin_sales") {
      if (gteKantin !== undefined && gteKantin !== "") query.from = String(gteKantin).slice(0, 10);
      if (ltKantin !== undefined && ltKantin !== "") query.to = String(ltKantin).slice(0, 10);
    }
    if (this.orderCol) query.order = this.orderCol + (this.orderDesc ? " desc" : "");
    if (this.limitN) query.limit = String(this.limitN);
    // Public landing reads go through without a session — proxy uses
    // ?tenant_id= to resolve. Authenticated reads ignore it.
    // Centrum is badminton-only — filter type, keep shared sports table for other tenants.
    if (this.table === "courts" || this.table === "pricing_rules") {
      query.tenant_id = TENANT_ID;
      if (!query.type) query.type = "badminton";
    }

    try {
      const body = await proxyFetch<{ items: T[] }>(this.path, { query });
      const items = (body.items ?? []) as Record<string, unknown>[];
      // Reshape proxy rows into the Supabase shapes the UI expects
      // (e.g. facility_name → courts: { name }, price → computed_price).
      const shaped = items.map((row) => shapeRow(this.table, row));
      // Apply client-side filters the proxy doesn't understand (including gte/lt/neq)
      const filtered = shaped.filter((it) => {
        for (const [k, v] of Object.entries(this.filters)) {
          if (k.endsWith(".neq")) {
            const col = k.slice(0, -4);
            if (String(it[col] ?? "") === String(v)) return false;
            continue;
          }
          if (k.endsWith(".gte")) {
            const col = k.slice(0, -4);
            // paid_at/created_at ranges are authoritative server-side
            // (WIB-day from/to); a client string-compare across zones
            // would wrongly drop rows near midnight.
            if (col.startsWith("paid_at") || col.startsWith("created_at")) continue;
            if (String(it[col] ?? "") < String(v)) return false;
            continue;
          }
          if (k.endsWith(".lt")) {
            const col = k.slice(0, -3);
            if (col.startsWith("paid_at") || col.startsWith("created_at")) continue;
            if (String(it[col] ?? "") >= String(v)) return false;
            continue;
          }
          if (k.includes(".")) {
            // Handle joined filters like kantin_sales.created_at.gte — extract leaf col
            const parts = k.split(".");
            const leaf = parts[parts.length - 2] ?? parts[parts.length - 1];
            // For gte/lt variants already handled above, this is fallback exact
            if (k.includes(".gte") || k.includes(".lt") || k.includes(".neq")) continue;
            if (String(it[leaf] ?? it[k] ?? "") !== String(v)) return false;
            continue;
          }
          if (it[k] !== v) return false;
        }
        return true;
      });
      // Client-side sort when the proxy doesn't order.
      let out = filtered;
      if (this.orderCol) {
        const dir = this.orderDesc ? -1 : 1;
        out = [...filtered].sort((a, b) => {
          const av = a[this.orderCol!];
          const bv = b[this.orderCol!];
          return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
        });
      }
      if (this.singleMode) {
        return { data: (out[0] ?? null) as T | null, error: null };
      }
      return { data: out as T[], error: null };
    } catch (e) {
      if (this.singleMode) return { data: null as T | null, error: null };
      return { data: [] as T[], error: null };
    }
  }

  private tableMap(): Record<string, string> {
    return {
      bookings: "bookings",
      payments: "payments",
      customers: "customers",
      expenses: "expenses",
      court_blocks: "courtblocks",
      recurring_series: "series",
      courts: "facilities",
      kantin_products: "kantin/products",
      kantin_sales: "kantin/sales",
      kantin_sale_items: "kantin/sales", // proxy sales list doesn't expose items; client aggregates via sales total instead
      kantin_stock_movements: "kantin/products", // no separate movements list; stok page uses proxy fallback
      pricing_rules: "pricing",
      profiles: "users",
    };
  }

  insert(row: Record<string, unknown> | Record<string, unknown>[]): this {
    this.writeOp = { kind: "insert", row: row as Record<string, unknown> };
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.writeOp = { kind: "update", row: patch };
    return this;
  }

  delete(): this {
    this.writeOp = { kind: "delete" };
    return this;
  }

  private pathFor(): string {
    const tableMap: Record<string, string> = {
      bookings: "bookings",
      payments: "payments",
      customers: "customers",
      expenses: "expenses",
      court_blocks: "courtblocks",
      recurring_series: "series",
      courts: "facilities",
      kantin_products: "kantin/products",
      pricing_rules: "pricing",
      profiles: "users",
    };
    return `/v1/sports/${tableMap[this.table] ?? this.table}`;
  }

  /** Map Centrum column names → proxy field names. */
  private mapRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
    const m: Record<string, string> = {
      court_id: "facility_id",
      booking_date: "date",
      start_time: "start_time",
      end_time: "end_time",
      customer_name: "customer_name",
      customer_phone: "customer_phone",
      source: "source",
      status: "status",
      computed_price: "price",
      override_price: "override_price",
      notes: "notes",
      block_date: "block_date",
      reason: "reason",
      valid_from: "valid_from",
      open_time: "open_time",
      close_time: "close_time",
      day_start: "day_start",
      day_end: "day_end",
      price_day: "price_day",
      price_evening: "price_evening",
      is_active: "is_active",
      name: "name",
      category: "category",
      price: "price",
      cost_price: "cost_price",
      track_stock: "track_stock",
      stock: "stock",
      low_stock_threshold: "low_stock_threshold",
      sort_order: "sort_order",
      full_name: "full_name",
      email: "email",
      password: "password",
      role: "role",
    };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = m[k] ?? k;
      if (v === undefined) continue;
      out[key] = v;
    }
    if (table === "courts") {
      // Proxy facilities speak status/type; the UI speaks is_active.
      if ("is_active" in out) {
        out.status = out.is_active === false ? "paused" : "active";
        delete out.is_active;
      }
      // Centrum is badminton-only — proxy defaults to type=other which
      // vanishes from type=badminton reads.
      if (out.type === undefined) out.type = "badminton";
    }
    return out;
  }
}

/**
 * Entry point for the Supabase-style chain (`supabase.from("bookings")`).
 * The row type stays caller-supplied: pages read the payload straight off
 * `data` exactly as they did against Supabase, and narrow at the point of
 * use, so pinning a default here would be a lie about the wire format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function from<T = any>(table: string): QueryBuilder<T> {
  return new QueryBuilder<T>(table);
}

/** RPC shim — maps Centrum RPC names to proxy calls. */
export async function rpc<T = unknown>(
  name: string,
  args?: Record<string, unknown>
): Promise<{ data: T; error: ProxyError | null }> {
  // Single boundary cast from the loose internal payload (see LooseResult)
  // to the row type the caller asks for, e.g. rpc<PricingRule[]>.
  return (await rpcLoose(name, args)) as { data: T; error: ProxyError | null };
}

async function rpcLoose(
  name: string,
  args?: Record<string, unknown>
): Promise<LooseResult> {
  try {
    switch (name) {
            case "is_owner": {
        const me = await cachedGetUser();
        return { data: me.data.user?.role === "owner", error: null };
      }
      case "is_staff": {
        await cachedGetUser();
        return { data: true, error: null };
      }      case "get_pricing_for": {
        const date = String(args?.p_date ?? "");
        const rules = await proxyFetch<{ items: Array<Record<string, unknown>> }>(
          "/v1/sports/pricing/",
          { query: { tenant_id: TENANT_ID, type: "badminton" } }
        );
        // Find the latest rule valid on/before the date.
        const valid = (rules.items ?? []).filter(
          (r) => String(r.valid_from) <= date && r.is_active !== false
        );
        valid.sort((a, b) => String(a.valid_from).localeCompare(String(b.valid_from)));
        return { data: valid.slice(-1), error: null };
      }
      case "get_day_busy": {
        const date = String(args?.p_date ?? "");
        const avail = await proxyFetch<{
          facilities: Array<{
            facility_id: string;
            name: string;
            busy: Array<{ start: string; end: string; kind: string }>;
          }>;
        }>("/v1/sports/availability/", { query: { date, tenant_id: TENANT_ID, type: "badminton" } });
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
      case "top_customers": {
        const limit = Number(args?.p_limit ?? 10);
        const res = await proxyFetch<{ items: unknown[] }>("/v1/sports/customers/top", {
          query: { limit: String(limit) },
        });
        return { data: res.items, error: null };
      }
      case "bump_no_show":
        // Handled server-side by the bookings PATCH (status=no_show).
        return { data: null, error: null };
      case "record_kantin_sale": {
        // Legacy RPC → proxy REST: POST /v1/sports/kantin/sales
        const pSale = (args?.p_sale ?? {}) as Record<string, unknown>;
        const pItems = (args?.p_items ?? []) as Array<Record<string, unknown>>;
        const sale = await proxyFetch<{ id: string; total: number }>("/v1/sports/kantin/sales", {
          method: "POST",
          body: {
            method: (pSale.method as string) ?? "cash",
            customer_name: (pSale.customer_name as string) ?? "",
            note: (pSale.note as string) ?? "",
            booking_id: (pSale.booking_id as string) ?? "",
            items: pItems.map((it) => ({
              product_id: String(it.product_id ?? it.productId ?? ""),
              qty: Number(it.qty ?? 1),
            })),
          },
        });
        // Supabase RPC returned { sale_id, total }; proxy returns { id, total } — expose both
        return {
          data: { ...sale, id: sale.id, sale_id: sale.id, total: sale.total } as unknown,
          error: null,
        };
      }
      case "adjust_kantin_stock": {
        const pid = String(args?.p_product_id ?? args?.p_productId ?? "");
        const deltaRaw = Number(args?.p_delta ?? 0);
        const reason = String(args?.p_reason ?? "correction");
        const note = (args?.p_note as string | null) ?? undefined;
        // DB RPC applied sign by reason (waste = -); proxy expects signed delta
        const delta = reason === "waste" ? -Math.abs(deltaRaw) : Math.abs(deltaRaw);
        const res = await proxyFetch<{ stock: number; id: string }>("/v1/sports/kantin/products/" + pid + "/stock", {
          method: "POST",
          body: { delta, reason, note },
        });
        return { data: (res.stock ?? null) as unknown, error: null };
      }
      case "void_kantin_sale": {
        const sid = String(args?.p_sale_id ?? args?.p_saleId ?? "");
        await proxyFetch("/v1/sports/kantin/sales/" + sid + "/void", { method: "POST" });
        return { data: null, error: null };
      }
      case "customer_stats": {
        // Aggregated stats: visits + last_visit per customer
        try {
          const customers = await proxyFetch<{ items: Array<Record<string, unknown>> }>("/v1/sports/customers/");
          const items = customers.items ?? [];
          const rows = items.map((c) => ({
            customer_id: String(c.id ?? c.customer_id ?? ""),
            // keep map by both id and name for last_visit fallback
            _name: String(c.name ?? ""),
            visits: Number((c as Record<string, unknown>).visits ?? (c as Record<string, unknown>).visit_count ?? 0),
            last_visit: (c as Record<string, unknown>).last_visit ?? (c as Record<string, unknown>).lastVisit ?? null,
          })) as Array<Record<string, unknown> & { _name: string }>;
          // If visits are 0 (proxy older), fallback to top endpoint
          if (rows.every((r) => Number(r.visits) === 0) && rows.length > 0) {
            try {
              const top = await proxyFetch<{ items: Array<Record<string, unknown>> }>("/v1/sports/customers/top", {
                query: { limit: String(Math.min(rows.length, 200)) },
              });
              const byId = new Map<string, Record<string, unknown>>();
              for (const t of top.items ?? []) byId.set(String((t as Record<string, unknown>).id ?? ""), t as Record<string, unknown>);
              for (const r of rows) {
                const m = byId.get(String(r.customer_id));
                if (m) r.visits = Number((m as Record<string, unknown>).visits ?? r.visits);
              }
            } catch {
              /* ignore */
            }
          }
          // Compute last_visit from bookings when not provided by proxy
          const needLast = rows.some((r) => !r.last_visit);
          if (needLast) {
            try {
              // Fetch recent bookings (confirmed/checked_in/completed) to derive max date per customer
              const bookings = await proxyFetch<{ items: Array<Record<string, unknown>> }>("/v1/sports/bookings/", {
                query: { limit: "500" },
              });
              const byCustomerId = new Map<string, string>();
              const byName = new Map<string, string>();
              for (const b of bookings.items ?? []) {
                const cid = String((b as Record<string, unknown>).customer_id ?? "");
                const cname = String((b as Record<string, unknown>).customer_name ?? "");
                const date = String((b as Record<string, unknown>).date ?? (b as Record<string, unknown>).booking_date ?? "");
                if (!date) continue;
                if (cid) {
                  const cur = byCustomerId.get(cid);
                  if (!cur || date > cur) byCustomerId.set(cid, date);
                }
                if (cname) {
                  const cur = byName.get(cname);
                  if (!cur || date > cur) byName.set(cname, date);
                }
              }
              for (const r of rows) {
                if (!r.last_visit) {
                  r.last_visit = byCustomerId.get(String(r.customer_id)) ?? byName.get(String(r._name)) ?? null;
                }
                delete (r as Record<string, unknown>)._name;
              }
            } catch {
              for (const r of rows) delete (r as Record<string, unknown>)._name;
            }
          } else {
            for (const r of rows) delete (r as Record<string, unknown>)._name;
          }
          return { data: rows, error: null };
        } catch {
          return { data: [], error: null };
        }
      }
      default:
        return { data: null, error: new ProxyError(`RPC ${name} not implemented in proxy connector`, 400) };
    }
  } catch (e) {
    return { data: null, error: e as ProxyError };
  }
}

export const proxySupabase = {
  auth: proxyAuth,
  from,
  rpc,
  // Realtime: no websocket on the proxy — no-op channel (the browser
  // connector polls; server components render fresh on each request).
  channel() {
    return {
      on() {
        return this;
      },
      subscribe() {
        return { unsubscribe: () => {} };
      },
    };
  },
  async removeChannel(_channel?: unknown) {},
};

// Shim for legacy imports — `createClient` from the old Supabase layer.
// New code should import from "@/lib/proxy/client" directly.
// `supabase` variable name is kept across the codebase (e.g. `src/app/page.tsx:56`,
// `src/app/app/(protected)/actions.ts:12`) to avoid a massive rename churn;
// it now holds the proxy client (`proxySupabase`). Prefer `proxy` as the
// local name in new code: `const proxy = await createClient()`.
export async function createClient() {
  return proxySupabase;
}

// Preferred alias for new code — same impl, clearer name
export const createProxyClient = createClient;
export const createPushSubscriptionClient = createClient;

/* ------------------------------------------------------------------ */
/* Row reshaping: proxy field names → the Supabase shapes the UI reads  */
/* ------------------------------------------------------------------ */

function shapeRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  switch (table) {
    case "bookings": {
      const r: Record<string, unknown> = { ...row };
      // Proxy: facility_name → UI: courts: { name }
      if (r.facility_name !== undefined) {
        r.courts = { name: r.facility_name };
        delete r.facility_name;
      }
      // Proxy: date → UI: booking_date
      if (r.date !== undefined) {
        r.booking_date = r.date;
        delete r.date;
      }
      // Proxy: facility_id → UI: court_id
      if (r.facility_id !== undefined) {
        r.court_id = r.facility_id;
      }
      // Proxy: price → UI: computed_price
      if (r.price !== undefined && r.computed_price === undefined) {
        r.computed_price = r.price;
      }
      // Proxy: start_time/end_time are HH:MM → UI expects HH:MM
      return r;
    }
    case "court_blocks": {
      const r: Record<string, unknown> = { ...row };
      if (r.facility_id !== undefined) {
        r.court_id = r.facility_id === "" ? null : r.facility_id;
      }
      // Keep block_date for blokir/page.tsx:62; also expose canonical date
      if (r.block_date !== undefined && r.date === undefined) r.date = r.block_date;
      if (r.date !== undefined && r.block_date === undefined) r.block_date = r.date;
      return r;
    }
    case "recurring_series": {
      const r: Record<string, unknown> = { ...row };
      if (r.facility_id !== undefined) r.court_id = r.facility_id;
      return r;
    }
    case "courts": {
      const r: Record<string, unknown> = { ...row };
      if (r.status !== undefined) {
        r.is_active = r.status === "active";
      } else if (r.is_active !== undefined) {
        r.is_active = r.is_active !== false;
      }
      return r;
    }
    case "kantin_products": {
      const r: Record<string, unknown> = { ...row };
      if (r.is_active !== undefined) r.is_active = r.is_active !== false;
      return r;
    }
    case "payments": {
      const r: Record<string, unknown> = { ...row };
      if (r.booking_id !== undefined && r.bookings === undefined) {
        // UI joins bookings; leave the id for the page to resolve.
      }
      return r;
    }
    default:
      return { ...row };
  }
}
