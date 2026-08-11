-- Authorization helpers, transactional workflows, complete RLS, and Storage.

-- Authorization helpers -------------------------------------------------------

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.admin_profiles a
    join public.profiles p on p.id=a.user_id
    where a.user_id=p_user_id and a.is_active and p.state='ACTIVE'
  )
$$;

create or replace function public.is_org_member(
  p_organization_id uuid,
  p_user_id uuid default auth.uid(),
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.memberships m
    join public.profiles p on p.id=m.user_id
    where m.organization_id=p_organization_id
      and m.user_id=p_user_id
      and m.status='ACTIVE'
      and p.state='ACTIVE'
      and (p_roles is null or m.role=any(p_roles))
  )
$$;

create or replace function public.can_manage_store(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_admin(p_user_id) or exists(
    select 1 from public.stores s
    where s.id=p_store_id
      and public.is_org_member(s.organization_id,p_user_id)
  )
$$;

create or replace function public.can_access_order(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_admin(p_user_id)
    or exists(select 1 from public.orders o where o.id=p_order_id and o.buyer_user_id=p_user_id)
    or exists(
      select 1 from public.order_items oi
      where oi.order_id=p_order_id and (
        public.is_org_member(oi.seller_organization_id,p_user_id)
        or public.is_org_member(oi.supplier_organization_id,p_user_id)
      )
    )
$$;

create or replace function public.can_access_fulfilment(
  p_fulfilment_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_admin(p_user_id) or exists(
    select 1 from public.fulfilments f
    where f.id=p_fulfilment_id and (
      public.is_org_member(f.supplier_organization_id,p_user_id)
      or public.can_access_order(f.order_id,p_user_id)
    )
  )
$$;

create or replace function public.can_access_file(
  p_bucket text,
  p_path text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    p_bucket in ('product-images','variant-mockups')
    or public.is_admin(p_user_id)
    or exists(
      select 1 from public.storage_files f
      where f.bucket=p_bucket and f.path=p_path and (
        f.owner_user_id=p_user_id
        or public.is_org_member(f.owner_organization_id,p_user_id)
        or exists(
          select 1 from public.fulfilment_files ff
          where ff.file_id=f.id and public.can_access_fulfilment(ff.fulfilment_id,p_user_id)
        )
      )
    )
$$;

-- Auth-backed onboarding ------------------------------------------------------

create or replace function public.provision_seller(p_user_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org_id uuid:=gen_random_uuid();
  v_store_id uuid:=gen_random_uuid();
  v_slug text:=lower(trim(p_payload->>'slug'));
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and session_user not in ('postgres','supabase_admin') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_slug is null or length(v_slug)<2 or v_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
    raise exception 'INVALID_STORE_SLUG';
  end if;
  if exists(select 1 from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=p_user_id and o.type='SELLER') then
    raise exception 'SELLER_ALREADY_PROVISIONED';
  end if;

  insert into public.organizations(
    id,type,legal_name,display_name,slug,status,contact_email,contact_phone,
    website_url,description
  ) values(
    v_org_id,'SELLER',
    coalesce(nullif(p_payload->>'legalName',''),p_payload->>'storeName'),
    p_payload->>'storeName','seller-'||v_slug,'ACTIVE',
    nullif(p_payload->>'supportEmail',''),nullif(p_payload->>'supportPhone',''),
    nullif(p_payload->>'websiteUrl',''),nullif(p_payload->>'storeDescription','')
  );
  insert into public.memberships(user_id,organization_id,role,status)
    values(p_user_id,v_org_id,'OWNER','ACTIVE');
  insert into public.stores(
    id,organization_id,owner_user_id,name,slug,status,description,primary_category,
    support_email,support_phone,social_url,brand_color,brand_tone
  ) values(
    v_store_id,v_org_id,p_user_id,p_payload->>'storeName',v_slug,'ACTIVE',
    p_payload->>'storeDescription',nullif(p_payload->>'primaryCategory',''),
    nullif(p_payload->>'supportEmail',''),nullif(p_payload->>'supportPhone',''),
    nullif(p_payload->>'socialUrl',''),coalesce(nullif(p_payload->>'brandColor',''),'#ef5b4c'),
    nullif(p_payload->>'brandTone','')
  );
  insert into public.seller_profiles(
    organization_id,owner_user_id,seller_type,experience_level,instagram_handle,
    audience_size,monthly_views,goal
  ) values(
    v_org_id,p_user_id,nullif(p_payload->>'sellerType',''),
    nullif(p_payload->>'experienceLevel',''),nullif(p_payload->>'instagramHandle',''),
    nullif(p_payload->>'audienceSize','')::integer,
    nullif(p_payload->>'monthlyViews','')::bigint,
    nullif(p_payload->>'sellerGoal','')
  );
  insert into public.balance_projections(organization_id) values(v_org_id)
    on conflict(organization_id) do nothing;
  insert into public.ai_credit_accounts(user_id) values(p_user_id)
    on conflict(user_id) do nothing;
  update public.profiles set primary_role='SELLER',updated_at=now() where id=p_user_id;
  return jsonb_build_object('organizationId',v_org_id,'storeId',v_store_id,'userId',p_user_id);
end
$$;

create or replace function public.provision_supplier(p_user_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org_id uuid:=gen_random_uuid();
  v_facility_id uuid:=gen_random_uuid();
  v_slug text:='supplier-'||substr(v_org_id::text,1,8);
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and session_user not in ('postgres','supabase_admin') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if exists(select 1 from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=p_user_id and o.type='SUPPLIER') then
    raise exception 'SUPPLIER_ALREADY_PROVISIONED';
  end if;

  insert into public.organizations(
    id,type,legal_name,display_name,slug,status,contact_email,contact_phone,
    website_url,description,national_id,registration_number
  ) values(
    v_org_id,'SUPPLIER',p_payload->>'legalName',p_payload->>'displayName',v_slug,'ACTIVE',
    (select email from public.profiles where id=p_user_id),nullif(p_payload->>'phone',''),
    nullif(p_payload->>'websiteUrl',''),nullif(p_payload->>'description',''),
    nullif(p_payload->>'nationalId',''),nullif(p_payload->>'registrationNumber','')
  );
  insert into public.memberships(user_id,organization_id,role,status)
    values(p_user_id,v_org_id,'OWNER','ACTIVE');
  insert into public.supplier_profiles(
    organization_id,owner_user_id,national_id,registration_number,
    capacity_per_day,lead_time_days,approval_mode,status
  ) values(
    v_org_id,p_user_id,nullif(p_payload->>'nationalId',''),
    nullif(p_payload->>'registrationNumber',''),
    greatest(0,coalesce((p_payload->>'capacityPerDay')::integer,0)),
    greatest(1,coalesce((p_payload->>'leadTimeDays')::integer,1)),
    'AUTO','APPROVED'
  );
  insert into public.facilities(
    id,organization_id,name,city,address,postal_code,phone,status
  ) values(
    v_facility_id,v_org_id,'مرکز '||(p_payload->>'displayName'),
    p_payload->>'city',p_payload->>'address',p_payload->>'postalCode',
    nullif(p_payload->>'phone',''),'ACTIVE'
  );
  insert into public.bank_accounts(
    organization_id,bank_name,card_number,iban,priority,status,account_holder_name
  ) values(
    v_org_id,nullif(p_payload->>'bankName',''),nullif(p_payload->>'cardNumber',''),
    nullif(p_payload->>'iban',''),1,'ACTIVE',p_payload->>'legalName'
  );
  insert into public.balance_projections(organization_id) values(v_org_id)
    on conflict(organization_id) do nothing;
  insert into public.ai_credit_accounts(user_id) values(p_user_id)
    on conflict(user_id) do nothing;
  update public.profiles set primary_role='SUPPLIER',updated_at=now() where id=p_user_id;
  return jsonb_build_object('organizationId',v_org_id,'facilityId',v_facility_id,'userId',p_user_id);
end
$$;

-- Checkout and supplier assignment -------------------------------------------

create or replace function public.checkout_create_order(
  p_idempotency_key text,
  p_shipping_address_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing uuid;
  v_order_id uuid:=gen_random_uuid();
  v_order_item_id uuid;
  v_fulfilment_id uuid;
  v_subtotal bigint:=0;
  v_shipping bigint:=790000;
  v_number text;
  v_address jsonb;
  v_item jsonb;
  v_quantity integer;
  v_row record;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))<8 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'CART_EMPTY'; end if;

  select id into v_existing from public.orders
    where buyer_user_id=v_user_id and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  select jsonb_build_object(
    'recipientName',recipient_name,'phone',phone,'province',province,'city',city,
    'addressLine',address_line,'postalCode',postal_code,'deliveryNote',delivery_note
  ) into v_address
  from public.buyer_addresses
  where id=p_shipping_address_id and user_id=v_user_id;
  if v_address is null then raise exception 'ADDRESS_NOT_FOUND'; end if;

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
      and so.status='ACTIVE' and so.approval_status='APPROVED';
    if not found then raise exception 'VARIANT_UNAVAILABLE'; end if;
    v_subtotal:=v_subtotal+(v_row.price*v_quantity);
  end loop;
  if v_subtotal>=15000000 then v_shipping:=0; end if;

  v_number:='CH-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||upper(substr(v_order_id::text,1,4));
  insert into public.orders(
    id,number,buyer_user_id,status,subtotal,total,currency,customer_snapshot,
    shipping_address_snapshot,shipping_address_id,shipping_amount,idempotency_key
  ) values(
    v_order_id,v_number,v_user_id,'CONFIRMED',v_subtotal,v_subtotal+v_shipping,'IRR',
    (select jsonb_build_object('email',email,'firstName',first_name,'lastName',last_name,'phone',phone) from public.profiles where id=v_user_id),
    v_address,p_shipping_address_id,v_shipping,p_idempotency_key
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
      jsonb_build_object('title',v_row.title,'description',v_row.description,'color',v_row.color_name,'size',v_row.size_name),
      coalesce((select jsonb_object_agg(rv.side,dv.canvas_document)
        from public.design_views dv join public.raw_product_views rv on rv.id=dv.raw_product_view_id
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
        v_row.offer_id,jsonb_build_object('offerId',v_row.offer_id,'unitCost',v_row.unit_cost,'leadTimeDays',v_row.lead_time_days),
        'ASSIGNED',now()+make_interval(days=>v_row.lead_time_days)
      );
    end if;
    insert into public.fulfilment_items(fulfilment_id,order_item_id,quantity)
      values(v_fulfilment_id,v_order_item_id,v_quantity);
  end loop;
  return v_order_id;
exception when unique_violation then
  select id into v_existing from public.orders
    where buyer_user_id=v_user_id and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  raise;
end
$$;

create or replace function public.record_payment(
  p_order_id uuid,p_provider text,p_provider_payment_id text,
  p_idempotency_key text,p_amount bigint,p_provider_response jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_order public.orders%rowtype; v_payment_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and session_user not in ('postgres','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select id into v_payment_id from public.payments where idempotency_key=p_idempotency_key;
  if v_payment_id is not null then return v_payment_id; end if;
  if p_amount<>v_order.total then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
  insert into public.payments(order_id,provider,provider_payment_id,idempotency_key,amount,status,provider_response,captured_at)
    values(p_order_id,p_provider,p_provider_payment_id,p_idempotency_key,p_amount,'CAPTURED',coalesce(p_provider_response,'{}'::jsonb),now())
    returning id into v_payment_id;
  update public.orders set paid_at=now() where id=p_order_id and paid_at is null;
  return v_payment_id;
end
$$;

-- Fulfilment state, earnings, and payouts -------------------------------------

create or replace function public.transition_fulfilment(
  p_fulfilment_id uuid,
  p_to public.fulfilment_status,
  p_tracking_code text default null,
  p_idempotency_key text default null
)
returns public.fulfilment_status
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.fulfilments%rowtype;
  v_actor uuid:=auth.uid();
  v_allowed boolean:=false;
  v_actor_type text:='SYSTEM';
  v_key text;
begin
  select * into v_row from public.fulfilments where id=p_fulfilment_id for update;
  if not found then raise exception 'FULFILMENT_NOT_FOUND'; end if;

  if v_actor is not null then
    if public.is_admin(v_actor) then v_actor_type:='ADMIN';
    elsif public.is_org_member(v_row.supplier_organization_id,v_actor) then v_actor_type:='SUPPLIER';
    else raise exception 'FORBIDDEN' using errcode='42501';
    end if;
  elsif session_user not in ('postgres','supabase_admin') and coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if v_row.status=p_to then return p_to; end if;
  v_allowed:=case v_row.status
    when 'ASSIGNED' then p_to in ('IN_PRODUCTION','CANCELLED')
    when 'IN_PRODUCTION' then p_to in ('QUALITY_CHECK','CANCELLED')
    when 'QUALITY_CHECK' then p_to in ('READY_TO_SEND','IN_PRODUCTION','CANCELLED')
    when 'READY_TO_SEND' then p_to in ('SENT','CANCELLED')
    when 'SENT' then p_to in ('DONE','RETURNED')
    else false
  end;
  if not v_allowed then raise exception 'INVALID_FULFILMENT_TRANSITION: % -> %',v_row.status,p_to; end if;

  if p_to='SENT' then
    if length(trim(coalesce(p_tracking_code,'')))<5 then raise exception 'TRACKING_REQUIRED'; end if;
    update public.fulfilments set
      status='SENT',tracking_code=trim(p_tracking_code),sent_at=now(),
      auto_complete_at=now()+interval '10 days',version=version+1
      where id=p_fulfilment_id;
    insert into public.shipments(fulfilment_id,tracking_code,status,shipped_at)
      values(p_fulfilment_id,trim(p_tracking_code),'SENT',now())
      on conflict(carrier,tracking_code) do nothing;
  elsif p_to='DONE' then
    update public.fulfilments set status='DONE',done_at=now(),auto_complete_at=null,version=version+1
      where id=p_fulfilment_id;
  elsif p_to='CANCELLED' then
    update public.fulfilments set status='CANCELLED',cancelled_at=now(),auto_complete_at=null,version=version+1
      where id=p_fulfilment_id;
  elsif p_to='RETURNED' then
    update public.fulfilments set status='RETURNED',returned_at=now(),auto_complete_at=null,version=version+1
      where id=p_fulfilment_id;
  else
    update public.fulfilments set status=p_to,version=version+1 where id=p_fulfilment_id;
  end if;

  v_key:=coalesce(nullif(p_idempotency_key,''),p_fulfilment_id::text||':'||p_to::text||':'||((v_row.version+1)::text));
  insert into public.fulfilment_status_events(
    fulfilment_id,from_status,to_status,actor_type,actor_id,idempotency_key
  ) values(
    p_fulfilment_id,v_row.status::text,p_to::text,v_actor_type,v_actor::text,v_key
  ) on conflict(idempotency_key) do nothing;
  return p_to;
end
$$;

create or replace function public.mark_fulfilment_sent(
  p_fulfilment uuid,p_tracking text,p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.transition_fulfilment(p_fulfilment,'SENT',p_tracking,p_fulfilment::text||':SENT');
end
$$;

create or replace function public.create_earnings_when_done()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare r record; v_seller_gross bigint; v_seller_fee bigint;
begin
  if new.status='DONE' and old.status is distinct from 'DONE' then
    for r in
      select oi.*,fi.quantity fulfilled_quantity
      from public.fulfilment_items fi join public.order_items oi on oi.id=fi.order_item_id
      where fi.fulfilment_id=new.id
    loop
      insert into public.earnings(
        beneficiary_organization_id,earning_type,source_type,source_id,
        order_id,order_item_id,fulfilment_id,gross_amount,fee_amount,net_amount,
        status,available_at
      ) values(
        new.supplier_organization_id,'SUPPLIER','FULFILMENT',new.id,
        new.order_id,r.id,new.id,r.cost_snapshot*r.fulfilled_quantity,0,
        r.cost_snapshot*r.fulfilled_quantity,'AVAILABLE',now()
      ) on conflict(beneficiary_organization_id,earning_type,source_type,source_id)
        do nothing;

      v_seller_gross:=greatest(0,(r.unit_price-r.cost_snapshot)*r.fulfilled_quantity);
      v_seller_fee:=least(v_seller_gross,(r.unit_price*r.fulfilled_quantity*10/100));
      insert into public.earnings(
        beneficiary_organization_id,earning_type,source_type,source_id,
        order_id,order_item_id,fulfilment_id,gross_amount,fee_amount,net_amount,
        status,available_at
      ) values(
        r.seller_organization_id,'SELLER','ORDER_ITEM',r.id,
        new.order_id,r.id,new.id,v_seller_gross,v_seller_fee,
        v_seller_gross-v_seller_fee,'AVAILABLE',now()
      ) on conflict(beneficiary_organization_id,earning_type,source_type,source_id)
        do nothing;
    end loop;
  end if;
  return new;
end
$$;
drop trigger if exists fulfilments_create_earnings on public.fulfilments;
create trigger fulfilments_create_earnings
after update of status on public.fulfilments
for each row execute function public.create_earnings_when_done();

create or replace function public.recalculate_balance(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.balance_projections(organization_id,pending,available,reserved,currency,updated_at)
  select p_organization_id,
    coalesce(sum(net_amount) filter(where status='PENDING'),0),
    coalesce(sum(net_amount) filter(where status='AVAILABLE' and coalesce(available_at,now())<=now()),0),
    coalesce(sum(net_amount) filter(where status='RESERVED'),0),
    'IRR',now()
  from public.earnings where beneficiary_organization_id=p_organization_id
  on conflict(organization_id) do update set
    pending=excluded.pending,available=excluded.available,reserved=excluded.reserved,updated_at=now();
end
$$;

create or replace function public.refresh_balance_after_earning()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  perform public.recalculate_balance(coalesce(new.beneficiary_organization_id,old.beneficiary_organization_id));
  return coalesce(new,old);
end
$$;
drop trigger if exists earnings_refresh_balance on public.earnings;
create trigger earnings_refresh_balance
after insert or update or delete on public.earnings
for each row execute function public.refresh_balance_after_earning();

create or replace function public.request_payout(
  p_organization_id uuid,p_bank_account_id uuid,p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_request_id uuid; v_amount bigint;
begin
  if not public.is_org_member(p_organization_id,auth.uid(),array['OWNER','FINANCE']) and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.bank_accounts where id=p_bank_account_id and organization_id=p_organization_id and status='ACTIVE') then
    raise exception 'BANK_ACCOUNT_NOT_FOUND';
  end if;
  select id into v_request_id from public.payout_requests where idempotency_key=p_idempotency_key;
  if v_request_id is not null then return v_request_id; end if;
  if exists(select 1 from public.payout_requests where organization_id=p_organization_id and status in ('REQUESTED','PROCESSING')) then
    raise exception 'OPEN_PAYOUT_EXISTS';
  end if;

  select coalesce(sum(net_amount),0) into v_amount
  from public.earnings
  where beneficiary_organization_id=p_organization_id and status='AVAILABLE'
    and coalesce(available_at,now())<=now()
  for update;
  if v_amount<=0 then raise exception 'NO_AVAILABLE_BALANCE'; end if;

  insert into public.payout_requests(
    organization_id,bank_account_id,amount,currency,status,idempotency_key
  ) values(p_organization_id,p_bank_account_id,v_amount,'IRR','REQUESTED',p_idempotency_key)
  returning id into v_request_id;

  insert into public.payout_request_items(payout_request_id,earning_id,amount)
    select v_request_id,id,net_amount from public.earnings
    where beneficiary_organization_id=p_organization_id and status='AVAILABLE'
      and coalesce(available_at,now())<=now()
    for update;
  update public.earnings set status='RESERVED'
    where id in(select earning_id from public.payout_request_items where payout_request_id=v_request_id);
  perform public.recalculate_balance(p_organization_id);
  return v_request_id;
end
$$;

create or replace function public.complete_payout(
  p_payout_request_id uuid,p_receipt_file_id uuid default null,p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_request public.payout_requests%rowtype; v_history_id uuid;
begin
  if not public.is_admin() and coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and session_user not in ('postgres','supabase_admin') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  select * into v_request from public.payout_requests where id=p_payout_request_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  select id into v_history_id from public.payout_payment_history where payout_request_id=p_payout_request_id;
  if v_history_id is not null then return v_history_id; end if;
  if v_request.status not in ('REQUESTED','PROCESSING') then raise exception 'PAYOUT_NOT_PAYABLE'; end if;
  if p_receipt_file_id is not null and not exists(
    select 1 from public.storage_files where id=p_receipt_file_id and kind='PAYOUT_RECEIPT' and state='READY'
  ) then raise exception 'INVALID_RECEIPT_FILE'; end if;

  insert into public.payout_payment_history(
    payout_request_id,organization_id,amount,currency,receipt_file_id,
    receipt_text,reference,paid_at,admin_id
  ) values(
    p_payout_request_id,v_request.organization_id,v_request.amount,v_request.currency,
    p_receipt_file_id,p_reference,p_reference,now(),auth.uid()
  ) returning id into v_history_id;
  update public.payout_requests set status='PAID',processed_at=now(),processed_by=auth.uid()
    where id=p_payout_request_id;
  update public.earnings set status='PAID',paid_at=now()
    where id in(select earning_id from public.payout_request_items where payout_request_id=p_payout_request_id);
  perform public.recalculate_balance(v_request.organization_id);
  return v_history_id;
end
$$;

create or replace function public.complete_eligible_fulfilments()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare r record; v_count integer:=0;
begin
  for r in select id from public.fulfilments
    where status='SENT' and auto_complete_at<=now()
      and returned_at is null and cancelled_at is null and disputed_at is null
    for update skip locked
  loop
    perform public.transition_fulfilment(r.id,'DONE',null,r.id::text||':AUTO_DONE');
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$$;

-- AI and moderation -----------------------------------------------------------

create or replace function public.consume_ai_credit(
  p_design_id uuid,p_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_account public.ai_credit_accounts%rowtype; v_existing integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.designs where id=p_design_id and owner_user_id=v_user) then
    raise exception 'DESIGN_NOT_OWNED';
  end if;
  select delta into v_existing from public.ai_credit_events where idempotency_key=p_idempotency_key;
  if found then
    select lifetime_granted-lifetime_used into v_existing from public.ai_credit_accounts where user_id=v_user;
    return v_existing;
  end if;
  insert into public.ai_credit_accounts(user_id) values(v_user) on conflict(user_id) do nothing;
  select * into v_account from public.ai_credit_accounts where user_id=v_user for update;
  if v_account.lifetime_used>=v_account.lifetime_granted then raise exception 'AI_CREDIT_EXHAUSTED'; end if;
  update public.ai_credit_accounts set lifetime_used=lifetime_used+1 where user_id=v_user;
  insert into public.ai_credit_events(user_id,design_id,idempotency_key,delta,reason)
    values(v_user,p_design_id,p_idempotency_key,-1,'AI_IMAGE_GENERATION');
  return v_account.lifetime_granted-v_account.lifetime_used-1;
end
$$;

create or replace function public.moderate_product(
  p_product_id uuid,p_decision public.moderation_state,
  p_rejection_reason_id uuid default null,p_custom_message text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_queue public.product_moderation_queue%rowtype; v_decision_id uuid; v_owner uuid; v_template uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'INVALID_DECISION'; end if;
  if p_decision='REJECTED' and p_rejection_reason_id is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into v_queue from public.product_moderation_queue
    where seller_product_id=p_product_id and status='PENDING'
    order by submitted_at desc limit 1 for update;
  if not found then raise exception 'PENDING_REVIEW_NOT_FOUND'; end if;

  update public.product_moderation_queue set
    status=p_decision::text,reviewed_at=now(),reviewed_by=auth.uid(),
    rejection_reason_id=p_rejection_reason_id,custom_message=p_custom_message
    where id=v_queue.id;
  update public.seller_products set
    moderation_status=p_decision,
    status=case when p_decision='APPROVED' then 'PUBLISHED' else 'REJECTED' end,
    published_at=case when p_decision='APPROVED' then coalesce(published_at,now()) else published_at end
    where id=p_product_id;
  insert into public.product_moderation_decisions(
    seller_product_id,queue_id,decision,rejection_reason_id,custom_message,admin_user_id
  ) values(p_product_id,v_queue.id,p_decision,p_rejection_reason_id,p_custom_message,auth.uid())
  returning id into v_decision_id;

  select st.owner_user_id into v_owner
  from public.seller_products sp join public.stores st on st.id=sp.store_id where sp.id=p_product_id;
  if p_rejection_reason_id is not null then
    select sms_template_id into v_template from public.rejection_reasons where id=p_rejection_reason_id;
  end if;
  insert into public.notification_outbox(
    event_type,recipient_user_id,template_id,payload,idempotency_key
  ) values(
    'PRODUCT_'||p_decision::text,v_owner,v_template,
    jsonb_build_object('productId',p_product_id,'message',p_custom_message),
    'moderation:'||v_decision_id::text
  );
  insert into public.audit_events(actor_type,actor_id,action,target_type,target_id,reason,after_data)
    values('ADMIN',auth.uid()::text,'PRODUCT_'||p_decision::text,'SELLER_PRODUCT',p_product_id::text,p_custom_message,jsonb_build_object('decisionId',v_decision_id));
  return v_decision_id;
end
$$;

-- Ticket transaction ----------------------------------------------------------

create or replace function public.create_ticket(
  p_organization_id uuid,p_subject text,p_category text,p_priority text,
  p_body text,p_reference_type text default null,p_reference_id text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_ticket uuid:=gen_random_uuid(); v_message uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.is_org_member(p_organization_id,v_user) and not public.is_admin(v_user) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if length(trim(p_subject))<3 or length(trim(p_body))<3 then raise exception 'SUBJECT_AND_BODY_REQUIRED'; end if;
  if p_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'INVALID_PRIORITY'; end if;
  insert into public.tickets(
    id,organization_id,opened_by_user_id,subject,category,priority,status,
    reference_type,reference_id,last_message_at
  ) values(v_ticket,p_organization_id,v_user,trim(p_subject),p_category,p_priority,'WAITING_SUPPORT',p_reference_type,p_reference_id,now());
  insert into public.ticket_participants(ticket_id,user_id,organization_id,role)
    values(v_ticket,v_user,p_organization_id,'REQUESTER');
  insert into public.ticket_messages(ticket_id,sender_id,sender_role,body,visibility)
    values(v_ticket,v_user,(select primary_role::text from public.profiles where id=v_user),trim(p_body),'PUBLIC')
    returning id into v_message;
  insert into public.ticket_read_states(ticket_id,user_id,last_read_message_id,last_read_at,unread_count)
    values(v_ticket,v_user,v_message,now(),0);
  return v_ticket;
end
$$;

-- RLS ------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables
    where schemaname='public' and tablename<>'_chapli_migrations'
  loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Clear the temporary public policies before replacing them.
drop policy if exists "public active stores" on public.stores;
drop policy if exists "public active raw products" on public.raw_products;
drop policy if exists "public published products" on public.seller_products;

-- Every authenticated admin can manage through RLS; sensitive commands still
-- go through the transactional functions above.
do $$
declare t text;
begin
  for t in select tablename from pg_tables
    where schemaname='public' and tablename<>'_chapli_migrations'
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admin_manage_'||t,t
    );
  end loop;
end $$;

create policy profiles_read_own on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy buyer_profiles_own on public.buyer_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy admin_profiles_read_own on public.admin_profiles for select to authenticated using(user_id=auth.uid());

create policy organizations_member_read on public.organizations for select to authenticated using(public.is_org_member(id));
create policy organizations_owner_update on public.organizations for update to authenticated using(public.is_org_member(id,auth.uid(),array['OWNER'])) with check(public.is_org_member(id,auth.uid(),array['OWNER']));
create policy memberships_member_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.is_org_member(organization_id));
create policy memberships_owner_manage on public.memberships for all to authenticated using(public.is_org_member(organization_id,auth.uid(),array['OWNER'])) with check(public.is_org_member(organization_id,auth.uid(),array['OWNER']));
create policy seller_profiles_org on public.seller_profiles for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy supplier_profiles_approved_read on public.supplier_profiles for select to authenticated using(status='APPROVED' or public.is_org_member(organization_id));
create policy supplier_profiles_org_manage on public.supplier_profiles for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy facilities_supplier_read on public.facilities for select to authenticated using(status='ACTIVE' or public.is_org_member(organization_id));
create policy facilities_org_manage on public.facilities for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));

create policy stores_public_read on public.stores for select to anon,authenticated using(status='ACTIVE');
create policy stores_org_manage on public.stores for all to authenticated using(public.can_manage_store(id)) with check(public.is_org_member(organization_id));

create policy buyer_addresses_own on public.buyer_addresses for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy categories_public_read on public.categories for select to anon,authenticated using(status='ACTIVE');
create policy raw_products_public_read on public.raw_products for select to anon,authenticated using(status='ACTIVE');
create policy raw_colors_public_read on public.raw_product_colors for select to anon,authenticated using(status='ACTIVE');
create policy raw_sizes_public_read on public.raw_product_sizes for select to anon,authenticated using(status='ACTIVE');
create policy raw_variants_public_read on public.raw_product_variants for select to anon,authenticated using(status='ACTIVE');
create policy raw_views_public_read on public.raw_product_views for select to anon,authenticated using(true);
create policy raw_variant_assets_auth_read on public.raw_product_variant_assets for select to authenticated using(true);
create policy raw_media_public_read on public.raw_product_media for select to anon,authenticated using(true);
create policy print_methods_public_read on public.print_methods for select to anon,authenticated using(status='ACTIVE');

create policy supplier_print_methods_read on public.supplier_print_methods for select to authenticated using(true);
create policy supplier_print_methods_manage on public.supplier_print_methods for all to authenticated using(public.is_org_member(supplier_organization_id)) with check(public.is_org_member(supplier_organization_id));
create policy supplier_categories_read on public.supplier_category_capabilities for select to authenticated using(true);
create policy supplier_categories_manage on public.supplier_category_capabilities for all to authenticated using(public.is_org_member(supplier_organization_id)) with check(public.is_org_member(supplier_organization_id));
create policy supplier_offers_eligible_read on public.supplier_offers for select to authenticated using((approval_status='APPROVED' and status='ACTIVE') or public.is_org_member(supplier_organization_id));
create policy supplier_offers_org_manage on public.supplier_offers for all to authenticated using(public.is_org_member(supplier_organization_id)) with check(public.is_org_member(supplier_organization_id));
create policy supplier_offer_variants_read on public.supplier_offer_variants for select to authenticated using(exists(select 1 from public.supplier_offers o where o.id=supplier_offer_id and ((o.approval_status='APPROVED' and o.status='ACTIVE') or public.is_org_member(o.supplier_organization_id))));
create policy supplier_offer_variants_manage on public.supplier_offer_variants for all to authenticated using(exists(select 1 from public.supplier_offers o where o.id=supplier_offer_id and public.is_org_member(o.supplier_organization_id))) with check(exists(select 1 from public.supplier_offers o where o.id=supplier_offer_id and public.is_org_member(o.supplier_organization_id)));

create policy designs_owner on public.designs for all to authenticated using(owner_user_id=auth.uid() or public.can_manage_store(store_id)) with check(owner_user_id=auth.uid() and public.can_manage_store(store_id));
create policy design_views_owner on public.design_views for all to authenticated using(exists(select 1 from public.designs d where d.id=design_id and (d.owner_user_id=auth.uid() or public.can_manage_store(d.store_id)))) with check(exists(select 1 from public.designs d where d.id=design_id and (d.owner_user_id=auth.uid() or public.can_manage_store(d.store_id))));
create policy design_variants_owner on public.design_variants for all to authenticated using(exists(select 1 from public.designs d where d.id=design_id and (d.owner_user_id=auth.uid() or public.can_manage_store(d.store_id)))) with check(exists(select 1 from public.designs d where d.id=design_id and (d.owner_user_id=auth.uid() or public.can_manage_store(d.store_id))));

create policy seller_products_public_read on public.seller_products for select to anon,authenticated using(status='PUBLISHED' and moderation_status='APPROVED');
create policy seller_products_store_manage on public.seller_products for all to authenticated using(public.can_manage_store(store_id)) with check(public.can_manage_store(store_id));
create policy seller_product_variants_public_read on public.seller_product_variants for select to anon,authenticated using(status='ACTIVE' and exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED'));
create policy seller_product_variants_owner on public.seller_product_variants for all to authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id))) with check(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id)));
create policy product_images_public_read on public.product_images for select to anon,authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED'));
create policy product_images_owner on public.product_images for all to authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id))) with check(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id)));
create policy product_details_public_read on public.product_details for select to anon,authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED'));
create policy product_details_owner on public.product_details for all to authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id))) with check(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id)));
create policy tags_public_read on public.tags for select to anon,authenticated using(true);
create policy product_tags_public_read on public.product_tags for select to anon,authenticated using(true);
create policy graphic_styles_public_read on public.graphic_styles for select to anon,authenticated using(status='ACTIVE');
create policy product_graphic_styles_public_read on public.product_graphic_styles for select to anon,authenticated using(true);
create policy product_videos_public_read on public.product_videos for select to anon,authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED'));
create policy product_videos_owner on public.product_videos for all to authenticated using(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id))) with check(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id)));
create policy homepage_banners_public_read on public.homepage_banners for select to anon,authenticated using(status='ACTIVE' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()));

