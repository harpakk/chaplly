-- Production integrity: exception workflows, delivery/audit infrastructure,
-- optional supplier assignment, optimistic versions and missing FK indexes.

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null,
  provider_attempt_id text,
  idempotency_key text not null unique,
  amount bigint not null check(amount > 0),
  currency text not null default 'IRR' check(currency='IRR'),
  status text not null default 'CREATED'
    check(status in ('CREATED','PENDING','AUTHORIZED','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_attempt_id)
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  requested_by uuid references public.profiles(id) on delete set null,
  processed_by uuid references public.profiles(id) on delete set null,
  amount bigint not null check(amount > 0),
  currency text not null default 'IRR' check(currency='IRR'),
  reason text not null,
  status text not null default 'REQUESTED'
    check(status in ('REQUESTED','APPROVED','PROCESSING','SUCCEEDED','FAILED','REJECTED','CANCELLED')),
  idempotency_key text not null unique,
  provider_ref text unique,
  provider_response jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.order_cancellations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'REQUESTED'
    check(status in ('REQUESTED','APPROVED','REJECTED','COMPLETED','CANCELLED')),
  idempotency_key text not null unique,
  review_message text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists order_cancellations_one_active_idx
  on public.order_cancellations(order_id)
  where status in ('REQUESTED','APPROVED');

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  description text,
  status text not null default 'REQUESTED'
    check(status in ('REQUESTED','APPROVED','REJECTED','IN_TRANSIT','RECEIVED','RESOLVED','CANCELLED')),
  idempotency_key text not null unique,
  return_tracking_code text,
  resolution text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  received_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists return_requests_one_active_idx
  on public.return_requests(order_item_id)
  where status in ('REQUESTED','APPROVED','IN_TRANSIT','RECEIVED');

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  reason text not null,
  description text not null,
  status text not null default 'OPEN'
    check(status in ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED','CLOSED')),
  idempotency_key text not null unique,
  resolution text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.reprints (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  original_fulfilment_id uuid not null references public.fulfilments(id) on delete restrict,
  replacement_fulfilment_id uuid references public.fulfilments(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'REQUESTED'
    check(status in ('REQUESTED','APPROVED','IN_PRODUCTION','SENT','DONE','REJECTED','CANCELLED')),
  idempotency_key text not null unique,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_assignment_events (
  id uuid primary key default gen_random_uuid(),
  fulfilment_id uuid not null references public.fulfilments(id) on delete cascade,
  from_supplier_organization_id uuid references public.organizations(id) on delete restrict,
  to_supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  from_supplier_offer_id uuid references public.supplier_offers(id) on delete restrict,
  to_supplier_offer_id uuid not null references public.supplier_offers(id) on delete restrict,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  idempotency_key text not null unique,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_variant_availability_events (
  id uuid primary key default gen_random_uuid(),
  supplier_offer_variant_id uuid not null references public.supplier_offer_variants(id) on delete cascade,
  from_status text,
  to_status text not null
    check(to_status in ('AVAILABLE','LOW_STOCK','OUT_OF_STOCK','PAUSED')),
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  hostname text not null,
  domain_type text not null default 'SUBDOMAIN'
    check(domain_type in ('SUBDOMAIN','CUSTOM')),
  status text not null default 'PENDING'
    check(status in ('PENDING','VERIFYING','ACTIVE','FAILED','REMOVED')),
  verification_token text not null default encode(gen_random_bytes(24),'hex'),
  verification_records jsonb not null default '[]'::jsonb,
  certificate_status text not null default 'PENDING'
    check(certificate_status in ('PENDING','ISSUING','ACTIVE','FAILED','REVOKED')),
  verified_at timestamptz,
  activated_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(hostname=lower(hostname) and hostname ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$')
);

create unique index if not exists store_domains_hostname_lower_idx
  on public.store_domains(lower(hostname));
create unique index if not exists store_domains_one_active_idx
  on public.store_domains(store_id)
  where status='ACTIVE';

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  channel text not null check(channel in ('IN_APP','SMS','EMAIL','PUSH')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,event_type,channel)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  channel text not null check(channel in ('IN_APP','SMS','EMAIL','PUSH')),
  provider text not null,
  provider_message_id text,
  attempt_number integer not null check(attempt_number > 0),
  status text not null default 'PENDING'
    check(status in ('PENDING','SENT','DELIVERED','FAILED','BOUNCED','CANCELLED')),
  provider_response jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(outbox_id,channel,attempt_number),
  unique(provider,provider_message_id)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  status text not null default 'RECEIVED'
    check(status in ('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED','DEAD_LETTER')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check(attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_hash text,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  consent_state text not null default 'ESSENTIAL'
    check(consent_state in ('ESSENTIAL','ANALYTICS','MARKETING','DENIED')),
  properties jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  release_version text,
  check(user_id is not null or anonymous_session_hash is not null)
);

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  commit_sha text not null,
  migration_version text,
  environment text not null check(environment in ('TEST','STAGING','PRODUCTION')),
  status text not null default 'DEPLOYING'
    check(status in ('DEPLOYING','ACTIVE','FAILED','ROLLED_BACK')),
  metadata jsonb not null default '{}'::jsonb,
  deployed_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(environment,version),
  unique(environment,commit_sha)
);

alter table public.stores add column if not exists version integer not null default 1;
alter table public.raw_products add column if not exists version integer not null default 1;
alter table public.designs add column if not exists version integer not null default 1;
alter table public.seller_products add column if not exists version integer not null default 1;

create or replace function public.bump_record_version()
returns trigger language plpgsql set search_path=public as $$
begin
  new.version:=old.version+1;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['stores','raw_products','designs','seller_products']
  loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_version',t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.bump_record_version()',
      'trg_'||t||'_version',t
    );
  end loop;
end
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'payment_attempts','refunds','order_cancellations','return_requests',
    'disputes','reprints','store_domains','notification_preferences',
    'webhook_events'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_updated',t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'trg_'||t||'_updated',t
    );
  end loop;
end
$$;

create or replace function public.validate_exception_transition()
returns trigger language plpgsql set search_path=public as $$
declare allowed boolean:=false;
begin
  if new.status=old.status then return new; end if;
  allowed:=case tg_table_name
    when 'refunds' then
      (old.status='REQUESTED' and new.status in ('APPROVED','REJECTED','CANCELLED')) or
      (old.status='APPROVED' and new.status in ('PROCESSING','CANCELLED')) or
      (old.status='PROCESSING' and new.status in ('SUCCEEDED','FAILED')) or
      (old.status='FAILED' and new.status in ('PROCESSING','CANCELLED'))
    when 'order_cancellations' then
      (old.status='REQUESTED' and new.status in ('APPROVED','REJECTED','CANCELLED')) or
      (old.status='APPROVED' and new.status in ('COMPLETED','CANCELLED'))
    when 'return_requests' then
      (old.status='REQUESTED' and new.status in ('APPROVED','REJECTED','CANCELLED')) or
      (old.status='APPROVED' and new.status in ('IN_TRANSIT','RECEIVED','RESOLVED','CANCELLED')) or
      (old.status='IN_TRANSIT' and new.status='RECEIVED') or
      (old.status='RECEIVED' and new.status='RESOLVED')
    when 'disputes' then
      (old.status='OPEN' and new.status in ('UNDER_REVIEW','REJECTED','CLOSED')) or
      (old.status='UNDER_REVIEW' and new.status in ('RESOLVED','REJECTED','CLOSED')) or
      (old.status in ('RESOLVED','REJECTED') and new.status='CLOSED')
    when 'reprints' then
      (old.status='REQUESTED' and new.status in ('APPROVED','REJECTED','CANCELLED')) or
      (old.status='APPROVED' and new.status in ('IN_PRODUCTION','CANCELLED')) or
      (old.status='IN_PRODUCTION' and new.status='SENT') or
      (old.status='SENT' and new.status='DONE')
    else true
  end;
  if not allowed then
    raise exception 'INVALID_%_TRANSITION_%_TO_%',
      upper(tg_table_name),old.status,new.status using errcode='23514';
  end if;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'refunds','order_cancellations','return_requests','disputes','reprints'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_transition',t);
    execute format(
      'create trigger %I before update of status on public.%I for each row execute function public.validate_exception_transition()',
      'trg_'||t||'_transition',t
    );
  end loop;
end
$$;

create or replace function public.audit_sensitive_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
declare target text;
begin
  target:=coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id');
  insert into public.audit_events(
    actor_type,actor_id,action,target_type,target_id,before_data,after_data
  ) values(
    case when auth.uid() is null then 'SERVICE' else 'USER' end,
    auth.uid()::text,
    tg_op,
    tg_table_name,
    target,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    case when tg_op='DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new,old);
end
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'refunds','order_cancellations','return_requests','disputes','reprints',
    'supplier_assignment_events'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_audit',t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_sensitive_mutation()',
      'trg_'||t||'_audit',t
    );
  end loop;
end
$$;

create or replace function public.request_order_cancellation(
  p_order_id uuid,
  p_reason text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_state public.order_state;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select id into v_id from public.order_cancellations
    where idempotency_key=p_idempotency_key and requested_by=v_user;
  if v_id is not null then return v_id; end if;
  select status into v_state from public.orders
    where id=p_order_id and buyer_user_id=v_user for update;
  if v_state is null then raise exception 'ORDER_NOT_FOUND' using errcode='42501'; end if;
  if v_state in ('DONE','CANCELLED','RETURNED') then raise exception 'ORDER_NOT_CANCELLABLE'; end if;
  insert into public.order_cancellations(order_id,requested_by,reason,idempotency_key)
    values(p_order_id,v_user,trim(p_reason),p_idempotency_key) returning id into v_id;
  return v_id;
exception when unique_violation then
  select id into v_id from public.order_cancellations
    where idempotency_key=p_idempotency_key and requested_by=v_user;
  if v_id is null then raise; end if;
  return v_id;
end
$$;

create or replace function public.request_return(
  p_order_item_id uuid,
  p_reason text,
  p_description text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_state public.order_state;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'REASON_REQUIRED'; end if;
  select rr.id into v_id from public.return_requests rr
    where rr.idempotency_key=p_idempotency_key and rr.buyer_user_id=v_user;
  if v_id is not null then return v_id; end if;
  select o.status into v_state
    from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.id=p_order_item_id and o.buyer_user_id=v_user for share of oi,o;
  if v_state is null then raise exception 'ORDER_ITEM_NOT_FOUND' using errcode='42501'; end if;
  if v_state not in ('SENT','DONE','RETURNED','DISPUTED') then
    raise exception 'RETURN_NOT_AVAILABLE';
  end if;
  insert into public.return_requests(
    order_item_id,buyer_user_id,reason,description,idempotency_key
  ) values(
    p_order_item_id,v_user,trim(p_reason),nullif(trim(p_description),''),p_idempotency_key
  ) returning id into v_id;
  return v_id;
exception when unique_violation then
  select id into v_id from public.return_requests
    where idempotency_key=p_idempotency_key and buyer_user_id=v_user;
  if v_id is null then raise; end if;
  return v_id;
end
$$;

create or replace function public.open_dispute(
  p_order_id uuid,
  p_order_item_id uuid,
  p_reason text,
  p_description text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<3 or
     length(trim(coalesce(p_description,'')))<10 then
    raise exception 'DISPUTE_DETAILS_REQUIRED';
  end if;
  select id into v_id from public.disputes
    where idempotency_key=p_idempotency_key and opened_by=v_user;
  if v_id is not null then return v_id; end if;
  if not exists(
    select 1 from public.orders o
    where o.id=p_order_id and o.buyer_user_id=v_user
  ) then raise exception 'ORDER_NOT_FOUND' using errcode='42501'; end if;
  if p_order_item_id is not null and not exists(
    select 1 from public.order_items
    where id=p_order_item_id and order_id=p_order_id
  ) then raise exception 'ORDER_ITEM_MISMATCH'; end if;
  insert into public.disputes(
    order_id,order_item_id,opened_by,reason,description,idempotency_key
  ) values(
    p_order_id,p_order_item_id,v_user,trim(p_reason),trim(p_description),p_idempotency_key
  ) returning id into v_id;
  update public.orders set status='DISPUTED',updated_at=now()
    where id=p_order_id and status not in ('CANCELLED','RETURNED');
  return v_id;
exception when unique_violation then
  select id into v_id from public.disputes
    where idempotency_key=p_idempotency_key and opened_by=v_user;
  if v_id is null then raise; end if;
  return v_id;
end
$$;

create or replace function public.assign_supplier_to_product(
  p_product_id uuid,
  p_primary_offer_id uuid,
  p_backup_offer_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_raw uuid; v_store uuid; v_variant record; v_primary_variant uuid; v_backup_variant uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select raw_product_id,store_id into v_raw,v_store
    from public.seller_products where id=p_product_id for update;
  if v_raw is null or not(public.can_manage_store(v_store) or public.is_admin()) then
    raise exception 'PRODUCT_NOT_OWNED' using errcode='42501';
  end if;
  if p_primary_offer_id is not null and not exists(
    select 1 from public.supplier_offers
    where id=p_primary_offer_id and raw_product_id=v_raw
      and approval_status='APPROVED' and status='ACTIVE'
  ) then raise exception 'PRIMARY_SUPPLIER_INVALID'; end if;
  if p_backup_offer_id is not null and (
    p_primary_offer_id is null or p_backup_offer_id=p_primary_offer_id or
    not exists(
      select 1 from public.supplier_offers
      where id=p_backup_offer_id and raw_product_id=v_raw
        and approval_status='APPROVED' and status='ACTIVE'
    )
  ) then raise exception 'BACKUP_SUPPLIER_INVALID'; end if;

  for v_variant in
    select id,raw_product_variant_id
    from public.seller_product_variants
    where seller_product_id=p_product_id for update
  loop
    v_primary_variant:=null;
    v_backup_variant:=null;
    if p_primary_offer_id is not null then
      select id into v_primary_variant from public.supplier_offer_variants
        where supplier_offer_id=p_primary_offer_id
          and raw_product_variant_id=v_variant.raw_product_variant_id
          and stock_status in ('AVAILABLE','LOW_STOCK');
      if v_primary_variant is null then
        raise exception 'PRIMARY_SUPPLIER_VARIANT_MISSING';
      end if;
    end if;
    if p_backup_offer_id is not null then
      select id into v_backup_variant from public.supplier_offer_variants
        where supplier_offer_id=p_backup_offer_id
          and raw_product_variant_id=v_variant.raw_product_variant_id
          and stock_status in ('AVAILABLE','LOW_STOCK');
      if v_backup_variant is null then
        raise exception 'BACKUP_SUPPLIER_VARIANT_MISSING';
      end if;
    end if;
    update public.seller_product_variants set
      supplier_offer_variant_id=v_primary_variant,
      backup_supplier_offer_variant_id=v_backup_variant,
      status=case when v_primary_variant is null then 'OUT_OF_STOCK' else 'ACTIVE' end,
      updated_at=now()
    where id=v_variant.id;
  end loop;
  update public.seller_products set
    primary_supplier_offer_id=p_primary_offer_id,
    backup_supplier_offer_id=p_backup_offer_id,
    updated_at=now()
  where id=p_product_id;
  return p_product_id;
end
$$;

create or replace function public.reassign_fulfilment(
  p_fulfilment_id uuid,
  p_supplier_organization_id uuid,
  p_facility_id uuid,
  p_supplier_offer_id uuid,
  p_reason text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_old record;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_old from public.fulfilments where id=p_fulfilment_id for update;
  if v_old.id is null then raise exception 'FULFILMENT_NOT_FOUND'; end if;
  if v_old.status in ('SENT','DONE','RETURNED','CANCELLED') then
    raise exception 'FULFILMENT_NOT_REASSIGNABLE';
  end if;
  if not exists(
    select 1 from public.supplier_offers o
    where o.id=p_supplier_offer_id
      and o.supplier_organization_id=p_supplier_organization_id
      and o.facility_id=p_facility_id
      and o.approval_status='APPROVED' and o.status='ACTIVE'
  ) then raise exception 'SUPPLIER_ASSIGNMENT_INVALID'; end if;
  insert into public.supplier_assignment_events(
    fulfilment_id,from_supplier_organization_id,to_supplier_organization_id,
    from_supplier_offer_id,to_supplier_offer_id,changed_by,reason,
    idempotency_key,snapshot
  ) values(
    p_fulfilment_id,v_old.supplier_organization_id,p_supplier_organization_id,
    v_old.supplier_offer_id,p_supplier_offer_id,auth.uid(),trim(p_reason),
    p_idempotency_key,to_jsonb(v_old)
  ) on conflict(idempotency_key) do nothing;
  update public.fulfilments set
    supplier_organization_id=p_supplier_organization_id,
    facility_id=p_facility_id,
    supplier_offer_id=p_supplier_offer_id,
    assignment_snapshot=jsonb_build_object(
      'offerId',p_supplier_offer_id,'reassignedAt',now(),'reason',trim(p_reason)
    ),
    updated_at=now(),version=version+1
  where id=p_fulfilment_id;
  return p_fulfilment_id;
end
$$;

-- Add a deterministic leading-column index for every public foreign key that
-- does not already have one.
do $$
declare r record; index_name text;
begin
  for r in
    select
      n.nspname schema_name,t.relname table_name,c.conname,
      string_agg(format('%I',a.attname),', ' order by u.ord) columns_sql,
      array_agg(a.attnum::smallint order by u.ord) key_numbers,
      c.conrelid
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    join unnest(c.conkey) with ordinality u(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.attnum
    where c.contype='f' and n.nspname='public'
    group by n.nspname,t.relname,c.conname,c.conrelid,c.conkey
  loop
    if not exists(
      select 1 from pg_index i
      where i.indrelid=r.conrelid
        and (i.indkey::smallint[])[0:cardinality(r.key_numbers)-1]
          @> r.key_numbers
    ) then
      index_name:=left('idx_'||r.table_name||'_'||r.conname,54)
        ||'_'||substr(md5(r.conname),1,8);
      execute format(
        'create index if not exists %I on %I.%I (%s)',
        index_name,r.schema_name,r.table_name,r.columns_sql
      );
    end if;
  end loop;
end
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'payment_attempts','refunds','order_cancellations','return_requests',
    'disputes','reprints','supplier_assignment_events',
    'supplier_variant_availability_events','store_domains',
    'notification_preferences','notification_deliveries','webhook_events',
    'analytics_events','app_releases'
  ]
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format(
      'create policy %I on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',
      'admin_manage_'||t,t
    );
  end loop;
end
$$;

create policy payment_attempts_order_read on public.payment_attempts
  for select to authenticated using(public.can_access_order(order_id));
create policy refunds_order_read on public.refunds
  for select to authenticated using(public.can_access_order(order_id));
create policy cancellations_order_read on public.order_cancellations
  for select to authenticated using(public.can_access_order(order_id));
create policy returns_order_read on public.return_requests
  for select to authenticated using(
    exists(
      select 1 from public.order_items oi
      where oi.id=order_item_id and public.can_access_order(oi.order_id)
    )
  );
create policy disputes_order_read on public.disputes
  for select to authenticated using(public.can_access_order(order_id));
create policy reprints_fulfilment_read on public.reprints
  for select to authenticated using(public.can_access_fulfilment(original_fulfilment_id));
create policy assignment_events_fulfilment_read on public.supplier_assignment_events
  for select to authenticated using(public.can_access_fulfilment(fulfilment_id));
create policy availability_events_supplier_read on public.supplier_variant_availability_events
  for select to authenticated using(
    exists(
      select 1
      from public.supplier_offer_variants sov
      join public.supplier_offers so on so.id=sov.supplier_offer_id
      where sov.id=supplier_offer_variant_id
        and public.is_org_member(so.supplier_organization_id)
    )
  );
create policy store_domains_store_manage on public.store_domains
  for all to authenticated
  using(public.can_manage_store(store_id))
  with check(public.can_manage_store(store_id));
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notification_deliveries_recipient_read on public.notification_deliveries
  for select to authenticated using(
    exists(
      select 1 from public.notification_outbox o
      where o.id=outbox_id and o.recipient_user_id=auth.uid()
    )
  );
create policy analytics_events_insert_anon on public.analytics_events
  for insert to anon with check(user_id is null);
create policy analytics_events_insert_auth on public.analytics_events
  for insert to authenticated with check(user_id is null or user_id=auth.uid());

grant select on public.payment_attempts,public.refunds,
  public.order_cancellations,public.return_requests,public.disputes,
  public.reprints,public.supplier_assignment_events,
  public.supplier_variant_availability_events,public.store_domains,
  public.notification_preferences,public.notification_deliveries,
  public.webhook_events,public.analytics_events,public.app_releases
  to authenticated;
grant insert,update,delete on public.notification_preferences,
  public.store_domains to authenticated;
grant insert on public.analytics_events to anon,authenticated;
grant usage,select on sequence public.analytics_events_id_seq to anon,authenticated;

revoke all on function public.request_order_cancellation(uuid,text,text) from public,anon;
revoke all on function public.request_return(uuid,text,text,text) from public,anon;
revoke all on function public.open_dispute(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.assign_supplier_to_product(uuid,uuid,uuid) from public,anon;
revoke all on function public.reassign_fulfilment(uuid,uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.request_order_cancellation(uuid,text,text) to authenticated;
grant execute on function public.request_return(uuid,text,text,text) to authenticated;
grant execute on function public.open_dispute(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.assign_supplier_to_product(uuid,uuid,uuid) to authenticated;
grant execute on function public.reassign_fulfilment(uuid,uuid,uuid,uuid,text,text) to authenticated;
