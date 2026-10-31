import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import { getLang } from "@/lib/lang-server";
import { siteUrl } from "@/lib/site";
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
  metadataBase: siteUrl(),
  title: "Centrum Badminton Arena",
  description:
    "GOR badminton indoor 2 lapangan di Cirebon. Booking mudah, harga transparan, buka setiap hari 07.00–23.00 WIB.",
  applicationName: "Centrum Badminton Arena",
  authors: [{ name: "Centrum Badminton Arena" }],
  keywords: [
    "badminton Cirebon",
    "GOR badminton",
    "booking lapangan badminton",
    "Centrum Badminton Arena",
  ],
  icons: {
    icon: [{ url: "/icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "Centrum Badminton Arena",
    title: "Centrum Badminton Arena — Booking Lapangan Badminton Cirebon",
    description:
      "2 lapangan badminton indoor vinyl interlock di Cirebon. Buka setiap hari 07.00–23.00 WIB. Booking mudah via WhatsApp.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Centrum Badminton Arena — Cirebon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Centrum Badminton Arena — Booking Lapangan Badminton Cirebon",
    description:
      "2 lapangan badminton indoor vinyl interlock di Cirebon. Buka setiap hari 07.00–23.00 WIB.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
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
