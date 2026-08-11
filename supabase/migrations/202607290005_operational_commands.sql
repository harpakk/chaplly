-- Operational command hardening and dashboard write APIs.

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

  -- Lock the exact earning rows first. PostgreSQL does not permit FOR UPDATE
  -- directly on an aggregate query.
  perform id from public.earnings
  where beneficiary_organization_id=p_organization_id and status='AVAILABLE'
    and coalesce(available_at,now())<=now()
  order by id for update;
  select coalesce(sum(net_amount),0) into v_amount
  from public.earnings
  where beneficiary_organization_id=p_organization_id and status='AVAILABLE'
    and coalesce(available_at,now())<=now();
  if v_amount<=0 then raise exception 'NO_AVAILABLE_BALANCE'; end if;

  insert into public.payout_requests(
    organization_id,bank_account_id,amount,currency,status,idempotency_key
  ) values(p_organization_id,p_bank_account_id,v_amount,'IRR','REQUESTED',p_idempotency_key)
  returning id into v_request_id;
  insert into public.payout_request_items(payout_request_id,earning_id,amount)
    select v_request_id,id,net_amount from public.earnings
    where beneficiary_organization_id=p_organization_id and status='AVAILABLE'
      and coalesce(available_at,now())<=now();
  update public.earnings set status='RESERVED'
    where id in(select earning_id from public.payout_request_items where payout_request_id=v_request_id);
  perform public.recalculate_balance(p_organization_id);
  return v_request_id;
end
$$;

