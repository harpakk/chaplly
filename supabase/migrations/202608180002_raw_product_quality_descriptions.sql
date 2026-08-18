create table if not exists public.raw_product_quality_descriptions (
  id uuid primary key default gen_random_uuid(),
  raw_product_id uuid not null references public.raw_products(id) on delete cascade,
  description text not null check (length(trim(description)) between 3 and 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(raw_product_id, sort_order)
);

create index if not exists raw_product_quality_descriptions_raw_idx
  on public.raw_product_quality_descriptions(raw_product_id, sort_order);

drop trigger if exists raw_product_quality_descriptions_touch
  on public.raw_product_quality_descriptions;
create trigger raw_product_quality_descriptions_touch
before update on public.raw_product_quality_descriptions
for each row execute function public.touch_updated_at();

alter table public.raw_product_quality_descriptions enable row level security;
drop policy if exists raw_product_quality_descriptions_public_read
  on public.raw_product_quality_descriptions;
create policy raw_product_quality_descriptions_public_read
on public.raw_product_quality_descriptions for select to anon, authenticated
using (exists(
  select 1 from public.raw_products raw
  where raw.id=raw_product_id and raw.status='ACTIVE'
));

insert into public.raw_product_quality_descriptions(raw_product_id,description,sort_order)
select id,left(trim(description),1000),0 from public.raw_products
where length(trim(coalesce(description,'')))>=3
on conflict(raw_product_id,sort_order) do nothing;

create or replace function public.service_set_raw_product_quality_descriptions(
  p_raw_product_id uuid,
  p_descriptions jsonb,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.admin_profiles where user_id=p_actor_id) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_descriptions,'[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(p_descriptions,'[]'::jsonb))>20 then
    raise exception 'QUALITY_DESCRIPTIONS_INVALID';
  end if;
  if exists(
    select 1 from jsonb_array_elements_text(coalesce(p_descriptions,'[]'::jsonb)) value
    where length(trim(value)) not between 3 and 1000
  ) then
    raise exception 'QUALITY_DESCRIPTIONS_INVALID';
  end if;

  delete from public.raw_product_quality_descriptions
  where raw_product_id=p_raw_product_id;
  insert into public.raw_product_quality_descriptions(raw_product_id,description,sort_order)
  select p_raw_product_id,trim(value),ordinality-1
  from jsonb_array_elements_text(coalesce(p_descriptions,'[]'::jsonb))
    with ordinality as item(value,ordinality);
end;
$$;

revoke all on function public.service_set_raw_product_quality_descriptions(uuid,jsonb,uuid)
  from public,anon,authenticated;
grant execute on function public.service_set_raw_product_quality_descriptions(uuid,jsonb,uuid)
  to service_role;

notify pgrst, 'reload schema';
