create or replace function public.service_save_product_metadata(
  p_product_id uuid,
  p_graphic_style_ids uuid[],
  p_variant_prices jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_variant_prices,'[]'::jsonb))
      as v("rawProductVariantId" uuid,price numeric)
    join public.seller_product_variants spv
      on spv.seller_product_id=p_product_id
     and spv.raw_product_variant_id=v."rawProductVariantId"
    join public.supplier_offer_variants sov
      on sov.id=spv.supplier_offer_variant_id
    where v.price < ceil(sov.unit_cost * 1.10)
  ) then
    raise exception 'MINIMUM_VARIANT_MARGIN_REQUIRED';
  end if;

  delete from public.product_graphic_styles where seller_product_id=p_product_id;
  insert into public.product_graphic_styles(seller_product_id,graphic_style_id)
  select p_product_id,gs.id
  from public.graphic_styles gs
  where gs.id=any(coalesce(p_graphic_style_ids,'{}'::uuid[])) and gs.status='ACTIVE'
  on conflict do nothing;

  update public.seller_product_variants spv
  set price=round(v.price)::bigint,updated_at=now()
  from jsonb_to_recordset(coalesce(p_variant_prices,'[]'::jsonb))
    as v("rawProductVariantId" uuid,price numeric)
  where spv.seller_product_id=p_product_id
    and spv.raw_product_variant_id=v."rawProductVariantId"
    and v.price>0;
end
$$;

revoke all on function public.service_save_product_metadata(uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.service_save_product_metadata(uuid,uuid[],jsonb) to service_role;
