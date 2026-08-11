create table public.raw_product_mockups (
  id uuid primary key default gen_random_uuid(),
  raw_product_id uuid not null references public.raw_products(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.raw_product_mockup_views (
  id uuid primary key default gen_random_uuid(),
  mockup_id uuid not null references public.raw_product_mockups(id) on delete cascade,
  side text not null check(side in ('FRONT','BACK')),
  background_file_id uuid not null references public.storage_files(id) on delete restrict,
  area_x numeric(8,6) not null check(area_x>=0 and area_x<=1),
  area_y numeric(8,6) not null check(area_y>=0 and area_y<=1),
  area_width numeric(8,6) not null check(area_width>0 and area_width<=1),
  area_height numeric(8,6) not null check(area_height>0 and area_height<=1),
  perspective_points jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mockup_id,side),
  check(area_x+area_width<=1),
  check(area_y+area_height<=1)
);

create table public.design_mockup_renders (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs(id) on delete cascade,
  mockup_id uuid not null references public.raw_product_mockups(id) on delete restrict,
  side text not null check(side in ('FRONT','BACK')),
  file_id uuid not null references public.storage_files(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(design_id,mockup_id,side)
);

create trigger raw_product_mockups_touch before update on public.raw_product_mockups
for each row execute function public.touch_updated_at();
create trigger raw_product_mockup_views_touch before update on public.raw_product_mockup_views
for each row execute function public.touch_updated_at();

alter table public.raw_product_mockups enable row level security;
alter table public.raw_product_mockup_views enable row level security;
alter table public.design_mockup_renders enable row level security;
create policy mockups_read on public.raw_product_mockups for select to authenticated using(status='ACTIVE' or public.is_admin());
create policy mockup_views_read on public.raw_product_mockup_views for select to authenticated using(true);
create policy mockups_admin on public.raw_product_mockups for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy mockup_views_admin on public.raw_product_mockup_views for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy design_mockup_renders_own on public.design_mockup_renders for select to authenticated using(
  exists(select 1 from public.designs design where design.id=design_id and design.owner_user_id=auth.uid()) or public.is_admin()
);

grant select,insert,update,delete on public.raw_product_mockups,public.raw_product_mockup_views to authenticated;
grant select on public.design_mockup_renders to authenticated;
