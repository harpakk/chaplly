create table if not exists public.seller_ai_copy_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  design_id uuid not null references public.designs(id) on delete cascade,
  request_id uuid not null unique,
  usage_day date not null,
  created_at timestamptz not null default now()
);

create index if not exists seller_ai_copy_usage_daily_idx
  on public.seller_ai_copy_usage(user_id,usage_day);

alter table public.seller_ai_copy_usage enable row level security;
drop policy if exists seller_ai_copy_usage_own_read on public.seller_ai_copy_usage;
create policy seller_ai_copy_usage_own_read on public.seller_ai_copy_usage
for select to authenticated using(user_id=auth.uid());

create or replace function public.service_reserve_seller_ai_copy(p_user_id uuid,p_design_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_created_at timestamptz; v_today date:=(now() at time zone 'Asia/Tehran')::date; v_limit integer; v_used integer;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select created_at into v_created_at from public.profiles where id=p_user_id;
  if v_created_at is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if not exists(select 1 from public.designs where id=p_design_id and owner_user_id=p_user_id) then raise exception 'DESIGN_NOT_OWNED' using errcode='42501'; end if;
  v_limit:=case when now()<v_created_at+interval '14 days' then 15 else 1 end;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||v_today::text,0));
  if exists(select 1 from public.seller_ai_copy_usage where request_id=p_request_id and user_id=p_user_id) then
    select count(*) into v_used from public.seller_ai_copy_usage where user_id=p_user_id and usage_day=v_today;
    return jsonb_build_object('allowed',true,'limit',v_limit,'used',v_used,'remaining',greatest(0,v_limit-v_used));
  end if;
  select count(*) into v_used from public.seller_ai_copy_usage where user_id=p_user_id and usage_day=v_today;
  if v_used>=v_limit then return jsonb_build_object('allowed',false,'limit',v_limit,'used',v_used,'remaining',0); end if;
  insert into public.seller_ai_copy_usage(user_id,design_id,request_id,usage_day) values(p_user_id,p_design_id,p_request_id,v_today);
  return jsonb_build_object('allowed',true,'limit',v_limit,'used',v_used+1,'remaining',v_limit-v_used-1);
end $$;

create or replace function public.service_release_seller_ai_copy(p_user_id uuid,p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  delete from public.seller_ai_copy_usage where user_id=p_user_id and request_id=p_request_id;
end $$;

revoke all on function public.service_reserve_seller_ai_copy(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.service_release_seller_ai_copy(uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_reserve_seller_ai_copy(uuid,uuid,uuid) to service_role;
grant execute on function public.service_release_seller_ai_copy(uuid,uuid) to service_role;
notify pgrst,'reload schema';
