-- Every raw product card has an independent primary catalog image.
-- Existing products use their front design background until an admin replaces it.

insert into public.raw_product_media(
  raw_product_id,
  file_id,
  alt_text,
  sort_order,
  is_primary
)
select distinct on (product.id)
  product.id,
  asset.background_file_id,
  'تصویر اصلی ' || product.name,
  0,
  true
from public.raw_products product
join public.raw_product_views view
  on view.raw_product_id=product.id
 and view.side='FRONT'
join public.raw_product_variants variant
  on variant.raw_product_id=product.id
join public.raw_product_variant_assets asset
  on asset.raw_product_variant_id=variant.id
 and asset.raw_product_view_id=view.id
where asset.background_file_id is not null
  and not exists(
    select 1
    from public.raw_product_media media
    where media.raw_product_id=product.id
      and media.is_primary
  )
order by product.id,asset.updated_at desc,asset.id
on conflict(raw_product_id,file_id) do update set
  alt_text=excluded.alt_text,
  sort_order=0,
  is_primary=true;
