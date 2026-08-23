-- ============================================================
-- Centrum Badminton Arena — initial schema
-- ============================================================

create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.user_role as enum ('owner', 'pegawai');
create type public.booking_status as enum ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');
create type public.booking_source as enum ('whatsapp', 'walk_in');
create type public.payment_method as enum ('cash', 'qris');
create type public.payment_status as enum ('unpaid', 'partial', 'paid');
create type public.series_status as enum ('active', 'paused', 'ended');

-- ------------------------------------------------------------
-- Profiles (linked to auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'pegawai',
  full_name   text not null default '',
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'App users: owner & pegawai. Created automatically on auth signup.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'pegawai',
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Role helpers (security definer avoids recursive RLS on profiles)
-- ------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner' and p.is_active
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

-- Callable by app sessions (boolean-only helpers, safe to expose)
grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- ------------------------------------------------------------
-- Courts
-- ------------------------------------------------------------
create table public.courts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Pricing rules (effective-date aware)
-- ------------------------------------------------------------
create table public.pricing_rules (
  id            uuid primary key default gen_random_uuid(),
  valid_from    date not null unique,
  open_time     time not null default '07:00',
  close_time    time not null default '23:00',
  day_start     time not null default '07:00',
  day_end       time not null default '17:00',
  price_day     numeric(10,0) not null check (price_day >= 0),
  price_evening numeric(10,0) not null check (price_evening >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Customers (auto-enriched directory)
-- ------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text not null unique,
  no_show_count  integer not null default 0,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Recurring booking series (komunitas weekly)
-- ------------------------------------------------------------
create table public.recurring_series (
  id            uuid primary key default gen_random_uuid(),
  court_id      uuid not null references public.courts (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete set null,
  customer_name text not null,
  customer_phone text,
  weekday       smallint not null check (weekday between 0 and 6), -- 0=Sunday
  start_time    time not null,
  end_time      time not null check (end_time > start_time),
  start_date    date not null,
  end_date      date,
  status        public.series_status not null default 'active',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Bookings
-- ------------------------------------------------------------
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  court_id            uuid not null references public.courts (id) on delete restrict,
  booking_date        date not null,
  start_time          time not null,
  end_time            time not null check (end_time > start_time),
  status              public.booking_status not null default 'confirmed',
  source              public.booking_source not null default 'whatsapp',
  customer_id         uuid references public.customers (id) on delete set null,
  customer_name       text not null,
  customer_phone      text,
  recurring_series_id uuid references public.recurring_series (id) on delete set null,
  computed_price      numeric(10,0) not null default 0,
  override_price      numeric(10,0),
  payment_status      public.payment_status not null default 'unpaid',
  notes               text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- prevent double-booking per court (cancelled/no_show excluded)
  constraint bookings_no_overlap exclude using gist (
    court_id with =,
    tsrange(booking_date::timestamp + start_time, booking_date::timestamp + end_time) with &&
  ) where (status not in ('cancelled', 'no_show'))
);

create index bookings_date_idx on public.bookings (booking_date);
create index bookings_court_date_idx on public.bookings (court_id, booking_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Payments (cash / QRIS recorded manually)
-- ------------------------------------------------------------
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  amount      numeric(10,0) not null check (amount > 0),
  method      public.payment_method not null default 'cash',
  paid_at     timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  note        text
);

create index payments_booking_idx on public.payments (booking_id);
create index payments_paid_at_idx on public.payments (paid_at);

-- Keep bookings.payment_status in sync with recorded payments
create or replace function public.recalc_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid := coalesce(new.booking_id, old.booking_id);
  v_price numeric;
  v_paid numeric;
begin
  if v_booking_id is null then
    return null;
  end if;

  select coalesce(override_price, computed_price)
    into v_price
    from public.bookings where id = v_booking_id;

  select coalesce(sum(amount), 0)
    into v_paid
    from public.payments where booking_id = v_booking_id;

  update public.bookings
     set payment_status = case
       when v_price is null or v_price <= 0 then 'unpaid'::public.payment_status
       when v_paid >= v_price then 'paid'::public.payment_status
       when v_paid > 0 then 'partial'::public.payment_status
       else 'unpaid'::public.payment_status
     end
   where id = v_booking_id;

  return null;
end;
$$;

create trigger payments_recalc_status
  after insert or update or delete on public.payments
  for each row execute function public.recalc_payment_status();

create trigger bookings_recalc_status_on_price_change
  after update of override_price, computed_price on public.bookings
  for each row execute function public.recalc_payment_status();

-- ------------------------------------------------------------
-- Court blocks (maintenance / private events)
-- ------------------------------------------------------------
create table public.court_blocks (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid references public.courts (id) on delete cascade, -- null = all courts
  block_date date not null,
  start_time time not null default '07:00',
  end_time   time not null default '23:00',
  reason     text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index court_blocks_date_idx on public.court_blocks (block_date);

-- ------------------------------------------------------------
-- Expenses (owner only)
-- ------------------------------------------------------------
create table public.expenses (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  amount     numeric(10,0) not null check (amount > 0),
  note       text,
  spent_at   date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index expenses_spent_at_idx on public.expenses (spent_at);

-- ------------------------------------------------------------
-- Public availability RPC (anon-safe, no PII)
-- Returns busy intervals for a given day; landing page computes free slots.
-- ------------------------------------------------------------
create or replace function public.get_day_busy(p_date date)
returns table (
  court_id   uuid,
  court_name text,
  start_time time,
  end_time   time,
  kind       text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.court_id, c.name, b.start_time, b.end_time, 'booked'::text
    from public.bookings b
    join public.courts c on c.id = b.court_id
   where b.booking_date = p_date
     and b.status not in ('cancelled', 'no_show')
  union all
  select cb.court_id, c2.name, cb.start_time, cb.end_time, 'blocked'::text
    from public.court_blocks cb
    left join public.courts c2 on c2.id = cb.court_id
   where cb.block_date = p_date;
$$;

grant execute on function public.get_day_busy(date) to anon, authenticated;

-- Active pricing rule for a date (anon-safe; landing shows prices)
create or replace function public.get_pricing_for(p_date date)
returns table (
  open_time     time,
  close_time    time,
  day_start     time,
  day_end       time,
  price_day     numeric,
  price_evening numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.open_time, pr.close_time, pr.day_start, pr.day_end,
         pr.price_day, pr.price_evening
    from public.pricing_rules pr
   where pr.is_active and pr.valid_from <= p_date
   order by pr.valid_from desc
   limit 1;
$$;

grant execute on function public.get_pricing_for(date) to anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles         enable row level security;
alter table public.courts           enable row level security;
alter table public.pricing_rules    enable row level security;
alter table public.customers        enable row level security;
alter table public.recurring_series enable row level security;
alter table public.bookings         enable row level security;
alter table public.payments         enable row level security;
alter table public.court_blocks     enable row level security;
alter table public.expenses         enable row level security;

-- profiles: self read/update basics; owner manages all
create policy "profiles_select_self_or_owner"
  on public.profiles for select
  using (id = auth.uid() or public.is_owner());

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_manage_all_owner"
  on public.profiles for update
  using (public.is_owner())
  with check (public.is_owner());

-- courts: public read, owner write
create policy "courts_read_all"   on public.courts for select using (true);
create policy "courts_write_owner" on public.courts for all
  using (public.is_owner()) with check (public.is_owner());

-- pricing_rules: public read, owner write
create policy "pricing_read_all" on public.pricing_rules for select using (true);
create policy "pricing_write_owner" on public.pricing_rules for all
  using (public.is_owner()) with check (public.is_owner());

-- customers: staff read/write, owner delete
create policy "customers_read_staff" on public.customers for select using (public.is_staff());
create policy "customers_insert_staff" on public.customers for insert with check (public.is_staff());
create policy "customers_update_staff" on public.customers for update using (public.is_staff()) with check (public.is_staff());
create policy "customers_delete_owner" on public.customers for delete using (public.is_owner());

-- bookings: staff read/write, owner delete
create policy "bookings_read_staff" on public.bookings for select using (public.is_staff());
create policy "bookings_insert_staff" on public.bookings for insert with check (public.is_staff());
create policy "bookings_update_staff" on public.bookings for update using (public.is_staff()) with check (public.is_staff());
create policy "bookings_delete_owner" on public.bookings for delete using (public.is_owner());

-- payments: staff insert/read/update, owner delete
create policy "payments_read_staff" on public.payments for select using (public.is_staff());
create policy "payments_insert_staff" on public.payments for insert with check (public.is_staff());
create policy "payments_update_staff" on public.payments for update using (public.is_staff()) with check (public.is_staff());
create policy "payments_delete_owner" on public.payments for delete using (public.is_owner());

-- recurring_series: owner only
create policy "series_owner_all" on public.recurring_series for all
  using (public.is_owner()) with check (public.is_owner());

-- court_blocks: staff read, owner write
create policy "blocks_read_staff" on public.court_blocks for select using (public.is_staff());
create policy "blocks_write_owner" on public.court_blocks for all
  using (public.is_owner()) with check (public.is_owner());

-- expenses: owner only
create policy "expenses_owner_all" on public.expenses for all
  using (public.is_owner()) with check (public.is_owner());

-- ============================================================
-- Realtime (landing page live availability)
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.court_blocks;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.bookings replica identity full;
alter table public.court_blocks replica identity full;
