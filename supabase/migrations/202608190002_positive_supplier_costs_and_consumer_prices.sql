-- Supplier costs are mandatory monetary inputs. Repair legacy zero values before
-- strengthening the constraint so existing offers remain editable.
update public.supplier_offer_variants sov
set unit_cost=greatest(
  1,
  coalesce(
    nullif(sov.unit_cost,0),
    nullif(so.base_cost,0),
    nullif(rp.base_cost+greatest(0,rpv.additional_cost),0),
    1
  )
)
from public.supplier_offers so
join public.raw_products rp on rp.id=so.raw_product_id
join public.raw_product_variants rpv on rpv.raw_product_id=rp.id
where so.id=sov.supplier_offer_id and rpv.id=sov.raw_product_variant_id and sov.unit_cost<=0;

update public.supplier_offers so
set base_cost=greatest(
  1,
  coalesce(
    (select min(sov.unit_cost) from public.supplier_offer_variants sov where sov.supplier_offer_id=so.id and sov.unit_cost>0),
    nullif(so.base_cost,0),
    nullif(rp.base_cost,0),
    1
  )
)
from public.raw_products rp
where rp.id=so.raw_product_id and so.base_cost<=0;

alter table public.supplier_offer_variants drop constraint if exists supplier_offer_variants_unit_cost_check;
alter table public.supplier_offer_variants add constraint supplier_offer_variants_unit_cost_check check(unit_cost>0);
alter table public.supplier_offers drop constraint if exists supplier_offers_cost_check;
alter table public.supplier_offers add constraint supplier_offers_cost_check check(base_cost>0);

-- Zero profit is allowed, negative profit is not. Prices remain derived from
-- the authoritative percentage so supplier cost changes still propagate.
alter table public.seller_product_variants drop constraint if exists seller_product_variants_markup_check;
alter table public.seller_product_variants add constraint seller_product_variants_markup_check check(markup_percentage between 0 and 10000);
alter table public.seller_product_property_markups drop constraint if exists seller_product_property_markups_markup_percentage_check;
alter table public.seller_product_property_markups add constraint seller_product_property_markups_markup_percentage_check check(markup_percentage between 0 and 10000);

create or replace function public.supplier_submit_inventory(
  p_organization_id uuid,p_raw_product_id uuid,p_variants jsonb,
  p_base_cost bigint,p_lead_time_days integer,p_capacity_per_day integer
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_facility uuid; v_offer uuid; v_item jsonb; v_variant uuid;
  v_quantity integer; v_unit_cost bigint; v_base_cost bigint;
begin
  if not public.is_org_member(p_organization_id,auth.uid(),array['OWNER','MANAGER']) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants)=0 then
    raise exception 'VARIANTS_REQUIRED';
  end if;
  if exists(
    select 1 from jsonb_to_recordset(p_variants) as item("variantId" uuid,quantity integer,"unitCost" bigint)
    where item."variantId" is null or coalesce(item."unitCost",0)<=0 or coalesce(item.quantity,0)<0
  ) then raise exception 'VARIANT_COST_REQUIRED'; end if;
  select min(item."unitCost") into v_base_cost
  from jsonb_to_recordset(p_variants) as item("variantId" uuid,quantity integer,"unitCost" bigint);
  if coalesce(v_base_cost,0)<=0 then raise exception 'VARIANT_COST_REQUIRED'; end if;

  select id into v_facility from public.facilities
    where organization_id=p_organization_id and status='ACTIVE' order by created_at limit 1;
  if v_facility is null then raise exception 'ACTIVE_FACILITY_REQUIRED'; end if;

  insert into public.supplier_offers(
    supplier_organization_id,facility_id,raw_product_id,base_cost,lead_time_days,
    capacity_per_day,approval_status,status,approved_at,approved_by
  ) values(
    p_organization_id,v_facility,p_raw_product_id,v_base_cost,
    greatest(1,p_lead_time_days),greatest(1,p_capacity_per_day),
    'PENDING','PAUSED',null,null
  )
  on conflict(supplier_organization_id,facility_id,raw_product_id) do update set
    base_cost=excluded.base_cost,lead_time_days=excluded.lead_time_days,
    capacity_per_day=excluded.capacity_per_day,approval_status='PENDING',status='PAUSED',
    approved_at=null,approved_by=null,updated_at=now()
  returning id into v_offer;

  update public.supplier_offer_variants set stock_quantity=0,stock_status='PAUSED'
  where supplier_offer_id=v_offer;

  for v_item in select value from jsonb_array_elements(p_variants) loop
    v_variant:=nullif(v_item->>'variantId','')::uuid;
    v_quantity:=greatest(0,coalesce((v_item->>'quantity')::integer,0));
    v_unit_cost:=coalesce((v_item->>'unitCost')::bigint,0);
    if v_unit_cost<=0 then raise exception 'VARIANT_COST_REQUIRED'; end if;
    if not exists(select 1 from public.raw_product_variants
      where id=v_variant and raw_product_id=p_raw_product_id and status='ACTIVE') then
      raise exception 'INVALID_VARIANT';
    end if;
    insert into public.supplier_offer_variants(
      supplier_offer_id,raw_product_variant_id,unit_cost,stock_quantity,stock_status
    ) values(v_offer,v_variant,v_unit_cost,v_quantity,'PAUSED')
    on conflict(supplier_offer_id,raw_product_variant_id) do update set
      unit_cost=excluded.unit_cost,stock_quantity=excluded.stock_quantity,
      stock_status='PAUSED',updated_at=now();
  end loop;
  return v_offer;
