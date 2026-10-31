"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (PWA offline shell + push handler) in
 * production only. During `next dev` a service worker caches chunks that
 * Turbopack is still changing, which produces confusing stale-bundle bugs.
 * Test the PWA with `npm run build && npm start`.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Remove a worker left behind by an earlier production run on the
      // same localhost origin so dev always serves fresh modules.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
