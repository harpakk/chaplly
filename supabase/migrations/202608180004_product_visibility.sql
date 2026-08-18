-- Keep the seller's discovery preference independent from moderation state.
alter table public.seller_products
  add column if not exists visibility text not null default 'VISIBLE';

alter table public.seller_products
  drop constraint if exists seller_products_visibility_check;
alter table public.seller_products
  add constraint seller_products_visibility_check
  check (visibility in ('VISIBLE','PRIVATE'));

create index if not exists seller_products_public_catalog_idx
  on public.seller_products(published_at desc,id)
  where status='PUBLISHED' and moderation_status='APPROVED' and visibility='VISIBLE';

-- Existing products were public before this feature and must stay public.
update public.seller_products set visibility='VISIBLE' where visibility is null;

-- Extend the existing atomic save RPC without losing later stock-handling fixes.
do $$
declare
  v_definition text:=pg_get_functiondef('public.save_seller_product(jsonb)'::regprocedure);
  v_before text:=v_definition;
begin
  v_definition:=replace(v_definition,
    '  v_publish boolean:=coalesce((p_payload->>''publish'')::boolean,false);',
    '  v_publish boolean:=coalesce((p_payload->>''publish'')::boolean,false);'||chr(10)||
    '  v_visibility text:=upper(coalesce(nullif(trim(p_payload->>''visibility''),''''),''VISIBLE''));');
  v_definition:=replace(v_definition,
    '  if length(trim(coalesce(p_payload->>''title'','''')))<3 then',
    '  if v_visibility not in (''VISIBLE'',''PRIVATE'') then'||chr(10)||
    '    raise exception ''VISIBILITY_INVALID'';'||chr(10)||
    '  end if;'||chr(10)||
    '  if length(trim(coalesce(p_payload->>''title'','''')))<3 then');
  v_definition:=replace(v_definition,
    '    status,moderation_status,seo_title,seo_description',
    '    status,moderation_status,visibility,seo_title,seo_description');
  v_definition:=replace(v_definition,
    '    case when v_publish then ''PENDING'' else ''DRAFT'' end,'||chr(10)||
    '    ''PENDING'','||chr(10)||
    '    nullif(trim(p_payload->>''seoTitle''),''''),',
    '    case when v_publish then ''PUBLISHED'' else ''DRAFT'' end,'||chr(10)||
    '    ''PENDING'','||chr(10)||
    '    v_visibility,'||chr(10)||
    '    nullif(trim(p_payload->>''seoTitle''),''''),');
  v_definition:=replace(v_definition,
    '    moderation_status=''PENDING'','||chr(10)||
    '    seo_title=excluded.seo_title,',
    '    moderation_status=''PENDING'','||chr(10)||
    '    visibility=excluded.visibility,'||chr(10)||
    '    seo_title=excluded.seo_title,');
  if v_definition=v_before
    or position('v_visibility text' in v_definition)=0
    or position('visibility=excluded.visibility' in v_definition)=0
    or position('then ''PUBLISHED'' else ''DRAFT''' in v_definition)=0 then
    raise exception 'save_seller_product visibility patch signature was not found';
  end if;
  execute v_definition;
end $$;

-- Discovery RPCs expose only approved products whose seller chose VISIBLE.
do $$
declare
  v_definition text:=pg_get_functiondef('public.service_catalog_products()'::regprocedure);
  v_before text:=v_definition;
begin
  v_definition:=replace(v_definition,
    'where p.status=''PUBLISHED'' and p.moderation_status=''APPROVED''',
    'where p.status=''PUBLISHED'' and p.moderation_status=''APPROVED'' and p.visibility=''VISIBLE''');
  if v_definition=v_before then raise exception 'service_catalog_products visibility patch signature was not found'; end if;
  execute v_definition;
end $$;

do $$
declare
  v_definition text:=pg_get_functiondef('public.public_top_reels(integer,integer)'::regprocedure);
  v_before text:=v_definition;
