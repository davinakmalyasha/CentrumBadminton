"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/proxy/browser";

/**
 * Realtime refresh untuk jadwal admin — re-render server component
 * (router.refresh) saat ada perubahan booking/blokir dari user lain.
 * Debounced: creating a 12-week series emits 12 INSERT events; without
 * the debounce each one triggered a full RSC refresh storm.
 */
export default function ScheduleRealtime({ dateISO }: { dateISO: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channelName = `jadwal-${dateISO}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        onChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_blocks" },
        onChange
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [dateISO, router]);

  return null;
}
