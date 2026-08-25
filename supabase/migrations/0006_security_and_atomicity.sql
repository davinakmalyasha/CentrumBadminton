-- ============================================================
-- 0006: security hardening II + atomicity RPCs + hot-path indexes
-- Run in Supabase SQL Editor (idempotent-safe on a fresh project).
--
-- Contents:
--   1) Open-signup mitigation: self-signups start INACTIVE until an
--      owner activates them in Pengaturan. Accounts created via the
--      admin API (email confirmed by the server) stay active.
--      ALSO disable public signups entirely in Supabase Dashboard →
--      Authentication → Providers → Email (defense in depth).
--   2) Bookings: price columns locked against non-owner writes
--      (pegawai could previously PATCH override_price=0 via direct API).
--   3) Kantin: staff can no longer INSERT kantin_sales directly
--      (fabricated revenue); sales only via record_kantin_sale RPC.
--   4) Kantin stock can never go negative (DB constraint).
--   5) record_kantin_sale: deterministic row-locking (no oversell races).
--   6) adjust_kantin_stock / void_kantin_sale / bump_no_show RPCs:
--      replace read-modify-write app logic with atomic SQL.
--   7) top_customers / customer_stats RPCs: aggregated visit stats
--      (removes 2000-row fetches from pelanggan page & AI tools).
--   8) Indexes for recurring_series lookups and push_subscriptions RLS.
--   9) customers.phone format CHECK (NOT VALID — future writes only).
-- ============================================================

-- ------------------------------------------------------------
-- 1) handle_new_user: inactive until confirmed-by-admin or activated
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, is_active)
  values (
    new.id,
    'pegawai',
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    -- Admin-created accounts (createStaff) are confirmed server-side and
    -- start active. Public self-signups start inactive: zero data access
    -- (is_staff() requires is_active) until an owner enables them.
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2) Bookings: price columns are owner-immutable
-- ------------------------------------------------------------
create or replace function public.bookings_guard_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.override_price is distinct from old.override_price
      or new.computed_price is distinct from old.computed_price)
     and not public.is_owner() then
    raise exception 'PRICE_CHANGE_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_price_guard on public.bookings;
create trigger bookings_price_guard
  before update on public.bookings
  for each row execute function public.bookings_guard_price();

-- ------------------------------------------------------------
-- 3) Kantin sales: insert only through the tamper-proof RPC
-- ------------------------------------------------------------
drop policy if exists "kantin_sales_insert" on public.kantin_sales;

-- ------------------------------------------------------------
-- 4) Stock can never go negative
-- ------------------------------------------------------------
update public.kantin_products set stock = 0 where track_stock and stock < 0;

alter table public.kantin_products
  add constraint kantin_products_stock_nonneg
  check (not track_stock or stock >= 0);

