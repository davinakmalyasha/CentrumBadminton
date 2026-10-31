"use client";

import dynamic from "next/dynamic";

/**
 * The chat widget is interaction-only and not needed for first paint.
 * Loading it after hydration keeps its client JS out of the landing page's
 * initial bundle; the floating button appears as soon as the chunk is ready.
 */
const ChatWidget = dynamic(() => import("./ChatWidget"), {
  ssr: false,
  loading: () => null,
});

export default function ChatWidgetLoader() {
  return <ChatWidget />;
}