create policy reviews_public_read on public.reviews for select to anon,authenticated using(status='PUBLISHED');
create policy reviews_buyer_insert on public.reviews for insert to authenticated with check(buyer_user_id=auth.uid());
create policy reviews_buyer_update on public.reviews for update to authenticated using(buyer_user_id=auth.uid()) with check(buyer_user_id=auth.uid());
create policy wishlist_own on public.wishlist_items for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy recent_views_own on public.recent_product_views for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy reels_public_read on public.reel_posts for select to anon,authenticated using(status='PUBLISHED');
create policy reels_store_manage on public.reel_posts for all to authenticated using(public.can_manage_store(store_id)) with check(public.can_manage_store(store_id));
create policy reel_likes_own on public.reel_likes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy reel_saves_own on public.reel_saves for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy carts_own on public.carts for all to authenticated using(buyer_user_id=auth.uid()) with check(buyer_user_id=auth.uid());
create policy cart_items_own on public.cart_items for all to authenticated using(exists(select 1 from public.carts c where c.id=cart_id and c.buyer_user_id=auth.uid())) with check(exists(select 1 from public.carts c where c.id=cart_id and c.buyer_user_id=auth.uid()));
create policy orders_access on public.orders for select to authenticated using(public.can_access_order(id));
create policy order_items_access on public.order_items for select to authenticated using(public.can_access_order(order_id));
create policy fulfilments_access on public.fulfilments for select to authenticated using(public.can_access_fulfilment(id));
create policy fulfilment_items_access on public.fulfilment_items for select to authenticated using(public.can_access_fulfilment(fulfilment_id));
create policy fulfilment_events_access on public.fulfilment_status_events for select to authenticated using(public.can_access_fulfilment(fulfilment_id));
create policy fulfilment_files_access on public.fulfilment_files for select to authenticated using(public.can_access_fulfilment(fulfilment_id));
create policy shipments_access on public.shipments for select to authenticated using(public.can_access_fulfilment(fulfilment_id));
create policy tracking_events_access on public.tracking_events for select to authenticated using(exists(select 1 from public.shipments s where s.id=shipment_id and public.can_access_fulfilment(s.fulfilment_id)));
create policy payments_buyer_read on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.buyer_user_id=auth.uid()));

