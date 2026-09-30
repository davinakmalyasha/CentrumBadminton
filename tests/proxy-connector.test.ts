// Proxy connector contract tests.
//
// WHY THIS FILE MATTERS MOST: the connector is the only place the Go
// proxy's wire contract is expressed on the frontend. If a backend
// migration renames a field or drops a query param, everything else in
// the app still type-checks and still builds — the only signal is a
// blank table at runtime. These tests are the tripwire.
//
// They are pure: `fetch` is stubbed, no DB, no network. They also pin
// the three bugs that made the dashboard wrong in ways nobody could see
// from the code alone:
//
//   1. `.update()` returned `data: null`, so every status change
//      reported failure AFTER the proxy had already committed it.
//   2. `status` was accepted as a filter and then dropped, so every
//      bookings read came back `confirmed`-only — hiding pending
//      bookings from the schedule and from the payment list.
//   3. chained `.neq()` overwrote itself, so excluding two statuses
//      silently excluded only the last.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, setSession, proxyAuth } from "@/lib/proxy/client";
import {
  ALL_BOOKING_STATUSES,
  MUTABLE_BOOKING_STATUSES,
  OCCUPIES_COURT,
  VISIBLE_ON_SCHEDULE,
} from "@/lib/booking-status";
import { cookieJar, resetCookieJar } from "./setup";

type Captured = { url: string; method: string; body?: string };

let captured: Captured[] = [];

