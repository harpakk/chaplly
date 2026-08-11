-- Front/back canvas media belongs to the view itself, independently of colors/sizes.

alter table public.raw_product_views
  add column if not exists background_file_id uuid references public.storage_files(id) on delete restrict,
  add column if not exists overlay_file_id uuid references public.storage_files(id) on delete set null,
  add column if not exists mockup_file_id uuid references public.storage_files(id) on delete set null;

with latest_asset as (
  select distinct on (asset.raw_product_view_id)
    asset.raw_product_view_id,
    asset.background_file_id,
    asset.overlay_file_id,
    asset.mockup_file_id
  from public.raw_product_variant_assets asset
  order by asset.raw_product_view_id,asset.updated_at desc,asset.id
)
update public.raw_product_views view
set
  background_file_id=coalesce(view.background_file_id,source.background_file_id),
  overlay_file_id=coalesce(view.overlay_file_id,source.overlay_file_id),
  mockup_file_id=coalesce(view.mockup_file_id,source.mockup_file_id)
from latest_asset source
where source.raw_product_view_id=view.id
  and view.background_file_id is null;

create index if not exists raw_product_views_background_file_idx
  on public.raw_product_views(background_file_id);
