alter table public.supplier_profiles
  add column if not exists banner_file_id uuid references public.storage_files(id) on delete set null;

create or replace function public.provision_supplier(p_user_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org_id uuid:=gen_random_uuid();
  v_facility_id uuid:=gen_random_uuid();
  v_slug text:='supplier-'||substr(v_org_id::text,1,8);
  v_display_name text:=trim(p_payload->>'displayName');
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and session_user not in ('postgres','supabase_admin') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'PROFILE_NOT_FOUND'; end if;
  if coalesce(v_display_name,'')='' then raise exception 'SUPPLIER_NAME_REQUIRED'; end if;
  if exists(select 1 from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=p_user_id and o.type='SUPPLIER') then
    raise exception 'SUPPLIER_ALREADY_PROVISIONED';
  end if;

  insert into public.organizations(
    id,type,legal_name,display_name,slug,status,contact_email,contact_phone,
    website_url,description,national_id,registration_number
  ) values(
    v_org_id,'SUPPLIER',coalesce(nullif(trim(p_payload->>'legalName'),''),v_display_name),v_display_name,v_slug,'ACTIVE',
    (select email from public.profiles where id=p_user_id),nullif(trim(p_payload->>'phone'),''),
    nullif(trim(p_payload->>'website'),''),nullif(trim(p_payload->>'description'),''),
    nullif(trim(p_payload->>'nationalId'),''),nullif(trim(p_payload->>'registrationNumber'),'')
  );
  insert into public.memberships(user_id,organization_id,role,status) values(p_user_id,v_org_id,'OWNER','ACTIVE');
  insert into public.supplier_profiles(
    organization_id,owner_user_id,national_id,registration_number,capacity_per_day,lead_time_days,approval_mode,status
  ) values(
    v_org_id,p_user_id,nullif(trim(p_payload->>'nationalId'),''),nullif(trim(p_payload->>'registrationNumber'),''),
    greatest(0,coalesce(nullif(p_payload->>'capacityPerDay','')::integer,0)),
    greatest(1,coalesce(nullif(p_payload->>'leadTimeDays','')::integer,1)),'AUTO','APPROVED'
  );
  insert into public.facilities(id,organization_id,name,city,address,postal_code,phone,status)
  values(v_facility_id,v_org_id,'مرکز '||v_display_name,trim(p_payload->>'city'),trim(p_payload->>'address'),
    nullif(trim(p_payload->>'postalCode'),''),nullif(trim(p_payload->>'phone'),''),'ACTIVE');

  insert into public.supplier_print_methods(supplier_organization_id,print_method_id)
  select v_org_id,value::uuid from jsonb_array_elements_text(coalesce(p_payload->'methodIds','[]'::jsonb))
  where exists(select 1 from public.print_methods pm where pm.id=value::uuid and pm.status='ACTIVE')
  on conflict do nothing;
  insert into public.supplier_category_capabilities(supplier_organization_id,category_id)
  select v_org_id,value::uuid from jsonb_array_elements_text(coalesce(p_payload->'categoryIds','[]'::jsonb))
  where exists(select 1 from public.categories c where c.id=value::uuid and c.status='ACTIVE')
  on conflict do nothing;

  if nullif(trim(p_payload->>'cardNumber'),'') is not null or nullif(trim(p_payload->>'iban'),'') is not null then
    insert into public.bank_accounts(organization_id,bank_name,card_number,iban,priority,status,account_holder_name)
    values(v_org_id,nullif(trim(p_payload->>'bankName'),''),nullif(trim(p_payload->>'cardNumber'),''),
      nullif(trim(p_payload->>'iban'),''),1,'ACTIVE',coalesce(nullif(trim(p_payload->>'legalName'),''),v_display_name));
  end if;
  insert into public.balance_projections(organization_id) values(v_org_id) on conflict(organization_id) do nothing;
  insert into public.ai_credit_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
  update public.profiles set primary_role='SUPPLIER',updated_at=now() where id=p_user_id;
  return jsonb_build_object('organizationId',v_org_id,'facilityId',v_facility_id,'userId',p_user_id);
end
$$;
