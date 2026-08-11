alter table public.admin_profiles
  add column if not exists access_expires_at timestamptz;

create index if not exists admin_profiles_active_access_idx
  on public.admin_profiles(access_expires_at)
  where is_active;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.admin_profiles a
    join public.profiles p on p.id=a.user_id
    where a.user_id=p_user_id
      and a.is_active
      and a.access_expires_at>now()
      and p.state='ACTIVE'
  )
$$;

comment on column public.admin_profiles.access_expires_at is
  'Server-issued temporary admin grant, currently valid for 24 hours after access-code verification.';
