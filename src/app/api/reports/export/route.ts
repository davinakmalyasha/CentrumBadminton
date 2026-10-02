import { NextResponse } from "next/server";
import { createClient, proxyFetch } from "@/lib/proxy/client";
import { monthEndExclusive, monthStart } from "@/lib/months";

/**
 * GET /api/reports/export?month=YYYY-MM[&type=kantin]
 * CSV/XLSX export of payments (or kantin sales) in the given month.
 * Owner exports the whole ledger; staff export only their own rows.
 * Backed by the proxy connector (was Supabase).
 */

const WIB_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const WIB_TIME = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

function esc(v: string | number | null | undefined): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Neutralise a leading formula character for the XLSX path.
 *
 * XLSX cells are formulas by default when they start with = + - @, and
 * Excel evaluates them on open. An apostrophe prefix is the standard
 * neutraliser; the cell is additionally typed as String below so the
 * character survives as visible text rather than being swallowed.
 *
 * A leading apostrophe that the user actually typed is left alone -- it
 * is already inert.
 */
function xlsxSafe(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function day(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : WIB_DAY.format(d);
}

function time(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : WIB_TIME.format(d);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Owner sees the whole ledger. Staff see only the money they actually
  // took — the "same tenant data (single tenant centrum)" comment that used
  // to sit here described a gate that was not one: is_staff returned true
  // for any signed-in browser, so any staff member could export every
  // payment in the tenant. The scope is pushed down to the proxy, which
  // resolves "me" to the session user server-side.
  const { data: isOwner } = await supabase.rpc("is_owner");
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (isOwner !== true && isStaff !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ownOnly = isOwner !== true;

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "kantin" ? "kantin" : "lapangan";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  // Support daily / monthly / yearly via ?from=&to= or legacy ?month= / ?year= / ?date=
  let from: string;
  let to: string;
  let label: string;
  const fromParam = url.searchParams.get("from") ?? "";
  const toParam = url.searchParams.get("to") ?? "";
  const dateParam = url.searchParams.get("date") ?? "";
  const yearParam = url.searchParams.get("year") ?? "";
  const monthParam = url.searchParams.get("month") ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    from = `${fromParam}T00:00:00+07:00`;
    to = `${toParam}T00:00:00+07:00`;
    label = `${fromParam}_to_${toParam}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const d = dateParam;
    const next = new Date(`${d}T00:00:00+07:00`);
    next.setDate(next.getDate() + 1);
    const iso = next.toISOString().slice(0, 10);
    from = `${d}T00:00:00+07:00`;
    to = `${iso}T00:00:00+07:00`;
    label = d;
  } else if (/^\d{4}$/.test(yearParam)) {
    from = `${yearParam}-01-01T00:00:00+07:00`;
    to = `${Number(yearParam) + 1}-01-01T00:00:00+07:00`;
    label = yearParam;
  } else {
    const month = /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 7);
    from = `${monthStart(month)}T00:00:00+07:00`;
    to = `${monthEndExclusive(month)}T00:00:00+07:00`;
    label = month;
  }

  if (type === "kantin") {
    // Proxy: kantin sales list + sale items (join in JS).
    // Push the month window server-side — the connector maps
    // created_at.gte/lt → ?from/&to for kantin_sales, so only the
    // requested rows cross the wire instead of the tenant's whole
    // history filtered in JS afterwards.
    const salesQ = supabase.from("kantin_sales").gte("created_at", from).lt("created_at", to);
    if (ownOnly) salesQ.eq("recorded_by", "me");
    const sales = await salesQ;
    const inMonth = ((sales as unknown as { data: Array<Record<string, unknown>> }).data ?? []) as Array<{
      id: string;
      total: number;
      method: string;
      created_at: string;
      customer_name: string | null;
      recorded_by?: string | null;
    }>;

    // Fetch sale items per sale via the items endpoint (one sale at a
    // time; tenant scale is small — cap at 500 sales per export).
    const allItems: Array<{
      sale_id: string;
      product_name: string;
      qty: number;
      unit_price: number;
    }> = [];
    for (const s of inMonth.slice(0, 500)) {
      try {
        const res = await proxyFetch<{ items: Array<{ product_name: string; qty: number; unit_price: number }> }>(
          `/v1/sports/kantin/sales/${s.id}/items`
        );
        for (const it of res.items ?? []) {
          allItems.push({ sale_id: s.id, product_name: it.product_name, qty: it.qty, unit_price: it.unit_price });
        }
      } catch {
        /* one bad sale must not kill the whole export */
      }
    }

    const kHeaders = ["Tanggal", "Jam", "Metode", "Produk", "Qty", "Harga", "Subtotal", "Pembeli", "Dicatat"];
    const kRows: Array<Array<string | number>> = [];
    for (const s of inMonth) {
      const saleItems = allItems.filter((i) => i.sale_id === s.id);
      for (const it of saleItems) {
        kRows.push([
          day(s.created_at),
          time(s.created_at),
          s.method,
          String(it.product_name),
          it.qty,
          Number(it.unit_price),
          Number(it.unit_price) * Number(it.qty),
          String(s.customer_name ?? ""),
          String(s.recorded_by ?? ""),
        ]);
      }
    }

    if (format === "xlsx") {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Kantin");
      ws.addRow(kHeaders);
      ws.getRow(1).font = { bold: true } as unknown as never;
      kRows.forEach((r) => ws.addRow(r));
      ws.columns.forEach((c) => {
        (c as unknown as { width: number }).width = 14;
      });
      const buf = await wb.xlsx.writeBuffer();
      return new NextResponse(buf as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="kantin-${label}.xlsx"`,
        },
      });
    }

    const kLines = [kHeaders.join(";"), ...kRows.map((r) => r.map((v) => esc(v)).join(";"))];
    return new NextResponse("\uFEFF" + kLines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kantin-${label}.csv"`,
      },
    });
  }

  // Lapangan: payments + bookings (join in JS). The window is pushed
  // to the proxy on payments (paid_at.gte/lt → ?from/&to) — the big
  // ledger — while bookings (small: per-court daily rows) are fetched
  // whole so the join can resolve payments that reference bookings
  // from adjacent days/prior months too. Bounded by ?limit.
  const payQ = supabase.from("payments").gte("paid_at", from).lt("paid_at", to);
  if (ownOnly) payQ.eq("recorded_by", "me");
  const payRes = await payQ;
  const payments = ((payRes as unknown as { data: Array<Record<string, unknown>> }).data ?? []) as Array<{
    id: string;
    booking_id: string;
    amount: number;
    method: string;
    paid_at: string;
  }>;
  const inMonth = payments.filter((p) => {
    const t = new Date(p.paid_at).getTime();
    return t >= new Date(from).getTime() && t < new Date(to).getTime();
  });

  const bkRes = await supabase.from("bookings").limit(2000);
  const bookings = ((bkRes as unknown as { data: Array<Record<string, unknown>> }).data ?? []) as Array<{
    id: string;
    facility_id?: string;
    customer_name: string;
    customer_phone: string | null;
    date: string;
    start_time: string;
    end_time: string;
    facility_name?: string;
  }>;
  const facRes = await supabase.from("courts");
  const facilities = ((facRes as unknown as { data: Array<Record<string, unknown>> }).data ?? []) as Array<{
    id: string;
    name: string;
  }>;
  const facName = (id: string) => facilities.find((f) => f.id === id)?.name ?? "";

  const lHeaders = ["Tanggal Bayar", "Metode", "Tanggal Main", "Jam", "Pelanggan", "Telepon", "Lapangan", "Nominal"];
  const lRows: Array<Array<string | number>> = [];
  for (const p of inMonth) {
    const b = bookings.find((x) => x.id === p.booking_id);
    lRows.push([
      day(p.paid_at),
      String(p.method),
      String(b?.date ?? ""),
      `${String(b?.start_time ?? "").slice(0, 5)}-${String(b?.end_time ?? "").slice(0, 5)}`,
      String(b?.customer_name ?? ""),
      String(b?.customer_phone ?? ""),
      String(b ? facName(b.facility_id ?? "") : ""),
      Number(p.amount),
    ]);
  }

  if (format === "xlsx") {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Laporan");
    ws.addRow(lHeaders);
    ws.getRow(1).font = { bold: true } as unknown as never;
    // Strings get the same formula-injection guard the CSV path applies,
    // and are marked as literal text so Excel cannot reinterpret them.
    //
    // A customer named "=1+1" or "+62811" is stored verbatim in the
    // database, and XLSX cells are evaluated on open: without this the
    // export handed the recipient a workbook that tried to compute its
    // own contents from whatever the payer typed into a name field. The
    // CSV path already escaped this; the XLSX path did not, so the same
    // data was safe in one format and not the other.
    const isText = (v: unknown) => typeof v === "string";
    const guard = (v: unknown) => (isText(v) ? xlsxSafe(v as string) : v);
    lRows.forEach((r) => ws.addRow(r.map(guard)));
    ws.columns.forEach((c) => {
      (c as unknown as { width: number }).width = 16;
    });
    // Header row plus every added row.
    for (let rowNo = 2; rowNo <= lRows.length + 1; rowNo++) {
      ws.getRow(rowNo).eachCell((cell, colNo) => {
        if (isText(lRows[rowNo - 2][colNo - 1])) {
          (cell as unknown as { type: unknown }).type = ExcelJS.ValueType.String;
        }
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="laporan-centrum-${label}.xlsx"`,
      },
    });
  }

  const lines = [lHeaders.join(";"), ...lRows.map((r) => r.map((v) => esc(v)).join(";"))];
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-centrum-${label}.csv"`,
    },
  });
}