create policy bank_accounts_org on public.bank_accounts for all to authenticated using(public.is_org_member(organization_id,auth.uid(),array['OWNER','FINANCE'])) with check(public.is_org_member(organization_id,auth.uid(),array['OWNER','FINANCE']));
create policy balances_org_read on public.balance_projections for select to authenticated using(public.is_org_member(organization_id));
create policy earnings_org_read on public.earnings for select to authenticated using(public.is_org_member(beneficiary_organization_id));
create policy payouts_org_read on public.payout_requests for select to authenticated using(public.is_org_member(organization_id));
create policy payout_items_org_read on public.payout_request_items for select to authenticated using(exists(select 1 from public.payout_requests p where p.id=payout_request_id and public.is_org_member(p.organization_id)));
create policy payout_history_org_read on public.payout_payment_history for select to authenticated using(public.is_org_member(organization_id));
create policy sms_templates_authenticated_read on public.sms_templates for select to authenticated using(status='ACTIVE');
create policy rejection_reasons_authenticated_read on public.rejection_reasons for select to authenticated using(status='ACTIVE');
create policy ai_accounts_own_read on public.ai_credit_accounts for select to authenticated using(user_id=auth.uid());
create policy ai_events_own_read on public.ai_credit_events for select to authenticated using(user_id=auth.uid());

