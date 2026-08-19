create or replace function public.service_approve_all_pending_products(
  p_actor_id uuid
) returns integer
language plpgsql security definer set search_path=public as $$
declare
  v_product record;
  v_count integer := 0;
begin
  perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role','service_role')::text,true);

  for v_product in
    select seller_product_id
    from public.product_moderation_queue
    where status = 'PENDING'
    group by seller_product_id
  loop
    perform public.moderate_product(
      v_product.seller_product_id,
      'APPROVED'::public.moderation_state,
      null,
      null
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

revoke all on function public.service_approve_all_pending_products(uuid) from public,anon,authenticated;
grant execute on function public.service_approve_all_pending_products(uuid) to service_role;
notify pgrst, 'reload schema';
