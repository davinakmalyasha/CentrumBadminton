import { NextResponse } from "next/server";

// GET /api/reports/download/{token}.xlsx
//
// Same-origin relay for chat-generated reports. The proxy at :8080
// already sends a good filename ("laporan-<from>_<to>-<type>-<id>.xlsx",
// see AgentsProxy saveReportFile) but the chat used to link straight at
// the proxy. That is a CROSS-origin download, and for one Chrome ignores
// Content-Disposition and names the file from the URL path instead —
// which is why a report saved as "<64-hex-token>.xlsx". Relaying
// through our own origin makes the header authoritative again.
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// 32 random bytes, hex — the shape mintReportToken produces.
const TOKEN_RE = /^[0-9a-f]{64}$/;

// The proxy builds this from a validated date range, a type slug and 8
// hex chars. Matching it exactly means a header we forward can never
// carry quotes, CR/LF, path separators or a second filename.
const FILENAME_RE =
  /^laporan-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}-[a-z0-9-]+-[0-9a-f]{8}\.xlsx$/;

function filenameFrom(disposition: string | null, token: string): string {
  const match = disposition?.match(/filename="([^"]*)"/i);
  if (match && FILENAME_RE.test(match[1])) return match[1];
  // Expired or renamed upstream ticket: still a valid download, just
  // without a meaningful name. Never echo an unvalidated value back.
  return `laporan-${token.slice(0, 8)}.xlsx`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  // The path segment carries the ".xlsx" suffix. Strip it, then require
  // exactly 64 hex chars: this is the only untrusted input, and without
  // the guard the route would proxy arbitrary paths on the backend.
  const token = raw.replace(/\.xlsx$/i, "");
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "token tidak valid" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${PROXY_URL}/v1/reports/${token}.xlsx`, {
      cache: "no-store",
      // Reports can be megabytes and the proxy uses http.ServeContent,
      // so pass a resumable range request straight through.
      headers: request.headers.get("range")
        ? { Range: request.headers.get("range") as string }
        : undefined,
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        {
          error:
            upstream.status === 404
              ? "laporan sudah kedaluwarsa atau tidak dikenal — minta lagi"
              : "gagal mengambil laporan dari server",
        },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const headers = new Headers({
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filenameFrom(
        upstream.headers.get("Content-Disposition"),
        token,
      )}"`,
      // A ticket is single-tenant and short-lived; never let a shared
      // cache hold one.
      "Cache-Control": "private, no-store",
    });
    const contentRange = upstream.headers.get("Content-Range");
    if (contentRange) headers.set("Content-Range", contentRange);
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json(
      { error: "tidak dapat menghubungi server laporan" },
      { status: 502 },
    );
  }
}
