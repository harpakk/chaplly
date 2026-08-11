-- Repair legacy seed relationships and enforce catalog/supply invariants.

insert into public.design_variants(design_id,raw_product_variant_id)
select distinct sp.design_id,spv.raw_product_variant_id
from public.seller_product_variants spv
join public.seller_products sp on sp.id=spv.seller_product_id
where sp.design_id is not null
on conflict(design_id,raw_product_variant_id) do nothing;

insert into public.supplier_assignment_events(
  fulfilment_id,to_supplier_organization_id,to_supplier_offer_id,
  reason,idempotency_key,snapshot,created_at
)
select
  f.id,f.supplier_organization_id,f.supplier_offer_id,
  'HISTORY_BACKFILL','assignment-backfill:'||f.id::text,
  f.assignment_snapshot,f.created_at
from public.fulfilments f
on conflict(idempotency_key) do nothing;

create or replace function public.validate_seller_product_variant_relation()
returns trigger language plpgsql set search_path=public as $$
declare v_design uuid; v_raw uuid;
begin
  select design_id,raw_product_id into v_design,v_raw
  from public.seller_products where id=new.seller_product_id;
  if v_design is null then raise exception 'SELLER_PRODUCT_DESIGN_REQUIRED'; end if;
  if not exists(
    select 1 from public.raw_product_variants
    where id=new.raw_product_variant_id and raw_product_id=v_raw
  ) then raise exception 'PRODUCT_VARIANT_RAW_PRODUCT_MISMATCH'; end if;
  if not exists(
    select 1 from public.design_variants
    where design_id=v_design and raw_product_variant_id=new.raw_product_variant_id
  ) then raise exception 'PRODUCT_VARIANT_NOT_SELECTED_IN_DESIGN'; end if;
  if new.status='ACTIVE' and new.supplier_offer_variant_id is null then
    raise exception 'ACTIVE_VARIANT_REQUIRES_SUPPLIER';
  end if;
  return new;
end
$$;

drop trigger if exists trg_seller_product_variant_relation
  on public.seller_product_variants;
create trigger trg_seller_product_variant_relation
before insert or update of seller_product_id,raw_product_variant_id,
  supplier_offer_variant_id,status
on public.seller_product_variants
for each row execute function public.validate_seller_product_variant_relation();

create or replace function public.validate_supplier_offer_variant_relation()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(
    select 1
    from public.supplier_offers so
    join public.raw_product_variants rv
      on rv.raw_product_id=so.raw_product_id
    where so.id=new.supplier_offer_id
      and rv.id=new.raw_product_variant_id
  ) then raise exception 'SUPPLIER_VARIANT_RAW_PRODUCT_MISMATCH'; end if;
  return new;
end
$$;

drop trigger if exists trg_supplier_offer_variant_relation
  on public.supplier_offer_variants;
create trigger trg_supplier_offer_variant_relation
before insert or update of supplier_offer_id,raw_product_variant_id
on public.supplier_offer_variants
for each row execute function public.validate_supplier_offer_variant_relation();

create or replace function public.record_supplier_availability_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.stock_status is distinct from new.stock_status then
    insert into public.supplier_variant_availability_events(
      supplier_offer_variant_id,from_status,to_status,changed_by,snapshot
    ) values(
      new.id,old.stock_status,new.stock_status,auth.uid(),
      jsonb_build_object('unitCost',new.unit_cost,'changedAt',now())
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_supplier_offer_variant_availability
  on public.supplier_offer_variants;
create trigger trg_supplier_offer_variant_availability
after update of stock_status on public.supplier_offer_variants
for each row execute function public.record_supplier_availability_change();
