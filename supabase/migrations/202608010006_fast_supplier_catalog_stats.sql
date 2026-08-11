create or replace function public.service_supplier_catalog_stats()
returns table(
  supplier_organization_id uuid,
  product_count integer,
  review_count integer,
  rating_average double precision
)
language sql
stable
security definer
set search_path=public
as $$
  select o.id,
    count(distinct so.raw_product_id)::integer,
    count(distinct r.id)::integer,
    coalesce(avg(r.rating),0)::double precision
  from public.organizations o
  left join public.supplier_offers so on so.supplier_organization_id=o.id
    and so.status='ACTIVE' and so.approval_status='APPROVED'
  left join public.order_items oi on oi.supplier_organization_id=o.id
  left join public.reviews r on r.order_item_id=oi.id and r.status='PUBLISHED'
  where o.type='SUPPLIER' and o.status='ACTIVE'
  group by o.id
$$;

revoke all on function public.service_supplier_catalog_stats() from public,anon,authenticated;
grant execute on function public.service_supplier_catalog_stats() to service_role;