end
$$;

revoke all on function public.supplier_submit_inventory(uuid,uuid,jsonb,bigint,integer,integer) from public,anon;
grant execute on function public.supplier_submit_inventory(uuid,uuid,jsonb,bigint,integer,integer) to authenticated,service_role;

create or replace function public.service_save_product_metadata(
  p_product_id uuid,
  p_graphic_style_ids uuid[],
  p_variant_markups jsonb,
  p_property_markups jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare v_expected integer;
begin
  select count(*) into v_expected from public.seller_product_variants where seller_product_id=p_product_id;
  if jsonb_typeof(coalesce(p_variant_markups,'[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(p_variant_markups,'[]'::jsonb))<>v_expected
    or exists(select 1 from jsonb_to_recordset(coalesce(p_variant_markups,'[]'::jsonb)) as v("rawProductVariantId" uuid,"markupPercentage" numeric) where v."markupPercentage" not between 0 and 10000)
    or exists(select 1 from public.seller_product_variants spv where spv.seller_product_id=p_product_id and not exists(select 1 from jsonb_to_recordset(coalesce(p_variant_markups,'[]'::jsonb)) as v("rawProductVariantId" uuid,"markupPercentage" numeric) where v."rawProductVariantId"=spv.raw_product_variant_id)) then
    raise exception 'VARIANT_MARKUPS_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_property_markups,'[]'::jsonb))<>'array'
    or exists(select 1 from jsonb_to_recordset(coalesce(p_property_markups,'[]'::jsonb)) as m(dimension text,"propertyId" uuid,"markupPercentage" numeric) where m.dimension not in ('COLOR','SIZE') or m."markupPercentage" not between 0 and 10000) then
    raise exception 'PROPERTY_MARKUPS_INVALID';
  end if;

  delete from public.product_graphic_styles where seller_product_id=p_product_id;
  insert into public.product_graphic_styles(seller_product_id,graphic_style_id)
  select p_product_id,gs.id from public.graphic_styles gs where gs.id=any(coalesce(p_graphic_style_ids,'{}'::uuid[])) and gs.status='ACTIVE' on conflict do nothing;

  delete from public.seller_product_property_markups where seller_product_id=p_product_id;
  insert into public.seller_product_property_markups(seller_product_id,dimension,color_id,size_id,markup_percentage)
  select p_product_id,m.dimension,case when m.dimension='COLOR' then m."propertyId" end,case when m.dimension='SIZE' then m."propertyId" end,m."markupPercentage"
  from jsonb_to_recordset(coalesce(p_property_markups,'[]'::jsonb)) as m(dimension text,"propertyId" uuid,"markupPercentage" numeric)
  where exists(select 1 from public.seller_product_variants spv join public.raw_product_variants rpv on rpv.id=spv.raw_product_variant_id where spv.seller_product_id=p_product_id and ((m.dimension='COLOR' and rpv.color_id=m."propertyId") or (m.dimension='SIZE' and rpv.size_id=m."propertyId")));

  update public.seller_product_variants spv set markup_percentage=v."markupPercentage"
  from jsonb_to_recordset(coalesce(p_variant_markups,'[]'::jsonb)) as v("rawProductVariantId" uuid,"markupPercentage" numeric)
  where spv.seller_product_id=p_product_id and spv.raw_product_variant_id=v."rawProductVariantId";
end
$$;

revoke all on function public.service_save_product_metadata(uuid,uuid[],jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.service_save_product_metadata(uuid,uuid[],jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
