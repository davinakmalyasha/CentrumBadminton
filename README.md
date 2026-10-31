# Centrum Badminton Arena — Digital Platform

Landing page publik + aplikasi manajemen (PWA) untuk **GOR Centrum Badminton Arena**, Cirebon.

[![CI](https://github.com/davinakmalyasha/CentrumBadminton/actions/workflows/ci.yml/badge.svg)](https://github.com/davinakmalyasha/CentrumBadminton/actions/workflows/ci.yml)

- **Landing page** (`/`) — info venue, ketersediaan slot, harga, lokasi, dan booking via WhatsApp.
- **Management app** (`/app`) — PWA untuk Owner & Pegawai: booking, pembayaran, kantin, laporan, pengeluaran, pengaturan, dan AI assistant.
- **Backend** — **AgentsProxy** (Go + Postgres + Redis), repo terpisah. Repo ini **hanya frontend**; tidak ada Supabase atau LLM key di sini.

## Arsitektur

```text
Browser
  │
  ├─ Landing page (server component) ──► Next.js route /api/availability ─┐
  ├─ Management PWA (server actions) ─────────────────────────────────────┤
  └─ Chat widget ──► /api/landing-chat ───────────────────────────────────┤
                                                                          ▼
                                                              AgentsProxy (:8080)
                                                              Postgres · Redis · LLM
```

- Semua request terautentikasi melewati server Next.js. Cookie sesi (`proxy_session`) bersifat **httpOnly** dan tidak pernah dibaca oleh JavaScript browser.
- `src/lib/proxy/` adalah satu-satunya lapisan yang tahu kontrak HTTP AgentsProxy.
- Route API Next.js hanya menjadi same-origin shim untuk kebutuhan browser (availability, chat publik, push subscription, download laporan).

## Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Bahasa | TypeScript 5.9 (strict) |
| UI | React 19 · Tailwind CSS v4 · Lucide |
| Data/Auth | AgentsProxy (Go) — Postgres + Redis |
| PWA | Web App Manifest + service worker + Web Push |
| Test | Vitest |
| Deploy | Vercel (frontend) + Railway/VPS (AgentsProxy) |

## Fitur

**Publik**

- Ketersediaan slot realtime (polling 5 detik, berhenti saat tab tidak aktif)
- Harga siang/malam dari pricing rule backend
- Google rating opsional (fallback statis bila API key tidak diisi)
- Bilingual ID/EN
- Booking via WhatsApp deep link
- SEO: metadata, Open Graph image, JSON-LD, sitemap, robots

**Manajemen**

- Dashboard, jadwal, booking baru, pembayaran cash/QRIS, pelanggan
- Blokir jadwal, series/member berulang, pengeluaran
- Laporan keuangan, riwayat, laporan kantin, ekspor CSV/XLSX
- POS kantin, produk, stok, dan riwayat penjualan
- Pengaturan lapangan, jam operasional, harga, staf
- AI assistant + daily closing report (lewat AgentsProxy)
- PWA installable + push notification

## Mulai Cepat

### Prasyarat

- Node.js **20.9+** (disarankan 22 LTS)
- npm 10+
- AgentsProxy berjalan di `http://localhost:8080` (lihat repo backend)

### 1. Install & konfigurasi

```bash
npm install
cp .env.local.example .env.local
```

Isi `.env.local` minimal:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PROXY_URL=http://localhost:8080
NEXT_PUBLIC_TENANT_ID=centrum
```

> Di production, `NEXT_PUBLIC_PROXY_URL` **wajib** diisi. Tanpa nilai itu aplikasi tidak akan diam-diam memakai `localhost`; request akan gagal dengan pesan konfigurasi.

### 2. Jalankan

```bash
npm run dev
```

- Landing: <http://localhost:3000>
- App: <http://localhost:3000/app>

### 3. Buat akun owner pertama

Akun dibuat di backend, bukan lewat halaman publik. Dari repo ini:

```bash
# Membuat akun owner dan menampilkan password acak satu kali.
node --env-file=.env.local scripts/provision-owner.mjs owner@example.com
```

Jika tenant belum punya client token/owner session, buat owner pertama langsung di database AgentsProxy dengan password kuat pilihan Anda. Jangan gunakan password contoh atau password yang pernah muncul di dokumentasi/commit.

Setelah owner ada, akun pegawai dibuat dari **Pengaturan → Staf → Buat Akun Pegawai**.

## Environment Variables

| Variable | Public? | Wajib | Fungsi |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ya | production | Canonical URL untuk metadata, sitemap, OG |
| `NEXT_PUBLIC_PROXY_URL` | ya | ya | Origin AgentsProxy, tanpa trailing slash |
| `NEXT_PUBLIC_TENANT_ID` | ya | ya | Tenant slug (`centrum`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ya | opsional | Public key Web Push; private key ada di backend |
| `GOOGLE_PLACES_API_KEY` | tidak | opsional | Rating Google live |
| `GOOGLE_PLACE_ID` | tidak | opsional | Place ID venue |
| `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD` | tidak | opsional | Hanya untuk script E2E |

`NEXT_PUBLIC_*` di-inline ke bundle browser. **Jangan pernah** menaruh service-role key, JWT private key, database URL, atau LLM API key di sana.

## Scripts

| Command | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve hasil build |
| `npm run lint` | ESLint, gagal jika ada warning |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit test (Vitest) |
| `npm run test:watch` | Test mode watch |
| `npm run check` | Typecheck + lint + test |
| `node scripts/kantin-e2e.mjs` | E2E kantin terhadap proxy lokal |
| `node scripts/promote-owner.mjs <email>` | Promosikan user menjadi owner (butuh kredensial owner) |

## Autentikasi & Sesi

- Login email+password ke `POST /v1/auth/login` milik AgentsProxy.
- Token disimpan di cookie `proxy_session`: `httpOnly`, `SameSite=Lax`, `Secure` di production, berlaku 30 hari.
- `src/proxy.ts` melakukan redirect optimistis; validasi sesi sebenarnya ada di `(protected)/layout.tsx` lewat `GET /v1/auth/me`.
- Backend down **tidak** dianggap logout. Halaman menampilkan error yang jujur, bukan mengarahkan ke login.
- Logout memanggil `POST /v1/auth/logout` (revoke server-side) lalu menghapus cookie.
- Role `owner` / `pegawai` diperiksa di server action dan page guard. Backend tetap menjadi otoritas akhir.

## PWA & Push

- Service worker hanya didaftarkan di production. Saat `next dev`, service worker lama otomatis di-unregister agar tidak menyajikan bundle basi.
- Test PWA: `npm run build && npm start`.
- Halaman `/app` tidak pernah di-cache oleh service worker (mencegah data satu akun terlihat oleh akun lain di perangkat bersama).
- Push subscription dikirim ke `/api/push/subscriptions`, yang meneruskan `X-Session-Token` dari cookie httpOnly ke AgentsProxy.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` harus sama dengan pasangan private key yang dipakai backend.

## Deploy

### Vercel (frontend)

1. Import repo ini di Vercel; framework terdeteksi otomatis sebagai Next.js.
2. Set environment variables untuk **Production** dan **Preview**:
   - `NEXT_PUBLIC_SITE_URL=https://domain-anda.example`
   - `NEXT_PUBLIC_PROXY_URL=https://proxy-anda.example`
   - `NEXT_PUBLIC_TENANT_ID=centrum`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (jika push aktif)
   - `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` (opsional)
3. Pastikan AgentsProxy mengizinkan origin frontend (CORS) dan cookie sesi bisa dikirim.
4. Cek `GET /api/health` — harus `200` dengan `"status":"ok"`.
5. Set custom domain, lalu perbarui `NEXT_PUBLIC_SITE_URL` dan redeploy.

### AgentsProxy (backend)

Deploy dari repo terpisah. Variabel yang dibutuhkan backend antara lain `DATABASE_URL`, `REDIS_URL`, `LLM_API_KEY`, `ADMIN_API_KEY`, `TELEGRAM_BOT_TOKEN`, dan VAPID private key. **Jangan** menyalin nilai-nilai itu ke repo ini.

## Keamanan

- Jangan commit `.env.local`, token, password, private key, atau dump database.
- Repo ini public. Gunakan **GitHub private vulnerability reporting** untuk melaporkan celah — lihat [SECURITY.md](SECURITY.md).
- CSP, HSTS, `X-Frame-Options`, `nosniff`, dan header keamanan lain diatur di `next.config.ts`; CSP di production bersifat enforcing.
- Semua ekspor CSV/XLSX dilindungi dari formula injection.
- Rate limit in-memory melindungi login, chat publik, pembuatan booking, pembayaran, dan ekspor. Untuk skala besar, pindahkan limiter ke Redis/edge.
- Riwayat repo pernah memuat kredensial uji dan artefak Playwright. Riwayat sudah ditulis ulang; **tetap rotasi** kredensial apa pun yang pernah muncul di repo/SHA lama.

## Testing

```bash
npm run check
```

Test mencakup kontrak connector AgentsProxy, perhitungan harga/slot, rate limiter, breadcrumb, popover, dan ekspor laporan. CI menjalankan typecheck, lint, test, dan build pada setiap push/PR ke `main`.

## Struktur

```text
src/
├── app/                     # Landing page, /app, route API, metadata
│   ├── app/(protected)/     # Halaman manajemen (auth required)
│   ├── app/login/           # Login staf
│   └── api/                 # Shim same-origin (availability, chat, push, reports, health)
├── components/              # UI landing + manajemen
├── lib/
│   ├── proxy/               # Connector AgentsProxy (server + browser shim)
│   ├── env.ts               # Public env + fail-fast helper
│   ├── site.ts              # Canonical URL helper
│   └── ...                  # Domain logic (availability, pricing, kantin, dll.)
└── proxy.ts                 # Optimistic /app auth gate (Next proxy/middleware)
assets/                      # Source logo (tidak di-deploy)
docs/                        # PRD & panduan Telegram
public/                      # Hanya aset yang disajikan
```

## Dokumen

- [PRD](docs/PRD.md) — requirement produk (catatan: sebagian arsitektur awal sudah digantikan AgentsProxy).
- [Telegram setup (ID)](docs/telegram-setup-ID.md) · [EN](docs/telegram-setup-EN.md)
- [Security policy](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| Login selalu gagal | AgentsProxy tidak jalan / `NEXT_PUBLIC_PROXY_URL` salah |
| `/api/health` 503 | Proxy unreachable atau env belum diisi |
| Slot selalu hijau | `/api/availability` degraded; cek backend |
| Push tidak muncul | VAPID public/private tidak cocok, atau izin browser ditolak |
| Aset lama muncul setelah deploy | Service worker cache; hard reload atau tunggu update SW |
| Build gagal di CI | Jalankan `npm run check` dan pastikan env CI terisi |

---

Dibuat untuk Centrum Badminton Arena. Kode tidak dilisensikan untuk penggunaan ulang tanpa izin.
