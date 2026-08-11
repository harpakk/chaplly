-- Sellers may design and create products before a supplier offer exists.
-- Such variants remain OUT_OF_STOCK until a supplier is assigned.
alter table public.seller_product_variants
  alter column supplier_offer_variant_id drop not null;

create or replace function public.save_seller_product(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store uuid:=(p_payload->>'storeId')::uuid;
  v_design uuid:=(p_payload->>'designId')::uuid;
  v_raw uuid:=(p_payload->>'rawProductId')::uuid;
  v_product uuid:=coalesce(nullif(p_payload->>'productId','')::uuid,gen_random_uuid());
  v_primary uuid:=nullif(p_payload->>'primarySupplierOfferId','')::uuid;
  v_backup uuid:=nullif(p_payload->>'backupSupplierOfferId','')::uuid;
  v_price bigint:=coalesce((p_payload->>'price')::bigint,0);
  v_publish boolean:=coalesce((p_payload->>'publish')::boolean,false);
  v_variant uuid;
  v_primary_variant uuid;
  v_backup_variant uuid;
  v_detail jsonb;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.stores
    where id=v_store and owner_user_id=auth.uid()
  ) then
    raise exception 'STORE_NOT_OWNED' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.designs
    where id=v_design and owner_user_id=auth.uid()
      and store_id=v_store and raw_product_id=v_raw
  ) then
    raise exception 'DESIGN_NOT_OWNED';
  end if;
  if length(trim(coalesce(p_payload->>'title','')))<3 then
    raise exception 'TITLE_REQUIRED';
  end if;
  if v_price<=0 then
    raise exception 'VALID_PRICE_REQUIRED';
  end if;
  if v_primary is not null and not exists(
    select 1 from public.supplier_offers
    where id=v_primary and raw_product_id=v_raw
      and approval_status='APPROVED' and status='ACTIVE'
  ) then
    raise exception 'PRIMARY_SUPPLIER_INVALID';
  end if;
  if v_backup is not null and (
    v_primary is null or
    v_backup=v_primary or
    not exists(
      select 1 from public.supplier_offers
      where id=v_backup and raw_product_id=v_raw
        and approval_status='APPROVED' and status='ACTIVE'
    )
  ) then
    raise exception 'BACKUP_SUPPLIER_INVALID';
  end if;

  v_slug:=lower(
    regexp_replace(
      coalesce(nullif(p_payload->>'slug',''),'product-'||substr(v_product::text,1,8)),
      '[^a-z0-9-]+','-','g'
    )
  );
  insert into public.seller_products(
    id,store_id,raw_product_id,design_id,
    primary_supplier_offer_id,backup_supplier_offer_id,
    slug,title,subtitle,description,price,discounted_price,
    status,moderation_status,seo_title,seo_description
  ) values(
    v_product,v_store,v_raw,v_design,v_primary,v_backup,v_slug,
    trim(p_payload->>'title'),
    nullif(p_payload->>'subtitle',''),
    nullif(p_payload->>'description',''),
    v_price,
    nullif(p_payload->>'discountedPrice','')::bigint,
    case when v_publish then 'PENDING' else 'DRAFT' end,
    'PENDING',
    nullif(p_payload->>'seoTitle',''),
    nullif(p_payload->>'seoDescription','')
  )
  on conflict(id) do update set
    design_id=excluded.design_id,
    primary_supplier_offer_id=excluded.primary_supplier_offer_id,
    backup_supplier_offer_id=excluded.backup_supplier_offer_id,
    slug=excluded.slug,
    title=excluded.title,
    subtitle=excluded.subtitle,
    description=excluded.description,
    price=excluded.price,
    discounted_price=excluded.discounted_price,
    status=excluded.status,
    moderation_status='PENDING',
    seo_title=excluded.seo_title,
    seo_description=excluded.seo_description,
    updated_at=now();

  for v_variant in
    select raw_product_variant_id
    from public.design_variants
    where design_id=v_design
  loop
    v_primary_variant:=null;
    v_backup_variant:=null;
    if v_primary is not null then
      select id into v_primary_variant
      from public.supplier_offer_variants
      where supplier_offer_id=v_primary
        and raw_product_variant_id=v_variant
        and stock_status in ('AVAILABLE','LOW_STOCK');
      if v_primary_variant is null then
        raise exception 'PRIMARY_SUPPLIER_VARIANT_MISSING';
      end if;
    end if;
    if v_backup is not null then
      select id into v_backup_variant
      from public.supplier_offer_variants
      where supplier_offer_id=v_backup
        and raw_product_variant_id=v_variant
        and stock_status in ('AVAILABLE','LOW_STOCK');
      if v_backup_variant is null then
        raise exception 'BACKUP_SUPPLIER_VARIANT_MISSING';
      end if;
    end if;
    insert into public.seller_product_variants(
      seller_product_id,raw_product_variant_id,
      supplier_offer_variant_id,backup_supplier_offer_variant_id,
      sku,price,compare_at_price,status
    ) values(
      v_product,v_variant,v_primary_variant,v_backup_variant,
      upper(substr(v_product::text,1,8)||'-'||substr(v_variant::text,1,8)),
      v_price,
      nullif(p_payload->>'compareAtPrice','')::bigint,
      case when v_primary_variant is null then 'OUT_OF_STOCK' else 'ACTIVE' end
    )
    on conflict(seller_product_id,raw_product_variant_id) do update set
      supplier_offer_variant_id=excluded.supplier_offer_variant_id,
      backup_supplier_offer_variant_id=excluded.backup_supplier_offer_variant_id,
      price=excluded.price,
      compare_at_price=excluded.compare_at_price,
      status=excluded.status,
      updated_at=now();
  end loop;

  delete from public.product_details where seller_product_id=v_product;
  for v_detail in
    select value
    from jsonb_array_elements(coalesce(p_payload->'details','[]'::jsonb))
  loop
    if length(trim(coalesce(v_detail->>'title','')))>0
      and length(trim(coalesce(v_detail->>'value','')))>0 then
      insert into public.product_details(
        seller_product_id,title,value,sort_order
      ) values(
        v_product,
        trim(v_detail->>'title'),
        trim(v_detail->>'value'),
        coalesce((v_detail->>'sortOrder')::integer,0)
      );
    end if;
  end loop;
  if v_publish and not exists(
    select 1 from public.product_moderation_queue
    where seller_product_id=v_product and status='PENDING'
  ) then
    insert into public.product_moderation_queue(
      seller_product_id,seller_id,status
    ) values(v_product,auth.uid(),'PENDING');
  end if;
  update public.designs
  set status='READY',updated_at=now()
  where id=v_design;
  return v_product;
end
$$;

revoke all on function public.save_seller_product(jsonb) from public,anon;
grant execute on function public.save_seller_product(jsonb)
  to authenticated,service_role;
