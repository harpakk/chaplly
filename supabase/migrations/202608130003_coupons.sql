create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code varchar(6) not null unique check (code ~ '^[0-9]{1,6}$'),
  created_by uuid not null references public.profiles(id),
  owner_organization_id uuid references public.organizations(id),
  discount_type text not null check (discount_type in ('PERCENTAGE','FIXED_RIAL')),
  discount_value bigint not null check (discount_value > 0),
  applies_to text not null check (applies_to in ('ITEM','BASKET')),
  all_stores boolean not null default false,
  expires_at timestamptz not null,
  max_usage integer not null check (max_usage > 0),
  usage_count integer not null default 0 check (usage_count >= 0 and usage_count <= max_usage),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'PERCENTAGE' or discount_value <= 100),
  check (owner_organization_id is null or all_stores = false),
  check (owner_organization_id is null or (discount_type <> 'PERCENTAGE' or discount_value <= 10)),
  check (owner_organization_id is null or (discount_type <> 'FIXED_RIAL' or discount_value <= 1000000))
);

create table public.coupon_stores (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  primary key (coupon_id, store_id)
);

create table public.coupon_categories (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (coupon_id, category_id)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  buyer_user_id uuid references public.profiles(id),
  discount_amount bigint not null check (discount_amount > 0),
  redeemed_at timestamptz not null default now()
);

create index coupons_owner_idx on public.coupons(owner_organization_id, created_at desc);
create index coupons_active_code_idx on public.coupons(code) where status = 'ACTIVE';
create index coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);

create or replace function public.enforce_coupon_store_owner()
returns trigger language plpgsql as $$
declare v_owner uuid; v_store_owner uuid;
begin
  select owner_organization_id into v_owner from public.coupons where id = new.coupon_id;
  select organization_id into v_store_owner from public.stores where id = new.store_id;
  if v_owner is not null and v_owner <> v_store_owner then
    raise exception 'SELLER_STORE_ONLY';
  end if;
  return new;
end $$;

create trigger coupon_store_owner_guard before insert or update on public.coupon_stores
for each row execute function public.enforce_coupon_store_owner();

create or replace function public.service_quote_coupon(p_code text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_base bigint; v_discount bigint;
begin
  if p_code !~ '^[0-9]{1,6}$' then raise exception 'COUPON_INVALID'; end if;
  select * into v_coupon from public.coupons where code = p_code;
  if not found or v_coupon.status <> 'ACTIVE' then raise exception 'COUPON_INVALID'; end if;
  if v_coupon.expires_at <= now() then raise exception 'COUPON_EXPIRED'; end if;
  if v_coupon.usage_count >= v_coupon.max_usage then raise exception 'COUPON_EXHAUSTED'; end if;

  with requested as (
    select (x->>'variantId')::uuid variant_id, least(99, greatest(1, (x->>'quantity')::integer)) quantity
    from jsonb_array_elements(p_items) x
  ), eligible as (
    select spv.price::bigint unit_price, r.quantity, (spv.price * r.quantity)::bigint line_total
    from requested r
    join public.seller_product_variants spv on spv.id = r.variant_id and spv.status = 'ACTIVE'
    join public.seller_products sp on sp.id = spv.seller_product_id and sp.status = 'PUBLISHED'
    join public.raw_products rp on rp.id = sp.raw_product_id
    where (v_coupon.all_stores or exists(select 1 from public.coupon_stores cs where cs.coupon_id=v_coupon.id and cs.store_id=sp.store_id))
      and (not exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id)
        or exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id and cc.category_id=rp.category_id))
  )
  select case when v_coupon.applies_to='ITEM' then max(unit_price) else sum(line_total) end into v_base from eligible;
  if coalesce(v_base,0) <= 0 then raise exception 'COUPON_NOT_APPLICABLE'; end if;
  v_discount := case when v_coupon.discount_type='PERCENTAGE'
    then floor(v_base * v_coupon.discount_value / 100.0)::bigint
    else least(v_base, v_coupon.discount_value) end;
  if v_discount <= 0 then raise exception 'COUPON_NOT_APPLICABLE'; end if;
  return jsonb_build_object('code',v_coupon.code,'discountAmount',v_discount,'eligibleAmount',v_base,
    'discountType',v_coupon.discount_type,'discountValue',v_coupon.discount_value,'appliesTo',v_coupon.applies_to);
