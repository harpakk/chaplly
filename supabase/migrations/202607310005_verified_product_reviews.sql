alter table public.reviews
  add column if not exists pros text[] not null default '{}',
  add column if not exists cons text[] not null default '{}',
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null;

alter table public.reviews alter column status set default 'PENDING';

create table if not exists public.review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  file_id uuid not null references public.storage_files(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(review_id,file_id)
);

alter table public.review_images enable row level security;
create policy review_images_public_read on public.review_images
for select to anon,authenticated using(
  exists(select 1 from public.reviews r where r.id=review_id and r.status='PUBLISHED')
  or exists(select 1 from public.reviews r where r.id=review_id and r.buyer_user_id=auth.uid())
);
grant select on public.review_images to anon,authenticated;

create index if not exists review_images_review_idx on public.review_images(review_id,sort_order);
create index if not exists reviews_pending_idx on public.reviews(status,created_at) where status='PENDING';
