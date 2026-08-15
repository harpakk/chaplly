create table if not exists public.storefront_unique_visits (
  store_id uuid not null references public.stores(id) on delete cascade,
  visitor_hash text not null check (length(visitor_hash) = 64),
  day date not null default ((now() at time zone 'Asia/Tehran')::date),
  first_seen_at timestamptz not null default now(),
  primary key (store_id, visitor_hash, day)
);

create index if not exists storefront_unique_visits_day_idx
  on public.storefront_unique_visits(day desc);

alter table public.storefront_unique_visits enable row level security;
revoke all on public.storefront_unique_visits from public, anon, authenticated;
grant select, insert on public.storefront_unique_visits to service_role;

create or replace function public.service_admin_seller_funnel(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with bounds as (
    select (now() at time zone 'Asia/Tehran')::date
      - greatest(1, least(coalesce(p_days, 30), 730)) + 1 as starts_on
  ), seller_sales as (
    select organization.id,
      coalesce(sum(order_item.quantity) filter (
        where paid_order.paid_at is not null
          and paid_order.status not in ('CANCELLED', 'RETURNED')
      ), 0)::bigint as items
    from public.organizations organization
    left join public.order_items order_item
      on order_item.seller_organization_id = organization.id
    left join public.orders paid_order on paid_order.id = order_item.order_id
    where organization.type = 'SELLER'
    group by organization.id
  )
  select jsonb_build_object(
    'uniqueVisitors', (
      select count(distinct visit.visitor_hash)
      from public.storefront_unique_visits visit, bounds
      where visit.day >= bounds.starts_on
    ),
    'allSellers', count(*),
    'withSales', count(*) filter (where items >= 1),
    'moreThanOne', count(*) filter (where items > 1),
    'moreThanFive', count(*) filter (where items > 5),
    'moreThanTen', count(*) filter (where items > 10),
    'exactlyOne', count(*) filter (where items = 1),
    'twoToFive', count(*) filter (where items between 2 and 5),
    'sixToTen', count(*) filter (where items between 6 and 10),
    'overTen', count(*) filter (where items > 10)
  ) from seller_sales
$$;

revoke all on function public.service_admin_seller_funnel(integer)
  from public, anon, authenticated;
grant execute on function public.service_admin_seller_funnel(integer)
  to service_role;

notify pgrst, 'reload schema';
