-- Compact, write-optimized analytics: one row per day, regardless of traffic volume.
create table if not exists public.daily_site_analytics (
  day date primary key,
  index_page_views bigint not null default 0 check (index_page_views >= 0),
  product_page_views bigint not null default 0 check (product_page_views >= 0),
  paid_orders bigint not null default 0 check (paid_orders >= 0),
  paid_items bigint not null default 0 check (paid_items >= 0),
  total_sales bigint not null default 0 check (total_sales >= 0),
  updated_at timestamptz not null default now()
);

alter table public.daily_site_analytics enable row level security;

create or replace function public.record_site_page_view(p_kind text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_kind not in ('index', 'product') then
    raise exception 'INVALID_PAGE_KIND';
  end if;
  insert into public.daily_site_analytics(day,index_page_views,product_page_views)
  values ((now() at time zone 'Asia/Tehran')::date,
    case when p_kind='index' then 1 else 0 end,
    case when p_kind='product' then 1 else 0 end)
  on conflict(day) do update set
    index_page_views=public.daily_site_analytics.index_page_views+excluded.index_page_views,
    product_page_views=public.daily_site_analytics.product_page_views+excluded.product_page_views,
    updated_at=now();
end
$$;

revoke all on function public.record_site_page_view(text) from public,anon,authenticated;
grant execute on function public.record_site_page_view(text) to service_role;

create or replace function public.rollup_paid_order_analytics()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_items bigint;
begin
  if new.paid_at is not null and (tg_op='INSERT' or old.paid_at is null) then
    select coalesce(sum(quantity),0) into v_items from public.order_items where order_id=new.id;
    insert into public.daily_site_analytics(day,paid_orders,paid_items,total_sales)
    values ((new.paid_at at time zone 'Asia/Tehran')::date,1,v_items,new.total)
    on conflict(day) do update set
      paid_orders=public.daily_site_analytics.paid_orders+1,
      paid_items=public.daily_site_analytics.paid_items+excluded.paid_items,
      total_sales=public.daily_site_analytics.total_sales+excluded.total_sales,
      updated_at=now();
  end if;
  return new;
end
$$;

drop trigger if exists orders_rollup_paid_analytics on public.orders;
create trigger orders_rollup_paid_analytics after insert or update of paid_at on public.orders
for each row execute function public.rollup_paid_order_analytics();

-- Seed historical sales once; subsequent payments are maintained by the trigger above.
insert into public.daily_site_analytics(day,paid_orders,paid_items,total_sales)
select (o.paid_at at time zone 'Asia/Tehran')::date,count(distinct o.id),
  coalesce(sum(oi.quantity),0),coalesce(max(t.day_total),0)
from public.orders o
left join public.order_items oi on oi.order_id=o.id
join (
  select (paid_at at time zone 'Asia/Tehran')::date as analytics_day,sum(total) as day_total
  from public.orders where paid_at is not null group by 1
) t on t.analytics_day=(o.paid_at at time zone 'Asia/Tehran')::date
where o.paid_at is not null
group by (o.paid_at at time zone 'Asia/Tehran')::date
on conflict(day) do update set paid_orders=excluded.paid_orders,
  paid_items=excluded.paid_items,total_sales=excluded.total_sales,updated_at=now();

create or replace function public.service_admin_analytics(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with bounds as (
    select greatest(1,least(coalesce(p_days,30),730))::integer as range_days,
      (now() at time zone 'Asia/Tehran')::date as today
  ), dates as (
    select generate_series(today-range_days+1,today,'1 day')::date as day from bounds
  ), series as (
    select d.day,coalesce(a.index_page_views,0) index_page_views,
      coalesce(a.product_page_views,0) product_page_views,
      coalesce(a.paid_orders,0) paid_orders,coalesce(a.total_sales,0) total_sales
    from dates d left join public.daily_site_analytics a using(day) order by d.day
  ), seller_sales as (
    select oi.seller_organization_id,sum(oi.quantity)::bigint items
    from public.order_items oi join public.orders o on o.id=oi.order_id
    where o.paid_at >= now()-interval '30 days' and o.status not in ('CANCELLED','RETURNED')
      and oi.seller_organization_id is not null group by oi.seller_organization_id
  )
  select jsonb_build_object(
    'series',coalesce((select jsonb_agg(jsonb_build_object(
      'day',day,'indexViews',index_page_views,'productViews',product_page_views,
      'sales',paid_orders,'averageBasket',case when paid_orders>0 then round(total_sales::numeric/paid_orders) else 0 end,
      'totalSales',total_sales,'conversionRate',case when index_page_views>0 then round(100.0*paid_orders/index_page_views,2) else 0 end
    )) from series),'[]'::jsonb),
    'sellers',jsonb_build_object(
      'all',(select count(*) from public.organizations where type='SELLER'),
      'moreThanFive',(select count(*) from seller_sales where items>5),
      'withSales',(select count(*) from seller_sales where items>0)
    )
  )
$$;

revoke all on function public.service_admin_analytics(integer) from public,anon,authenticated;
grant execute on function public.service_admin_analytics(integer) to service_role;
