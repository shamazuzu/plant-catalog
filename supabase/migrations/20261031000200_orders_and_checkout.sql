-- Orders, customer profiles and atomic checkout for Kind of Green
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
drop policy if exists "Customers can read own profile" on public.customer_profiles;
create policy "Customers can read own profile" on public.customer_profiles
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Customers can insert own profile" on public.customer_profiles;
create policy "Customers can insert own profile" on public.customer_profiles
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Customers can update own profile" on public.customer_profiles;
create policy "Customers can update own profile" on public.customer_profiles
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_email text not null,
  customer_name text,
  customer_phone text not null,
  delivery_method text not null check (delivery_method in ('pickup','courier')),
  customer_comment text,
  status text not null default 'new' check (status in ('new','confirmed','preparing','completed','cancelled')),
  items_count integer not null default 0,
  total numeric(12,2) not null default 0,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  offer_id uuid references public.plant_offers(id) on delete set null,
  plant_name text not null,
  article_code text,
  size_label text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Customers read own orders and admins read all" on public.orders;
create policy "Customers read own orders and admins read all" on public.orders
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Customers read own order items and admins read all" on public.order_items;
create policy "Customers read own order items and admins read all" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );

-- Keep the required phone number in a profile row as soon as a user signs up.
create or replace function public.handle_new_customer_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'phone','') <> '' then
    insert into public.customer_profiles(user_id, phone, full_name)
    values (new.id, new.raw_user_meta_data->>'phone', nullif(new.raw_user_meta_data->>'full_name',''))
    on conflict (user_id) do update set
      phone = excluded.phone,
      full_name = coalesce(excluded.full_name, customer_profiles.full_name),
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer_profile on auth.users;
create trigger on_auth_user_created_customer_profile
  after insert or update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_customer_profile();

-- Atomic checkout: validates current stock and current (possibly discounted) prices,
-- creates immutable order line snapshots and decrements stock in one transaction.
create or replace function public.place_order(
  p_items jsonb,
  p_delivery_method text,
  p_customer_name text default null,
  p_customer_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_phone text;
  v_order_id uuid;
  v_order_number bigint;
  v_total numeric(12,2) := 0;
  v_count integer := 0;
  v_item jsonb;
  v_offer public.plant_offers%rowtype;
  v_name text;
  v_price numeric(12,2);
  v_qty integer;
  v_size text;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if p_delivery_method not in ('pickup','courier') then raise exception 'Выбери способ получения заказа.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Корзина пуста.'; end if;

  select email into v_email from auth.users where id = v_user_id;
  select phone into v_phone from public.customer_profiles where user_id = v_user_id;
  if coalesce(v_phone,'') = '' then raise exception 'В профиле не указан телефон. Обнови профиль.'; end if;

  insert into public.orders(user_id, customer_email, customer_name, customer_phone, delivery_method, customer_comment)
  values (v_user_id, coalesce(v_email,''), nullif(trim(p_customer_name),''), v_phone, p_delivery_method, nullif(trim(p_customer_comment),''))
  returning id, order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 30 then raise exception 'Некорректное количество товара.'; end if;

    select * into v_offer from public.plant_offers
    where id = (v_item->>'offer_id')::uuid
    for update;

    if not found or v_offer.status <> 'available' or v_offer.stock < v_qty then
      raise exception 'Одно из растений уже недоступно в выбранном количестве. Обнови корзину.';
    end if;

    select p.name into v_name from public.plants p where p.id = v_offer.plant_id and p.is_active = true;
    if v_name is null then raise exception 'Одно из растений больше не доступно.'; end if;

    v_price := case when v_offer.discount_price is not null and v_offer.discount_price > 0 and v_offer.discount_price < v_offer.price then v_offer.discount_price else v_offer.price end;
    v_size := case when v_offer.pot_diameter is not null then v_offer.pot_diameter::text || ' см' else coalesce(v_offer.size_label,'Размер не указан') end;

    insert into public.order_items(order_id, offer_id, plant_name, article_code, size_label, quantity, unit_price, line_total)
    values (v_order_id, v_offer.id, v_name, v_offer.article_code, v_size, v_qty, v_price, v_price * v_qty);

    update public.plant_offers set stock = stock - v_qty,
      status = case when stock - v_qty <= 0 then 'sold' else status end
    where id = v_offer.id;

    v_total := v_total + v_price * v_qty;
    v_count := v_count + v_qty;
  end loop;

  update public.orders set total = v_total, items_count = v_count where id = v_order_id;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'total',v_total,'items_count',v_count);
end;
$$;

revoke all on function public.place_order(jsonb,text,text,text) from public;
grant execute on function public.place_order(jsonb,text,text,text) to authenticated;
