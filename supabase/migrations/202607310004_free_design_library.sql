create table if not exists public.free_designs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  graphic_style_id uuid not null references public.graphic_styles(id) on delete restrict,
  file_id uuid not null references public.storage_files(id) on delete restrict,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists free_designs_touch on public.free_designs;
create trigger free_designs_touch before update on public.free_designs
for each row execute function public.touch_updated_at();

alter table public.free_designs enable row level security;
create policy free_designs_public_read on public.free_designs
for select to anon,authenticated using(status='ACTIVE');
grant select on public.free_designs to anon,authenticated;
create index if not exists free_designs_style_status_idx
on public.free_designs(graphic_style_id,status,sort_order,created_at desc);
