-- ============================================================
-- Centrum Badminton Arena — seed data
-- Run automatically by `supabase db reset` / `supabase start`
-- ============================================================

insert into public.courts (name, sort_order)
values ('Lapangan 1', 1), ('Lapangan 2', 2)
on conflict (name) do nothing;

insert into public.pricing_rules (
  valid_from, open_time, close_time, day_start, day_end,
  price_day, price_evening, is_active
)
values (
  '2024-01-01', '07:00', '23:00', '07:00', '17:00',
  40000, 50000, true
)
on conflict (valid_from) do nothing;