begin
  v_definition:=replace(v_definition,
    'p.status=''PUBLISHED'' and p.moderation_status=''APPROVED''',
    'p.status=''PUBLISHED'' and p.moderation_status=''APPROVED'' and p.visibility=''VISIBLE''');
  v_definition:=replace(v_definition,
    'where r.status=''PUBLISHED''',
    'where r.status=''PUBLISHED'' and exists(select 1 from public.reel_products visible_link join public.seller_products visible_product on visible_product.id=visible_link.seller_product_id where visible_link.reel_id=r.id and visible_product.status=''PUBLISHED'' and visible_product.moderation_status=''APPROVED'' and visible_product.visibility=''VISIBLE'')');
  if v_definition=v_before or position('visible_product.visibility=''VISIBLE''' in v_definition)=0 then
    raise exception 'public_top_reels visibility patch signature was not found';
  end if;
  execute v_definition;
end $$;

do $$
declare
  v_definition text:=pg_get_functiondef('public.service_marketplace_context()'::regprocedure);
  v_before text:=v_definition;
begin
  v_definition:=replace(v_definition,
    'where status=''PUBLISHED'' order by published_at desc limit 30',
    'where status=''PUBLISHED'' and exists(select 1 from public.reel_products visible_link join public.seller_products visible_product on visible_product.id=visible_link.seller_product_id where visible_link.reel_id=reel_posts.id and visible_product.status=''PUBLISHED'' and visible_product.moderation_status=''APPROVED'' and visible_product.visibility=''VISIBLE'') order by published_at desc limit 30');
  v_definition:=replace(v_definition,
    'left join public.seller_products product on product.id=reel.seller_product_id',
    'left join public.seller_products product on product.id=reel.seller_product_id and product.status=''PUBLISHED'' and product.moderation_status=''APPROVED'' and product.visibility=''VISIBLE''');
  if v_definition=v_before or position('visible_product.visibility=''VISIBLE''' in v_definition)=0 then
    raise exception 'service_marketplace_context visibility patch signature was not found';
  end if;
  execute v_definition;
end $$;

-- Public PostgREST reads are discovery reads. Direct-link pages use a narrow
-- server-only loader, so these policies must not make private rows enumerable.
drop policy if exists "public published products" on public.seller_products;
drop policy if exists seller_products_public_read on public.seller_products;
create policy seller_products_public_read on public.seller_products for select to anon,authenticated
  using(status='PUBLISHED' and moderation_status='APPROVED' and visibility='VISIBLE');

drop policy if exists seller_product_variants_public_read on public.seller_product_variants;
create policy seller_product_variants_public_read on public.seller_product_variants for select to anon,authenticated
  using(status='ACTIVE' and exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));
drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images for select to anon,authenticated
  using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));
drop policy if exists product_details_public_read on public.product_details;
create policy product_details_public_read on public.product_details for select to anon,authenticated
  using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));
drop policy if exists product_tags_public_read on public.product_tags;
create policy product_tags_public_read on public.product_tags for select to anon,authenticated
  using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));
drop policy if exists product_graphic_styles_public_read on public.product_graphic_styles;
create policy product_graphic_styles_public_read on public.product_graphic_styles for select to anon,authenticated
  using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));
drop policy if exists product_videos_public_read on public.product_videos;
create policy product_videos_public_read on public.product_videos for select to anon,authenticated
  using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));

drop policy if exists reels_public_read on public.reel_posts;
create policy reels_public_read on public.reel_posts for select to anon,authenticated
  using(status='PUBLISHED' and exists(select 1 from public.reel_products link join public.seller_products p on p.id=link.seller_product_id where link.reel_id=reel_posts.id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));
drop policy if exists reel_products_public_read on public.reel_products;
create policy reel_products_public_read on public.reel_products for select to anon,authenticated
  using(exists(select 1 from public.seller_products p where p.id=seller_product_id and p.status='PUBLISHED' and p.moderation_status='APPROVED' and p.visibility='VISIBLE'));

-- A published product is purchasable through its direct link regardless of
-- moderation/visibility. Inventory and ownership checks in these RPCs remain.
do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_before text;
begin
  foreach v_signature in array array[
    'public.checkout_create_order(text,uuid,jsonb)'::regprocedure,
    'public.service_guest_checkout_create_order(text,jsonb,jsonb)'::regprocedure,
    'public.sync_buyer_cart(jsonb)'::regprocedure
  ] loop
    v_definition:=pg_get_functiondef(v_signature);
    v_before:=v_definition;
    v_definition:=replace(v_definition,' and sp.moderation_status=''APPROVED''','');
    if v_definition=v_before then
      raise exception '% direct-link purchase patch signature was not found',v_signature;
    end if;
    execute v_definition;
  end loop;
end $$;
