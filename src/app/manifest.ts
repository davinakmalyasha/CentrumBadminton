import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Centrum Badminton Manager",
    short_name: "Centrum",
    description:
      "Manajemen booking, pembayaran & laporan GOR Centrum Badminton Arena.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EFF7FF",
    theme_color: "#0B2545",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Jadwal", url: "/app/jadwal" },
      { name: "Booking Baru", url: "/app/booking/baru" },
      { name: "Pembayaran", url: "/app/pembayaran" },
    ],
  };
}
