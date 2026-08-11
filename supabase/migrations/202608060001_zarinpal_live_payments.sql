-- Guest checkout historically marked orders paid for the simulated gateway.
-- Keep that behavior for development, but expose a service-only pending variant
-- for real gateways. Everything runs in one transaction, so no paid state leaks.
alter type public.order_state add value if not exists 'PENDING' before 'CONFIRMED';

create or replace function public.service_guest_checkout_create_pending_order(
  p_idempotency_key text,
  p_address jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_order_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    and session_user not in ('postgres','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  v_order_id:=public.service_guest_checkout_create_order(
    p_idempotency_key,
    p_address,
    p_items
  );

  if not exists(
    select 1 from public.payments
    where order_id=v_order_id and status='CAPTURED' and provider<>'WALLET'
  ) then
    update public.orders set paid_at=null,status='PENDING' where id=v_order_id;
    delete from public.earnings
    where order_id=v_order_id and status='PENDING';
  end if;
  return v_order_id;
end
$$;

revoke all on function public.service_guest_checkout_create_pending_order(text,jsonb,jsonb)
from public,anon,authenticated;
grant execute on function public.service_guest_checkout_create_pending_order(text,jsonb,jsonb)
to service_role;

-- Payment capture and order activation must be one database transaction. This
-- also repairs the state safely if the HTTP callback is delivered repeatedly.
create or replace function public.confirm_pending_order_when_paid()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.paid_at is null and new.paid_at is not null and new.status='PENDING' then
    new.status:='CONFIRMED';
  end if;
  return new;
end
$$;

drop trigger if exists orders_confirm_pending_when_paid on public.orders;
create trigger orders_confirm_pending_when_paid
before update of paid_at on public.orders
for each row execute function public.confirm_pending_order_when_paid();
