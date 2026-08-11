alter table public.raw_product_mockup_views
  add column if not exists rotation_degrees numeric(7,3) not null default 0;

alter table public.raw_product_mockup_views
  drop constraint if exists raw_product_mockup_views_rotation_check,
  add constraint raw_product_mockup_views_rotation_check
    check(rotation_degrees >= -180 and rotation_degrees <= 180);
