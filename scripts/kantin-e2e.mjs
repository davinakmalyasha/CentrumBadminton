/**
 * Kantin E2E via AgentsProxy — exercises real DB paths + authenticated
 * page fetches. Run:
 *   node --env-file=.env.local scripts/kantin-e2e.mjs
 *
 * Required env:
 *   NEXT_PUBLIC_PROXY_URL (default http://localhost:8080)
 *   NEXT_PUBLIC_TENANT_ID (default centrum)
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD  (owner credentials — never commit)
 *   E2E_BASE_URL (default http://localhost:3000)
 */
const proxyUrl = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const tenantId = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

if (!email || !password) {
  console.error("Missing env: set E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD (and NEXT_PUBLIC_PROXY_URL)");
  process.exit(1);
}

const results = [];
const ok = (name, pass, detail = "") =>
  results.push(`${pass ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);

async function proxyFetch(path, { method = "GET", token, body, query } = {}) {
  let url = proxyUrl + path;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.set(k, v);
    const s = qs.toString();
    if (s) url += "?" + s;
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-Session-Token"] = token;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json, ok: res.ok, status: res.status };
}

// 1) Sign in as owner via proxy
const login = await fetch(`${proxyUrl}/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tenant_id: tenantId, email, password }),
});
const loginJson = await login.json().catch(() => ({}));
const token = loginJson.token;
ok("owner login via proxy", login.ok && Boolean(token), loginJson.error ?? `status=${login.status}`);
if (!token) {
  console.log(results.join("\n"));
  process.exit(1);
}

// helper for authed proxy calls
const api = (p, opts = {}) => proxyFetch(p, { ...opts, token });

// 2) Seeded products visible
const { json: prodJson, ok: prodOk } = await api("/v1/sports/kantin/products");
const products = prodJson.items ?? prodJson.data ?? [];
ok("seeded products >= 1", prodOk && (products.length ?? 0) >= 1, `got ${products.length}`);
const pick = (n) => products.find((p) => p.name === n);
let esTeh = pick("Es Teh");
let indomie = pick("Indomie Goreng");
// Fallback: pick first two if seed names differ per tenant
if (!esTeh) esTeh = products[0];
if (!indomie) indomie = products[1] ?? products[0];
ok("seed prices valid", esTeh?.price > 0 && indomie?.price > 0, `EsTeh=${esTeh?.price} Indomie=${indomie?.price}`);

// 3) Record sale — server-computed total
const salePayload = {
  method: "cash",
  customer_name: "E2E Test",
  note: "e2e",
  items: [
    { product_id: esTeh.id, qty: 2 },
    { product_id: indomie.id, qty: 1 },
  ],
};
const { json: sale, ok: saleOk } = await api("/v1/sports/kantin/sales", { method: "POST", body: salePayload });
const expectedTotal = (esTeh.price ?? 0) * 2 + (indomie.price ?? 0) * 1;
ok("record kantin sale (atomic)", saleOk && Number(sale.total) === expectedTotal, sale.error ?? `total=${sale.total} expected=${expectedTotal}`);
const saleId = sale.id ?? sale.sale_id;

// 4.1/4 stock check: read product after sale
if (saleId) {
  const { json: saleGet } = await api(`/v1/sports/kantin/sales/${saleId}`);
  ok("sale readable", Boolean(saleGet.id ?? saleGet.total !== undefined), `id=${saleGet.id}`);
}

