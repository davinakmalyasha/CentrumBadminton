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
import {
  assertProxyConfigured,
  CLIENT_COOKIE,
  PROXY_URL,
  SESSION_COOKIE,
  TENANT_ID,
} from "@/lib/env";

const DEFAULT_TIMEOUT_MS = 12_000;

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

/**
 * UI table name → AgentsProxy endpoint.
 *
 * The proxy groups these under /v1/sports. Keeping one map means a read
 * and a write for the same table can never drift to different endpoints.
 */
const TABLE_PATHS: Record<string, string> = {
  bookings: "bookings",
  payments: "payments",
  customers: "customers",
  expenses: "expenses",
  court_blocks: "courtblocks",
  recurring_series: "series",
  courts: "facilities",
  kantin_products: "kantin/products",
  kantin_sales: "kantin/sales",
  // The sales list does not expose items; the client aggregates from the
  // sale total instead.
  kantin_sale_items: "kantin/sales",
  // This used to point at "kantin/products" because no movements endpoint
  // existed, which made the stock page render PRODUCT rows as movements:
  // no delta, no reason, no note, and the product's creation date as the
  // movement time. It looked like plausible data, so the fabrication went
  // unnoticed. The ledger now has its own endpoint.
  kantin_stock_movements: "kantin/movements",
  pricing_rules: "pricing",
  profiles: "users",
};

async function getTokens(): Promise<{ session?: string; client?: string }> {
  const store = await cookies();
  return {
    session: store.get(SESSION_COOKIE)?.value,
    client: store.get(CLIENT_COOKIE)?.value,
  };
}

export async function setSession(token: string) {
  const store = await cookies();
  // httpOnly: the token is a bearer credential the proxy accepts
  // directly as X-Session-Token, scoped to the whole tenant at owner
  // level, for 30 days. It must not be reachable from document.cookie.
  //
  // This used to be deliberately not-httpOnly so the browser connector
  // (landing availability) could read the same cookie to send
  // X-Session-Token. That reader is gone: getCookie/browserFetch are
  // dead code and the one live browser path (get_day_busy) goes through
  // the same-origin /api/availability route, which never touches the
  // cookie. So the trade-off no longer buys anything.
  //
  // SameSite=Lax still lets a top-level GET from an external link
  // carry the cookie, which is the normal staff-link-in case; CSRF for
  // state changes is covered by the SameSite check plus the fact that
  // every write goes through a server action (POST).
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
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
  init?: {
    method?: string;
    body?: unknown;
    /**
     * A value may be an array to send the key REPEATEDLY
     * (`?status.neq=a&status.neq=b`) instead of joined with commas. The Go
     * proxy reads those with `for _, v := range q["status.neq"]`, so a
     * comma-joined string arrives as one literal value and fails
     * validation. Array form is the only shape the handlers understand.
     */
    query?: Record<string, string | string[] | undefined>;
    /** Per-call timeout. LLM-backed endpoints need more than the default. */
    timeoutMs?: number;
  }
): Promise<T> {
  assertProxyConfigured();
  const { session, client } = await getTokens();
  let url = PROXY_URL + path;
  if (init?.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item !== "") qs.append(k, item);
        }
      } else {
        qs.set(k, v);
      }
    }
    const s = qs.toString();
    if (s) url += "?" + s;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session) headers["X-Session-Token"] = session;
  else if (client) headers["X-Client-Token"] = client;

  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new ProxyError("Server tidak merespons (timeout).", 504);
    }
    throw new ProxyError("Tidak dapat menghubungi server.", 0);
  }
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
    assertProxyConfigured();
    try {
      const res = await fetch(`${PROXY_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: TENANT_ID, email: creds.email, password: creds.password }),
        cache: "no-store",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new ProxyError("Email atau kata sandi salah.", res.status);
      }
      const data = (await res.json()) as { token?: unknown };
      if (typeof data.token !== "string" || data.token.length < 10) {
        throw new ProxyError("Respons login dari server tidak valid.", 502);
      }
      await setSession(data.token);
      return { error: null };
    } catch (e) {
      if (e instanceof ProxyError) return { error: e };
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
        return { error: new ProxyError("Server tidak merespons (timeout).", 504) };
      }
      return { error: new ProxyError("Tidak dapat menghubungi server.", 0) };
    }
  },
  async signOut(): Promise<void> {
    // Revoke server-side first. The proxy has POST /v1/auth/logout,
    // which DELETEs the session row; without calling it the token
    // stays valid for the full 30-day SessionTTL after the user
    // pressed "Keluar", which matters on a shared device where the
    // next person could restore the cookie from browser history.
    //
    // Best-effort: if the proxy is unreachable we still clear the local
    // cookie, and a stale-but-unused token is far better than a staff
    // member who cannot log out.
    try {
      const { session } = await getTokens();
      if (session) {
        await fetch(`${PROXY_URL}/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Token": session },
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });
      }
    } catch {
      // Proxy down or already expired - fall through to local clear.
    }
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
    // Only a definitive auth answer means "signed out". A timeout, a 5xx
    // or an unreachable backend must NOT clear the session: redirecting to
    // login during an outage looks like a logout and hides the real error.
    if (status === 401 || status === 403 || status === 404) {
      return { data: { user: null } };
    }
    if (status === 429) {
      console.warn("[getUser] rate limited 429");
    }
    throw e;
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

