-- Persistent customer carts, including guest-to-account merge support.
create table if not exists public.customer_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.plant_offers(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 30),
  updated_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);
alter table public.customer_cart_items enable row level security;
drop policy if exists "Customers manage own cart" on public.customer_cart_items;
create policy "Customers manage own cart" on public.customer_cart_items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
