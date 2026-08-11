-- Variant-level supplier inventory, moderation, atomic checkout deduction,
-- cancellation release and a safe fulfilment preparation workflow.

alter table public.fulfilments
  add column if not exists inventory_released_at timestamptz;

alter table public.supplier_offer_variants
  alter column stock_quantity set default 0;

update public.supplier_offer_variants
set stock_quantity=0,stock_status='OUT_OF_STOCK'
where stock_quantity is null;

alter table public.supplier_offer_variants
  alter column stock_quantity set not null;

create or replace function public.sync_offer_variant_stock_state()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_approved boolean;
begin
  select so.approval_status='APPROVED' and so.status='ACTIVE'
    into v_approved from public.supplier_offers so where so.id=new.supplier_offer_id;
  new.stock_status:=case
    when not coalesce(v_approved,false) then 'PAUSED'
    when new.stock_quantity<=0 then 'OUT_OF_STOCK'
    when new.stock_quantity<=5 then 'LOW_STOCK'
    else 'AVAILABLE'
  end;
  new.updated_at:=now();
  return new;
end
$$;

drop trigger if exists supplier_offer_variant_sync_stock on public.supplier_offer_variants;
create trigger supplier_offer_variant_sync_stock
before insert or update of stock_quantity,supplier_offer_id
on public.supplier_offer_variants for each row
execute function public.sync_offer_variant_stock_state();