/** Stub fetch, returning `body` as the JSON response and recording the call. */
function stubFetch(body: unknown, status = 200) {
  captured = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    captured.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function lastQuery(): URLSearchParams {
  return new URL(captured[0].url).searchParams;
}

beforeEach(() => {
  resetCookieJar();
  captured = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("query builder: status reaches the proxy", () => {
  it("sends an explicit status filter", async () => {
    stubFetch({ items: [] });
    const supabase = await createClient();
    await supabase.from("bookings").eq("date", "2026-09-30").eq("status", "pending");

    expect(lastQuery().get("status")).toBe("pending");
  });

  it("maps .in() to the proxy's CSV status param", async () => {
    stubFetch({ items: [] });
    const supabase = await createClient();
    await supabase.from("bookings").eq("date", "2026-09-30").in("status", VISIBLE_ON_SCHEDULE);

    expect(lastQuery().get("status")).toBe(VISIBLE_ON_SCHEDULE.join(","));
  });

  it("keeps the confirmed-only proxy default when no status is asked for", async () => {
    // The proxy defaults to status=confirmed. Omitting the param keeps
    // that behaviour for the call sites that rely on it, so this test
    // fails loudly if someone starts sending an implicit default.
    stubFetch({ items: [] });
    const supabase = await createClient();
    await supabase.from("bookings").eq("date", "2026-09-30");

    expect(lastQuery().has("status")).toBe(false);
  });

  it("sends a single-row lookup as ?id= instead of downloading the table", async () => {
    stubFetch({ items: [] });
    const supabase = await createClient();
    await supabase.from("bookings").eq("id", "b-123");

    expect(lastQuery().get("id")).toBe("b-123");
  });
});

describe("query builder: client-side filtering still holds", () => {
  it("treats a CSV status list as membership, not equality", async () => {
    // The server-side param does the work on the proxy, but the
    // connector also re-filters locally. If that pass compared
    // equality against "pending,confirmed" it would drop every row.
    const rows = [
      { id: "1", status: "pending" },
      { id: "2", status: "confirmed" },
      { id: "3", status: "cancelled" },
    ];
    stubFetch({ items: rows });

    const supabase = await createClient();
    const { data } = await supabase
      .from("bookings")
      .in("status", VISIBLE_ON_SCHEDULE)
      .order("start_time");

    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(["1", "2"]);
    expect(ids).not.toContain("3");
  });

  it("accumulates chained .neq() instead of keeping only the last", async () => {
    const rows = [
      { id: "1", status: "pending" },
      { id: "2", status: "cancelled" },
      { id: "3", status: "no_show" },
    ];
    stubFetch({ items: rows });

    const supabase = await createClient();
    const { data } = await supabase
      .from("bookings")
      .neq("status", "cancelled")
      .neq("status", "no_show");

    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(["1"]);
  });
});

describe("update returns the patched row", () => {
  it("returns a one-element array so .select() callers see success", async () => {
    stubFetch({ id: "b-123", status: "updated" });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", "b-123");

    expect(error).toBeNull();
    // Before the fix this was always null, so the caller's
    // `!updated || updated.length === 0` guard reported failure for a
    // write the proxy had already committed.
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(1);
  });

  it("surfaces the proxy's 404 as an error rather than a false success", async () => {
    stubFetch({ error: "not found" }, 404);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", "missing");

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("issues a PATCH to the single-resource path", async () => {
    stubFetch({ id: "b-9", status: "updated" });

    const supabase = await createClient();
    await supabase.from("bookings").update({ status: "completed" }).eq("id", "b-9");

    expect(captured[0].method).toBe("PATCH");
    expect(captured[0].url).toContain("/v1/sports/bookings/b-9");
  });
});

describe("session cookie", () => {
  it("is httpOnly, SameSite=Lax and scoped to /", async () => {
    await setSession("tok-abc");
    const stored = cookieJar().get("proxy_session");

    expect(stored?.value).toBe("tok-abc");
    // Not httpOnly meant any script in the origin could read a
    // 30-day, owner-level bearer token out of document.cookie.
    expect(stored?.opts?.httpOnly).toBe(true);
    expect(stored?.opts?.sameSite).toBe("lax");
    expect(stored?.opts?.path).toBe("/");
  });
});

describe("sign-out", () => {
  it("revokes the session server-side before clearing the cookie", async () => {
    await setSession("tok-abc");
    stubFetch({ status: "logged_out" });

    await proxyAuth.signOut();

    const logout = captured.find((c) => c.url.includes("/v1/auth/logout"));
    expect(logout, "signOut must call the proxy's revoke endpoint").toBeDefined();
    expect(logout?.method).toBe("POST");
    // Best-effort on failure, but when it succeeds it must be called.
    expect(cookieJar().has("proxy_session")).toBe(false);
  });

  it("still clears the cookie when the proxy is unreachable", async () => {
    await setSession("tok-abc");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await expect(proxyAuth.signOut()).resolves.toBeUndefined();
    expect(cookieJar().has("proxy_session")).toBe(false);
  });
});

describe("is_staff is a real check", () => {
  // The shim used to be `await cachedGetUser(); return { data: true }`:
  // the session was fetched and discarded, so every caller got "yes".
  // The payment-ledger export gated on this, which made the gate a
  // no-op. These tests pin the answer to the session that was resolved.
  it("is true for an owner session", async () => {
    stubFetch({ user: { id: "u1", email: "o@x.dev", role: "owner" } });
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_staff");
    expect(data).toBe(true);
  });

  it("is true for a pegawai session", async () => {
    stubFetch({ user: { id: "u2", email: "p@x.dev", role: "pegawai" } });
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_staff");
    expect(data).toBe(true);
  });

  it("is false when nobody is signed in", async () => {
    stubFetch({ user: null });
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_staff");
    expect(data).toBe(false);
  });

  it("is false when /v1/auth/me omits the user entirely", async () => {
    // cachedGetUser passes `me.user` straight through, so a body with no
    // `user` key yields undefined rather than null. A `user !== null`
    // guard would have let this through.
    stubFetch({});
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_staff");
    expect(data).toBe(false);
  });

  it("is false for an unknown role", async () => {
    stubFetch({ user: { id: "u3", email: "x@x.dev", role: "admin" } });
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_staff");
    expect(data).toBe(false);
  });

  it("is false when the proxy is unreachable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_staff");
    expect(data).toBe(false);
  });

  it("stays consistent with is_owner", async () => {
    stubFetch({ user: { id: "u1", email: "o@x.dev", role: "owner" } });
    const supabase = await createClient();
    const [owner, staff] = await Promise.all([
      supabase.rpc("is_owner"),
      supabase.rpc("is_staff"),
    ]);
    expect(owner.data).toBe(true);
    expect(staff.data).toBe(true);
  });
});

describe("booking status sets", () => {
  it("schedule view includes no_show but not cancelled", () => {
    // A cancelled slot is free again and must not paint the grid busy;
    // a no-show slot really was used and must stay visible.
    expect(VISIBLE_ON_SCHEDULE).toContain("no_show");
    expect(VISIBLE_ON_SCHEDULE).not.toContain("cancelled");
  });

  it("court occupancy excludes cancelled and no_show", () => {
    // Matches the DB exclusion constraint, which ignores those two so a
    // cancelled slot can be rebooked.
    expect(OCCUPIES_COURT).not.toContain("cancelled");
    expect(OCCUPIES_COURT).not.toContain("no_show");
  });

  it("mutable set covers every status a transition can start from", () => {
    for (const s of ["pending", "confirmed", "checked_in", "no_show"]) {
      expect(MUTABLE_BOOKING_STATUSES as readonly string[]).toContain(s);
    }
    // completed and cancelled are terminal.
    expect(MUTABLE_BOOKING_STATUSES as readonly string[]).not.toContain("completed");
    expect(MUTABLE_BOOKING_STATUSES as readonly string[]).not.toContain("cancelled");
  });

  it("ALL_BOOKING_STATUSES is a superset of every other set", () => {
    for (const set of [VISIBLE_ON_SCHEDULE, OCCUPIES_COURT, MUTABLE_BOOKING_STATUSES]) {
      for (const s of set) expect(ALL_BOOKING_STATUSES as readonly string[]).toContain(s);
    }
  });
});
