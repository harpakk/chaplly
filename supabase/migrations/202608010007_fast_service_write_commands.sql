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

create or replace function public.service_refresh_product_review_stats(
  p_product_id uuid
)
returns void
language sql
security definer
set search_path=public
as $$
  update public.seller_products p set
    rating_average=coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.seller_product_id=p.id and r.status='PUBLISHED'),0),
    review_count=(select count(*) from public.reviews r where r.seller_product_id=p.id and r.status='PUBLISHED')
  where p.id=p_product_id
$$;

revoke all on function public.service_save_product_metadata(uuid,uuid[],jsonb) from public,anon,authenticated;
revoke all on function public.service_refresh_product_review_stats(uuid) from public,anon,authenticated;
grant execute on function public.service_save_product_metadata(uuid,uuid[],jsonb) to service_role;
grant execute on function public.service_refresh_product_review_stats(uuid) to service_role;

create or replace function public.service_upsert_raw_product(
  p_payload jsonb,
  p_actor_id uuid,
  p_color_names text[],
  p_size_names text[],
  p_variant_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',p_actor_id,'role','authenticated','aal','aal1')::text,
    true
  );
  v_id:=public.admin_upsert_raw_product(p_payload);

  with colors as (
    update public.raw_product_colors
    set status=case when name=any(p_color_names) then 'ACTIVE' else 'INACTIVE' end
    where raw_product_id=v_id returning id,status
  ), sizes as (
    update public.raw_product_sizes
    set status=case when name=any(p_size_names) then 'ACTIVE' else 'INACTIVE' end
    where raw_product_id=v_id returning id,status
  )
  update public.raw_product_variants variant
  set status=case
    when color.status='ACTIVE' and size.status='ACTIVE'
      and (p_variant_keys is null or (color.name||'::'||size.name)=any(p_variant_keys)) then 'ACTIVE'
    else 'INACTIVE'
  end
  from public.raw_product_colors color,public.raw_product_sizes size
  where variant.raw_product_id=v_id
    and color.id=variant.color_id and size.id=variant.size_id;
  return v_id;
end
$$;

revoke all on function public.service_upsert_raw_product(jsonb,uuid,text[],text[],text[]) from public,anon,authenticated;
grant execute on function public.service_upsert_raw_product(jsonb,uuid,text[],text[],text[]) to service_role;

create or replace function public.service_save_raw_product_media(
  p_raw_product_id uuid,
  p_main_file_id uuid,
  p_main_alt_text text,
  p_front_background_id uuid,
  p_front_overlay_id uuid,
  p_front_mockup_id uuid,
  p_back_background_id uuid,
  p_back_overlay_id uuid,
  p_back_mockup_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_main_file_id is not null then
    update public.raw_product_media set is_primary=false
    where raw_product_id=p_raw_product_id and is_primary;
    insert into public.raw_product_media(raw_product_id,file_id,alt_text,sort_order,is_primary)
    values(p_raw_product_id,p_main_file_id,p_main_alt_text,0,true)
    on conflict(raw_product_id,file_id) do update set
      alt_text=excluded.alt_text,sort_order=0,is_primary=true;
  end if;

  update public.raw_product_views set
    background_file_id=coalesce(p_front_background_id,background_file_id),
    overlay_file_id=coalesce(p_front_overlay_id,overlay_file_id),
    mockup_file_id=coalesce(p_front_mockup_id,mockup_file_id),updated_at=now()
  where raw_product_id=p_raw_product_id and side='FRONT';
  update public.raw_product_views set
    background_file_id=coalesce(p_back_background_id,background_file_id),
    overlay_file_id=coalesce(p_back_overlay_id,overlay_file_id),
    mockup_file_id=coalesce(p_back_mockup_id,mockup_file_id),updated_at=now()
  where raw_product_id=p_raw_product_id and side='BACK';

  insert into public.raw_product_variant_assets(
    raw_product_variant_id,raw_product_view_id,background_file_id,overlay_file_id,mockup_file_id
  )
  select variant.id,view.id,
    coalesce(case when view.side='FRONT' then p_front_background_id else p_back_background_id end,current.background_file_id),
    coalesce(case when view.side='FRONT' then p_front_overlay_id else p_back_overlay_id end,current.overlay_file_id),
    coalesce(case when view.side='FRONT' then p_front_mockup_id else p_back_mockup_id end,current.mockup_file_id)
  from public.raw_product_variants variant
  join public.raw_product_views view on view.raw_product_id=variant.raw_product_id
  left join public.raw_product_variant_assets current
    on current.raw_product_variant_id=variant.id and current.raw_product_view_id=view.id
  where variant.raw_product_id=p_raw_product_id
    and (
      (view.side='FRONT' and (p_front_background_id is not null or p_front_overlay_id is not null or p_front_mockup_id is not null))
      or (view.side='BACK' and (p_back_background_id is not null or p_back_overlay_id is not null or p_back_mockup_id is not null))
    )
    and coalesce(case when view.side='FRONT' then p_front_background_id else p_back_background_id end,current.background_file_id) is not null
  on conflict(raw_product_variant_id,raw_product_view_id) do update set
    background_file_id=excluded.background_file_id,
    overlay_file_id=excluded.overlay_file_id,
    mockup_file_id=excluded.mockup_file_id,
    updated_at=now();
end
$$;

revoke all on function public.service_save_raw_product_media(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_save_raw_product_media(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
