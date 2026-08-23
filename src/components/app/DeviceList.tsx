"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listMyDevices,
  removeDeviceById,
  type DeviceInfo,
} from "@/app/app/(protected)/push-actions";

function deviceLabel(ua: string | null): string {
  if (!ua) return "Perangkat tidak dikenal";
  const browser =
    /iphone.*safari|crios/i.test(ua)
      ? "iPhone Safari"
      : /ipad/i.test(ua)
        ? "iPad"
        : /android.*chrome|android/i.test(ua)
          ? "Android Chrome"
          : /edg/i.test(ua)
            ? "Edge"
            : /chrome/i.test(ua)
              ? "Chrome"
              : /firefox/i.test(ua)
                ? "Firefox"
                : /safari/i.test(ua)
                  ? "Safari"
                  : "Browser lain";
  return browser;
}

export default function DeviceList({ initialDevices }: { initialDevices: DeviceInfo[] }) {
  const [devices, setDevices] = useState<DeviceInfo[]>(initialDevices);
  const [pending, startTransition] = useTransition();

  // Refresh on mount (subscription may have been created after page render)
  useEffect(() => {
    void listMyDevices().then(setDevices);
  }, []);

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeDeviceById(id);
      if (!res.error) setDevices((prev) => prev.filter((d) => d.id !== id));
    });
  }

  if (devices.length === 0) {
    return (
      <p className="text-[11px] font-medium text-navy-700/40">
        Belum ada perangkat — tekan 🔕 di header untuk mengaktifkan notifikasi.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {devices.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-2 rounded-xl bg-ice-100 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-navy-900">
              📱 {deviceLabel(d.user_agent)}
            </p>
            <p className="text-[10px] font-medium text-navy-700/40">
              terdaftar{" "}
              {new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "short",
                timeZone: "Asia/Jakarta",
              }).format(new Date(d.created_at))}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => remove(d.id)}
            title="Hapus perangkat"
            className="flex-shrink-0 rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            🗑
          </button>
        </li>
      ))}
    </ul>
  );
}
