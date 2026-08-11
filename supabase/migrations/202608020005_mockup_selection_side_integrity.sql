-- Preserve the meaning of selections that referenced a historical combined
-- mockup: select its newly split back record as well.
insert into public.design_mockup_selections(design_id,mockup_id,sort_order)
select selection.design_id,back_mockup.id,selection.sort_order+1
from public.design_mockup_selections selection
join public.raw_product_mockups front_mockup
  on front_mockup.id=selection.mockup_id and front_mockup.side='FRONT'
join public.raw_product_mockups back_mockup
  on back_mockup.raw_product_id=front_mockup.raw_product_id
 and back_mockup.side='BACK'
 and back_mockup.name=front_mockup.name||' - پشت'
 and back_mockup.created_at=front_mockup.created_at
on conflict(design_id,mockup_id) do nothing;

update public.design_mockup_renders render
set mockup_id=back_mockup.id
from public.raw_product_mockups front_mockup
join public.raw_product_mockups back_mockup
  on back_mockup.raw_product_id=front_mockup.raw_product_id
 and back_mockup.side='BACK'
 and back_mockup.name=front_mockup.name||' - پشت'
 and back_mockup.created_at=front_mockup.created_at
where render.mockup_id=front_mockup.id
  and front_mockup.side='FRONT'
  and render.side='BACK';

create or replace function public.validate_design_mockup_selection()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  design_raw_id uuid;
  mockup_raw_id uuid;
  mockup_status text;
begin
  select design.raw_product_id into design_raw_id
  from public.designs design where design.id=new.design_id;
  select mockup.raw_product_id,mockup.status into mockup_raw_id,mockup_status
  from public.raw_product_mockups mockup
  where mockup.id=new.mockup_id
    and exists(select 1 from public.raw_product_mockup_views view where view.mockup_id=mockup.id);
  if design_raw_id is null or mockup_raw_id is null
    or design_raw_id<>mockup_raw_id or mockup_status<>'ACTIVE'
  then raise exception 'DESIGN_MOCKUP_MISMATCH'; end if;
  return new;
end
$$;

drop trigger if exists design_mockup_selections_validate on public.design_mockup_selections;
create trigger design_mockup_selections_validate
before insert or update on public.design_mockup_selections
for each row execute function public.validate_design_mockup_selection();

create or replace function public.validate_design_mockup_render_side()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare configured_side text;
begin
  select mockup.side into configured_side
  from public.raw_product_mockups mockup where mockup.id=new.mockup_id;
  if configured_side is null or new.side<>configured_side then
    raise exception 'DESIGN_MOCKUP_RENDER_SIDE_MISMATCH';
  end if;
  return new;
end
$$;

drop trigger if exists design_mockup_renders_validate_side on public.design_mockup_renders;
create trigger design_mockup_renders_validate_side
before insert or update on public.design_mockup_renders
for each row execute function public.validate_design_mockup_render_side();
