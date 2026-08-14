alter table public.seller_profiles
  add column if not exists onboarding_answers jsonb not null default '{}'::jsonb;

alter table public.seller_profiles drop constraint if exists seller_profiles_onboarding_answers_object;
alter table public.seller_profiles add constraint seller_profiles_onboarding_answers_object
  check (jsonb_typeof(onboarding_answers) = 'object');

update public.seller_profiles sp
set onboarding_answers = jsonb_strip_nulls(jsonb_build_object(
  'sellerType', sp.seller_type,
  'experienceLevel', sp.experience_level,
  'instagramHandle', sp.instagram_handle,
  'audienceSize', case
    when sp.audience_size is null then null when sp.audience_size < 10000 then 'UNDER_10K'
    when sp.audience_size < 100000 then '10K_100K' when sp.audience_size < 1000000 then '100K_1M' else 'OVER_1M' end,
  'monthlyViews', case
    when sp.monthly_views is null then null when sp.monthly_views < 100000 then 'UNDER_100K'
    when sp.monthly_views < 1000000 then '100K_1M' when sp.monthly_views < 10000000 then '1M_10M' else 'OVER_10M' end,
  'sellerGoal', sp.goal,
  'websiteUrl', o.website_url,
  'primaryCategory', s.primary_category,
  'brandTone', s.brand_tone
))
from public.organizations o
left join public.stores s on s.organization_id = o.id
where sp.organization_id = o.id and sp.onboarding_answers = '{}'::jsonb;

create index if not exists seller_profiles_onboarding_answers_gin
  on public.seller_profiles using gin(onboarding_answers);

create or replace function public.service_save_seller_onboarding_answers(p_user_id uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'ANSWERS_INVALID'; end if;
  if p_answers ?| array['password','confirmPassword','terms'] then raise exception 'SENSITIVE_ANSWER_REJECTED'; end if;
  update public.seller_profiles set onboarding_answers=p_answers,updated_at=now() where owner_user_id=p_user_id;
  if not found then raise exception 'SELLER_PROFILE_NOT_FOUND'; end if;
end $$;
revoke all on function public.service_save_seller_onboarding_answers(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.service_save_seller_onboarding_answers(uuid,jsonb) to service_role;
