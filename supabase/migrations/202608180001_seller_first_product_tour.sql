alter table public.profiles
  add column if not exists login_count integer not null default 0;

alter table public.profiles drop constraint if exists profiles_login_count_check;
alter table public.profiles add constraint profiles_login_count_check
  check (login_count >= 0);

create table if not exists public.seller_tour_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  eligible boolean not null default false,
  sidebar_step integer not null default 0 check (sidebar_step >= 0),
  product_step integer not null default 0 check (product_step >= 0),
  design_step integer not null default 0 check (design_step >= 0),
  sidebar_completed_at timestamptz,
  product_completed_at timestamptz,
  design_completed_at timestamptz,
  sidebar_shown_count integer not null default 0 check (sidebar_shown_count >= 0),
  product_shown_count integer not null default 0 check (product_shown_count >= 0),
  design_shown_count integer not null default 0 check (design_shown_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  dismissed_login_count integer,
  dont_show_again boolean not null default false,
  dont_show_again_at timestamptz,
  last_tour text check (last_tour is null or last_tour in ('sidebar','product','design')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists seller_tour_progress_touch on public.seller_tour_progress;
create trigger seller_tour_progress_touch before update on public.seller_tour_progress
for each row execute function public.touch_updated_at();

alter table public.seller_tour_progress enable row level security;
drop policy if exists seller_tour_progress_own on public.seller_tour_progress;
create policy seller_tour_progress_own on public.seller_tour_progress
for select to authenticated using (user_id = auth.uid());

create or replace function public.service_record_profile_login(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer;
begin
  update public.profiles
  set last_login_at=now(), login_count=login_count+1, updated_at=now()
  where id=p_user_id
  returning login_count into v_count;
  if v_count is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  return v_count;
end;
$$;

revoke all on function public.service_record_profile_login(uuid)
  from public, anon, authenticated;
grant execute on function public.service_record_profile_login(uuid)
  to service_role;

notify pgrst, 'reload schema';
