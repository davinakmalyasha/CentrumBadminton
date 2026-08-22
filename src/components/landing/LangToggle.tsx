"use client";

import { useLang, type Lang } from "@/lib/i18n";

export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();

  const btn = (l: Lang) =>
    `px-2.5 py-1 rounded-full text-xs font-semibold transition ${
      lang === l
        ? "bg-navy-800 text-white"
        : "text-navy-700 hover:bg-ice-200"
    }`;

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-sky-brand-200 bg-white p-0.5 ${className}`}
      aria-label="Language"
    >
      <button type="button" onClick={() => setLang("id")} className={btn("id")}>
        ID
      </button>
      <button type="button" onClick={() => setLang("en")} className={btn("en")}>
        EN
      </button>
    </div>
  );
}