create or replace function public.admin_upsert_raw_product(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  v_color jsonb; v_size jsonb; v_color_id uuid; v_size_id uuid;
  v_slug text:=lower(regexp_replace(coalesce(nullif(p_payload->>'slug',''),'raw-'||substr(v_id::text,1,8)),'[^a-z0-9-]+','-','g'));
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_payload->>'name','')))<2 then raise exception 'NAME_REQUIRED'; end if;
  if not exists(select 1 from public.categories where id=(p_payload->>'categoryId')::uuid) then raise exception 'CATEGORY_NOT_FOUND'; end if;

  insert into public.raw_products(
    id,category_id,name,slug,description,base_cost,suggested_price,has_back,status,
    sku_prefix,material,weight_grams,production_notes
  ) values(
    v_id,(p_payload->>'categoryId')::uuid,trim(p_payload->>'name'),v_slug,
    nullif(p_payload->>'description',''),greatest(0,coalesce((p_payload->>'baseCost')::bigint,0)),
    greatest(0,coalesce((p_payload->>'suggestedPrice')::bigint,0)),
    coalesce((p_payload->>'hasBack')::boolean,false),coalesce(nullif(p_payload->>'status',''),'ACTIVE'),
    nullif(p_payload->>'skuPrefix',''),nullif(p_payload->>'material',''),
    nullif(p_payload->>'weightGrams','')::integer,nullif(p_payload->>'productionNotes','')
  )
  on conflict(id) do update set
    category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,
    description=excluded.description,base_cost=excluded.base_cost,
    suggested_price=excluded.suggested_price,has_back=excluded.has_back,status=excluded.status,
    sku_prefix=excluded.sku_prefix,material=excluded.material,
    weight_grams=excluded.weight_grams,production_notes=excluded.production_notes,updated_at=now();

  for v_color in select value from jsonb_array_elements(coalesce(p_payload->'colors','[]'::jsonb))
  loop
    insert into public.raw_product_colors(raw_product_id,name,slug,hex,status,sort_order)
    values(v_id,trim(v_color->>'name'),
      lower(regexp_replace(coalesce(nullif(v_color->>'slug',''),trim(v_color->>'name')),'[^a-zA-Z0-9-]+','-','g')),
      nullif(v_color->>'hex',''),'ACTIVE',coalesce((v_color->>'sortOrder')::integer,0))
    on conflict(raw_product_id,name) do update set hex=excluded.hex,status='ACTIVE',sort_order=excluded.sort_order
    returning id into v_color_id;
  end loop;

  for v_size in select value from jsonb_array_elements(coalesce(p_payload->'sizes','[]'::jsonb))
  loop
    insert into public.raw_product_sizes(raw_product_id,name,label,sort_order,status)
    values(v_id,trim(v_size->>'name'),coalesce(nullif(v_size->>'label',''),trim(v_size->>'name')),
      coalesce((v_size->>'sortOrder')::integer,0),'ACTIVE')
    on conflict(raw_product_id,name) do update set label=excluded.label,status='ACTIVE',sort_order=excluded.sort_order
    returning id into v_size_id;
  end loop;

  insert into public.raw_product_variants(raw_product_id,color_id,size_id,sku,status)
  select v_id,c.id,s.id,
    upper(coalesce(nullif(p_payload->>'skuPrefix',''),'RAW'))||'-'||upper(substr(c.id::text,1,4))||'-'||upper(substr(s.id::text,1,4)),
    'ACTIVE'
  from public.raw_product_colors c cross join public.raw_product_sizes s
  where c.raw_product_id=v_id and c.status='ACTIVE' and s.raw_product_id=v_id and s.status='ACTIVE'
  on conflict(raw_product_id,color_id,size_id) do update set status='ACTIVE';

  insert into public.raw_product_views(raw_product_id,side,print_area_x,print_area_y,print_area_width,print_area_height)
  values(v_id,'FRONT',coalesce((p_payload#>>'{front,x}')::numeric,.3),coalesce((p_payload#>>'{front,y}')::numeric,.2),
    coalesce((p_payload#>>'{front,width}')::numeric,.4),coalesce((p_payload#>>'{front,height}')::numeric,.55))
  on conflict(raw_product_id,side) do update set print_area_x=excluded.print_area_x,print_area_y=excluded.print_area_y,
    print_area_width=excluded.print_area_width,print_area_height=excluded.print_area_height,updated_at=now();
  if coalesce((p_payload->>'hasBack')::boolean,false) then
    insert into public.raw_product_views(raw_product_id,side,print_area_x,print_area_y,print_area_width,print_area_height)
    values(v_id,'BACK',coalesce((p_payload#>>'{back,x}')::numeric,.3),coalesce((p_payload#>>'{back,y}')::numeric,.2),
      coalesce((p_payload#>>'{back,width}')::numeric,.4),coalesce((p_payload#>>'{back,height}')::numeric,.55))
    on conflict(raw_product_id,side) do update set print_area_x=excluded.print_area_x,print_area_y=excluded.print_area_y,
      print_area_width=excluded.print_area_width,print_area_height=excluded.print_area_height,updated_at=now();
  else
    delete from public.raw_product_views where raw_product_id=v_id and side='BACK'
      and not exists(select 1 from public.design_views dv where dv.raw_product_view_id=raw_product_views.id);
  end if;
  insert into public.audit_events(actor_type,actor_id,action,target_type,target_id,after_data)
    values('ADMIN',auth.uid()::text,'RAW_PRODUCT_UPSERT','RAW_PRODUCT',v_id::text,p_payload);
  return v_id;
end
$$;

create or replace function public.supplier_submit_offer(
  p_organization_id uuid,p_raw_product_id uuid,p_variant_ids uuid[],
  p_base_cost bigint,p_lead_time_days integer,p_capacity_per_day integer
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_facility uuid; v_offer uuid;
begin
  if not public.is_org_member(p_organization_id,auth.uid(),array['OWNER','MANAGER']) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select id into v_facility from public.facilities
    where organization_id=p_organization_id and status='ACTIVE' order by created_at limit 1;
  if v_facility is null then raise exception 'ACTIVE_FACILITY_REQUIRED'; end if;
  if coalesce(array_length(p_variant_ids,1),0)=0 then raise exception 'VARIANTS_REQUIRED'; end if;
  if exists(select 1 from unnest(p_variant_ids) x
    left join public.raw_product_variants v on v.id=x
    where v.id is null or v.raw_product_id<>p_raw_product_id) then raise exception 'INVALID_VARIANT'; end if;

  insert into public.supplier_offers(
    supplier_organization_id,facility_id,raw_product_id,base_cost,lead_time_days,
    capacity_per_day,approval_status,status,approved_at,approved_by
  ) values(
    p_organization_id,v_facility,p_raw_product_id,greatest(0,p_base_cost),
    greatest(1,p_lead_time_days),greatest(1,p_capacity_per_day),'APPROVED','ACTIVE',now(),auth.uid()
  )
  on conflict(supplier_organization_id,facility_id,raw_product_id) do update set
    base_cost=excluded.base_cost,lead_time_days=excluded.lead_time_days,
    capacity_per_day=excluded.capacity_per_day,approval_status='APPROVED',status='ACTIVE',
    approved_at=now(),approved_by=auth.uid(),updated_at=now()
  returning id into v_offer;
  update public.supplier_offer_variants set stock_status='PAUSED'
    where supplier_offer_id=v_offer and not(raw_product_variant_id=any(p_variant_ids));
  insert into public.supplier_offer_variants(supplier_offer_id,raw_product_variant_id,unit_cost,stock_status)
    select v_offer,id,greatest(0,p_base_cost+additional_cost),'AVAILABLE'
    from public.raw_product_variants where id=any(p_variant_ids)
  on conflict(supplier_offer_id,raw_product_variant_id) do update set unit_cost=excluded.unit_cost,stock_status='AVAILABLE',updated_at=now();
  return v_offer;
end
$$;

revoke all on function public.admin_upsert_raw_product(jsonb) from public,anon;
grant execute on function public.admin_upsert_raw_product(jsonb) to authenticated,service_role;
revoke all on function public.supplier_submit_offer(uuid,uuid,uuid[],bigint,integer,integer) from public,anon;
grant execute on function public.supplier_submit_offer(uuid,uuid,uuid[],bigint,integer,integer) to authenticated,service_role;
