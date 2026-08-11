create or replace function public.admin_review_supplier_offer(
  p_offer_id uuid,p_decision text,p_note text default null
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_status text; v_actor uuid:=auth.uid(); v_result uuid;
begin
  if not public.is_admin(v_actor)
     and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and session_user not in ('postgres','supabase_admin') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'INVALID_DECISION'; end if;
  v_status:=case when p_decision='APPROVED' then 'ACTIVE' else 'PAUSED' end;
  update public.supplier_offers set approval_status=p_decision,status=v_status,
    approved_at=case when p_decision='APPROVED' then now() else null end,
    approved_by=case when p_decision='APPROVED' then v_actor else null end,
    notes=nullif(trim(p_note),''),updated_at=now()
  where id=p_offer_id returning id into v_result;
  if v_result is null then raise exception 'OFFER_NOT_FOUND'; end if;
  update public.supplier_offer_variants set stock_status=case
    when p_decision='REJECTED' then 'PAUSED'
    when stock_quantity<=0 then 'OUT_OF_STOCK'
    when stock_quantity<=5 then 'LOW_STOCK'
    else 'AVAILABLE' end,updated_at=now()
  where supplier_offer_id=v_result;
  return v_result;
end
$$;

revoke all on function public.admin_review_supplier_offer(uuid,text,text) from public,anon;
grant execute on function public.admin_review_supplier_offer(uuid,text,text) to authenticated,service_role;
