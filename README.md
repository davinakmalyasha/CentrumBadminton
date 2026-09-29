# Centrum Badminton Arena — Digital Platform

Landing page publik + aplikasi manajemen (PWA) untuk GOR Centrum Badminton Arena, Cirebon.

- **Landing page** (`/`) — info venue, ketersediaan slot realtime, booking via WhatsApp deep link
- **Management app** (`/app`) — PWA untuk Owner & Pegawai: booking, pembayaran cash/QRIS, laporan, AI assistant (via AgentsProxy)

Stack: Next.js 16 · TypeScript · Tailwind CSS v4 · AgentsProxy (Go) — single shared LLM_API_KEY · Vercel

Dokumentasi produk lengkap: [`docs/PRD.md`](docs/PRD.md)

## Struktur

```
src/
├── app/                  # Landing page (public) + ChatWidget (client)
├── app/app/login/        # Login management app
├── app/app/(protected)/  # Management app (auth required) — jadwal, kantin, laporan, AI (pegawai/owner)
├── lib/proxy/            # AgentsProxy connector (client.ts + browser.ts + register.ts)
├── lib/types.ts          # Domain types
└── proxy.ts              # Optimistic auth guard untuk /app/* (proxy_session)
# Schema + RLS now lives in AgentsProxy/internal/db/migrations (021_sports_users, 023_centrum_gaps, etc.)
```

## Setup

### 1. Install dependencies

```bash
npm install
cp .env.local.example .env.local   # lalu isi nilainya
```

### 2. Setup AgentsProxy (Go backend, single shared LLM_API_KEY)

Lihat `D:\MyProject\AgentsProxy\.env` — `DATABASE_URL`, `REDIS_URL`, `LLM_API_KEY` (Google `AIza...` via `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/` + `LLM_MODEL=gemini-2.0-flash`), `ADMIN_API_KEY`, `TELEGRAM_BOT_TOKEN` (for auto daily report). Jalankan:

```powershell
cd D:\MyProject\AgentsProxy
. .\scripts\load-env.ps1
go run ./cmd/server # :8080, auto-migrate, healthz
```

### 3. Buat akun Owner

Lewat proxy (bukan Supabase Dashboard). Seed sudah ada `owner@centrumbadminton.id` (role owner) di `sports_users`. Untuk owner pertama manual:

```powershell
# via psql
psql "postgres://postgres:postgres@localhost:5432/agents_proxy?sslmode=disable" -c "INSERT INTO sports_users (tenant_id,email,password_hash,role,full_name) VALUES ('centrum','owner@centrumbadminton.id', crypt('owner123', gen_salt('bf')), 'owner','Owner') ON CONFLICT DO NOTHING;"
```

Akun **pegawai** dibuat owner dari dalam app (**Pengaturan → Staf → Buat Akun Pegawai**) — via `POST /v1/auth/register` dengan `X-Session-Token` owner, no Supabase key needed.

### 4. Jalankan

```bash
npm run dev        # http://localhost:3000  |  app: http://localhost:3000/app
```

## Scripts

| Command | Fungsi |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest — logika harga, slot, bulan) |

## Catatan Sesi

Login bersifat permanen (auto-refresh token via cookie) — tidak ada logout otomatis; keluar hanya melalui tombol **Keluar**.

## PWA & Push Notification

Aplikasi manajemen (`/app`) dapat di-*install* ke home screen:

- **Android/Chrome**: menu titik tiga → *Install app* (atau banner install otomatis)
- **iPhone/Safari**: Share → *Add to Home Screen* (butuh iOS 16.4+ untuk push)

Push notification booking baru butuh VAPID keys:

```bash
npx web-push generate-vapid-keys
# isi NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY di .env.local
```

Fan-out push via `sendPushToAll` sekarang no-op (Telegram is main channel via `AgentsProxy`); VAPID tetap untuk PWA install.

## Deploy ke Production

1. **AgentsProxy** — deploy Go binary ke Railway/VPS (`Dockerfile` scratch ~15MB), set `DATABASE_URL` (Supabase pooler 6543), `REDIS_URL`, `LLM_API_KEY` (single shared), `ADMIN_API_KEY`, `TELEGRAM_BOT_TOKEN` (for 23:00 auto daily report)
2. **Vercel** — import repo GitHub `davinakmalyasha/CentrumBadminton`, framework auto-detect Next.js
3. **Environment Variables** (Vercel → Settings → Environment Variables) — salin dari `.env.local`:
   - `NEXT_PUBLIC_SITE_URL=https://domainmu.vercel.app`
   - `NEXT_PUBLIC_PROXY_URL=https://your-proxy.fly.dev` + `NEXT_PUBLIC_TENANT_ID=centrum`, VAPID keys, `GOOGLE_PLACES_API_KEY`+`GOOGLE_PLACE_ID` (opsional)
   - Tidak perlu `SUPABASE_*` atau `GEMINI_API_KEY` lagi — semua via proxy
4. **Domain** (opsional): custom domain lewat Vercel Settings → Domains
