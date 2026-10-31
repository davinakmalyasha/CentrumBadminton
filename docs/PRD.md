# PRD — Centrum Badminton Arena Platform (v1.0)

> **Status (Oktober 2026):** Ini adalah PRD awal. Sebagian arsitektur sudah
> digantikan: Supabase/Gemini tidak lagi dipakai. Backend sekarang
> **AgentsProxy** (Go + Postgres + Redis), dan frontend hanya berbicara ke
> proxy lewat `src/lib/proxy/`. Untuk arsitektur dan cara deploy terkini,
> lihat [README](../README.md). Bagian historis dipertahankan sebagai konteks
> keputusan produk.

## 1. Overview

Single **Next.js** repository serving two products from one root folder:

```
CentrumBadminton/                 ← single project root
├── src/app/                      ← Landing page (public)
├── src/app/app/                  ← Management PWA ("mobile" app lives here)
├── src/lib/proxy/                ← AgentsProxy connector
├── docs/PRD.md                   ← this document
└── assets/                       ← source art (tidak di-deploy)
```

| | |
|---|---|
| Venue | GOR Centrum Badminton Arena — Jl. Pangeran Cakra Buana, Griya Cempaka Arum – Talun, Cirebon 45171 (belakang Indomaret Cempaka Arum) |
| Courts | 2 indoor courts, vinyl interlock floor |
| Hours | Daily 07:00–23:00 WIB |
| Pricing | Rp40.000/jam (07:00–17:00) · Rp50.000/jam (17:00–23:00) |
| WhatsApp | +62 815-9408-136 → `wa.me/628159408136` |
| Socials | IG `@centrum_badminton_arena` · FB *Centrum Badminton Arena* |
| Stack | Next.js 16 + TypeScript + Tailwind CSS v4 · AgentsProxy (Go/Postgres/Redis) · Vercel |

## 2. Users & Roles

| Role | Where | Access |
|---|---|---|
| Guest/Customer | Landing page | View availability/pricing/facilities, book via WhatsApp |
| Pegawai | `/app` | Bookings CRUD, walk-ins, check-in/out, payments entry, customers |
| Owner | `/app` | Everything + blocks, recurring series, reports, expenses, settings, AI, staff management |

## 3. Auth & Session Policy

- **No public register.** Akun dibuat oleh Owner in-app (*Pengaturan → Kelola Pegawai*) atau lewat tooling backend. Login email+password.
- **Sesi permanen 30 hari**: token disimpan di cookie `__Host-proxy_session` (production) yang `httpOnly`, `Secure`, `Path=/`, dan `SameSite=Lax`. Nama lama `proxy_session` tetap dibaca sebagai fallback. Tidak ada idle timeout; keluar hanya lewat tombol **Keluar** (yang juga me-revoke sesi di backend).
- Validasi sesi: `GET /v1/auth/me` di `(protected)/layout.tsx`. Proxy hanya melakukan redirect optimistis.
- Otorisasi: page guard + pengecekan role di server action; backend tetap menjadi otoritas akhir. Backend down tidak diperlakukan sebagai logout.

## 4. Landing Page Features

| # | Feature | Spec |
|---|---|---|
| L1 | Hero | Name, **live Google rating badge**, photo/video carousel (placeholders initially), CTA scroll-to-schedule + WA button |
| L2 | Live Availability | Date picker → timeline grid, both courts, hourly slots 07–23; states: available/booked/past/blocked; peak-price color coding; polling 5 detik lewat `/api/availability` (berhenti saat tab hidden) |
| L3 | WA Booking Deep Link | Multi-slot selection → prefilled message (court, date, times, total price) → `wa.me/628159408136`. Payment settled in chat (cash/QRIS) |
| L4 | Pricing | Rate table + hours |
| L5 | Facilities | 8-item grid (vinyl interlock ×2, wasit & scoreboard, lampu, indoor, ruang tunggu & kantin, musholla, toilet bersih, parkir) |
| L6 | Location | Maps embed on page; tap/click opens native Google Maps directions directly |
| L7 | Reviews & socials | IG/FB links, review highlight section |
| L8 | i18n | ID default + EN toggle |
| L9 | SEO | Meta/OG, LocalBusiness structured data, sitemap |

### Dynamic Google Rating ⭐
- Server-side fetch via **Google Places API (Place Details)**: returns `rating` + `user_ratings_total` live.
- Cached with 24h revalidation (`next: { revalidate: 86400 }`) — always fresh enough, negligible API cost (within free credit).
- Fallback: last cached value shown if API unreachable. Requires `GOOGLE_PLACES_API_KEY` + resolved `place_id` stored in env.

## 5. Management PWA Features (`/app`)

Installable home-screen app on iPhone (Safari → Add to Home Screen) & Android (Chrome install prompt); offline shell for previously loaded views.