export type QueryResult<T> = {
  data: T;
  error: ProxyError | null;
  /**
   * True when the proxy reported hitting its row cap.
   *
   * A caller summing `data` has a partial total and no way to know it
   * from the type — `[]` is a legitimate empty result and the same
   * shape. Reports and exports check this.
   */
  truncated?: boolean;
};

/**
 * Internal result of one request. Deliberately loose: the Supabase chain
 * this replaces returns different payloads for the same builder — rows
 * for a list select, one row for `.single()`, `{ created }` for a batch
 * insert, `null` for updates/deletes — so the payload cannot honestly be
 * typed as `T` here. Callers see `QueryResult<T>`; `then()` reconciles the
 * two in a single documented cast.
 */
type LooseResult = { data: unknown; error: ProxyError | null; truncated?: boolean };

export class QueryBuilder<T> implements PromiseLike<QueryResult<T>> {
  private path: string;
  private filters: Filter = {};
  /** Column → excluded values. Emitted as repeated `<col>.neq` params. */
  private neqList: Record<string, (string | number | boolean)[]> = {};
  // Every order() call, in order, each with its direction. Supabase
  // accumulates; this used to keep only the last.
  private orderList: string[] = [];
  private limitN?: number;
  private singleMode = false;
  private strictSingle = false;
  /** True when the proxy reported hitting its row cap on the last read. */
  private listTruncated = false;
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

  /**
   * `status IN (...)`.
   *
   * The proxy takes a CSV status list (`?status=pending,confirmed`) and
   * DEFAULTS to `status=confirmed` when the param is absent. That
   * default is correct for a revenue list and wrong for a schedule
   * grid, so anything that needs more than confirmed has to say so.
   *
   * Before this existed, `eq("status", …)` was accepted and then
   * silently dropped on the floor (the query builder had no mapping for
   * it), so every read came back confirmed-only regardless of what the
   * caller asked for.
   */
  in(col: string, vals: readonly (string | number)[]): this {
    if (vals.length > 0) this.filters[col] = vals.map(String).join(",");
    return this;
  }

  neq(col: string, val: string | number | boolean): this {
    this.addNeq(col, val);
    return this;
  }

  not(col: string, _op: string, val: string | number | boolean | null): this {
    this.addNeq(col, val);
    return this;
  }

