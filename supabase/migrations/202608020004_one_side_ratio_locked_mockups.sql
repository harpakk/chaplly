-- A mockup is one photograph for exactly one product side. Split historical
-- two-sided records before enforcing the invariant.
alter table public.raw_product_mockups
  add column if not exists side text;

update public.raw_product_mockups mockup
set side=coalesce(
  (select view.side from public.raw_product_mockup_views view
   where view.mockup_id=mockup.id order by case view.side when 'FRONT' then 0 else 1 end limit 1),
  'FRONT'
)
where side is null;

do $$
declare
  source record;
  back_id uuid;
begin
  for source in
    select mockup.*
    from public.raw_product_mockups mockup
    where exists(select 1 from public.raw_product_mockup_views view where view.mockup_id=mockup.id and view.side='FRONT')
      and exists(select 1 from public.raw_product_mockup_views view where view.mockup_id=mockup.id and view.side='BACK')
  loop
    back_id:=gen_random_uuid();
    insert into public.raw_product_mockups(
      id,raw_product_id,name,status,created_by,created_at,updated_at,needs_alignment,side
    ) values(
      back_id,source.raw_product_id,source.name||' - پشت',source.status,source.created_by,
      source.created_at,source.updated_at,source.needs_alignment,'BACK'
    );
    update public.raw_product_mockup_views
    set mockup_id=back_id
    where mockup_id=source.id and side='BACK';
    update public.raw_product_mockups set side='FRONT' where id=source.id;
  end loop;
end
$$;

alter table public.raw_product_mockups
  alter column side set default 'FRONT',
  alter column side set not null,
  drop constraint if exists raw_product_mockups_side_check,
  add constraint raw_product_mockups_side_check check(side in ('FRONT','BACK'));

alter table public.raw_product_mockup_views
  drop constraint if exists raw_product_mockup_views_one_side,
  add constraint raw_product_mockup_views_one_side unique(mockup_id);

create or replace function public.validate_raw_product_mockup()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  product_has_back boolean;
begin
  select product.has_back into product_has_back
  from public.raw_products product
  where product.id=new.raw_product_id and product.status='ACTIVE';
  if not found then raise exception 'RAW_PRODUCT_NOT_ACTIVE'; end if;
  if new.side='BACK' and not product_has_back then raise exception 'RAW_PRODUCT_HAS_NO_BACK'; end if;
  if tg_op='UPDATE'
    and (old.raw_product_id,old.side) is distinct from (new.raw_product_id,new.side)
    and exists(select 1 from public.raw_product_mockup_views view where view.mockup_id=old.id)
  then
    raise exception 'MOCKUP_PRODUCT_AND_SIDE_ARE_IMMUTABLE';
  end if;
  return new;
end
$$;

drop trigger if exists raw_product_mockups_validate on public.raw_product_mockups;
create trigger raw_product_mockups_validate
before insert or update on public.raw_product_mockups
for each row execute function public.validate_raw_product_mockup();

create or replace function public.validate_raw_product_mockup_view()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  mockup_side text;
  product_id uuid;
  product_has_back boolean;
  raw_width numeric;
  raw_height numeric;
begin
  select mockup.side,mockup.raw_product_id,product.has_back,
         raw_view.print_area_width,raw_view.print_area_height
  into mockup_side,product_id,product_has_back,raw_width,raw_height
  from public.raw_product_mockups mockup
  join public.raw_products product on product.id=mockup.raw_product_id
  join public.raw_product_views raw_view
    on raw_view.raw_product_id=mockup.raw_product_id and raw_view.side::text=mockup.side
  where mockup.id=new.mockup_id;
  if not found then raise exception 'RAW_PRODUCT_SIDE_NOT_CONFIGURED'; end if;
  if new.side<>mockup_side then raise exception 'MOCKUP_SIDE_MISMATCH'; end if;
  if new.side='BACK' and not product_has_back then raise exception 'RAW_PRODUCT_HAS_NO_BACK'; end if;
  if new.area_width<=0 then raise exception 'MOCKUP_AREA_WIDTH_INVALID'; end if;
  new.area_height:=round((new.area_width*raw_height/raw_width)::numeric,6);
  if new.area_x<0 or new.area_y<0
    or new.area_x+new.area_width>1
    or new.area_y+new.area_height>1
  then raise exception 'MOCKUP_AREA_OUT_OF_BOUNDS'; end if;
  return new;
