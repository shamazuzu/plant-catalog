-- Discounts and editable promotion cards for Kind of Green
alter table public.plant_offers
  add column if not exists discount_price numeric(12,2),
  add column if not exists discount_reason text;

alter table public.plant_offers
  drop constraint if exists plant_offers_discount_price_check;

alter table public.plant_offers
  add constraint plant_offers_discount_price_check
  check (discount_price is null or (discount_price > 0 and discount_price < price));

create table if not exists public.campaign_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_posts enable row level security;

grant select on public.campaign_posts to anon, authenticated;
grant insert, update, delete on public.campaign_posts to authenticated;

drop policy if exists "Published campaigns are visible to everyone" on public.campaign_posts;
create policy "Published campaigns are visible to everyone"
  on public.campaign_posts for select
  to anon, authenticated
  using (is_published = true or (select public.is_admin()));

drop policy if exists "Admins can insert campaigns" on public.campaign_posts;
create policy "Admins can insert campaigns"
  on public.campaign_posts for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update campaigns" on public.campaign_posts;
create policy "Admins can update campaigns"
  on public.campaign_posts for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete campaigns" on public.campaign_posts;
create policy "Admins can delete campaigns"
  on public.campaign_posts for delete
  to authenticated
  using ((select public.is_admin()));