  /**
   * Accumulate exclusions per column.
   *
   * Two bugs lived here. First, this used to overwrite a single key, so
   * chaining two `.neq()` calls kept only the last — silently changing any
   * report that excluded two statuses at once. Second, the fix joined
   * them with a comma into one string, which is worse: the proxy reads
   * `?status.neq` with `for _, ex := range q["status.neq"]` and validates
   * EACH value against the status enum, so "cancelled,no_show" arrived as
   * one unknown literal and the request 400'd. The caller then got an
   * empty list back and every figure built from it — occupancy, peak
   * hours, "jadwal ke depan" — was permanently zero with no error shown.
   *
   * Kept in a dedicated list (not `filters`, which is scalar-typed) and
   * emitted as a repeated query key, which is what the handler expects.
   */
  private addNeq(col: string, val: string | number | boolean | null): void {
    if (val === null) return;
    const list = this.neqList[col] ?? [];
    if (!list.includes(val)) list.push(val);
    this.neqList[col] = list;
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
    // Supabase ACCUMULATES order clauses; this kept only the last, so
    // `.order("block_date").order("start_time")` silently sorted by
    // start_time alone and the rows interleaved across days. Ordering is a
    // list, and each call appends to it.
    const dir = opts?.ascending === false ? " desc" : " asc";
    this.orderList.push(col + dir);
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  /**
   * `.maybeSingle()` — exactly one row, or null. More than one is an
   * error, because "which one?" has no safe answer.
   *
   * Supabase's two methods are distinct and both were implemented as the
   * same thing here: `.single()` returned `rows[0] ?? null` with no
   * complaint. A caller that relied on `.single()` erroring when the row
   * was missing got `null` instead and carried on — and a caller that
   * relied on it erroring when the filter matched too much got whichever
   * row happened to come first. `.single()` is the strict form; see
   * `strictSingle`.
   */
  maybeSingle(): Promise<QueryResult<T>> {
    this.singleMode = true;
    this.strictSingle = false;
    return this.execute() as Promise<QueryResult<T>>;
  }

  /** `.single()` — exactly one row, or an error. */
  single(): Promise<QueryResult<T>> {
    this.singleMode = true;
    this.strictSingle = true;
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
          // Return the proxy's confirmation so `.update(...).select(...)`
          // callers can tell success from "row not found". The proxy
          // answers 404 for a missing row and validates the status
          // transition server-side, so a rejected update surfaces as
          // `error` here and a successful one as a 1-element array.
          //
          // Returning `data: null` (as this used to) made every caller
          // that checks `!data || data.length === 0` report failure
          // after a write that had already committed.
          const updated = await proxyFetch<Record<string, unknown>>(`${feature}/${id}`, {
            method: "PATCH",
            body: this.mapRow(this.table, this.writeOp.row ?? {}),
          });
          return { data: [updated] as unknown as T[], error: null };
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

    const query: Record<string, string | string[]> = {};
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
    if (this.filters["status"] !== undefined) query.status = String(this.filters["status"]);
    if (this.filters["id"] !== undefined) query.id = String(this.filters["id"]);
    if (this.filters["type"] !== undefined) query.type = String(this.filters["type"]);
    // recorded_by scopes payments and kantin sales to one staff member's
    // own rows. "me" is resolved to the session user by the proxy, so a
    // caller cannot pass somebody else's id to read their takings.
    if (this.filters["recorded_by"] !== undefined)
      query.recorded_by = String(this.filters["recorded_by"]);

    // `truncated` is the proxy's admission that it hit the row cap. It is
    // not a filter, so it must not become a query param.
    this.listTruncated = false;
    // Exclusions go out as REPEATED keys — see addNeq(). The handlers
    // validate each value, so a comma-joined string is rejected outright.
    for (const [col, values] of Object.entries(this.neqList)) {
      query[`${col}.neq`] = values.map(String);
    }
    // Forward range filters to proxy when supported; client-side fallback below also handles them
    for (const [k, v] of Object.entries(this.filters)) {
      if (k.endsWith(".gte") || k.endsWith(".lt")) {
        // Keep original key for client-side eval; also send as query for future proxy support
        query[k] = String(v);
      }
    }
    // Map range filters to the proxy's from/to params, which it honours
    // server-side. Only paid_at (payments) and created_at (kantin_sales)
    // were mapped before, so an expenses month range never reached the
    // proxy: it answered with the tenant's newest 500 expenses and the
    // month was applied afterwards in JS. Past that cap, every month
    // older than the newest 500 rows silently showed Rp0.
    const rangeTo = (col: string) => {
      const gte = this.filters[`${col}.gte`];
      const lt = this.filters[`${col}.lt`];
      if (gte !== undefined && gte !== "") query.from = String(gte).slice(0, 10);
      if (lt !== undefined && lt !== "") query.to = String(lt).slice(0, 10);
    };
    rangeTo("paid_at");
    if (this.table === "kantin_sales") rangeTo("created_at");
    if (this.table === "expenses") rangeTo("spent_at");
    // Bookings take a date RANGE (from inclusive / to exclusive). Without
    // this the range keys were shipped as ?booking_date.gte=…, which no
    // handler reads, so a "show me everything still unpaid" query came
    // back as the tenant's oldest 500 bookings and recent invoices were
    // invisible.
    if (this.table === "bookings") rangeTo("booking_date");
    if (this.orderList.length > 0) query.order = this.orderList.join(",");
    if (this.limitN) query.limit = String(this.limitN);
    // Public landing reads go through without a session — the proxy uses
    // ?tenant_id= to resolve. Authenticated reads ignore it.
    //
    // The tenant is the isolation boundary, so courts/pricing are pinned to
    // it. This used to ALSO pin `type=badminton`, which was a silent
    // invisibility trap: sports_facilities.type defaults to 'other', and
    // anything inserted without that column — a psql insert, a script, an
    // older row — matched no court on the dashboard, the schedule, the
    // booking form, the reports or the landing availability board, with no
    // error and no hint why. The handler filters by tenant alone when
    // `type` is absent (facilities/feature.go:175), which is both correct
    // for a single-venue arena and impossible to trip by accident.
    if (this.table === "courts" || this.table === "pricing_rules") {
      query.tenant_id = TENANT_ID;
    }

    try {
      const body = await proxyFetch<{ items: T[]; truncated?: boolean }>(this.path, { query });
      // The proxy reports hitting its row cap. Recorded here rather than
      // discarded so a caller can tell a complete list from a shortened
      // one — the difference between "Rp0 collected" and "Rp0 of the rows
      // we happened to fetch".
      this.listTruncated = body.truncated === true;
      const items = (body.items ?? []) as Record<string, unknown>[];
      // Reshape proxy rows into the Supabase shapes the UI expects
      // (e.g. facility_name → courts: { name }, price → computed_price).
      const shaped = items.map((row) => shapeRow(this.table, row));
      // Apply client-side filters the proxy doesn't understand (gte/lt/neq)
      const filtered = shaped.filter((it) => {
        for (const [k, v] of Object.entries(this.filters)) {
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
            if (k.includes(".gte") || k.includes(".lt")) continue;
            if (String(it[leaf] ?? it[k] ?? "") !== String(v)) return false;
            continue;
          }
          if (typeof v === "string" && v.includes(",")) {
            // CSV list (from .in()): membership, not equality. Without
            // this an `in("status", [...])` would compare the row's
            // status against the whole "a,b,c" string and match nothing.
            if (!v.split(",").includes(String(it[k] ?? ""))) return false;
            continue;
          }
          if (it[k] !== v) return false;
        }
        // Exclusions, from neqList (see addNeq). Handlers that validate
        // each value (bookings) reject the whole request on an unknown
        // literal, so keep this as a belt-and-braces client pass.
        for (const [col, values] of Object.entries(this.neqList)) {
          if (values.map(String).includes(String(it[col] ?? ""))) return false;
        }
        return true;
      });
      // Client-side sort when the proxy doesn't order. Applies every
      // clause in order, so `.order("block_date").order("start_time")`
      // sorts by date then time — previously only the last clause was
      // honoured, which is why blocked slots on different days interleaved.
      let out = filtered;
      if (this.orderList.length > 0) {
        const clauses = this.orderList.map((spec) => {
          const desc = spec.endsWith(" desc");
          return { col: spec.replace(/ (asc|desc)$/, ""), dir: desc ? -1 : 1 };
        });
        out = [...filtered].sort((a, b) => {
          for (const { col, dir } of clauses) {
            const av = a[col];
            const bv = b[col];
            // Compare numbers numerically. `localeCompare` on strings made
            // sort_order sort as 1, 10, 2 and — worse — re-sorted rows the
            // proxy had already ordered correctly by its own SQL.
            if (typeof av === "number" && typeof bv === "number") {
              const d = (av - bv) * dir;
              if (d !== 0) return d;
              continue;
            }
            if (av === bv) continue;
            if (av === null || av === undefined) return 1; // nulls last
            if (bv === null || bv === undefined) return -1;
            const d = String(av).localeCompare(String(bv)) * dir;
            if (d !== 0) return d;
          }
          return 0;
        });
      }
      if (this.singleMode) {
        // Distinguish "no row", "one row" and "too many". Collapsing all
        // three into rows[0] ?? null is what let a missing booking read as
        // a clean null instead of an error the caller could handle.
        if (out.length > 1) {
          return {
            data: null as T | null,
            error: new ProxyError(
              `Expected one row, got ${out.length}`,
              // 406, matching postgrest's "PGRST116" range.
              406
            ),
          };
        }
        if (out.length === 0) {
          if (this.strictSingle) {
            return { data: null as T | null, error: new ProxyError("No rows returned", 406) };
          }
          return { data: null as T | null, error: null };
        }
        return { data: out[0] as T, error: null };
      }
      return { data: out as T[], error: null, truncated: this.listTruncated };
    } catch (e) {
      // Report the failure instead of disguising it as "no rows".
      //
      // This used to return `{data: [], error: null}` for EVERY fault —
      // unreachable proxy, 401, 403, 500, timeout, malformed JSON — so an
      // outage rendered as a cheerful empty page on every screen and no
      // page could ever show a data-layer error. `error` is part of
      // QueryResult and callers are free to ignore it; pages now check it
      // and render a "data unavailable" state (see DataUnavailable).
      return {
        data: this.singleMode ? (null as T | null) : ([] as T[]),
        error: e instanceof ProxyError ? e : new ProxyError(String((e as Error)?.message ?? e), 0),
      };
    }
  }

