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
  ), sales as (
    select item.seller_organization_id as organization_id,
      sum(item.quantity)::bigint as items
    from public.order_items item
    join public.orders paid_order on paid_order.id = item.order_id
    where item.seller_organization_id is not null
      and paid_order.paid_at is not null
      and paid_order.status not in ('CANCELLED', 'RETURNED')
    group by item.seller_organization_id
  ), profits as (
    select earning.beneficiary_organization_id as organization_id,
      sum(earning.net_amount)::bigint as lifetime_profit
    from public.earnings earning
    where earning.earning_type = 'SELLER'
      and earning.status <> 'REVERSED'
    group by earning.beneficiary_organization_id
  ), seller_metrics as (
    select organization.id,
      organization.display_name as name,
      coalesce(sales.items, 0)::bigint as items,
      coalesce(profits.lifetime_profit, 0)::bigint as lifetime_profit
    from public.organizations organization
    left join sales on sales.organization_id = organization.id
    left join profits on profits.organization_id = organization.id
    where organization.type = 'SELLER'
  ), totals as (
    select count(*)::bigint as seller_count,
      coalesce(sum(lifetime_profit), 0)::bigint as total_profit
    from seller_metrics
  )
  select jsonb_build_object(
    'uniqueVisitors', (
      select count(distinct visit.visitor_hash)
      from public.storefront_unique_visits visit, bounds
      where visit.day >= bounds.starts_on
    ),
    'allSellers', (select seller_count from totals),
    'withSales', count(*) filter (where items >= 1),
    'moreThanOne', count(*) filter (where items > 1),
    'moreThanFive', count(*) filter (where items > 5),
    'moreThanTen', count(*) filter (where items > 10),
    'exactlyOne', count(*) filter (where items = 1),
    'twoToFive', count(*) filter (where items between 2 and 5),
    'sixToTen', count(*) filter (where items between 6 and 10),
    'overTen', count(*) filter (where items > 10),
    'totalLifetimeProfit', (select total_profit from totals),
    'averageLifetimeProfit', (
      select case when seller_count > 0 then round(total_profit::numeric / seller_count) else 0 end
      from totals
    ),
    'sellerRows', coalesce(jsonb_agg(jsonb_build_object(
      'organizationId', id,
      'name', name,
      'itemsSold', items,
      'lifetimeProfit', lifetime_profit
    ) order by lifetime_profit desc, items desc, name), '[]'::jsonb)
  ) from seller_metrics
$$;

revoke all on function public.service_admin_seller_funnel(integer)
  from public, anon, authenticated;
grant execute on function public.service_admin_seller_funnel(integer)
  to service_role;

notify pgrst, 'reload schema';
