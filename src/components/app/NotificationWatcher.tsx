"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Toast {
  id: string;
  text: string;
}

/**
 * Realtime watcher — shows a toast whenever a new booking is created
 * by anyone (owner sees staff activity & vice versa).
 * Complements PWA push (Phase 6): instant in-app fallback that works
 * even when push is unavailable or permission is denied.
 */
export default function NotificationWatcher() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("booking-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            customer_name?: string;
            start_time?: string;
            booking_date?: string;
          };
          if (!row?.id) return;
          // Only toast bookings for today/future
          const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Jakarta",
          }).format(new Date());
          if ((row.booking_date ?? "") < today) return;

          const t = `Booking baru: ${row.customer_name ?? "Pelanggan"} · ${String(
            row.start_time ?? ""
          ).slice(0, 5)}`;
          const id = row.id;
          setToasts((prev) =>
            prev.some((x) => x.id === id) ? prev : [...prev.slice(-2), { id, text: t }]
          );
          setTimeout(() => {
            setToasts((prev) => prev.filter((x) => x.id !== id));
          }, 6000);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-lg shadow-emerald-900/10"
        >
          <Bell className="h-4 w-4 flex-shrink-0" />
          {t.text}
        </div>
      ))}
    </div>
  );
}
