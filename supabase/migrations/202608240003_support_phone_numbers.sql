create table if not exists public.support_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone text not null,
  sort_order integer not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists support_phone_numbers_touch on public.support_phone_numbers;
create trigger support_phone_numbers_touch before update on public.support_phone_numbers
for each row execute function public.touch_updated_at();

alter table public.support_phone_numbers enable row level security;
drop policy if exists support_phone_numbers_authenticated_read on public.support_phone_numbers;
create policy support_phone_numbers_authenticated_read on public.support_phone_numbers
for select to authenticated using (status = 'ACTIVE');

notify pgrst, 'reload schema';
