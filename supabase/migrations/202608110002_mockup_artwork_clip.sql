alter table public.raw_product_mockup_views
  add column if not exists artwork_clip text not null default 'FULL';

alter table public.raw_product_mockup_views
  drop constraint if exists raw_product_mockup_views_artwork_clip_check;
alter table public.raw_product_mockup_views
  add constraint raw_product_mockup_views_artwork_clip_check
  check (artwork_clip in ('FULL','TOP','BOTTOM','LEFT','RIGHT'));

create or replace function public.service_upsert_raw_product_mockup(
  p_id uuid,p_raw_product_id uuid,p_name text,p_side text,p_background_file_id uuid,
  p_area_x numeric,p_area_y numeric,p_area_width numeric,p_rotation_degrees numeric,p_actor_id uuid,
  p_color_id uuid,p_gender text,p_perspective_points jsonb default null,p_artwork_clip text default 'FULL'
)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing public.raw_product_mockups%rowtype; background_id uuid; raw_width numeric; raw_height numeric; area_height numeric; product_has_back boolean;
begin
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'MOCKUP_NAME_REQUIRED'; end if;
  if p_side not in ('FRONT','BACK') then raise exception 'MOCKUP_SIDE_INVALID'; end if;
  if p_gender not in ('MALE','FEMALE','UNISEX') then raise exception 'MOCKUP_GENDER_INVALID'; end if;
  if p_artwork_clip not in ('FULL','TOP','BOTTOM','LEFT','RIGHT') then raise exception 'MOCKUP_ARTWORK_CLIP_INVALID'; end if;
  select * into existing from public.raw_product_mockups where id=p_id;
  if found and (existing.raw_product_id,existing.side) is distinct from (p_raw_product_id,p_side) then raise exception 'MOCKUP_PRODUCT_AND_SIDE_ARE_IMMUTABLE'; end if;
  select product.has_back,raw_view.print_area_width,raw_view.print_area_height into product_has_back,raw_width,raw_height from public.raw_products product join public.raw_product_views raw_view on raw_view.raw_product_id=product.id and raw_view.side::text=p_side where product.id=p_raw_product_id and product.status='ACTIVE';
  if not found then raise exception 'RAW_PRODUCT_SIDE_NOT_CONFIGURED'; end if;
  if p_side='BACK' and not product_has_back then raise exception 'RAW_PRODUCT_HAS_NO_BACK'; end if;
  if not exists(select 1 from public.raw_product_colors where id=p_color_id and raw_product_id=p_raw_product_id and status='ACTIVE') then raise exception 'MOCKUP_COLOR_INVALID'; end if;
  if p_area_width<=0 then raise exception 'MOCKUP_AREA_WIDTH_INVALID'; end if;
  area_height:=round((p_area_width*raw_height/raw_width)::numeric,6);
  if p_area_x<0 or p_area_y<0 or p_area_x+p_area_width>1 or p_area_y+area_height>1 then raise exception 'MOCKUP_AREA_OUT_OF_BOUNDS'; end if;
  if p_rotation_degrees not between -180 and 180 then raise exception 'MOCKUP_ROTATION_INVALID'; end if;
  if p_perspective_points is not null and (jsonb_typeof(p_perspective_points)<>'array' or jsonb_array_length(p_perspective_points)<>8) then raise exception 'MOCKUP_PERSPECTIVE_INVALID'; end if;
  background_id:=coalesce(p_background_file_id,(select view.background_file_id from public.raw_product_mockup_views view where view.mockup_id=p_id));
  if background_id is null then raise exception 'MOCKUP_IMAGE_REQUIRED'; end if;
  insert into public.raw_product_mockups(id,raw_product_id,name,side,color_id,gender,status,created_by,needs_alignment) values(p_id,p_raw_product_id,trim(p_name),p_side,p_color_id,p_gender,'ACTIVE',p_actor_id,false) on conflict(id) do update set name=excluded.name,color_id=excluded.color_id,gender=excluded.gender,status='ACTIVE',needs_alignment=false,updated_at=now();
  insert into public.raw_product_mockup_views(mockup_id,side,background_file_id,area_x,area_y,area_width,area_height,rotation_degrees,perspective_points,artwork_clip) values(p_id,p_side,background_id,p_area_x,p_area_y,p_area_width,area_height,p_rotation_degrees,p_perspective_points,p_artwork_clip) on conflict(mockup_id) do update set side=excluded.side,background_file_id=excluded.background_file_id,area_x=excluded.area_x,area_y=excluded.area_y,area_width=excluded.area_width,area_height=excluded.area_height,rotation_degrees=excluded.rotation_degrees,perspective_points=excluded.perspective_points,artwork_clip=excluded.artwork_clip,updated_at=now();
  return p_id;
end $$;

revoke all on function public.service_upsert_raw_product_mockup(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.service_upsert_raw_product_mockup(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,uuid,text,jsonb,text) to service_role;