**A. Dashboard** *(both)* — today's bookings, next check-in, occupancy %, revenue today (cash/QRIS split).
**B. Calendar & Bookings** *(both)* — day timeline per court + week view; create/edit/cancel; statuses `pending→confirmed→checked_in→completed` / `cancelled` / `no_show`; source tag `whatsapp|walk_in`; auto price w/ owner override; double-booking prevention.
**C. Check-in/out** *(both)* — one-tap status transitions.
**D. Payments** *(both record; owner edit/delete)* — cash/QRIS, partial DP support (`unpaid|partial|paid`), daily-close summary view.
**E. Recurring Series** *(owner)* — weekly repeating bookings (komunitas), auto-instance generation, pause/end, conflict-aware.
**F. Customer Directory** *(both)* — auto-built profiles (name, phone, visits, last visit, no-show count), autocomplete on booking create, tap-to-WA.
**G. No-show Tracking** *(both)* — flag + counter surfaced on profile.
**H. Court Blocks** *(owner)* — maintenance/event blocking, reflected instantly on landing availability.
**I. Reports** *(owner)* — revenue by day/week/month, per-court utilization, peak heatmap, CSV export.
**J. Expenses** *(owner)* — entries (listrik, gaji, …) → gross vs net reporting.
**K. AI Assistant — AgentsProxy** *(owner/pegawai)* — chat UI; LLM key hanya di backend; tool-calling dan memory ada di AgentsProxy (`POST /v1/agent/chat`); **Daily Closing Report** diformat untuk WhatsApp; kuota per role ditegakkan di backend + limiter lokal.
**L. Notifications** — new booking alert + daily-report reminder; PWA push didaftarkan lewat `/api/push/subscriptions` ke AgentsProxy; Telegram tetap kanal utama backend.
**M. Settings** *(owner)* — courts, hours, pricing rules (effective-date aware), WA number, venue info, **staff management (create/disable pegawai)**.

## 6. Data Model (historis — Supabase)

> Skema saat ini ada di repo AgentsProxy (`internal/db/migrations`), memakai
> tabel `sports_*` dengan tenant isolation. Model di bawah adalah desain awal
> yang dipertahankan untuk konteks; nama kolom di connector sudah dipetakan ke
> endpoint proxy (`facility_id`, `price`, `series`, dst.).

```
profiles(id, role: owner|pegawai, name, phone, is_active)
courts(id, name, is_active)
pricing_rules(id, valid_from, day_start, day_end, price_day, price_evening, is_active)
bookings(id, court_id, date, start_time, end_time,
         status, source, customer_id?, recurring_series_id?,
         computed_price, override_price?, notes, created_by)
payments(id, booking_id, amount, method: cash|qris, paid_at, recorded_by)
recurring_series(id, court_id, weekday, start_time, end_time, start_date, end_date?, status)
customers(id, name, phone, no_show_count)   -- auto-enriched
court_blocks(id, court_id?, date_start, time_start, time_end, reason)
expenses(id, category, amount, note, spent_at, created_by)
```
RLS: pegawai → bookings/payments/customers read-write, zero access to expenses/reports/profiles/settings; owner → all.

## 7. Non-Goals (v1)

1. Online payment gateway (Xendit/Midtrans) — payments stay manual cash/QRIS via WA
2. Customer accounts / customer-facing app or web booking-without-WA
3. Kantin/café POS — **dikerjakan setelah v1** (sekarang sudah ada di app)
4. Automated WhatsApp reply bot (chat remains human)
5. Payroll & employee attendance management
6. Multi-venue/branch support
7. Native App Store/Play Store builds (PWA only)
8. Tournament/ladder management tools

## 8. Future Roadmap (post-v1)

- **v1.1**: Xendit integration → self-service online booking & payment, auto-confirmation
- **v1.2**: WA notification bot (auto confirm/remind), kantin POS-lite
- **v2**: Full customer app experience (accounts, history, membership packages)

## 9. Milestones

| Phase | Deliverable |
|---|---|
| 1 | Repo setup, Supabase schema+migrations+seed, auth (roles, permanent session), staff creation |
| 2 | Landing page complete (L1–L9 incl. live rating + availability + WA deep link) |
| 3 | PWA core: dashboard, calendar, bookings, check-in/out, payments, customers |
| 4 | Recurring series, blocks, reports, expenses, settings |
| 5 | Gemini assistant + daily closing report, notifications |
| 6 | PWA polish (manifest/service worker/icons), i18n pass, SEO, deploy Vercel + Supabase prod |

## 10. Success Metrics

- 100% of bookings tracked in system (zero unrecorded)
- <30s for a walk-in booking entry
- Owner checks revenue daily without asking pegawai
- Daily closing report generated ≤10 seconds via AI
- Landing Lighthouse ≥90 performance/SEO
