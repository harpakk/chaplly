create or replace function public.provision_seller(p_user_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid:=gen_random_uuid();
  v_store_id uuid:=gen_random_uuid();
  v_slug text:=lower(trim(p_payload->>'slug'));
  v_request_role text:=coalesce(
    auth.role(),
    current_setting('request.jwt.claim.role',true),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',
    ''
  );
begin
  if auth.uid() is distinct from p_user_id and v_request_role <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_slug is null or length(v_slug)<2 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug)>80 then
    raise exception 'INVALID_STORE_SLUG';
  end if;
  if exists(select 1 from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=p_user_id and o.type='SELLER') then
    raise exception 'SELLER_ALREADY_PROVISIONED';
  end if;

  insert into public.organizations(
    id,type,legal_name,display_name,slug,status,contact_email,contact_phone,website_url,description
  ) values(
    v_org_id,'SELLER',coalesce(nullif(p_payload->>'legalName',''),p_payload->>'storeName'),
    p_payload->>'storeName','seller-'||v_slug,'ACTIVE',
    coalesce(nullif(p_payload->>'supportEmail',''),(select email from public.profiles where id=p_user_id)),
    coalesce(nullif(p_payload->>'supportPhone',''),(select phone from public.profiles where id=p_user_id)),
    nullif(p_payload->>'websiteUrl',''),nullif(p_payload->>'storeDescription','')
  );
  insert into public.memberships(user_id,organization_id,role,status) values(p_user_id,v_org_id,'OWNER','ACTIVE');
  insert into public.stores(
    id,organization_id,owner_user_id,name,slug,status,description,primary_category,
    support_email,support_phone,social_url,brand_color,brand_tone
  ) values(
    v_store_id,v_org_id,p_user_id,p_payload->>'storeName',v_slug,'ACTIVE',
    p_payload->>'storeDescription',nullif(p_payload->>'primaryCategory',''),
    coalesce(nullif(p_payload->>'supportEmail',''),(select email from public.profiles where id=p_user_id)),
    coalesce(nullif(p_payload->>'supportPhone',''),(select phone from public.profiles where id=p_user_id)),
    null,coalesce(nullif(p_payload->>'brandColor',''),'#ef5b4c'),nullif(p_payload->>'brandTone','')
  );
  insert into public.seller_profiles(
    organization_id,owner_user_id,seller_type,experience_level,instagram_handle,audience_size,monthly_views,goal
  ) values(
    v_org_id,p_user_id,nullif(p_payload->>'sellerType',''),nullif(p_payload->>'experienceLevel',''),
    nullif(p_payload->>'instagramHandle',''),nullif(p_payload->>'audienceSize','')::integer,
    nullif(p_payload->>'monthlyViews','')::bigint,null
  );
  insert into public.balance_projections(organization_id) values(v_org_id) on conflict(organization_id) do nothing;
  insert into public.ai_credit_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
  update public.profiles set primary_role='SELLER',updated_at=now() where id=p_user_id;
  return jsonb_build_object('organizationId',v_org_id,'storeId',v_store_id,'userId',p_user_id);
end $$;

revoke all on function public.provision_seller(uuid,jsonb) from public,anon;
grant execute on function public.provision_seller(uuid,jsonb) to authenticated,service_role;
