-- Required marketplace gender classification for seller products.
alter table public.seller_products
  add column if not exists gender text not null default 'UNISEX';

alter table public.seller_products drop constraint if exists seller_products_gender_check;
alter table public.seller_products add constraint seller_products_gender_check
  check(gender in ('MALE','FEMALE','UNISEX'));

create index if not exists seller_products_gender_catalog_idx
  on public.seller_products(gender,published_at desc)
  where status='PUBLISHED' and moderation_status='APPROVED';
