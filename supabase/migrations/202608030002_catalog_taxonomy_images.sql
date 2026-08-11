alter type public.asset_kind add value if not exists 'CATEGORY_IMAGE';
alter type public.asset_kind add value if not exists 'GRAPHIC_STYLE_IMAGE';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('catalog-assets','catalog-assets',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists catalog_assets_public_read on storage.objects;
create policy catalog_assets_public_read on storage.objects for select to anon,authenticated
using(bucket_id='catalog-assets');

create or replace function public.service_marketplace_context()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'banners',coalesce((select jsonb_agg(jsonb_build_object(
      'id',banner.id,'eyebrow',banner.eyebrow,'title',banner.title,'body',banner.body,
      'cta_label',banner.cta_label,'cta_url',banner.cta_url,'tone',banner.tone,
      'file',jsonb_build_object('bucket',file.bucket,'path',file.path)
    ) order by banner.sort_order) from (select * from public.homepage_banners where status='ACTIVE' order by sort_order limit 12) banner left join public.storage_files file on file.id=banner.desktop_file_id),'[]'::jsonb),
    'stores',coalesce((select jsonb_agg(to_jsonb(store) order by store.follower_count desc) from (
      select id,name,slug,description,social_url,follower_count,logo_file_id,banner_file_id from public.stores where status='ACTIVE' order by follower_count desc limit 24
    ) store),'[]'::jsonb),
    'styles',coalesce((select jsonb_agg(jsonb_build_object(
      'id',style.id,'slug',style.slug,'name',style.name,'caption',style.caption,'sort_order',style.sort_order,
      'file',jsonb_build_object('bucket',file.bucket,'path',file.path)
    ) order by style.sort_order) from (select * from public.graphic_styles where status='ACTIVE' order by sort_order limit 24) style left join public.storage_files file on file.id=style.image_file_id),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',category.id,'parent_id',category.parent_id,'slug',category.slug,'name',category.name,
      'description',category.description,'sort_order',category.sort_order,
      'file',jsonb_build_object('bucket',file.bucket,'path',file.path)
    ) order by category.sort_order) from (select * from public.categories where status='ACTIVE' and parent_id is null order by sort_order limit 24) category left join public.storage_files file on file.id=category.image_file_id),'[]'::jsonb),
    'reels',coalesce((select jsonb_agg(jsonb_build_object(
      'id',reel.id,'store_id',reel.store_id,'seller_product_id',reel.seller_product_id,'caption',reel.caption,
      'like_count',reel.like_count,'save_count',reel.save_count,'published_at',reel.published_at,
      'store',jsonb_build_object('name',store.name,'slug',store.slug,'social_url',store.social_url),
      'product',jsonb_build_object('slug',product.slug),'file',jsonb_build_object('bucket',file.bucket,'path',file.path)
    ) order by reel.published_at desc) from (select * from public.reel_posts where status='PUBLISHED' order by published_at desc limit 30) reel
      left join public.stores store on store.id=reel.store_id left join public.seller_products product on product.id=reel.seller_product_id left join public.storage_files file on file.id=reel.video_file_id),'[]'::jsonb)
  )
$$;

revoke all on function public.service_marketplace_context() from public;
grant execute on function public.service_marketplace_context() to anon,authenticated,service_role;
