create or replace function public.sync_buyer_cart(p_items jsonb)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_cart uuid;
  v_item jsonb;
  v_variant uuid;
  v_quantity integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.consume_user_rate_limit('cart:sync',120,60) then
    raise exception 'RATE_LIMIT_EXCEEDED';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or
     jsonb_array_length(coalesce(p_items,'[]'::jsonb))>100 then
    raise exception 'INVALID_CART';
  end if;
  select id into v_cart from public.carts
    where buyer_user_id=v_user and status='ACTIVE' for update;
  if v_cart is null then
    insert into public.carts(buyer_user_id,status)
      values(v_user,'ACTIVE') returning id into v_cart;
  end if;
  create temporary table if not exists pg_temp.cart_sync_items(
    variant_id uuid primary key,
    quantity integer not null
  ) on commit drop;
  truncate pg_temp.cart_sync_items;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
  loop
    begin
      v_variant:=(v_item->>'variantId')::uuid;
      v_quantity:=(v_item->>'quantity')::integer;
    exception when others then
      raise exception 'INVALID_CART_ITEM';
    end;
    if v_quantity not between 1 and 99 then
      raise exception 'INVALID_CART_ITEM';
    end if;
    -- Products and variants may be archived while an old browser cart still
    -- references them. Remove those stale rows instead of rejecting the whole
    -- cart and repeatedly returning HTTP 400 on every page.
    if not exists(
      select 1 from public.seller_product_variants spv
      join public.seller_products sp on sp.id=spv.seller_product_id
      where spv.id=v_variant and spv.status='ACTIVE'
        and sp.status='PUBLISHED' and sp.moderation_status='APPROVED'
    ) then
      continue;
    end if;
    insert into pg_temp.cart_sync_items values(v_variant,v_quantity)
      on conflict(variant_id) do update set quantity=excluded.quantity;
  end loop;
  delete from public.cart_items ci
    where ci.cart_id=v_cart and not exists(
      select 1 from pg_temp.cart_sync_items i
      where i.variant_id=ci.seller_product_variant_id
    );
  insert into public.cart_items(cart_id,seller_product_variant_id,quantity)
    select v_cart,variant_id,quantity from pg_temp.cart_sync_items
    on conflict(cart_id,seller_product_variant_id)
    do update set quantity=excluded.quantity,updated_at=now();
  update public.carts set updated_at=now(),expires_at=now()+interval '30 days'
    where id=v_cart;
  return v_cart;
end
$$;

revoke all on function public.sync_buyer_cart(jsonb) from public,anon;
grant execute on function public.sync_buyer_cart(jsonb) to authenticated;