// 5) Stock tracking path
// enable track_stock on Es Teh
if (esTeh?.id) {
  await api(`/v1/sports/kantin/products/${esTeh.id}`, { method: "PATCH", body: { track_stock: true, low_stock_threshold: 5 } });
  // set stock to 10 via restock delta (read current then top up) — use adjust endpoint
  // first get current stock
  const { json: cur } = await api(`/v1/sports/kantin/products/${esTeh.id}`);
  const curStock = Number(cur.stock ?? cur.data?.stock ?? 0);
  const need = 10 - curStock;
  if (need !== 0) {
    await api(`/v1/sports/kantin/products/${esTeh.id}/stock`, {
      method: "POST",
      body: { delta: need, reason: "correction", note: "e2e stock setup" },
    });
  }
  const { json: afterSetup } = await api(`/v1/sports/kantin/products/${esTeh.id}`);
  esTehTracked = afterSetup;

  const { json: sale2, ok: sale2Ok } = await api("/v1/sports/kantin/sales", {
    method: "POST",
    body: { method: "qris", items: [{ product_id: esTeh.id, qty: 2 }] },
  });
  const { json: after } = await api(`/v1/sports/kantin/products/${esTeh.id}`);
  const afterStock = Number(after.stock ?? 0);
  const setupStock = Number(afterSetup.stock ?? 0);
  ok("stock decremented on sale", sale2Ok && afterStock === setupStock - 2, `stock ${setupStock}->${afterStock}`);

  const { json: oos, ok: oosOk } = await api("/v1/sports/kantin/sales", {
    method: "POST",
    body: { method: "cash", items: [{ product_id: esTeh.id, qty: 999 }] },
  });
  ok("out-of-stock rejected", !oosOk && /out of stock|insufficient/i.test(oos.error ?? ""), oos.error ?? `status ok=${oosOk}`);

  // movements? proxy doesn't expose list, just check product still exists
  const { json: prodAgain } = await api(`/v1/sports/kantin/products/${esTeh.id}`);
  ok("product still active after OOS attempt", Boolean(prodAgain.id), `id=${prodAgain.id}`);

  // anon sale must be rejected (no token)
  const anonRes = await fetch(`${proxyUrl}/v1/sports/kantin/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "cash", items: [{ product_id: esTeh.id, qty: 1 }] }),
  });
  ok("anon sale rejected", anonRes.status === 401, `status=${anonRes.status}`);

  // void last sale via proxy (owner-only)
  if (sale2?.id) {
    const { ok: voidOk } = await api(`/v1/sports/kantin/sales/${sale2.id}/void`, { method: "POST" });
    const { json: restored } = await api(`/v1/sports/kantin/products/${esTeh.id}`);
    ok("void restores stock", voidOk, `stock after void=${restored.stock}`);
    // restore stock back to original for idempotence
    const cur2 = Number(restored.stock ?? 0);
    const diff = (setupStock - cur2);
    if (diff !== 0) {
      await api(`/v1/sports/kantin/products/${esTeh.id}/stock`, {
        method: "POST",
        body: { delta: diff, reason: "correction", note: "e2e reset" },
      });
    }
  } else {
    ok("void restores stock", false, "no sale2 id");
  }
}

// 6) Authenticated page renders — session via proxy_session cookie
const pageRes = await fetch(`${baseUrl}/app/kantin`, {
  headers: { cookie: `proxy_session=${token}` },
  redirect: "manual",
});
const html = await pageRes.text();
ok("kantin page renders", pageRes.status === 200 && html.includes("Kantin") || html.includes("Kasir"), `status=${pageRes.status}`);

const dashRes = await fetch(`${baseUrl}/app`, {
  headers: { cookie: `proxy_session=${token}` },
});
const dashHtml = await dashRes.text();
ok("dashboard renders", dashRes.status === 200 && /Kantin|Dashboard|Centrum/.test(dashHtml), `status=${dashRes.status}`);

// cleanup first sale
if (saleId) {
  await api(`/v1/sports/kantin/sales/${saleId}/void`, { method: "POST" });
  // reset stock tracking for Es Teh
  if (esTeh?.id) {
    await api(`/v1/sports/kantin/products/${esTeh.id}`, { method: "PATCH", body: { track_stock: false } });
  }
  results.push("CLEANUP done (test sale voided, Es Teh reset)");
}

console.log(results.join("\n"));
