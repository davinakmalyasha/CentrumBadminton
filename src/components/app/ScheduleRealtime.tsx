"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Realtime refresh untuk jadwal admin — re-render server component
 * (router.refresh) setiap ada perubahan booking/blokir dari user lain.
 */
export default function ScheduleRealtime({ dateISO }: { dateISO: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channelName = `jadwal-${dateISO}`;
    const onChange = () => router.refresh();

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
      void supabase.removeChannel(channel);
    };
  }, [dateISO, router]);

  return null;
}
