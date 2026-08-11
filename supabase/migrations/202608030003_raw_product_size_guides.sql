-- Flexible size guide stored with the raw product it describes.
alter table public.raw_products
  add column if not exists size_guide jsonb;

alter table public.raw_products drop constraint if exists raw_products_size_guide_shape_check;
alter table public.raw_products add constraint raw_products_size_guide_shape_check check(
  size_guide is null or (
    jsonb_typeof(size_guide)='object' and
    jsonb_typeof(size_guide->'columns')='array' and
    jsonb_typeof(size_guide->'rows')='array'
  )
);
