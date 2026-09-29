"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "cba-manager-theme";

const ThemeContext = createContext<{
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
}>({
  choice: "system",
  resolved: "light",
  setChoice: () => {},
  toggle: () => {},
});

function systemIsDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function readStored(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

function subscribeToSystem(cb: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("storage", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", cb);
  };
}

function getSystemSnapshot(): boolean {
  return systemIsDark();
}

function getSystemServerSnapshot(): boolean {
  return false;
}

/** Client theme state for the manager area only. No logic changes elsewhere. */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init reads localStorage on first client render (same pattern as
  // ChatWidget history) — no mount effect needed. suppressHydrationWarning
  // covers the server/client first-paint difference; the head script in
  // app/app/layout.tsx already sets .dark pre-paint to avoid flash.
  const [choice, setChoiceState] = useState<ThemeChoice>(readStored);
  const systemDark = useSyncExternalStore(
    subscribeToSystem,
    getSystemSnapshot,
    getSystemServerSnapshot,
  );
  const resolved: ResolvedTheme =
    choice === "system" ? (systemDark ? "dark" : "light") : choice;

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setChoiceState((prev) => {
      const current: ResolvedTheme =
        prev === "system" ? (systemIsDark() ? "dark" : "light") : prev;
      const next: ResolvedTheme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice, toggle }}>
      {/* `.dark` scopes Tailwind dark: variants to the manager only */}
      <div
        id="manager-root"
        suppressHydrationWarning
        className={resolved === "dark" ? "dark" : ""}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useManagerTheme() {
  return useContext(ThemeContext);
}
