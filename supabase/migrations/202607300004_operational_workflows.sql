-- Operational workflow completion: database-backed carts, abuse controls,
-- exception review operations, notifications, and reconciliation surfaces.

create table if not exists public.rate_limit_counters (
  identity_hash text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check(request_count > 0),
  expires_at timestamptz not null,
  primary key(identity_hash,action,window_started_at)
);
create index if not exists rate_limit_counters_expiry_idx
  on public.rate_limit_counters(expires_at);
alter table public.rate_limit_counters enable row level security;
drop policy if exists rate_limit_counters_admin_read on public.rate_limit_counters;
create policy rate_limit_counters_admin_read on public.rate_limit_counters
  for select to authenticated using(public.is_admin());
revoke all on public.rate_limit_counters from anon,authenticated;
grant select on public.rate_limit_counters to authenticated;

create or replace function public.consume_user_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_identity text;
  v_window timestamptz;
  v_count integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_action !~ '^[a-z0-9:_-]{3,80}$' or
     p_limit not between 1 and 1000 or
     p_window_seconds not between 10 and 86400 then
    raise exception 'INVALID_RATE_LIMIT_CONFIGURATION';
  end if;
  v_identity:=encode(digest(v_user::text,'sha256'),'hex');
  v_window:=to_timestamp(
    floor(extract(epoch from clock_timestamp())/p_window_seconds)*p_window_seconds
  );
  insert into public.rate_limit_counters(
    identity_hash,action,window_started_at,request_count,expires_at
  ) values(
    v_identity,p_action,v_window,1,v_window+make_interval(secs=>p_window_seconds*2)
  )
  on conflict(identity_hash,action,window_started_at)
  do update set request_count=public.rate_limit_counters.request_count+1
  returning request_count into v_count;
  return v_count<=p_limit;
end
$$;
revoke all on function public.consume_user_rate_limit(text,integer,integer)
  from public,anon;
grant execute on function public.consume_user_rate_limit(text,integer,integer)
  to authenticated;

create or replace function public.enforce_exception_rate_limit()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.consume_user_rate_limit(
    'exception:'||tg_table_name,10,600
  ) then
    raise exception 'RATE_LIMIT_EXCEEDED' using errcode='P0001';
  end if;
  return new;
end
$$;
do $$
declare t text;
begin
  foreach t in array array['order_cancellations','return_requests','disputes']
  loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_rate_limit',t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.enforce_exception_rate_limit()',
      'trg_'||t||'_rate_limit',t
    );
  end loop;
end
$$;

create or replace function public.sync_buyer_cart(p_items jsonb)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_cart uuid;
  v_item jsonb;
  v_variant uuid;
  v_quantity integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.consume_user_rate_limit('cart:sync',120,60) then
    raise exception 'RATE_LIMIT_EXCEEDED';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or
     jsonb_array_length(coalesce(p_items,'[]'::jsonb))>100 then
    raise exception 'INVALID_CART';
  end if;
  select id into v_cart from public.carts
    where buyer_user_id=v_user and status='ACTIVE' for update;
  if v_cart is null then
    insert into public.carts(buyer_user_id,status)
      values(v_user,'ACTIVE') returning id into v_cart;
  end if;
  create temporary table if not exists pg_temp.cart_sync_items(
    variant_id uuid primary key,
    quantity integer not null
  ) on commit drop;
  truncate pg_temp.cart_sync_items;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
  loop
    begin
      v_variant:=(v_item->>'variantId')::uuid;
      v_quantity:=(v_item->>'quantity')::integer;
    exception when others then
      raise exception 'INVALID_CART_ITEM';
    end;
    if v_quantity not between 1 and 99 or not exists(
      select 1 from public.seller_product_variants spv
      join public.seller_products sp on sp.id=spv.seller_product_id
      where spv.id=v_variant and spv.status='ACTIVE'
        and sp.status='PUBLISHED' and sp.moderation_status='APPROVED'
    ) then raise exception 'UNAVAILABLE_CART_VARIANT'; end if;
    insert into pg_temp.cart_sync_items values(v_variant,v_quantity)
      on conflict(variant_id) do update set quantity=excluded.quantity;
  end loop;
  delete from public.cart_items ci
    where ci.cart_id=v_cart and not exists(
      select 1 from pg_temp.cart_sync_items i
      where i.variant_id=ci.seller_product_variant_id
    );
  insert into public.cart_items(cart_id,seller_product_variant_id,quantity)
    select v_cart,variant_id,quantity from pg_temp.cart_sync_items
    on conflict(cart_id,seller_product_variant_id)
    do update set quantity=excluded.quantity,updated_at=now();
  update public.carts set updated_at=now(),expires_at=now()+interval '30 days'
    where id=v_cart;
  return v_cart;
