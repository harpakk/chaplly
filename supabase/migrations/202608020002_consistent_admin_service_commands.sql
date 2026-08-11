create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    coalesce(current_setting('request.jwt.claim.role',true),'')='service_role'
    or coalesce(auth.jwt()->>'role','')='service_role'
    or exists(
      select 1
      from public.admin_profiles a
      join public.profiles p on p.id=a.user_id
      where a.user_id=p_user_id
        and a.is_active
        and a.access_expires_at>now()
        and p.state='ACTIVE'
    )
$$;

create or replace function public.service_upsert_raw_product(
  p_payload jsonb,
  p_actor_id uuid,
  p_color_names text[],
  p_size_names text[],
  p_variant_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',p_actor_id,'role','service_role','aal','aal1')::text,
    true
  );
  v_id:=public.admin_upsert_raw_product(p_payload);

  with colors as (
    update public.raw_product_colors
    set status=case when name=any(p_color_names) then 'ACTIVE' else 'INACTIVE' end
    where raw_product_id=v_id returning id,status
  ), sizes as (
    update public.raw_product_sizes
    set status=case when name=any(p_size_names) then 'ACTIVE' else 'INACTIVE' end
    where raw_product_id=v_id returning id,status
  )
  update public.raw_product_variants variant
  set status=case
    when color.status='ACTIVE' and size.status='ACTIVE'
      and (p_variant_keys is null or (color.name||'::'||size.name)=any(p_variant_keys)) then 'ACTIVE'
    else 'INACTIVE'
  end
  from public.raw_product_colors color,public.raw_product_sizes size
  where variant.raw_product_id=v_id
    and color.id=variant.color_id and size.id=variant.size_id;
  return v_id;
end
$$;

create or replace function public.service_complete_payout(
  p_payout_request_id uuid,
  p_receipt_file_id uuid,
  p_reference text,
  p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);
  return public.complete_payout(p_payout_request_id,p_receipt_file_id,p_reference);
end
$$;

create or replace function public.service_moderate_product(
  p_product_id uuid,
  p_decision public.moderation_state,
  p_rejection_reason_id uuid,
  p_custom_message text,
  p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);
  return public.moderate_product(p_product_id,p_decision,p_rejection_reason_id,p_custom_message);
end
$$;

create or replace function public.service_review_order_cancellation(
  p_request_id uuid,p_approve boolean,p_message text,p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);
  return public.review_order_cancellation(p_request_id,p_approve,p_message);
end
$$;

create or replace function public.service_review_return_request(
  p_request_id uuid,p_approve boolean,p_message text,p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);
  return public.review_return_request(p_request_id,p_approve,p_message);
end
$$;

create or replace function public.service_resolve_dispute(
  p_dispute_id uuid,p_resolution text,p_reject boolean,p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);
  return public.resolve_dispute(p_dispute_id,p_resolution,p_reject);
end
$$;

create or replace function public.service_review_fulfilment_exception(
  p_exception_id uuid,p_status text,p_resolution text,p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);
  return public.review_fulfilment_exception(p_exception_id,p_status,p_resolution);
end
$$;

revoke all on function public.service_upsert_raw_product(jsonb,uuid,text[],text[],text[]) from public,anon,authenticated;
revoke all on function public.service_complete_payout(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.service_moderate_product(uuid,public.moderation_state,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.service_review_order_cancellation(uuid,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.service_review_return_request(uuid,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.service_resolve_dispute(uuid,text,boolean,uuid) from public,anon,authenticated;
revoke all on function public.service_review_fulfilment_exception(uuid,text,text,uuid) from public,anon,authenticated;

grant execute on function public.service_upsert_raw_product(jsonb,uuid,text[],text[],text[]) to service_role;
grant execute on function public.service_complete_payout(uuid,uuid,text,uuid) to service_role;
grant execute on function public.service_moderate_product(uuid,public.moderation_state,uuid,text,uuid) to service_role;
grant execute on function public.service_review_order_cancellation(uuid,boolean,text,uuid) to service_role;
grant execute on function public.service_review_return_request(uuid,boolean,text,uuid) to service_role;
grant execute on function public.service_resolve_dispute(uuid,text,boolean,uuid) to service_role;
grant execute on function public.service_review_fulfilment_exception(uuid,text,text,uuid) to service_role;
