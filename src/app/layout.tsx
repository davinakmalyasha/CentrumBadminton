import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import { getLang } from "@/lib/lang-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0B2545",
  viewportFit: "cover",
};

// metadataBase must never throw at build time: an empty or malformed
// NEXT_PUBLIC_SITE_URL (e.g. a placeholder left in Vercel env) used to
// crash "Collecting page data" with ERR_INVALID_URL. Trim, validate,
// and fall back to localhost so a bad env value degrades OG URLs
// instead of failing the deploy.
function siteUrl(): URL {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (raw !== "") {
    try {
      return new URL(raw);
    } catch {
      // Fall through to the dev fallback below.
    }
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Centrum Badminton Arena",
  description:
    "GOR badminton indoor 2 lapangan di Cirebon. Booking mudah, harga transparan, buka setiap hari 07.00–23.00 WIB.",
  icons: {
    icon: [{ url: "/icon-32.png", sizes: "32x32", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Keep <html lang> in sync with the language cookie so screen readers and
  // translation tools announce the active language correctly.
  const lang = await getLang();
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
