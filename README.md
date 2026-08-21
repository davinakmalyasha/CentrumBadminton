# Centrum Badminton Arena — Digital Platform

Landing page publik + aplikasi manajemen (PWA) untuk GOR Centrum Badminton Arena, Cirebon.

- **Landing page** (`/`) — info venue, ketersediaan slot realtime, booking via WhatsApp deep link
- **Management app** (`/app`) — PWA untuk Owner & Pegawai: booking, pembayaran cash/QRIS, laporan, AI assistant (Gemini)

Stack: Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase (Postgres/Auth/Realtime/RLS) · Gemini Flash · Vercel

Dokumentasi produk lengkap: [`docs/PRD.md`](docs/PRD.md)

## Struktur

```
src/
├── app/                  # Landing page (public)
├── app/app/login/        # Login management app
├── app/app/(protected)/  # Management app (auth required)
├── lib/supabase/         # Supabase clients (browser & server)
├── lib/types.ts          # Domain types
└── proxy.ts              # Optimistic auth guard untuk /app/*
supabase/
├── migrations/0001_init.sql   # Schema + RLS + RPC
└── seed.sql                   # Lapangan & harga default
```

## Setup

### 1. Install dependencies

```bash
npm install
cp .env.local.example .env.local   # lalu isi nilainya
```

### 2. Setup database Supabase

1. Buat project di [supabase.com](https://supabase.com) (region Singapore terdekat)
2. Buka **SQL Editor** → jalankan seluruh isi `supabase/migrations/0001_init.sql`
3. Jalankan seluruh isi `supabase/seed.sql` (lapangan + harga default)
4. Salin **Project URL** dan **anon key** (Settings → API) ke `.env.local`

### 3. Buat akun Owner

Registrasi publik dinonaktifkan sesuai PRD — akun dibuat manual:

1. Supabase Dashboard → **Authentication → Users → Add user**
   (email + password, centang *Auto Confirm User*)
2. Promosikan user pertama menjadi owner via SQL Editor:

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users order by created_at desc limit 1);
```

Akun pegawai nanti dibuat oleh owner dari dalam app (Pengaturan → Kelola Pegawai, Fase 4).

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

## Catatan Sesi

Login bersifat permanen (auto-refresh token via cookie) — tidak ada logout otomatis; keluar hanya melalui tombol **Keluar**.
