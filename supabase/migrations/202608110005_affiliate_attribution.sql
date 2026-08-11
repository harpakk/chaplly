alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists acquisition_source text,
  add column if not exists attribution_landing_path text,
  add column if not exists attributed_at timestamptz;

alter table public.orders
  add column if not exists referral_code text,
  add column if not exists acquisition_source text,
  add column if not exists attribution_landing_path text;

create index if not exists profiles_referral_code_idx on public.profiles(referral_code) where referral_code is not null;
create index if not exists orders_referral_code_paid_idx on public.orders(referral_code,paid_at) where paid_at is not null;

-- At most one compact row per anonymous visitor per Tehran calendar day.
create table if not exists public.daily_attribution_visitors (
  day date not null,
  visitor_hash text not null,
  source_type text not null check(source_type in ('DIRECT','GOOGLE','REFERRAL','OTHER')),
  referral_code text,
  landing_path text,
  visits integer not null default 1 check(visits > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(day,visitor_hash)
);

alter table public.daily_attribution_visitors enable row level security;
create index if not exists daily_attribution_source_idx on public.daily_attribution_visitors(day,source_type,referral_code);

create or replace function public.record_attribution_visit(
  p_visitor_hash text,
  p_source_type text,
  p_referral_code text default null,
  p_landing_path text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare
  v_source text:=upper(trim(coalesce(p_source_type,'DIRECT')));
  v_ref text:=nullif(lower(left(trim(coalesce(p_referral_code,'')),80)),'');
begin
  if v_source not in ('DIRECT','GOOGLE','REFERRAL','OTHER') then v_source:='OTHER'; end if;
  if v_ref is not null then v_source:='REFERRAL'; end if;
  if length(coalesce(p_visitor_hash,''))<32 then raise exception 'INVALID_VISITOR'; end if;
  insert into public.daily_attribution_visitors(day,visitor_hash,source_type,referral_code,landing_path)
  values((now() at time zone 'Asia/Tehran')::date,p_visitor_hash,v_source,v_ref,left(p_landing_path,500))
  on conflict(day,visitor_hash) do update set
    visits=public.daily_attribution_visitors.visits+1,
    source_type=case when excluded.referral_code is not null then 'REFERRAL' else public.daily_attribution_visitors.source_type end,
    referral_code=coalesce(excluded.referral_code,public.daily_attribution_visitors.referral_code),
    landing_path=coalesce(public.daily_attribution_visitors.landing_path,excluded.landing_path),
    last_seen_at=now();
end $$;

revoke all on function public.record_attribution_visit(text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_attribution_visit(text,text,text,text) to service_role;

create or replace function public.service_admin_attribution(p_days integer default 30)
returns jsonb
language sql stable security definer set search_path=public as $$
with bounds as (
  select greatest(1,least(coalesce(p_days,30),730))::integer days,
    (now() at time zone 'Asia/Tehran')::date as today
), visit_rows as (
  select case when referral_code is not null then 'ref:'||referral_code else lower(source_type) end source_key,
    sum(visits)::bigint visits,count(distinct visitor_hash)::bigint unique_visits
  from public.daily_attribution_visitors,bounds
  where day between today-days+1 and today group by 1
), signup_rows as (
  select case when referral_code is not null then 'ref:'||lower(referral_code)
    else lower(coalesce(acquisition_source,'DIRECT')) end source_key,count(*)::bigint signups
  from public.profiles,bounds
  where created_at >= (today-days+1)::timestamp at time zone 'Asia/Tehran' group by 1
), buy_rows as (
  select case when o.referral_code is not null then 'ref:'||lower(o.referral_code)
    when p.referral_code is not null then 'ref:'||lower(p.referral_code)
    else lower(coalesce(o.acquisition_source,p.acquisition_source,'DIRECT')) end source_key,
    count(*)::bigint buys
  from public.orders o left join public.profiles p on p.id=o.buyer_user_id,bounds
  where o.paid_at >= (today-days+1)::timestamp at time zone 'Asia/Tehran' group by 1
), keys as (
  select source_key from visit_rows union select source_key from signup_rows union select source_key from buy_rows
), combined as (
  select k.source_key,coalesce(v.visits,0) visits,coalesce(v.unique_visits,0) unique_visits,
    coalesce(s.signups,0) signups,coalesce(b.buys,0) buys
  from keys k left join visit_rows v using(source_key) left join signup_rows s using(source_key) left join buy_rows b using(source_key)
), total as (select coalesce(sum(visits),0) visits from combined)
select coalesce(jsonb_agg(jsonb_build_object(
  'sourceKey',combined.source_key,'visits',combined.visits,'uniqueVisits',combined.unique_visits,
  'signups',combined.signups,'buys',combined.buys,
  'visitPercentage',case when total.visits>0 then round(100.0*combined.visits/total.visits,2) else 0 end
) order by combined.visits desc,combined.source_key),'[]'::jsonb) from combined cross join total group by total.visits
$$;

revoke all on function public.service_admin_attribution(integer) from public,anon,authenticated;
grant execute on function public.service_admin_attribution(integer) to service_role;
notify pgrst, 'reload schema';
