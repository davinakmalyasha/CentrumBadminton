import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  monthEndExclusive,
  monthStart,
} from "@/lib/months";

/**
 * GET /api/reports/export?month=YYYY-MM[&type=kantin]
 * Owner-only CSV export of payments (or kantin sales) in the given month.
 */

const WIB_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const WIB_TIME = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Neutralize spreadsheet formula injection, then quote when needed. */
function esc(v: string | number | null | undefined): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ownerFlag } = await supabase.rpc("is_owner");
  if (ownerFlag !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month") ?? "";
  const type = url.searchParams.get("type") === "kantin" ? "kantin" : "lapangan";
  const month = /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
        .format(new Date())
        .slice(0, 7);

  if (type === "kantin") {
    const { data: kData, error: kError } = await supabase
      .from("kantin_sale_items")
      .select(
        "qty,unit_price,product_name,kantin_sales(total,method,created_at,customer_name,profiles(full_name))"
      )
      .gte("kantin_sales.created_at", `${monthStart(month)}T00:00:00+07:00`)
      .lt("kantin_sales.created_at", `${monthEndExclusive(month)}T00:00:00+07:00`)
      .order("kantin_sales(created_at)", { referencedTable: "kantin_sales" });

    if (kError) {
      return NextResponse.json({ error: kError.message }, { status: 500 });
    }

    type KRow = {
      qty: number;
      unit_price: number;
      product_name: string;
      kantin_sales: {
        total: number;
        method: string;
        created_at: string;
        customer_name: string | null;
        profiles: { full_name: string } | null;
      } | null;
    };

    const kLines: string[] = [
      "Tanggal;Jam;Metode;Produk;Qty;Harga;Subtotal;Pembeli;Dicatat",
      ...((kData ?? []) as unknown as KRow[]).map((r) =>
        [
          day(r.kantin_sales?.created_at),
          time(r.kantin_sales?.created_at),
          r.kantin_sales?.method ?? "",
          esc(r.product_name),
          r.qty,
          Number(r.unit_price),
          Number(r.unit_price) * Number(r.qty),
          esc(r.kantin_sales?.customer_name),
          esc(r.kantin_sales?.profiles?.full_name),
        ].join(";")
      ),
    ];

    return new NextResponse("\uFEFF" + kLines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kantin-${month}.csv"`,
      },
    });
  }

  const { data, error } = await supabase
    .from("payments")
    .select(
      "amount,method,paid_at,bookings(customer_name,customer_phone,booking_date,start_time,end_time,courts(name))"
    )
    .gte("paid_at", `${monthStart(month)}T00:00:00+07:00`)
    .lt("paid_at", `${monthEndExclusive(month)}T00:00:00+07:00`)
    .order("paid_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    amount: number;
    method: string;
    paid_at: string;
    bookings: {
      customer_name?: string;
      customer_phone?: string;
      booking_date?: string;
      start_time?: string;
      end_time?: string;
      courts?: { name?: string } | null;
    } | null;
  };

  const rows = (data ?? []) as Row[];

  const lines: string[] = [
    "Tanggal Bayar;Metode;Tanggal Main;Jam;Pelanggan;Telepon;Lapangan;Nominal",
    ...rows.map((r) =>
      [
        day(r.paid_at),
        r.method,
        r.bookings?.booking_date ?? "",
        `${String(r.bookings?.start_time ?? "").slice(0, 5)}-${String(
          r.bookings?.end_time ?? ""
        ).slice(0, 5)}`,
        esc(r.bookings?.customer_name),
        esc(r.bookings?.customer_phone),
        esc(r.bookings?.courts?.name),
        Number(r.amount),
      ].join(";")
    ),
  ];

  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-centrum-${month}.csv"`,
    },
  });
}
