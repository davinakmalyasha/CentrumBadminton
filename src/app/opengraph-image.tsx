import { ImageResponse } from "next/og";

export const alt = "Centrum Badminton Arena — Cirebon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #EFF7FF 0%, #BFDEFF 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 9999,
            background: "#FF7A00",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 900,
            color: "white",
          }}
        >
          🏸
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, color: "#0B2545", marginTop: 32 }}>
          Centrum Badminton Arena
        </div>
        <div style={{ fontSize: 34, color: "#133D6F", marginTop: 12 }}>
          2 Lapangan Indoor · Vinyl Interlock · Cirebon
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 40,
            fontSize: 30,
            fontWeight: 700,
            color: "white",
          }}
        >
          <span style={{ background: "#0369D1", padding: "12px 28px", borderRadius: 16 }}>
            Siang Rp40rb/jam
          </span>
          <span style={{ background: "#FF7A00", padding: "12px 28px", borderRadius: 16 }}>
            Malam Rp50rb/jam
          </span>
        </div>
        <div style={{ fontSize: 26, color: "#133D6F", marginTop: 36 }}>
          ⭐ 4.7 · Buka setiap hari 07.00–23.00 WIB
        </div>
      </div>
    ),
    size
  );
}
