create or replace function public.service_append_product_images(
  p_product_id uuid,
  p_actor_id uuid,
  p_images jsonb
) returns integer
language plpgsql security definer set search_path=public as $$
declare
  v_image jsonb;
  v_file_id uuid;
  v_sort_offset integer;
  v_count integer := 0;
begin
  if not exists(
    select 1
    from public.seller_products product
    join public.designs design on design.id=product.design_id
    where product.id=p_product_id and design.owner_user_id=p_actor_id
  ) then
    raise exception 'PRODUCT_NOT_OWNED' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_images,'[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_PRODUCT_IMAGES';
  end if;
  if jsonb_array_length(coalesce(p_images,'[]'::jsonb)) = 0 then return 0; end if;

  select coalesce(max(sort_order),-1)+1 into v_sort_offset
  from public.product_images where seller_product_id=p_product_id;

  if exists(
    select 1 from jsonb_array_elements(p_images) as images(value)
    where coalesce((value->>'isPrimary')::boolean,false)
  ) then
    update public.product_images set is_primary=false
    where seller_product_id=p_product_id and is_primary;
  end if;

  for v_image in select value from jsonb_array_elements(p_images)
  loop
    v_file_id := nullif(v_image->>'fileId','')::uuid;
    if v_file_id is null or not exists(
      select 1 from public.storage_files
      where id=v_file_id and owner_user_id=p_actor_id and state='READY'
    ) then
      raise exception 'PRODUCT_IMAGE_FILE_NOT_OWNED' using errcode='42501';
    end if;
    insert into public.product_images(
      seller_product_id,file_id,alt_text,sort_order,is_primary
    ) values(
      p_product_id,
      v_file_id,
      coalesce(nullif(trim(v_image->>'altText'),''),'تصویر محصول'),
      v_sort_offset+coalesce((v_image->>'sortOrder')::integer,v_count),
      coalesce((v_image->>'isPrimary')::boolean,false)
    );
    v_count := v_count+1;
  end loop;
  return v_count;
end
$$;

revoke all on function public.service_append_product_images(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.service_append_product_images(uuid,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