create policy tutorials_auth_read on public.tutorials for select to authenticated using(status='PUBLISHED');
create policy tutorial_progress_own on public.tutorial_progress for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy tickets_org_read on public.tickets for select to authenticated using(public.is_org_member(organization_id) or opened_by_user_id=auth.uid());
create policy ticket_participants_read on public.ticket_participants for select to authenticated using(exists(select 1 from public.tickets t where t.id=ticket_id and (public.is_org_member(t.organization_id) or t.opened_by_user_id=auth.uid())));
create policy ticket_messages_read on public.ticket_messages for select to authenticated using(exists(select 1 from public.tickets t where t.id=ticket_id and (public.is_org_member(t.organization_id) or t.opened_by_user_id=auth.uid())) and visibility<>'INTERNAL');
create policy ticket_messages_insert on public.ticket_messages for insert to authenticated with check(sender_id=auth.uid() and visibility='PUBLIC' and exists(select 1 from public.tickets t where t.id=ticket_id and (public.is_org_member(t.organization_id) or t.opened_by_user_id=auth.uid())));
create policy ticket_attachments_read on public.ticket_attachments for select to authenticated using(exists(select 1 from public.tickets t where t.id=ticket_id and (public.is_org_member(t.organization_id) or t.opened_by_user_id=auth.uid())));
create policy ticket_read_states_own on public.ticket_read_states for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy storage_files_public_read on public.storage_files for select to anon,authenticated using(bucket in ('product-images','variant-mockups') and state='READY');
create policy storage_files_owner_read on public.storage_files for select to authenticated using(public.can_access_file(bucket,path));
create policy storage_files_owner_insert on public.storage_files for insert to authenticated with check(owner_user_id=auth.uid() or public.is_org_member(owner_organization_id));
create policy storage_files_owner_update on public.storage_files for update to authenticated using(owner_user_id=auth.uid() or public.is_org_member(owner_organization_id)) with check(owner_user_id=auth.uid() or public.is_org_member(owner_organization_id));

