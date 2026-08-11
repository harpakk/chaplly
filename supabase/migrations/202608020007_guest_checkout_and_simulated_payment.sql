-- Guest checkout uses a service-only command. It creates the order and its
-- fulfilments atomically while the application treats payment as captured in
-- development. Authenticated checkout continues to use checkout_create_order.
create or replace function public.service_guest_checkout_create_order(
  p_idempotency_key text,
  p_address jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_existing uuid;
  v_order_id uuid:=gen_random_uuid();
  v_order_item_id uuid;
  v_fulfilment_id uuid;
  v_subtotal bigint:=0;
  v_shipping bigint:=790000;
  v_number text;
  v_item jsonb;
  v_quantity integer;
  v_row record;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    and session_user not in ('postgres','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))<8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if length(trim(coalesce(p_address->>'recipientName','')))<2
    or length(trim(coalesce(p_address->>'phone','')))<7
    or length(trim(coalesce(p_address->>'addressLine','')))<5 then
    raise exception 'ADDRESS_REQUIRED';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'CART_EMPTY';
  end if;

  select id into v_existing from public.orders
  where idempotency_key=p_idempotency_key and buyer_user_id is null;
  if v_existing is not null then return v_existing; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity:=coalesce((v_item->>'quantity')::integer,0);
    if v_quantity<1 or v_quantity>99 then raise exception 'INVALID_QUANTITY'; end if;
    select spv.price into v_row
    from public.seller_product_variants spv
    join public.seller_products sp on sp.id=spv.seller_product_id
    join public.supplier_offer_variants sov on sov.id=spv.supplier_offer_variant_id
    join public.supplier_offers so on so.id=sov.supplier_offer_id
    where spv.id=(v_item->>'variantId')::uuid
      and spv.status='ACTIVE' and sp.status='PUBLISHED'
      and sp.moderation_status='APPROVED'
      and sov.stock_status in ('AVAILABLE','LOW_STOCK')
      and sov.stock_quantity>=v_quantity
      and so.status='ACTIVE' and so.approval_status='APPROVED';
    if not found then raise exception 'VARIANT_UNAVAILABLE'; end if;
    v_subtotal:=v_subtotal+(v_row.price*v_quantity);
  end loop;
  if v_subtotal>=15000000 then v_shipping:=0; end if;

  v_number:='CH-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||upper(substr(v_order_id::text,1,4));
  insert into public.orders(
    id,number,buyer_user_id,status,subtotal,total,currency,customer_snapshot,
    shipping_address_snapshot,shipping_address_id,shipping_amount,
    idempotency_key,paid_at
  ) values(
    v_order_id,v_number,null,'CONFIRMED',v_subtotal,v_subtotal+v_shipping,'IRR',
    jsonb_build_object(
      'name',trim(p_address->>'recipientName'),
      'phone',trim(p_address->>'phone'),
      'guest',true
    ),
    p_address,null,v_shipping,p_idempotency_key,now()
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity:=(v_item->>'quantity')::integer;
    select
      spv.id spv_id,spv.price,sov.unit_cost,sov.id sov_id,rpv.id rpv_id,
      sp.id product_id,sp.title,sp.description,sp.design_id,
      st.organization_id seller_org_id,so.supplier_organization_id supplier_org_id,
      so.id offer_id,so.facility_id,so.lead_time_days,
      rpc.name color_name,rps.name size_name
    into v_row
    from public.seller_product_variants spv
    join public.seller_products sp on sp.id=spv.seller_product_id
    join public.stores st on st.id=sp.store_id
    join public.raw_product_variants rpv on rpv.id=spv.raw_product_variant_id
    join public.raw_product_colors rpc on rpc.id=rpv.color_id
    join public.raw_product_sizes rps on rps.id=rpv.size_id
    join public.supplier_offer_variants sov on sov.id=spv.supplier_offer_variant_id
    join public.supplier_offers so on so.id=sov.supplier_offer_id
    where spv.id=(v_item->>'variantId')::uuid
    for share of spv,sov,so;

    v_order_item_id:=gen_random_uuid();
    insert into public.order_items(
      id,order_id,seller_product_id,seller_product_variant_id,raw_product_variant_id,
      supplier_offer_variant_id,seller_organization_id,supplier_organization_id,
      quantity,unit_price,cost_snapshot,line_total,product_snapshot,design_snapshot
    ) values(
      v_order_item_id,v_order_id,v_row.product_id,v_row.spv_id,v_row.rpv_id,
      v_row.sov_id,v_row.seller_org_id,v_row.supplier_org_id,v_quantity,
      v_row.price,v_row.unit_cost,v_row.price*v_quantity,
      jsonb_build_object(
        'title',v_row.title,'description',v_row.description,
        'color',v_row.color_name,'size',v_row.size_name
      ),
      coalesce((select jsonb_object_agg(rv.side,dv.canvas_document)
        from public.design_views dv
        join public.raw_product_views rv on rv.id=dv.raw_product_view_id
        where dv.design_id=v_row.design_id),'{}'::jsonb)
    );

    select id into v_fulfilment_id from public.fulfilments
    where order_id=v_order_id
      and supplier_organization_id=v_row.supplier_org_id
      and facility_id=v_row.facility_id
      and supplier_offer_id=v_row.offer_id
    limit 1;
    if v_fulfilment_id is null then
      v_fulfilment_id:=gen_random_uuid();
      insert into public.fulfilments(
        id,order_id,supplier_organization_id,facility_id,supplier_offer_id,
        assignment_snapshot,status,due_at
      ) values(
        v_fulfilment_id,v_order_id,v_row.supplier_org_id,v_row.facility_id,
        v_row.offer_id,
        jsonb_build_object(
          'offerId',v_row.offer_id,'unitCost',v_row.unit_cost,
          'leadTimeDays',v_row.lead_time_days
        ),
        'ASSIGNED',now()+make_interval(days=>v_row.lead_time_days)
      );
    end if;
    insert into public.fulfilment_items(fulfilment_id,order_item_id,quantity)
    values(v_fulfilment_id,v_order_item_id,v_quantity);
  end loop;
  return v_order_id;
exception when unique_violation then
  select id into v_existing from public.orders
  where idempotency_key=p_idempotency_key and buyer_user_id is null;
  if v_existing is not null then return v_existing; end if;
  raise;
end
$$;

revoke all on function public.service_guest_checkout_create_order(text,jsonb,jsonb)
from public,anon,authenticated;
grant execute on function public.service_guest_checkout_create_order(text,jsonb,jsonb)
to service_role;
