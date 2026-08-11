-- Save the seller-facing mockup attributes in the same transaction as the
-- image and placement. This prevents a new/edited mockup from briefly or
-- permanently losing its color when the follow-up update fails.
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
  p_actor_id uuid,
  p_color_id uuid,
  p_gender text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_gender not in ('MALE','FEMALE','UNISEX') then
    raise exception 'MOCKUP_GENDER_INVALID';
  end if;
  if not exists(
    select 1 from public.raw_product_colors
    where id=p_color_id and raw_product_id=p_raw_product_id and status='ACTIVE'
  ) then
    raise exception 'MOCKUP_COLOR_INVALID';
  end if;

  perform public.service_upsert_raw_product_mockup(
    p_id,p_raw_product_id,p_name,p_side,p_background_file_id,p_area_x,p_area_y,
    p_area_width,p_rotation_degrees,p_actor_id
  );
  update public.raw_product_mockups
    set color_id=p_color_id,gender=p_gender,updated_at=now()
    where id=p_id;
  return p_id;
end
$$;

revoke all on function public.service_upsert_raw_product_mockup(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.service_upsert_raw_product_mockup(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,uuid,text)
to service_role;
