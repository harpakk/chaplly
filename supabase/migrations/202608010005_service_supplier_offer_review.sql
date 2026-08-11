create or replace function public.service_review_supplier_offer(
  p_offer_id uuid,
  p_decision text,
  p_actor_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text;
  v_result uuid;
begin
  -- This command is intentionally service-role only. The application verifies
  -- the interactive admin session before calling it and passes the actor for
  -- the audit foreign key; service-role requests do not carry auth.uid().
  if not exists(select 1 from public.profiles where id=p_actor_id) then
    raise exception 'ADMIN_PROFILE_NOT_FOUND' using errcode='22023';
  end if;
  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'INVALID_DECISION' using errcode='22023';
  end if;

  v_status:=case when p_decision='APPROVED' then 'ACTIVE' else 'PAUSED' end;
  update public.supplier_offers
  set approval_status=p_decision,
      status=v_status,
      approved_at=case when p_decision='APPROVED' then now() else null end,
      approved_by=case when p_decision='APPROVED' then p_actor_id else null end,
      notes=nullif(trim(p_note),''),
      updated_at=now()
  where id=p_offer_id
  returning id into v_result;

  if v_result is null then
    raise exception 'OFFER_NOT_FOUND' using errcode='P0002';
  end if;

  update public.supplier_offer_variants
  set stock_status=case
        when p_decision='REJECTED' then 'PAUSED'
        when stock_quantity<=0 then 'OUT_OF_STOCK'
        when stock_quantity<=5 then 'LOW_STOCK'
        else 'AVAILABLE'
      end,
      updated_at=now()
  where supplier_offer_id=v_result;

  return v_result;
end
$$;

revoke all on function public.service_review_supplier_offer(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.service_review_supplier_offer(uuid,text,uuid,text) to service_role;

