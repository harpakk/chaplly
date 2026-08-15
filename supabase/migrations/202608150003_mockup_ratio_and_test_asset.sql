create table if not exists public.admin_mockup_test_assets (
  singleton boolean primary key default true check (singleton),
  file_id uuid not null references public.storage_files(id),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.admin_mockup_test_assets enable row level security;
drop policy if exists admin_mockup_test_assets_admin on public.admin_mockup_test_assets;
create policy admin_mockup_test_assets_admin on public.admin_mockup_test_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.admin_mockup_test_assets to authenticated;

create or replace function public.validate_raw_product_mockup_view()
returns trigger language plpgsql set search_path=public as $$
declare mockup_side text; product_has_back boolean;
begin
  select mockup.side,product.has_back into mockup_side,product_has_back
  from public.raw_product_mockups mockup
  join public.raw_products product on product.id=mockup.raw_product_id
  where mockup.id=new.mockup_id;
  if not found then raise exception 'RAW_PRODUCT_SIDE_NOT_CONFIGURED'; end if;
  if new.side<>mockup_side then raise exception 'MOCKUP_SIDE_MISMATCH'; end if;
  if new.side='BACK' and not product_has_back then raise exception 'RAW_PRODUCT_HAS_NO_BACK'; end if;
  if new.area_width<=0 or new.area_width>1.8 then raise exception 'MOCKUP_AREA_WIDTH_INVALID'; end if;
  if new.area_height<=0 or new.area_height>1.8 then raise exception 'MOCKUP_AREA_HEIGHT_INVALID'; end if;
  if new.area_x>1 or new.area_y>1
    or new.area_x+new.area_width<0 or new.area_y+new.area_height<0
  then raise exception 'MOCKUP_AREA_OUT_OF_BOUNDS'; end if;
  return new;
end $$;

drop function if exists public.service_upsert_raw_product_mockup(
  uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,uuid,text,jsonb,text
);

create function public.service_upsert_raw_product_mockup(
  p_id uuid,p_raw_product_id uuid,p_name text,p_side text,p_background_file_id uuid,
  p_area_x numeric,p_area_y numeric,p_area_width numeric,p_area_height numeric,
  p_rotation_degrees numeric,p_actor_id uuid,p_color_id uuid,p_gender text,
  p_perspective_points jsonb default null,p_artwork_clip text default 'FULL'
)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing public.raw_product_mockups%rowtype; background_id uuid; product_has_back boolean;
begin
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'MOCKUP_NAME_REQUIRED'; end if;
  if p_side not in ('FRONT','BACK') then raise exception 'MOCKUP_SIDE_INVALID'; end if;
  if p_gender not in ('MALE','FEMALE','UNISEX') then raise exception 'MOCKUP_GENDER_INVALID'; end if;
  if p_artwork_clip not in ('FULL','TOP','BOTTOM','LEFT','RIGHT') then raise exception 'MOCKUP_ARTWORK_CLIP_INVALID'; end if;
  select * into existing from public.raw_product_mockups where id=p_id;
  if found and (existing.raw_product_id,existing.side) is distinct from (p_raw_product_id,p_side) then raise exception 'MOCKUP_PRODUCT_AND_SIDE_ARE_IMMUTABLE'; end if;
  select product.has_back into product_has_back from public.raw_products product
    join public.raw_product_views raw_view on raw_view.raw_product_id=product.id and raw_view.side::text=p_side
    where product.id=p_raw_product_id and product.status='ACTIVE';
  if not found then raise exception 'RAW_PRODUCT_SIDE_NOT_CONFIGURED'; end if;
  if p_side='BACK' and not product_has_back then raise exception 'RAW_PRODUCT_HAS_NO_BACK'; end if;
  if not exists(select 1 from public.raw_product_colors where id=p_color_id and raw_product_id=p_raw_product_id and status='ACTIVE') then raise exception 'MOCKUP_COLOR_INVALID'; end if;
  if p_area_width<=0 or p_area_width>1.8 then raise exception 'MOCKUP_AREA_WIDTH_INVALID'; end if;
  if p_area_height<=0 or p_area_height>1.8 then raise exception 'MOCKUP_AREA_HEIGHT_INVALID'; end if;
  if p_area_x>1 or p_area_y>1 or p_area_x+p_area_width<0 or p_area_y+p_area_height<0 then raise exception 'MOCKUP_AREA_OUT_OF_BOUNDS'; end if;
  if p_rotation_degrees not between -180 and 180 then raise exception 'MOCKUP_ROTATION_INVALID'; end if;
  if p_perspective_points is not null and (jsonb_typeof(p_perspective_points)<>'array' or jsonb_array_length(p_perspective_points)<>8) then raise exception 'MOCKUP_PERSPECTIVE_INVALID'; end if;
  background_id:=coalesce(p_background_file_id,(select view.background_file_id from public.raw_product_mockup_views view where view.mockup_id=p_id));
  if background_id is null then raise exception 'MOCKUP_IMAGE_REQUIRED'; end if;
  insert into public.raw_product_mockups(id,raw_product_id,name,side,color_id,gender,status,created_by,needs_alignment)
    values(p_id,p_raw_product_id,trim(p_name),p_side,p_color_id,p_gender,'ACTIVE',p_actor_id,false)
    on conflict(id) do update set name=excluded.name,color_id=excluded.color_id,gender=excluded.gender,status='ACTIVE',needs_alignment=false,updated_at=now();
  insert into public.raw_product_mockup_views(mockup_id,side,background_file_id,area_x,area_y,area_width,area_height,rotation_degrees,perspective_points,artwork_clip)
    values(p_id,p_side,background_id,p_area_x,p_area_y,p_area_width,p_area_height,p_rotation_degrees,p_perspective_points,p_artwork_clip)
    on conflict(mockup_id) do update set side=excluded.side,background_file_id=excluded.background_file_id,area_x=excluded.area_x,area_y=excluded.area_y,area_width=excluded.area_width,area_height=excluded.area_height,rotation_degrees=excluded.rotation_degrees,perspective_points=excluded.perspective_points,artwork_clip=excluded.artwork_clip,updated_at=now();
  return p_id;
end $$;

revoke all on function public.service_upsert_raw_product_mockup(
  uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,numeric,uuid,uuid,text,jsonb,text
) from public,anon,authenticated;
grant execute on function public.service_upsert_raw_product_mockup(
  uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,numeric,uuid,uuid,text,jsonb,text
) to service_role;

with corrected as (
  select mockup_view.id,
    mockup_view.area_width,
    mockup_view.area_width *
      (mockup_file.width::numeric / mockup_file.height) /
      ((raw_file.width::numeric / raw_file.height) *
       (raw_view.print_area_width / raw_view.print_area_height)) as calculated_height
  from public.raw_product_mockup_views mockup_view
  join public.raw_product_mockups mockup on mockup.id=mockup_view.mockup_id
  join public.raw_product_views raw_view on raw_view.raw_product_id=mockup.raw_product_id and raw_view.side::text=mockup.side
  join public.storage_files raw_file on raw_file.id=raw_view.background_file_id
  join public.storage_files mockup_file on mockup_file.id=mockup_view.background_file_id
  where raw_file.width>0 and raw_file.height>0 and mockup_file.width>0 and mockup_file.height>0
)
update public.raw_product_mockup_views target set
  area_width=corrected.area_width * least(1::numeric,1.8/corrected.calculated_height),
  area_height=corrected.calculated_height * least(1::numeric,1.8/corrected.calculated_height),
  updated_at=now()
from corrected where corrected.id=target.id and corrected.calculated_height>0;

update public.raw_product_mockups mockup set needs_alignment=true,updated_at=now()
where exists (
  select 1 from public.raw_product_mockup_views mockup_view
  join public.raw_product_views raw_view on raw_view.raw_product_id=mockup.raw_product_id and raw_view.side::text=mockup.side
  left join public.storage_files raw_file on raw_file.id=raw_view.background_file_id
  left join public.storage_files mockup_file on mockup_file.id=mockup_view.background_file_id
  where mockup_view.mockup_id=mockup.id
    and (raw_file.width is null or raw_file.height is null or mockup_file.width is null or mockup_file.height is null)
);

notify pgrst, 'reload schema';
