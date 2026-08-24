-- ============================================================
-- 0004: production security hardening (RLS + constraints)
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1) Payments: pegawai may INSERT/SELECT but never UPDATE.
--    PRD: "both record; owner edit/delete" — previously pegawai
--    could edit any payment's amount (falsifiable money trail).
drop policy if exists "payments_update_staff" on public.payments;

-- 2) Bookings: forbid negative/absurd prices at DB level
--    (RLS is row-level only; without CHECK a staff token could
--    insert computed_price = -1 via direct API).
alter table public.bookings
  add constraint bookings_price_check
  check (computed_price >= 0 and computed_price <= 100000000
         and (override_price is null or override_price >= 0));

-- 3) Payments amount sanity (numeric(10,0) already caps at 10 digits;
--    explicit positive check for direct-API writes).
alter table public.payments
  add constraint payments_amount_check
  check (amount > 0 and amount <= 100000000);

-- 4) Expenses same treatment.
alter table public.expenses
  add constraint expenses_amount_check
  check (amount > 0 and amount <= 1000000000);