create or replace function public.refresh_seller_variant_availability(p_offer_variant_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.seller_product_variants spv
  set status=case
      when sov.stock_quantity>0 and sov.stock_status in ('AVAILABLE','LOW_STOCK')
        and so.status='ACTIVE' and so.approval_status='APPROVED' then 'ACTIVE'
      else 'OUT_OF_STOCK'
    end,
    updated_at=now()
  from public.supplier_offer_variants sov
  join public.supplier_offers so on so.id=sov.supplier_offer_id
  where sov.id=p_offer_variant_id and spv.supplier_offer_variant_id=sov.id;
end
$$;

create or replace function public.after_offer_variant_stock_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_seller_variant_availability(new.id);
  return new;
end $$;

drop trigger if exists supplier_offer_variant_refresh_seller on public.supplier_offer_variants;
create trigger supplier_offer_variant_refresh_seller
after insert or update of stock_quantity,stock_status
on public.supplier_offer_variants for each row
execute function public.after_offer_variant_stock_change();

create or replace function public.supplier_submit_inventory(
  p_organization_id uuid,p_raw_product_id uuid,p_variants jsonb,
  p_base_cost bigint,p_lead_time_days integer,p_capacity_per_day integer
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_facility uuid; v_offer uuid; v_item jsonb; v_variant uuid; v_quantity integer;
begin
  if not public.is_org_member(p_organization_id,auth.uid(),array['OWNER','MANAGER']) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants)=0 then
    raise exception 'VARIANTS_REQUIRED';
  end if;
  select id into v_facility from public.facilities
    where organization_id=p_organization_id and status='ACTIVE' order by created_at limit 1;
  if v_facility is null then raise exception 'ACTIVE_FACILITY_REQUIRED'; end if;

  insert into public.supplier_offers(
    supplier_organization_id,facility_id,raw_product_id,base_cost,lead_time_days,
    capacity_per_day,approval_status,status,approved_at,approved_by
  ) values(
    p_organization_id,v_facility,p_raw_product_id,greatest(0,p_base_cost),
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
    if not exists(select 1 from public.raw_product_variants
      where id=v_variant and raw_product_id=p_raw_product_id and status='ACTIVE') then
      raise exception 'INVALID_VARIANT';
    end if;
    insert into public.supplier_offer_variants(
      supplier_offer_id,raw_product_variant_id,unit_cost,stock_quantity,stock_status
    ) select v_offer,rpv.id,greatest(0,p_base_cost+rpv.additional_cost),v_quantity,'PAUSED'
      from public.raw_product_variants rpv where rpv.id=v_variant
    on conflict(supplier_offer_id,raw_product_variant_id) do update set
      unit_cost=excluded.unit_cost,stock_quantity=excluded.stock_quantity,
      stock_status='PAUSED',updated_at=now();
  end loop;
  return v_offer;
end
$$;

create or replace function public.admin_review_supplier_offer(
  p_offer_id uuid,p_decision text,p_note text default null
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'INVALID_DECISION'; end if;
  v_status:=case when p_decision='APPROVED' then 'ACTIVE' else 'PAUSED' end;
  update public.supplier_offers set approval_status=p_decision,status=v_status,
    approved_at=case when p_decision='APPROVED' then now() else null end,
    approved_by=case when p_decision='APPROVED' then auth.uid() else null end,
    notes=nullif(trim(p_note),''),updated_at=now()
  where id=p_offer_id returning id into p_offer_id;
  if p_offer_id is null then raise exception 'OFFER_NOT_FOUND'; end if;
  update public.supplier_offer_variants set stock_status=case
    when p_decision='REJECTED' then 'PAUSED'
    when stock_quantity<=0 then 'OUT_OF_STOCK'
    when stock_quantity<=5 then 'LOW_STOCK'
    else 'AVAILABLE' end,updated_at=now()
  where supplier_offer_id=p_offer_id;
  return p_offer_id;
end
$$;

create or replace function public.deduct_supplier_inventory_for_order_item()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_remaining integer;
begin
  if new.supplier_offer_variant_id is null then raise exception 'SUPPLIER_VARIANT_REQUIRED'; end if;
  update public.supplier_offer_variants sov set stock_quantity=sov.stock_quantity-new.quantity
  from public.supplier_offers so
  where sov.id=new.supplier_offer_variant_id and so.id=sov.supplier_offer_id
    and so.status='ACTIVE' and so.approval_status='APPROVED'
    and sov.stock_status in ('AVAILABLE','LOW_STOCK') and sov.stock_quantity>=new.quantity
  returning sov.stock_quantity into v_remaining;
  if not found then raise exception 'INSUFFICIENT_SUPPLIER_INVENTORY'; end if;
  return new;
end
$$;

drop trigger if exists order_item_deduct_supplier_inventory on public.order_items;
create trigger order_item_deduct_supplier_inventory
before insert on public.order_items for each row
execute function public.deduct_supplier_inventory_for_order_item();

create or replace function public.release_cancelled_fulfilment_inventory()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_item record;
begin
  if new.status='CANCELLED' and old.status is distinct from 'CANCELLED'
     and new.inventory_released_at is null then
    for v_item in select oi.supplier_offer_variant_id,fi.quantity
      from public.fulfilment_items fi join public.order_items oi on oi.id=fi.order_item_id
      where fi.fulfilment_id=new.id and oi.supplier_offer_variant_id is not null
    loop
      update public.supplier_offer_variants
        set stock_quantity=stock_quantity+v_item.quantity
        where id=v_item.supplier_offer_variant_id;
    end loop;
    new.inventory_released_at:=now();
  end if;
  return new;
end
$$;

drop trigger if exists fulfilment_release_inventory on public.fulfilments;
create trigger fulfilment_release_inventory
before update of status on public.fulfilments for each row
execute function public.release_cancelled_fulfilment_inventory();

create or replace function public.prepare_fulfilment_for_shipping(p_fulfilment_id uuid)
returns public.fulfilment_status
language plpgsql security definer set search_path=public
as $$
declare v_status public.fulfilment_status;
begin
  select status into v_status from public.fulfilments where id=p_fulfilment_id for update;
  if not found then raise exception 'FULFILMENT_NOT_FOUND'; end if;
  if v_status='ASSIGNED' then
    perform public.transition_fulfilment(p_fulfilment_id,'IN_PRODUCTION',null,p_fulfilment_id||':IN_PRODUCTION');
    v_status:='IN_PRODUCTION';
  end if;
  if v_status='IN_PRODUCTION' then
    perform public.transition_fulfilment(p_fulfilment_id,'QUALITY_CHECK',null,p_fulfilment_id||':QUALITY_CHECK');
    v_status:='QUALITY_CHECK';
  end if;
  if v_status='QUALITY_CHECK' then
    perform public.transition_fulfilment(p_fulfilment_id,'READY_TO_SEND',null,p_fulfilment_id||':READY_TO_SEND');
    v_status:='READY_TO_SEND';
  end if;
  return v_status;
end
$$;

revoke all on function public.supplier_submit_inventory(uuid,uuid,jsonb,bigint,integer,integer) from public,anon;
grant execute on function public.supplier_submit_inventory(uuid,uuid,jsonb,bigint,integer,integer) to authenticated,service_role;
revoke all on function public.admin_review_supplier_offer(uuid,text,text) from public,anon;
grant execute on function public.admin_review_supplier_offer(uuid,text,text) to authenticated,service_role;
revoke all on function public.prepare_fulfilment_for_shipping(uuid) from public,anon;
grant execute on function public.prepare_fulfilment_for_shipping(uuid) to authenticated,service_role;