  private tableMap(): Record<string, string> {
    return TABLE_PATHS;
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
    return `/v1/sports/${TABLE_PATHS[this.table] ?? this.table}`;
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
        try {
          const me = await cachedGetUser();
          return { data: me.data.user?.role === "owner", error: null };
        } catch {
          // Capability checks fail closed when the backend is unreachable;
          // the layout/route that needs a real answer surfaces its own error.
          return { data: false, error: null };
        }
      }
      case "is_staff": {
        // This was `await cachedGetUser(); return { data: true }` — the
        // session lookup was awaited and then thrown away, so the answer
        // was "yes" for everyone, including a signed-out browser. Any
        // gate built on it (the payment-ledger export) was therefore not
        // a gate at all.
        //
        // Test the role rather than the user object: /v1/auth/me can come
        // back without a `user` key at all, which surfaces as
        // `undefined` — and `undefined !== null` would have let a missing
        // user through a null check.
        try {
          const me = await cachedGetUser();
          const role = me.data.user?.role;
          return { data: role === "owner" || role === "pegawai", error: null };
        } catch {
          return { data: false, error: null };
        }
      }
      case "get_pricing_for": {
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
      const reason = String(args?.p_reason ?? "correction");
      const note = (args?.p_note as string | null) ?? undefined;
      const body: Record<string, unknown> = { reason, note };
      if (reason === "correction") {
        // "Stok opname" is a physical count: the operator counted N units,
        // so send that level and let the backend record the difference.
        // It used to send an ordinary additive delta, so counting 3 when
        // the system believed 20 produced 23 — and the stock page's
        // promise that "sistem menghitung selisihnya otomatis" was false.
        const count = Number(args?.p_count ?? args?.p_qty ?? args?.p_delta ?? 0);
        body.count = Math.max(0, Math.trunc(count));
      } else {
        const deltaRaw = Number(args?.p_delta ?? args?.p_qty ?? 0);
        // The DB RPC applied sign by reason (waste = -); the proxy expects
        // a signed delta.
        body.delta = reason === "waste" ? -Math.abs(deltaRaw) : Math.abs(deltaRaw);
      }
      const res = await proxyFetch<{ stock: number; id: string }>(
        "/v1/sports/kantin/products/" + pid + "/stock",
        { method: "POST", body }
      );
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
              // Ask for the bookings that can actually inform a "last
              // visit".
              //
              // This used to request `limit=500` and nothing else, which
              // hit two problems at once. The bookings list defaulted to
              // status=confirmed, so completed and checked_in bookings
              // never appeared; and with no date range it returned the
              // OLDEST 500 bookings in the tenant's history. So for any
              // customer whose recent activity was not in that page,
              // "terakhir" showed a stale old date or nothing at all —
              // while looking like a real answer.
              //
              // Now: every status that represents a visit, newest first,
              // and explicitly bounded to a recent window.
              const recent = new Date(Date.now() - 365 * 86_400_000)
                .toISOString()
                .slice(0, 10);
              const bookings = await proxyFetch<{
                items: Array<Record<string, unknown>>;
                truncated?: boolean;
              }>("/v1/sports/bookings/", {
                query: {
                  status: "confirmed,checked_in,completed,pending,no_show",
                  from: recent,
                  limit: "2000",
                },
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
        } catch (e) {
          // This outer catch used to return `{ data: [], error: null }`,
          // which is the exact failure the rest of this connector was
          // fixed to avoid: an unreachable proxy rendered the Pelanggan
          // screen as "nobody has any visits" instead of showing that the
          // numbers are unknown. Surface it.
          return {
            data: [],
            error:
              e instanceof ProxyError ? e : new ProxyError(String((e as Error)?.message ?? e), 0),
          };
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
