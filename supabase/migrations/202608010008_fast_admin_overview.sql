create or replace function public.service_admin_overview()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'openOrders', (
      select count(*)
      from public.orders
      where status not in ('DONE','CANCELLED','RETURNED')
    ),
    'pendingProducts', (
      select count(*)
      from public.product_moderation_queue
      where status='PENDING'
    ),
    'payoutCount', (
      select count(*)
      from public.payout_requests
      where status='REQUESTED'
    ),
    'payoutAmount', (
      select coalesce(sum(amount),0)
      from public.payout_requests
      where status='REQUESTED'
    ),
    'rawProducts', (
      select count(*)
      from public.raw_products
    ),
    'sellers', (
      select count(*)
      from public.organizations
      where type='SELLER'
    ),
    'suppliers', (
      select count(*)
      from public.organizations
      where type='SUPPLIER'
    ),
    'orders', coalesce((
      select jsonb_agg(
        to_jsonb(recent_order) || jsonb_build_object(
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'order_id', item.order_id,
              'id', item.id,
              'quantity', item.quantity,
              'seller_product_id', item.seller_product_id
            ))
            from public.order_items item
            where item.order_id=recent_order.id
          ), '[]'::jsonb)
        )
      )
      from (
        select id,number,buyer_user_id,status,total,created_at,customer_snapshot
        from public.orders
        where status not in ('DONE','CANCELLED','RETURNED')
        order by created_at
        limit 5
      ) recent_order
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.service_admin_overview() from public,anon,authenticated;
grant execute on function public.service_admin_overview() to service_role;
