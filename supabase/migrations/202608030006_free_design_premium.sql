-- Premium classification for the existing graphic-style categorized library.
alter table public.free_designs
  add column if not exists is_premium boolean not null default false;

create index if not exists free_designs_style_premium_idx
  on public.free_designs(graphic_style_id,is_premium,sort_order,created_at desc)
  where status='ACTIVE';
