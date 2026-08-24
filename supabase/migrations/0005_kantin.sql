-- ============================================================
-- 0005: Kantin POS — products, sales, items, stock movements
-- Run in Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table public.kantin_products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text not null default 'lainnya',
  price               numeric(10,0) not null check (price >= 0),
  cost_price          numeric(10,0) not null default 0 check (cost_price >= 0),
  track_stock         boolean not null default false,
  stock               integer not null default 0,
  low_stock_threshold integer not null default 5,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

create table public.kantin_sales (
  id            uuid primary key default gen_random_uuid(),
  total         numeric(10,0) not null check (total >= 0),
  method        public.payment_method not null default 'cash',
  booking_id    uuid references public.bookings (id) on delete set null,
  customer_name text,
  note          text,
  recorded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.kantin_sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.kantin_sales (id) on delete cascade,
  product_id   uuid references public.kantin_products (id) on delete set null,
  product_name text not null,
  qty          integer not null check (qty > 0),
  unit_price   numeric(10,0) not null,
  unit_cost    numeric(10,0) not null default 0
);

create table public.kantin_stock_movements (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.kantin_products (id) on delete cascade,
  delta      integer not null,
  reason     text not null, -- sale | restock | waste | correction | void
  note       text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index kantin_sales_created_idx on public.kantin_sales (created_at);
create index kantin_sale_items_sale_idx on public.kantin_sale_items (sale_id);
create index kantin_stock_mov_product_idx on public.kantin_stock_movements (product_id, created_at);

alter table public.kantin_products        enable row level security;
alter table public.kantin_sales           enable row level security;
alter table public.kantin_sale_items      enable row level security;
alter table public.kantin_stock_movements enable row level security;

-- RLS: staff read+insert, owner manage
create policy "kantin_products_read"   on public.kantin_products for select using (public.is_staff());
create policy "kantin_products_owner"  on public.kantin_products for all using (public.is_owner()) with check (public.is_owner());
create policy "kantin_sales_read"      on public.kantin_sales for select using (public.is_staff());
create policy "kantin_sales_insert"    on public.kantin_sales for insert with check (public.is_staff());
create policy "kantin_sales_delete"    on public.kantin_sales for delete using (public.is_owner());
create policy "kantin_items_read"      on public.kantin_sale_items for select using (public.is_staff());
create policy "kantin_movements_read"  on public.kantin_stock_movements for select using (public.is_staff());
create policy "kantin_movements_owner" on public.kantin_stock_movements for all using (public.is_owner()) with check (public.is_owner());

-- ------------------------------------------------------------
-- Atomic sale RPC — server-side price computation + stock logic.
-- Tamper-proof: total comes from DB prices, never from the client.
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

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
    from public.kantin_products
    where id = (v_item->>'product_id')::uuid and is_active;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'BAD_QTY';
    end if;
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
-- Seed: 8 starter products (edit/deactivate in Pengaturan Kantin)
-- ------------------------------------------------------------
insert into public.kantin_products (name, category, price, cost_price, sort_order) values
  ('Es Teh',            'minuman', 5000,  2000, 1),
  ('Teh Panas',         'minuman', 4000,  1500, 2),
  ('Air Mineral 600ml', 'minuman', 5000,  3000, 3),
  ('Kopi Sachet',       'minuman', 5000,  2500, 4),
  ('Indomie Goreng',    'makanan', 8000,  3500, 5),
  ('Roti Bakar',        'makanan', 10000, 5000, 6),
  ('Kerupuk',           'snack',   3000,  1500, 7),
  ('Biskuit',           'snack',   6000,  4000, 8);
