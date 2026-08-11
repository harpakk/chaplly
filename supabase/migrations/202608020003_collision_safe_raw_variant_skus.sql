-- Seeded UUIDs can share their first four characters. The previous SKU
-- formula used only those prefixes, so expanding a variant matrix during an
-- edit could violate the global raw_product_variants.sku unique constraint.
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
    upper(coalesce(nullif(p_payload->>'skuPrefix',''),'RAW'))||'-'||
      upper(replace(c.id::text,'-',''))||'-'||upper(replace(s.id::text,'-','')),
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
