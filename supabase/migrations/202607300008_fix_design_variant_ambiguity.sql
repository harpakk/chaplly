create or replace function public.save_design_draft(
  p_design_id uuid,p_store_id uuid,p_raw_product_id uuid,p_name text,
  p_views jsonb,p_variant_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid:=coalesce(p_design_id,gen_random_uuid()); v_view jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.stores store where store.id=p_store_id and store.owner_user_id=auth.uid()) then
    raise exception 'STORE_NOT_OWNED' using errcode='42501';
  end if;
  if p_design_id is not null and not exists(select 1 from public.designs design where design.id=p_design_id and design.owner_user_id=auth.uid()) then
    raise exception 'DESIGN_NOT_OWNED' using errcode='42501';
  end if;
  if jsonb_typeof(p_views)<>'array' then raise exception 'VIEWS_MUST_BE_ARRAY'; end if;
  if exists(
    select 1
    from unnest(p_variant_ids) as selected(variant_id)
    left join public.raw_product_variants variant on variant.id=selected.variant_id
    where variant.id is null or variant.raw_product_id<>p_raw_product_id
  ) then raise exception 'INVALID_VARIANT'; end if;

  insert into public.designs(id,store_id,raw_product_id,owner_user_id,name,status,schema_version,version)
  values(v_id,p_store_id,p_raw_product_id,auth.uid(),coalesce(nullif(trim(p_name),''),'طرح بدون نام'),'DRAFT',1,1)
  on conflict(id) do update set name=excluded.name,version=designs.version+1,updated_at=now();
  for v_view in select value from jsonb_array_elements(p_views)
  loop
    if not exists(select 1 from public.raw_product_views raw_view
      where raw_view.id=(v_view->>'rawProductViewId')::uuid and raw_view.raw_product_id=p_raw_product_id) then
      raise exception 'INVALID_PRODUCT_VIEW';
    end if;
    insert into public.design_views(design_id,raw_product_view_id,canvas_document,validation_state,validation_messages)
    values(v_id,(v_view->>'rawProductViewId')::uuid,coalesce(v_view->'canvas','{"version":1,"objects":[]}'::jsonb),'VALID','[]'::jsonb)
    on conflict(design_id,raw_product_view_id) do update set
      canvas_document=excluded.canvas_document,validation_state='VALID',validation_messages='[]'::jsonb,updated_at=now();
  end loop;
  delete from public.design_variants variant_link
    where variant_link.design_id=v_id and not(variant_link.raw_product_variant_id=any(p_variant_ids));
  insert into public.design_variants(design_id,raw_product_variant_id)
    select v_id,variant.id from public.raw_product_variants variant where variant.id=any(p_variant_ids)
  on conflict do nothing;
  return v_id;
end
$$;

revoke all on function public.save_design_draft(uuid,uuid,uuid,text,jsonb,uuid[]) from public,anon;
grant execute on function public.save_design_draft(uuid,uuid,uuid,text,jsonb,uuid[]) to authenticated,service_role;
