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
   lalu `0002`–`0006` secara berurutan
3. Jalankan seluruh isi `supabase/seed.sql` (lapangan + harga default)
4. Salin **Project URL** dan **anon key** (Settings → API) ke `.env.local`
5. **Keamanalan signup**: Dashboard → Authentication → Providers → Email →
   matikan *Allow new users to sign up*. Sebagai lapis kedua, migration `0006`
   membuat profil hasil self-signup **tidak aktif** (nol akses data) sampai
   owner mengaktifkannya di Pengaturan → Staf.

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

Akun **pegawai** dibuat owner dari dalam app (**Pengaturan → Staf → Buat Akun Pegawai**) —
butuh env `SUPABASE_SERVICE_ROLE_KEY`. Hanya akun owner pertama yang perlu dibuat manual di sini.

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

Fan-out push membaca daftar perangkat semua staf via service-role, jadi
`SUPABASE_SERVICE_ROLE_KEY` wajib diisi agar notifikasi terkirim.

Lalu tekan ikon 🔕 di header aplikasi dan izinkan notifikasi. Perangkat yang
terdaftar bisa dilihat/dihapus di **Pengaturan → Perangkat Saya**.

### Catatan model Gemini

Default model: `gemini-3.5-flash` (model lama seperti `gemini-2.5-flash` sudah
dimatikan Google). Jika suatu saat model retired, set `GEMINI_MODEL` di env
(mis. `gemini-3.6-flash`) lalu redeploy.

## Deploy ke Production

1. **Supabase** — jalankan semua file `supabase/migrations/*.sql` + `seed.sql` di SQL Editor project production; aktifkan *Automatic RLS*; matikan *Allow new users to sign up*
2. **Vercel** — import repo GitHub `davinakmalyasha/CentrumBadminton`, framework auto-detect Next.js
3. **Environment Variables** (Vercel → Settings → Environment Variables) — salin semua dari `.env.local`:
   - `NEXT_PUBLIC_SITE_URL=https://domainmu.vercel.app`
   - Supabase URL/anon key + `SUPABASE_SERVICE_ROLE_KEY` (buat akun pegawai), `GEMINI_API_KEY`, VAPID keys, `GOOGLE_PLACES_API_KEY`+`GOOGLE_PLACE_ID` (opsional)
4. **Domain** (opsional): custom domain lewat Vercel Settings → Domains
