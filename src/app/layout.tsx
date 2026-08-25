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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "Centrum Badminton Arena",
  description:
    "GOR badminton indoor 2 lapangan di Cirebon. Booking mudah, harga transparan, buka setiap hari 07.00–23.00 WIB.",
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