end
$$;
revoke all on function public.sync_buyer_cart(jsonb) from public,anon;
grant execute on function public.sync_buyer_cart(jsonb) to authenticated;

create or replace function public.review_order_cancellation(
  p_request_id uuid,
  p_approve boolean,
  p_message text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_request public.order_cancellations%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_request from public.order_cancellations
    where id=p_request_id for update;
  if v_request.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_request.status<>'REQUESTED' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  update public.order_cancellations set
    status=case when p_approve then 'APPROVED' else 'REJECTED' end,
    reviewed_by=auth.uid(),review_message=nullif(trim(p_message),''),
    reviewed_at=now(),updated_at=now()
  where id=p_request_id;
  return p_request_id;
end
$$;

create or replace function public.review_return_request(
  p_request_id uuid,
  p_approve boolean,
  p_message text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_request public.return_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_request from public.return_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_request.status<>'REQUESTED' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  update public.return_requests set
    status=case when p_approve then 'APPROVED' else 'REJECTED' end,
    reviewed_by=auth.uid(),resolution=nullif(trim(p_message),''),
    reviewed_at=now(),updated_at=now()
  where id=p_request_id;
  return p_request_id;
end
$$;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_reject boolean default false
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_dispute public.disputes%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_resolution,'')))<5 then raise exception 'RESOLUTION_REQUIRED'; end if;
  select * into v_dispute from public.disputes where id=p_dispute_id for update;
  if v_dispute.id is null then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if v_dispute.status not in ('OPEN','UNDER_REVIEW') then
    raise exception 'DISPUTE_ALREADY_RESOLVED';
  end if;
  update public.disputes set
    status=case when p_reject then 'REJECTED' else 'RESOLVED' end,
    assigned_to=auth.uid(),resolution=trim(p_resolution),
    resolved_at=now(),updated_at=now()
  where id=p_dispute_id;
  return p_dispute_id;
end
$$;
revoke all on function public.review_order_cancellation(uuid,boolean,text)
  from public,anon;
revoke all on function public.review_return_request(uuid,boolean,text)
  from public,anon;
revoke all on function public.resolve_dispute(uuid,text,boolean)
  from public,anon;
grant execute on function public.review_order_cancellation(uuid,boolean,text)
  to authenticated;
grant execute on function public.review_return_request(uuid,boolean,text)
  to authenticated;
grant execute on function public.resolve_dispute(uuid,text,boolean)
  to authenticated;

create or replace function public.queue_exception_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_recipient uuid; v_event text;
begin
  v_recipient:=coalesce(
    to_jsonb(new)->>'requested_by',
    to_jsonb(new)->>'buyer_user_id',
    to_jsonb(new)->>'opened_by'
  )::uuid;
  v_event:=upper(tg_table_name)||'_'||new.status;
  insert into public.notification_outbox(
    event_type,recipient_user_id,payload,idempotency_key
  ) values(
    v_event,v_recipient,
    jsonb_build_object('recordId',new.id,'status',new.status),
    'exception:'||tg_table_name||':'||new.id||':'||new.status
  ) on conflict(idempotency_key) do nothing;
  return new;
end
$$;
do $$
declare t text;
begin
  foreach t in array array['order_cancellations','return_requests','disputes']
  loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_notification',t);
    execute format(
      'create trigger %I after insert or update of status on public.%I for each row execute function public.queue_exception_notification()',
      'trg_'||t||'_notification',t
    );
  end loop;
end
$$;

create or replace view public.operational_reconciliation as
select 'PAYMENT_TOTAL_MISMATCH'::text issue_type,o.id entity_id,o.number reference,
  jsonb_build_object('orderTotal',o.total,'captured',coalesce(sum(p.amount) filter(where p.status='CAPTURED'),0)) detail
from public.orders o left join public.payments p on p.order_id=o.id
where o.status<>'CANCELLED'
group by o.id,o.number,o.total
having coalesce(sum(p.amount) filter(where p.status='CAPTURED'),0)<>o.total
union all
select 'PAID_PAYOUT_WITHOUT_HISTORY',pr.id,pr.id::text,
  jsonb_build_object('amount',pr.amount,'organizationId',pr.organization_id)
from public.payout_requests pr
where pr.status='PAID' and not exists(
  select 1 from public.payout_payment_history ph where ph.payout_request_id=pr.id
)
union all
select 'ACTIVE_FULFILMENT_WITHOUT_SUPPLIER',f.id,f.id::text,
  jsonb_build_object('orderId',f.order_id,'status',f.status)
from public.fulfilments f
where f.status not in ('DONE','CANCELLED') and f.supplier_organization_id is null;
revoke all on public.operational_reconciliation from public,anon,authenticated;
grant select on public.operational_reconciliation to service_role;

delete from public.rate_limit_counters where expires_at<now();