end
$$;

drop trigger if exists raw_product_mockup_views_validate on public.raw_product_mockup_views;
create trigger raw_product_mockup_views_validate
before insert or update on public.raw_product_mockup_views
for each row execute function public.validate_raw_product_mockup_view();

create or replace function public.service_upsert_raw_product_mockup(
  p_id uuid,
  p_raw_product_id uuid,
  p_name text,
  p_side text,
  p_background_file_id uuid,
  p_area_x numeric,
  p_area_y numeric,
  p_area_width numeric,
  p_rotation_degrees numeric,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  existing public.raw_product_mockups%rowtype;
  background_id uuid;
  raw_width numeric;
  raw_height numeric;
  area_height numeric;
  product_has_back boolean;
begin
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'MOCKUP_NAME_REQUIRED'; end if;
  if p_side not in ('FRONT','BACK') then raise exception 'MOCKUP_SIDE_INVALID'; end if;
  select * into existing from public.raw_product_mockups where id=p_id;
  if found and (existing.raw_product_id,existing.side) is distinct from (p_raw_product_id,p_side) then
    raise exception 'MOCKUP_PRODUCT_AND_SIDE_ARE_IMMUTABLE';
  end if;
  select product.has_back,raw_view.print_area_width,raw_view.print_area_height
  into product_has_back,raw_width,raw_height
  from public.raw_products product
  join public.raw_product_views raw_view
    on raw_view.raw_product_id=product.id and raw_view.side::text=p_side
  where product.id=p_raw_product_id and product.status='ACTIVE';
  if not found then raise exception 'RAW_PRODUCT_SIDE_NOT_CONFIGURED'; end if;
  if p_side='BACK' and not product_has_back then raise exception 'RAW_PRODUCT_HAS_NO_BACK'; end if;
  if p_area_width<=0 then raise exception 'MOCKUP_AREA_WIDTH_INVALID'; end if;
  area_height:=round((p_area_width*raw_height/raw_width)::numeric,6);
  if p_area_x<0 or p_area_y<0 or p_area_x+p_area_width>1 or p_area_y+area_height>1 then
    raise exception 'MOCKUP_AREA_OUT_OF_BOUNDS';
  end if;
  if p_rotation_degrees not between -180 and 180 then raise exception 'MOCKUP_ROTATION_INVALID'; end if;
  background_id:=coalesce(
    p_background_file_id,
    (select view.background_file_id from public.raw_product_mockup_views view where view.mockup_id=p_id)
  );
  if background_id is null then raise exception 'MOCKUP_IMAGE_REQUIRED'; end if;

  insert into public.raw_product_mockups(id,raw_product_id,name,side,status,created_by,needs_alignment)
  values(p_id,p_raw_product_id,trim(p_name),p_side,'ACTIVE',p_actor_id,false)
  on conflict(id) do update set name=excluded.name,status='ACTIVE',needs_alignment=false,updated_at=now();

  insert into public.raw_product_mockup_views(
    mockup_id,side,background_file_id,area_x,area_y,area_width,area_height,rotation_degrees
  ) values(
    p_id,p_side,background_id,p_area_x,p_area_y,p_area_width,area_height,p_rotation_degrees
  )
  on conflict(mockup_id) do update set
    side=excluded.side,background_file_id=excluded.background_file_id,
    area_x=excluded.area_x,area_y=excluded.area_y,area_width=excluded.area_width,
    area_height=excluded.area_height,rotation_degrees=excluded.rotation_degrees,updated_at=now();
  return p_id;
end
$$;

revoke all on function public.service_upsert_raw_product_mockup(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid)
from public,anon,authenticated;
grant execute on function public.service_upsert_raw_product_mockup(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid)
to service_role;