end $$;

create or replace function public.service_apply_coupon_to_order(p_order_id uuid, p_code text, p_buyer_user_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_base bigint; v_discount bigint; v_existing bigint; v_total bigint;
begin
  select discount_amount into v_existing from public.coupon_redemptions where order_id=p_order_id;
  if found then return 0; end if;
  if p_code !~ '^[0-9]{1,6}$' then raise exception 'COUPON_INVALID'; end if;
  select * into v_coupon from public.coupons where code=p_code for update;
  if not found or v_coupon.status <> 'ACTIVE' then raise exception 'COUPON_INVALID'; end if;
  if v_coupon.expires_at <= now() then raise exception 'COUPON_EXPIRED'; end if;
  if v_coupon.usage_count >= v_coupon.max_usage then raise exception 'COUPON_EXHAUSTED'; end if;
  select total into v_total from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  with eligible as (
    select oi.unit_price::bigint, oi.line_total::bigint
    from public.order_items oi
    join public.seller_products sp on sp.id=oi.seller_product_id
    join public.raw_products rp on rp.id=sp.raw_product_id
    where oi.order_id=p_order_id
      and (v_coupon.all_stores or exists(select 1 from public.coupon_stores cs where cs.coupon_id=v_coupon.id and cs.store_id=sp.store_id))
      and (not exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id)
        or exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id and cc.category_id=rp.category_id))
  )
  select case when v_coupon.applies_to='ITEM' then max(unit_price) else sum(line_total) end into v_base from eligible;
  if coalesce(v_base,0) <= 0 then raise exception 'COUPON_NOT_APPLICABLE'; end if;
  v_discount := case when v_coupon.discount_type='PERCENTAGE'
    then floor(v_base * v_coupon.discount_value / 100.0)::bigint
    else least(v_base, v_coupon.discount_value) end;
  v_discount := least(v_discount, v_total);
  if v_discount <= 0 then raise exception 'COUPON_NOT_APPLICABLE'; end if;

  insert into public.coupon_redemptions(coupon_id,order_id,buyer_user_id,discount_amount)
  values(v_coupon.id,p_order_id,p_buyer_user_id,v_discount);
  update public.coupons set usage_count=usage_count+1,updated_at=now() where id=v_coupon.id;
  update public.orders set discount_amount=discount_amount+v_discount,total=greatest(0,total-v_discount),updated_at=now() where id=p_order_id;
  return v_discount;
end $$;

revoke all on function public.service_quote_coupon(text,jsonb) from public, anon, authenticated;
revoke all on function public.service_apply_coupon_to_order(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.service_quote_coupon(text,jsonb) to service_role;
grant execute on function public.service_apply_coupon_to_order(uuid,text,uuid) to service_role;

alter table public.coupons enable row level security;
alter table public.coupon_stores enable row level security;
alter table public.coupon_categories enable row level security;
alter table public.coupon_redemptions enable row level security;

create policy coupons_admin_all on public.coupons for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy coupons_seller_manage on public.coupons for all to authenticated
  using(owner_organization_id is not null and public.is_org_member(owner_organization_id))
  with check(owner_organization_id is not null and public.is_org_member(owner_organization_id));
create policy coupon_stores_manage on public.coupon_stores for all to authenticated
  using(exists(select 1 from public.coupons c where c.id=coupon_id and (public.is_admin() or public.is_org_member(c.owner_organization_id))))
  with check(exists(select 1 from public.coupons c where c.id=coupon_id and (public.is_admin() or public.is_org_member(c.owner_organization_id))));
create policy coupon_categories_manage on public.coupon_categories for all to authenticated
  using(exists(select 1 from public.coupons c where c.id=coupon_id and (public.is_admin() or public.is_org_member(c.owner_organization_id))))
  with check(exists(select 1 from public.coupons c where c.id=coupon_id and (public.is_admin() or public.is_org_member(c.owner_organization_id))));
create policy coupon_redemptions_admin_read on public.coupon_redemptions for select to authenticated using(public.is_admin());
