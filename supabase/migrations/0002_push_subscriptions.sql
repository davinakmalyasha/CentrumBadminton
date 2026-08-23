-- ============================================================
-- Centrum Badminton Arena — push notification subscriptions
-- ============================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null, -- {p256dh, auth}
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "subs_manage_own"
  on public.push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
