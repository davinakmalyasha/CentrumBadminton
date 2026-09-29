// The /app section talks to the proxy (cookies + fetch in server
// actions) — it must render dynamically, never be statically
// prerendered at build time.
export const dynamic = "force-dynamic";

import ThemeProvider from "@/components/app/ThemeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Set .dark on the manager wrapper before paint to avoid theme flash.
          Scoped to #manager-root so the public landing always stays light. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var s=localStorage.getItem("cba-manager-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;s==="system"&&(d=window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){requestAnimationFrame(function(){var r=document.getElementById("manager-root");if(r)r.classList.add("dark")})} }catch(e){}})();`,
        }}
      />
      <ThemeProvider>{children}</ThemeProvider>
    </>
  );
}
