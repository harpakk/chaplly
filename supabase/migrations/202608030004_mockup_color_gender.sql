-- Searchable mockup attributes for the seller mockup picker.
alter table public.raw_product_mockups
  add column if not exists color_id uuid references public.raw_product_colors(id) on delete set null,
  add column if not exists gender text not null default 'UNISEX';

alter table public.raw_product_mockups drop constraint if exists raw_product_mockups_gender_check;
alter table public.raw_product_mockups add constraint raw_product_mockups_gender_check
  check(gender in ('MALE','FEMALE','UNISEX'));

create index if not exists raw_product_mockups_filter_idx
  on public.raw_product_mockups(raw_product_id,gender,color_id) where status='ACTIVE';
