-- Orders are created as CONFIRMED internally; while every fulfilment is still
-- ASSIGNED this is the buyer-facing pending phase. Once production or shipping
-- starts, cancellation must go through support instead of this command.
create or replace function public.request_order_cancellation(
  p_order_id uuid,
  p_reason text,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
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
  if v_state<>'CONFIRMED' or not exists(
    select 1 from public.fulfilments where order_id=p_order_id
  ) or exists(
    select 1 from public.fulfilments where order_id=p_order_id and status<>'ASSIGNED'
  ) then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
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
