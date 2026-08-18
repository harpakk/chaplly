-- Percentage markup is authoritative. Monetary price columns are maintained
-- derived caches so older reads remain compatible and fast.
alter table public.seller_product_variants
  add column if not exists markup_percentage numeric(8,4);

update public.seller_product_variants spv
set markup_percentage=greatest(10,round(((spv.price::numeric/nullif(sov.unit_cost,0))-1)*100,4))
from public.supplier_offer_variants sov
where sov.id=spv.supplier_offer_variant_id and spv.markup_percentage is null and sov.unit_cost>0;
update public.seller_product_variants set markup_percentage=30 where markup_percentage is null;
alter table public.seller_product_variants alter column markup_percentage set default 30;
alter table public.seller_product_variants alter column markup_percentage set not null;
alter table public.seller_product_variants drop constraint if exists seller_product_variants_markup_check;
alter table public.seller_product_variants add constraint seller_product_variants_markup_check
  check(markup_percentage between 10 and 10000);

create table if not exists public.seller_product_property_markups(
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  dimension text not null check(dimension in ('COLOR','SIZE')),
  color_id uuid references public.raw_product_colors(id) on delete restrict,
  size_id uuid references public.raw_product_sizes(id) on delete restrict,
  markup_percentage numeric(8,4) not null check(markup_percentage between 10 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((dimension='COLOR' and color_id is not null and size_id is null) or (dimension='SIZE' and size_id is not null and color_id is null))
);
create unique index if not exists seller_product_color_markup_unique on public.seller_product_property_markups(seller_product_id,color_id) where dimension='COLOR';
create unique index if not exists seller_product_size_markup_unique on public.seller_product_property_markups(seller_product_id,size_id) where dimension='SIZE';
create index if not exists seller_product_property_markups_product_idx on public.seller_product_property_markups(seller_product_id);
drop trigger if exists seller_product_property_markups_touch on public.seller_product_property_markups;
create trigger seller_product_property_markups_touch before update on public.seller_product_property_markups for each row execute function public.touch_updated_at();

-- Preserve every existing variant's effective price. Property rows are an
-- editable UI decomposition; variant markup remains the checkout authority.
insert into public.seller_product_property_markups(seller_product_id,dimension,color_id,markup_percentage)
select spv.seller_product_id,'COLOR',rpv.color_id,min(spv.markup_percentage)
from public.seller_product_variants spv join public.raw_product_variants rpv on rpv.id=spv.raw_product_variant_id
group by spv.seller_product_id,rpv.color_id on conflict do nothing;
insert into public.seller_product_property_markups(seller_product_id,dimension,size_id,markup_percentage)
select spv.seller_product_id,'SIZE',rpv.size_id,min(spv.markup_percentage)
from public.seller_product_variants spv join public.raw_product_variants rpv on rpv.id=spv.raw_product_variant_id
group by spv.seller_product_id,rpv.size_id on conflict do nothing;

create or replace function public.derive_seller_variant_price()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_cost bigint;
begin
  if new.supplier_offer_variant_id is not null then
    select unit_cost into v_cost from public.supplier_offer_variants where id=new.supplier_offer_variant_id;
    if v_cost is not null then new.price:=ceil(v_cost::numeric*(1+new.markup_percentage/100))::bigint; end if;
  end if;
  new.updated_at:=now();
  return new;
end $$;
drop trigger if exists seller_variant_derive_price on public.seller_product_variants;
create trigger seller_variant_derive_price before insert or update of markup_percentage,supplier_offer_variant_id,price
on public.seller_product_variants for each row execute function public.derive_seller_variant_price();

create or replace function public.refresh_seller_product_min_price()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_product uuid;
begin
  v_product:=case when tg_op='DELETE' then old.seller_product_id else new.seller_product_id end;
  update public.seller_products p set price=coalesce((select min(v.price) from public.seller_product_variants v where v.seller_product_id=v_product),p.price),discounted_price=null,updated_at=now() where p.id=v_product;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists seller_variant_refresh_product_price on public.seller_product_variants;
create trigger seller_variant_refresh_product_price after insert or update or delete
on public.seller_product_variants for each row execute function public.refresh_seller_product_min_price();

create or replace function public.refresh_prices_after_supplier_cost()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.unit_cost is distinct from old.unit_cost then
    update public.seller_product_variants set markup_percentage=markup_percentage where supplier_offer_variant_id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists supplier_cost_refresh_seller_prices on public.supplier_offer_variants;
create trigger supplier_cost_refresh_seller_prices after update of unit_cost on public.supplier_offer_variants
for each row execute function public.refresh_prices_after_supplier_cost();

-- Recalculate all caches once under the new invariant.
update public.seller_product_variants set markup_percentage=markup_percentage;

alter table public.seller_product_property_markups enable row level security;
drop policy if exists seller_product_property_markups_owner on public.seller_product_property_markups;
create policy seller_product_property_markups_owner on public.seller_product_property_markups for all to authenticated
using(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id)))
with check(exists(select 1 from public.seller_products p where p.id=seller_product_id and public.can_manage_store(p.store_id)));

drop function if exists public.service_save_product_metadata(uuid,uuid[],jsonb);
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
    or exists(select 1 from jsonb_to_recordset(coalesce(p_variant_markups,'[]'::jsonb)) as v("rawProductVariantId" uuid,"markupPercentage" numeric) where v."markupPercentage" not between 10 and 10000)
    or exists(select 1 from public.seller_product_variants spv where spv.seller_product_id=p_product_id and not exists(select 1 from jsonb_to_recordset(coalesce(p_variant_markups,'[]'::jsonb)) as v("rawProductVariantId" uuid,"markupPercentage" numeric) where v."rawProductVariantId"=spv.raw_product_variant_id)) then
    raise exception 'VARIANT_MARKUPS_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_property_markups,'[]'::jsonb))<>'array'
    or exists(select 1 from jsonb_to_recordset(coalesce(p_property_markups,'[]'::jsonb)) as m(dimension text,"propertyId" uuid,"markupPercentage" numeric) where m.dimension not in ('COLOR','SIZE') or m."markupPercentage" not between 10 and 10000) then
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
end $$;
revoke all on function public.service_save_product_metadata(uuid,uuid[],jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.service_save_product_metadata(uuid,uuid[],jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
