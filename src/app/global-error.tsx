"use client";

/**
 * Last-resort boundary for errors thrown outside the root layout.
 * It must render its own <html> and <body>, and it cannot rely on the
 * app's CSS being available, so the styles are intentionally inline.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f4f5",
          color: "#18181b",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>
            Aplikasi gagal dimuat
          </h1>
          <p style={{ color: "#52525b", lineHeight: 1.6, margin: "0 0 20px" }}>
            Terjadi kesalahan tak terduga. Muat ulang halaman; jika masih
            terjadi, hubungi pengelola Centrum.
          </p>
          {error.digest ? (
            <p style={{ color: "#a1a1aa", fontSize: 12, margin: "0 0 20px" }}>
              Kode kesalahan: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={retry}
            style={{
              border: 0,
              borderRadius: 12,
              background: "#18181b",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              padding: "12px 20px",
            }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
