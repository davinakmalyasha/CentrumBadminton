import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  monthEndExclusive,
  monthStart,
} from "@/lib/months";

/**
 * GET /api/reports/export?month=YYYY-MM
 * Owner-only CSV export of all payments in the given month.
 */
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
  const month = /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
        .format(new Date())
        .slice(0, 7);

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

  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [
    "Tanggal Bayar;Metode;Tanggal Main;Jam;Pelanggan;Telepon;Lapangan;Nominal",
    ...rows.map((r) =>
      [
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
          new Date(r.paid_at)
        ),
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
