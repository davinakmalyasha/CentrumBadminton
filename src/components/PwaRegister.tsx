"use client";

import { useEffect } from "react";

/** Registers the service worker (PWA offline shell + push handler). */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
