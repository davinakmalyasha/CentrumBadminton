"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Bot, Maximize2, X } from "lucide-react";
import AiChat from "./AiChat";
import { useRole } from "./RoleContext";
import { isActivePath } from "./AppNav";
import { placePanel, type PanelBox } from "@/lib/popover";

const DESKTOP_WIDTH = 420;
const DESKTOP_HEIGHT = 560;
const DESKTOP_QUERY = "(min-width: 1024px)";

function measure(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;

  return placePanel(rect, { width, height }, {
    maxWidth: isDesktop ? DESKTOP_WIDTH : width,
    maxHeight: isDesktop ? DESKTOP_HEIGHT : height,
  });
}

export default function AiChatPopover({
  triggerRef,
  open,
  onOpenChange,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { role } = useRole();
  const [box, setBox] = useState<PanelBox | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastPath = useRef(pathname);

  const measureBox = useCallback(() => {
    const el = triggerRef.current;
    if (el) setBox(measure(el));
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;
    measureBox();
    window.addEventListener("resize", measureBox);
    return () => window.removeEventListener("resize", measureBox);
  }, [open, measureBox]);

  const close = useCallback(() => {
    onOpenChange(false);
    triggerRef.current?.focus();
  }, [onOpenChange, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  useEffect(() => {
    if (open) composerRef.current?.focus();
  }, [open]);

  const aiActive = isActivePath(pathname, "/app/ai");
  const shown = open && box !== null;

  return (
    <>
      {shown && (
        <button
          type="button"
          aria-label="Tutup asisten AI"
          onClick={close}
          className="fixed inset-0 z-[59] cursor-default"
        />
      )}

      <div
        id="ai-chat-popover"
        role="dialog"
        aria-label="Asisten AI"
        style={
          box
            ? {
                top: `${box.top}px`,
                left: `${box.left}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
              }
            : undefined
        }
        className={`fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 transition-[opacity,transform,visibility] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40 ${
          shown
            ? "visible translate-y-0 opacity-100"
            : "invisible pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Bot className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-extrabold">Asisten Centrum</p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {role === "owner"
                ? "Tanya apa saja soal usaha"
                : "Tanya jadwal, stok, laporan harian"}
            </p>
          </div>
          {!aiActive && (
            <Link
              href="/app/ai"
              onClick={() => onOpenChange(false)}
              title="Buka halaman AI"
              className="manager-tap inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              Penuh
            </Link>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Tutup asisten AI"
            className="manager-tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <AiChat role={role} embedded inputRef={composerRef} />
      </div>
    </>
  );
}