-- ------------------------------------------------------------
-- 5) record_kantin_sale — same contract, concurrency-safe.
--    Items are processed in deterministic product_id order with
--    SELECT … FOR UPDATE so two concurrent sales cannot both pass
--    the stock check (previously READ COMMITTED lost-update race).
-- ------------------------------------------------------------
create or replace function public.record_kantin_sale(
  p_sale  jsonb,
  p_items jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_sale_id  uuid;
  v_item     jsonb;
  v_product  kantin_products%rowtype;
  v_total    numeric(10,0) := 0;
  v_qty      integer;
begin
  if v_user is null or not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  insert into public.kantin_sales (total, method, booking_id, customer_name, note, recorded_by)
  values (
    0,
    coalesce(p_sale->>'method', 'cash')::public.payment_method,
    (nullif(p_sale->>'booking_id', ''))::uuid,
    nullif(p_sale->>'customer_name', ''),
    nullif(p_sale->>'note', ''),
    v_user
  )
  returning id into v_sale_id;

  for v_item in
    select * from jsonb_array_elements(p_items) item
    order by (item->>'product_id')
  loop
    select * into v_product
    from public.kantin_products
    where id = (v_item->>'product_id')::uuid and is_active
    for update;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'BAD_QTY';
    end if;
    -- stock re-checked under row lock → no oversell
    if v_product.track_stock and v_product.stock < v_qty then
      raise exception 'OUT_OF_STOCK:%', v_product.name;
    end if;

    v_total := v_total + (v_product.price * v_qty);

    insert into public.kantin_sale_items (sale_id, product_id, product_name, qty, unit_price, unit_cost)
    values (v_sale_id, v_product.id, v_product.name, v_qty, v_product.price, v_product.cost_price);

    if v_product.track_stock then
      update public.kantin_products
      set stock = stock - v_qty
      where id = v_product.id;
      insert into public.kantin_stock_movements (product_id, delta, reason, created_by)
      values (v_product.id, -v_qty, 'sale', v_user);
    end if;
  end loop;

  update public.kantin_sales set total = v_total where id = v_sale_id;

  return json_build_object('sale_id', v_sale_id, 'total', v_total);
end;
$$;

revoke execute on function public.record_kantin_sale(jsonb, jsonb) from public, anon;
grant  execute on function public.record_kantin_sale(jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6a) adjust_kantin_stock — atomic delta application + audit row
-- ------------------------------------------------------------
create or replace function public.adjust_kantin_stock(
  p_product_id uuid,
  p_delta      integer,          -- restock/waste: magnitude (>0); correction: absolute count
  p_reason     text,             -- restock | waste | correction
  p_note       text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_product kantin_products%rowtype;
  v_new     integer;
  v_move    integer;
begin
  if v_user is null or not public.is_owner() then
    raise exception 'FORBIDDEN';
  end if;
  if p_reason not in ('restock', 'waste', 'correction') then
    raise exception 'BAD_REASON';
  end if;
  if p_delta is null or p_delta < 1 or p_delta > 999999 then
    raise exception 'BAD_QTY';
  end if;

  select * into v_product
  from public.kantin_products
  where id = p_product_id
  for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if not v_product.track_stock then
    raise exception 'NOT_TRACKED:%', v_product.name;
  end if;

  if p_reason = 'restock' then
    v_new := v_product.stock + p_delta;
    v_move := p_delta;
  elsif p_reason = 'waste' then
    v_new := v_product.stock - p_delta;
    v_move := -p_delta;
  else
    v_new := p_delta;             -- correction: absolute physical count
    v_move := p_delta - v_product.stock;
  end if;

  if v_new < 0 then
    raise exception 'NEGATIVE_STOCK:%', v_product.name;
  end if;
  if v_move = 0 then
    raise exception 'NO_CHANGE';
  end if;

  update public.kantin_products set stock = v_new where id = v_product.id;

  insert into public.kantin_stock_movements (product_id, delta, reason, note, created_by)
  values (v_product.id, v_move, p_reason, p_note, v_user);

  return v_new;
end;
$$;

revoke execute on function public.adjust_kantin_stock(uuid, integer, text, text) from public, anon;
grant  execute on function public.adjust_kantin_stock(uuid, integer, text, text) to authenticated;

-- ------------------------------------------------------------
-- 6b) void_kantin_sale — atomic void: lock sale, restore tracked
--     stock, write movements, delete (items cascade).
--     Fixes: double-void race, lost stock restores, silent failures.
-- ------------------------------------------------------------
create or replace function public.void_kantin_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_owner() then
    raise exception 'FORBIDDEN';
  end if;
  if p_sale_id is null then
    raise exception 'SALE_NOT_FOUND';
  end if;

  -- Serialize concurrent voids of the same sale
  perform id from public.kantin_sales where id = p_sale_id for update;
  if not found then
    raise exception 'SALE_NOT_FOUND';
  end if;

  with items as (
    select si.product_id, sum(si.qty)::integer as qty_sum
    from public.kantin_sale_items si
    where si.sale_id = p_sale_id and si.product_id is not null
    group by si.product_id
  ),
  restored as (
    update public.kantin_products p
       set stock = p.stock + items.qty_sum
      from items
     where p.id = items.product_id
       and p.track_stock
    returning p.id, items.qty_sum
  )
  insert into public.kantin_stock_movements (product_id, delta, reason, created_by)
  select id, qty_sum, 'void', v_user from restored;

  delete from public.kantin_sales where id = p_sale_id;
end;
$$;

revoke execute on function public.void_kantin_sale(uuid) from public, anon;
grant  execute on function public.void_kantin_sale(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6c) bump_no_show — atomic counter increment tied to a booking
-- ------------------------------------------------------------
create or replace function public.bump_no_show(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.customers
     set no_show_count = no_show_count + 1
   where id = (select customer_id from public.bookings where id = p_booking_id);
$$;

revoke execute on function public.bump_no_show(uuid) from public, anon;
grant  execute on function public.bump_no_show(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7) Aggregated customer stats (replaces 2000-row JS tallies)
-- ------------------------------------------------------------
create or replace function public.top_customers(p_limit integer default 5)
returns table (
  name            text,
  phone           text,
  no_show_count   integer,
  visits          bigint,
  last_visit      date
)
language sql
stable
set search_path = public
as $$
  select c.name, c.phone, c.no_show_count,
         count(b.id) filter (where b.status <> 'cancelled' and b.status <> 'no_show') as visits,
         max(b.booking_date) filter (where b.status <> 'cancelled' and b.status <> 'no_show') as last_visit
    from public.customers c
    left join public.bookings b on b.customer_id = c.id
   group by c.id
   order by visits desc nulls last, last_visit desc nulls last, c.name asc
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

create or replace function public.customer_stats()
returns table (
  customer_id uuid,
  visits      bigint,
  last_visit  date
)
language sql
stable
set search_path = public
as $$
  select b.customer_id,
         count(*) filter (where b.status <> 'cancelled' and b.status <> 'no_show'),
         max(b.booking_date) filter (where b.status <> 'cancelled' and b.status <> 'no_show')
    from public.bookings b
   where b.customer_id is not null
   group by b.customer_id;
$$;

-- RLS note: callers are staff; underlying tables are already readable
-- by is_staff(). Functions run as invoker, so RLS still applies.
grant execute on function public.top_customers(integer) to authenticated;
grant execute on function public.customer_stats() to authenticated;

-- ------------------------------------------------------------
-- 8) Hot-path indexes
-- ------------------------------------------------------------
create index if not exists bookings_series_date_idx
  on public.bookings (recurring_series_id, booking_date);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id);

-- ------------------------------------------------------------
-- 9) Phone sanity for wa.me deep links (future writes only)
-- ------------------------------------------------------------
alter table public.customers
  add constraint customers_phone_format
  check (phone ~ '^[0-9]{8,16}$') not valid;
