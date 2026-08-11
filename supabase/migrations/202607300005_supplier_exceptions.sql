-- Supplier fulfilment exception/escalation workflow.

create table if not exists public.fulfilment_exceptions (
  id uuid primary key default gen_random_uuid(),
  fulfilment_id uuid not null references public.fulfilments(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  exception_type text not null check(exception_type in (
    'CANNOT_SUPPLY','DAMAGED_PRINT','FILE_ISSUE','CAPACITY',
    'CANCELLATION','RETURN','OTHER'
  )),
  description text not null check(length(description) between 10 and 2000),
  status text not null default 'OPEN'
    check(status in ('OPEN','ACKNOWLEDGED','RESOLVED','REJECTED')),
  resolution text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists fulfilment_exceptions_fulfilment_idx
  on public.fulfilment_exceptions(fulfilment_id);
create index if not exists fulfilment_exceptions_supplier_idx
  on public.fulfilment_exceptions(supplier_organization_id);
create index if not exists fulfilment_exceptions_reporter_idx
  on public.fulfilment_exceptions(reported_by);
create index if not exists fulfilment_exceptions_reviewer_idx
  on public.fulfilment_exceptions(reviewed_by);
create index if not exists fulfilment_exceptions_open_idx
  on public.fulfilment_exceptions(created_at)
  where status in ('OPEN','ACKNOWLEDGED');

alter table public.fulfilment_exceptions enable row level security;
drop policy if exists fulfilment_exceptions_admin_all on public.fulfilment_exceptions;
create policy fulfilment_exceptions_admin_all on public.fulfilment_exceptions
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists fulfilment_exceptions_supplier_read on public.fulfilment_exceptions;
create policy fulfilment_exceptions_supplier_read on public.fulfilment_exceptions
  for select to authenticated using(
    public.is_org_member(supplier_organization_id)
  );
revoke all on public.fulfilment_exceptions from anon,authenticated;
grant select on public.fulfilment_exceptions to authenticated;

drop trigger if exists trg_fulfilment_exceptions_updated on public.fulfilment_exceptions;
create trigger trg_fulfilment_exceptions_updated before update
  on public.fulfilment_exceptions for each row execute function public.touch_updated_at();
drop trigger if exists trg_fulfilment_exceptions_audit on public.fulfilment_exceptions;
create trigger trg_fulfilment_exceptions_audit after insert or update or delete
  on public.fulfilment_exceptions for each row execute function public.audit_sensitive_mutation();

create or replace function public.report_fulfilment_exception(
  p_fulfilment_id uuid,
  p_exception_type text,
  p_description text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_supplier uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_exception_type not in (
    'CANNOT_SUPPLY','DAMAGED_PRINT','FILE_ISSUE','CAPACITY',
    'CANCELLATION','RETURN','OTHER'
  ) or length(trim(coalesce(p_description,''))) not between 10 and 2000 then
    raise exception 'INVALID_EXCEPTION_DETAILS';
  end if;
  if not public.consume_user_rate_limit('fulfilment:exception',10,600) then
    raise exception 'RATE_LIMIT_EXCEEDED';
  end if;
  select supplier_organization_id into v_supplier
    from public.fulfilments
    where id=p_fulfilment_id and status not in ('DONE','CANCELLED')
    for update;
  if v_supplier is null or not public.is_org_member(v_supplier) then
    raise exception 'FULFILMENT_NOT_ASSIGNED' using errcode='42501';
  end if;
  select id into v_id from public.fulfilment_exceptions
    where idempotency_key=p_idempotency_key and reported_by=v_user;
  if v_id is not null then return v_id; end if;
  insert into public.fulfilment_exceptions(
    fulfilment_id,supplier_organization_id,reported_by,exception_type,
    description,idempotency_key
  ) values(
    p_fulfilment_id,v_supplier,v_user,p_exception_type,
    trim(p_description),p_idempotency_key
  ) returning id into v_id;
  insert into public.notification_outbox(
    event_type,payload,idempotency_key
  ) values(
    'FULFILMENT_EXCEPTION',
    jsonb_build_object(
      'exceptionId',v_id,'fulfilmentId',p_fulfilment_id,
      'supplierOrganizationId',v_supplier,'type',p_exception_type
    ),
    'fulfilment-exception:'||v_id
  ) on conflict(idempotency_key) do nothing;
  return v_id;
exception when unique_violation then
  select id into v_id from public.fulfilment_exceptions
    where idempotency_key=p_idempotency_key and reported_by=v_user;
  if v_id is null then raise; end if;
  return v_id;
end
$$;
revoke all on function public.report_fulfilment_exception(uuid,text,text,text)
  from public,anon;
grant execute on function public.report_fulfilment_exception(uuid,text,text,text)
  to authenticated;

create or replace function public.review_fulfilment_exception(
  p_exception_id uuid,
  p_status text,
  p_resolution text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_row public.fulfilment_exceptions%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_status not in ('ACKNOWLEDGED','RESOLVED','REJECTED') then
    raise exception 'INVALID_EXCEPTION_STATUS';
  end if;
  if p_status in ('RESOLVED','REJECTED') and length(trim(coalesce(p_resolution,'')))<5 then
    raise exception 'RESOLUTION_REQUIRED';
  end if;
  select * into v_row from public.fulfilment_exceptions
    where id=p_exception_id for update;
  if v_row.id is null then raise exception 'EXCEPTION_NOT_FOUND'; end if;
  if v_row.status in ('RESOLVED','REJECTED') then
    raise exception 'EXCEPTION_ALREADY_CLOSED';
  end if;
  update public.fulfilment_exceptions set
    status=p_status,resolution=nullif(trim(p_resolution),''),
    reviewed_by=auth.uid(),reviewed_at=now(),
    resolved_at=case when p_status in ('RESOLVED','REJECTED') then now() else null end,
    updated_at=now()
  where id=p_exception_id;
  return p_exception_id;
end
$$;
revoke all on function public.review_fulfilment_exception(uuid,text,text)
  from public,anon;
grant execute on function public.review_fulfilment_exception(uuid,text,text)
  to authenticated;
