"use client";

import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";

const LANG_COOKIE = "cba-lang";

export default function LangToggle({
  lang,
  className = "",
}: {
  lang: Lang;
  className?: string;
}) {
  const router = useRouter();

  function setLang(l: Lang) {
    if (l === lang) return;
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

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
