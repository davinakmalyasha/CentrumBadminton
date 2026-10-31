# Performance Notes

Baseline: **2026-10-31**, Next.js 16.4.3, Turbopack production build.

## How to measure

```bash
npm run analyze
```

This writes:

- `.next/diagnostics/analyze/analyze.html` — interactive treemap
- `.next/diagnostics/route-bundle-stats.json` — per-route first-load JS
- `.next/diagnostics/analyze/analyze.txt` — raw analyzer data

The numbers below are **uncompressed first-load JavaScript**, not Core Web
Vitals. Vercel serves gzip/brotli, so the real transfer size is smaller.

## Baseline (uncompressed first-load JS)

| Route | Size |
|---|---:|
| `/_not-found` | 471 KB |
| `/offline` | 474 KB |
| `/` | 499 KB |
| `/app/login` | 516 KB |
| `/app/ai` | 538 KB |
| `/app` | 546 KB |
| `/app/booking/baru` | 554 KB |

The shared framework/runtime floor is ~471 KB. Page-specific code is
roughly 30–80 KB on top of that.

## Already applied

- Landing chat widget is dynamically imported after hydration, so its JS is
  not part of the initial landing bundle.
- Route-level code splitting is automatic via the App Router.
- `exceljs` is server-only and dynamically imported inside the export route.
- Kantin export item fetches use bounded concurrency (4) instead of a
  sequential 500-request loop.
- PWA icons were palette-optimized; source logos moved out of `public/`.
- Availability API is edge-cacheable for 30s with stale-while-revalidate.
- Google rating is cached for 24h.

## Next candidates

1. Run Lighthouse/WebPageTest on the production URL and record LCP/INP/CLS.
2. Replace 5s availability polling with SSE/WebSocket from AgentsProxy.
3. Cache courts/pricing reads for a short TTL (they change rarely).
4. Dynamic-import heavy page widgets (`KantinPos`, `BookingForm`) behind a
   visible loading state if their routes feel slow on low-end phones.
5. Audit long lists (`pelanggan`, `pembayaran`, `riwayat`) for virtualization
   once row counts grow.
6. Batch Kantin sale items in the backend to remove the remaining N+1 shape
   entirely.

Any change should include before/after numbers from `npm run analyze` or a
Lighthouse run, not just a code-size guess.
