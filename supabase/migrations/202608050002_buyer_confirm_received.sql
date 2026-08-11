-- The buyer confirmation function used transition_fulfilment(), whose actor
-- guard only accepts suppliers/admins and therefore returned FORBIDDEN for the
-- buyer. Validate ownership here and complete the sent fulfilments directly.
create or replace function public.buyer_confirm_order_received(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare r record; v_buyer uuid:=auth.uid();
begin
  if not exists(
    select 1 from public.orders where id=p_order_id and buyer_user_id=v_buyer
  ) then
    raise exception 'ORDER_NOT_FOUND' using errcode='42501';
  end if;
  if exists(
    select 1 from public.fulfilments
    where order_id=p_order_id and status not in ('SENT','DONE')
  ) then
    raise exception 'ORDER_NOT_FULLY_SENT';
  end if;

  for r in
    select id,status::text,version from public.fulfilments
    where order_id=p_order_id and status='SENT' for update
  loop
    update public.fulfilments
      set status='DONE',done_at=now(),auto_complete_at=null,
          version=version+1,updated_at=now()
      where id=r.id;
    insert into public.fulfilment_status_events(
      fulfilment_id,from_status,to_status,actor_type,actor_id,idempotency_key
    ) values(
      r.id,r.status,'DONE','BUYER',v_buyer::text,r.id::text||':BUYER_RECEIVED'
    ) on conflict(idempotency_key) do nothing;
  end loop;
  update public.orders
    set status='DONE',completed_at=coalesce(completed_at,now()),updated_at=now()
    where id=p_order_id;
  return p_order_id;
end
$$;

revoke all on function public.buyer_confirm_order_received(uuid) from public,anon;
grant execute on function public.buyer_confirm_order_received(uuid) to authenticated;