-- Grants are intentionally broad at the SQL level; RLS is the enforcement
-- boundary. Internal tables with no non-admin policies remain inaccessible.
grant usage on schema public to anon,authenticated;
grant select on all tables in schema public to anon,authenticated;
grant insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

revoke all on function public.provision_seller(uuid,jsonb) from public,anon;
revoke all on function public.provision_supplier(uuid,jsonb) from public,anon;
grant execute on function public.provision_seller(uuid,jsonb) to authenticated,service_role;
grant execute on function public.provision_supplier(uuid,jsonb) to authenticated,service_role;
grant execute on function public.checkout_create_order(text,uuid,jsonb) to authenticated;
grant execute on function public.transition_fulfilment(uuid,public.fulfilment_status,text,text) to authenticated,service_role;
grant execute on function public.mark_fulfilment_sent(uuid,text,uuid) to authenticated,service_role;
grant execute on function public.request_payout(uuid,uuid,text) to authenticated;
grant execute on function public.complete_payout(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.consume_ai_credit(uuid,text) to authenticated;
grant execute on function public.moderate_product(uuid,public.moderation_state,uuid,text) to authenticated;
grant execute on function public.create_ticket(uuid,text,text,text,text,text,text) to authenticated;
revoke all on function public.record_payment(uuid,text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.record_payment(uuid,text,text,text,bigint,jsonb) to service_role;
revoke all on function public.complete_eligible_fulfilments() from public,anon,authenticated;
grant execute on function public.complete_eligible_fulfilments() to service_role;

-- Storage buckets and object policies ----------------------------------------

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('raw-product-assets','raw-product-assets',false,20971520,array['image/jpeg','image/png','image/webp']),
  ('variant-mockups','variant-mockups',true,20971520,array['image/jpeg','image/png','image/webp']),
  ('design-files','design-files',false,52428800,array['image/jpeg','image/png','image/webp','image/svg+xml','application/pdf']),
  ('printable-exports','printable-exports',false,104857600,array['image/png','application/pdf','application/zip']),
  ('ai-generated','ai-generated',false,20971520,array['image/jpeg','image/png','image/webp']),
  ('payout-receipts','payout-receipts',false,10485760,array['image/jpeg','image/png','application/pdf']),
  ('ticket-attachments','ticket-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','application/zip'])
on conflict(id) do update set
  public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists chapli_public_media_read on storage.objects;
drop policy if exists chapli_private_file_read on storage.objects;
drop policy if exists chapli_user_upload_insert on storage.objects;
drop policy if exists chapli_user_upload_update on storage.objects;
drop policy if exists chapli_user_upload_delete on storage.objects;

create policy chapli_public_media_read on storage.objects
for select to anon,authenticated
using(bucket_id in ('product-images','variant-mockups'));

create policy chapli_private_file_read on storage.objects
for select to authenticated
using(public.can_access_file(bucket_id,name));

create policy chapli_user_upload_insert on storage.objects
for insert to authenticated
with check(
  bucket_id in ('product-images','design-files','ai-generated','ticket-attachments')
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy chapli_user_upload_update on storage.objects
for update to authenticated
using(public.can_access_file(bucket_id,name))
with check(public.can_access_file(bucket_id,name));

create policy chapli_user_upload_delete on storage.objects
for delete to authenticated
using(public.can_access_file(bucket_id,name));

