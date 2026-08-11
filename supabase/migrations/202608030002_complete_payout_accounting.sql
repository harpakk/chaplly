-- Complete seller/supplier accounting: pending on payment, release on delivery,
-- exact partial payouts, platform commissions, and buyer delivery confirmation.

alter table public.earnings
  add column if not exists reserved_amount bigint not null default 0,
  add column if not exists paid_amount bigint not null default 0;

alter table public.earnings drop constraint if exists earnings_reserved_amount_check;
alter table public.earnings add constraint earnings_reserved_amount_check
  check(reserved_amount >= 0 and paid_amount >= 0 and reserved_amount + paid_amount <= net_amount);

-- An earning may participate in several partial payouts over its lifetime.
alter table public.payout_request_items drop constraint if exists payout_request_items_earning_id_key;

create or replace function public.create_order_earnings(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record; v_supplier_gross bigint; v_seller_gross bigint;
begin
  if not exists(select 1 from public.orders where id=p_order_id and paid_at is not null) then return; end if;
  for r in
    select oi.*, f.id fulfilment_id, f.supplier_organization_id, fi.quantity fulfilled_quantity
    from public.order_items oi
    join public.fulfilment_items fi on fi.order_item_id=oi.id
    join public.fulfilments f on f.id=fi.fulfilment_id
    where oi.order_id=p_order_id
  loop
    v_supplier_gross:=r.cost_snapshot*r.fulfilled_quantity;
    if not exists(select 1 from public.earnings where beneficiary_organization_id=r.supplier_organization_id and earning_type='SUPPLIER' and order_item_id=r.id) then
      insert into public.earnings(beneficiary_organization_id,earning_type,source_type,source_id,order_id,order_item_id,fulfilment_id,gross_amount,fee_amount,net_amount,status)
      values(r.supplier_organization_id,'SUPPLIER','ORDER_ITEM',r.id,p_order_id,r.id,r.fulfilment_id,
        v_supplier_gross,(v_supplier_gross*7/100),v_supplier_gross-(v_supplier_gross*7/100),'PENDING');
    end if;
    v_seller_gross:=greatest(0,(r.unit_price-r.cost_snapshot)*r.fulfilled_quantity);
    if not exists(select 1 from public.earnings where beneficiary_organization_id=r.seller_organization_id and earning_type='SELLER' and order_item_id=r.id) then
      insert into public.earnings(beneficiary_organization_id,earning_type,source_type,source_id,order_id,order_item_id,fulfilment_id,gross_amount,fee_amount,net_amount,status)
      values(r.seller_organization_id,'SELLER','ORDER_ITEM',r.id,p_order_id,r.id,r.fulfilment_id,
        v_seller_gross,(v_seller_gross*5/100),v_seller_gross-(v_seller_gross*5/100),'PENDING');
    end if;
  end loop;
end $$;

create or replace function public.create_earnings_after_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.paid_at is not null and (tg_op='INSERT' or old.paid_at is null) then
    perform public.create_order_earnings(new.id);
  end if;
  return new;
end $$;
drop trigger if exists orders_create_earnings_after_payment on public.orders;
create trigger orders_create_earnings_after_payment after insert or update of paid_at on public.orders
for each row execute function public.create_earnings_after_payment();

create or replace function public.create_earnings_when_done()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='DONE' and old.status is distinct from 'DONE' then
    perform public.create_order_earnings(new.order_id);
    update public.earnings set status='AVAILABLE',available_at=now(),updated_at=now()
      where fulfilment_id=new.id and status='PENDING';
  end if;
  return new;
end $$;

create or replace function public.recalculate_balance(p_organization_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.balance_projections(organization_id,pending,available,reserved,currency,updated_at)
  select p_organization_id,
    coalesce(sum(net_amount) filter(where status='PENDING'),0),
    coalesce(sum(net_amount-reserved_amount-paid_amount) filter(where status='AVAILABLE' and coalesce(available_at,now())<=now()),0),
    coalesce(sum(reserved_amount) filter(where status<>'REVERSED'),0),'IRR',now()
  from public.earnings where beneficiary_organization_id=p_organization_id
  on conflict(organization_id) do update set pending=excluded.pending,available=excluded.available,reserved=excluded.reserved,updated_at=now();
end $$;

create or replace function public.request_partial_payout(
  p_organization_id uuid,p_bank_account_id uuid,p_amount bigint,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_available bigint; v_left bigint; r record; v_take bigint;
begin
  if not public.is_org_member(p_organization_id,auth.uid(),array['OWNER','FINANCE']) and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists(select 1 from public.bank_accounts where id=p_bank_account_id and organization_id=p_organization_id and status='ACTIVE') then raise exception 'BANK_ACCOUNT_NOT_FOUND'; end if;
  select id into v_request_id from public.payout_requests where idempotency_key=p_idempotency_key;
  if v_request_id is not null then return v_request_id; end if;
  if exists(select 1 from public.payout_requests where organization_id=p_organization_id and status in ('REQUESTED','PROCESSING')) then raise exception 'OPEN_PAYOUT_EXISTS'; end if;
  perform id from public.earnings where beneficiary_organization_id=p_organization_id
    and status='AVAILABLE' and coalesce(available_at,now())<=now() for update;
  select coalesce(sum(net_amount-reserved_amount-paid_amount),0) into v_available from public.earnings
    where beneficiary_organization_id=p_organization_id and status='AVAILABLE' and coalesce(available_at,now())<=now();
  if p_amount>v_available then raise exception 'AMOUNT_EXCEEDS_AVAILABLE_BALANCE'; end if;
  insert into public.payout_requests(organization_id,bank_account_id,amount,currency,status,idempotency_key)
    values(p_organization_id,p_bank_account_id,p_amount,'IRR','REQUESTED',p_idempotency_key) returning id into v_request_id;
  v_left:=p_amount;
  for r in select id,(net_amount-reserved_amount-paid_amount) remaining from public.earnings
    where beneficiary_organization_id=p_organization_id and status='AVAILABLE' and coalesce(available_at,now())<=now()
      and net_amount>reserved_amount+paid_amount order by available_at,id for update
  loop
    exit when v_left=0; v_take:=least(v_left,r.remaining);
    insert into public.payout_request_items(payout_request_id,earning_id,amount) values(v_request_id,r.id,v_take);
    update public.earnings set reserved_amount=reserved_amount+v_take,updated_at=now() where id=r.id;
    v_left:=v_left-v_take;
  end loop;
  perform public.recalculate_balance(p_organization_id); return v_request_id;
end $$;

create or replace function public.complete_payout(p_payout_request_id uuid,p_receipt_file_id uuid default null,p_reference text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_request public.payout_requests%rowtype; v_history_id uuid; r record;
begin
  if not public.is_admin() and coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_request from public.payout_requests where id=p_payout_request_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  select id into v_history_id from public.payout_payment_history where payout_request_id=p_payout_request_id;
  if v_history_id is not null then return v_history_id; end if;
  if v_request.status not in ('REQUESTED','PROCESSING') then raise exception 'PAYOUT_NOT_PAYABLE'; end if;
  if p_receipt_file_id is not null and not exists(select 1 from public.storage_files where id=p_receipt_file_id and kind='PAYOUT_RECEIPT' and state='READY') then raise exception 'INVALID_RECEIPT_FILE'; end if;
  insert into public.payout_payment_history(payout_request_id,organization_id,amount,currency,receipt_file_id,receipt_text,reference,paid_at,admin_id)
    values(p_payout_request_id,v_request.organization_id,v_request.amount,v_request.currency,p_receipt_file_id,p_reference,p_reference,now(),auth.uid()) returning id into v_history_id;
  update public.payout_requests set status='PAID',processed_at=now(),processed_by=auth.uid() where id=p_payout_request_id;
  for r in select earning_id,amount from public.payout_request_items where payout_request_id=p_payout_request_id loop
    update public.earnings set reserved_amount=greatest(0,reserved_amount-r.amount),paid_amount=paid_amount+r.amount,
      status=case when paid_amount+r.amount>=net_amount then 'PAID'::public.earning_state else 'AVAILABLE'::public.earning_state end,
      paid_at=case when paid_amount+r.amount>=net_amount then now() else paid_at end,updated_at=now() where id=r.earning_id;
  end loop;
  perform public.recalculate_balance(v_request.organization_id); return v_history_id;
end $$;

create or replace function public.buyer_confirm_order_received(p_order_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if not exists(select 1 from public.orders where id=p_order_id and buyer_user_id=auth.uid()) then raise exception 'ORDER_NOT_FOUND' using errcode='42501'; end if;
  if exists(select 1 from public.fulfilments where order_id=p_order_id and status not in ('SENT','DONE')) then raise exception 'ORDER_NOT_FULLY_SENT'; end if;
  for r in select id from public.fulfilments where order_id=p_order_id and status='SENT' loop
    perform public.transition_fulfilment(r.id,'DONE',null,r.id::text||':BUYER_RECEIVED');
  end loop;
  update public.orders set status='DONE',updated_at=now() where id=p_order_id;
  return p_order_id;
end $$;

create or replace function public.sync_order_after_fulfilment_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='DONE' and not exists(select 1 from public.fulfilments where order_id=new.order_id and status<>'DONE') then
    update public.orders set status='DONE',updated_at=now() where id=new.order_id and status<>'DONE';
  elsif new.status='SENT' and not exists(select 1 from public.fulfilments where order_id=new.order_id and status not in ('SENT','DONE')) then
    update public.orders set status='SENT',updated_at=now() where id=new.order_id and status not in ('DONE','CANCELLED','RETURNED');
  end if;
  return new;
end $$;
drop trigger if exists fulfilments_sync_order_status on public.fulfilments;
create trigger fulfilments_sync_order_status after update of status on public.fulfilments
for each row execute function public.sync_order_after_fulfilment_status();

-- Correct commissions for legacy earnings which have not entered a payout.
update public.earnings set reserved_amount=net_amount where status='RESERVED' and reserved_amount=0 and paid_amount=0;
update public.earnings set paid_amount=net_amount where status='PAID' and paid_amount=0;
update public.earnings set fee_amount=gross_amount*7/100,net_amount=gross_amount-(gross_amount*7/100),updated_at=now()
 where earning_type='SUPPLIER' and status in ('PENDING','AVAILABLE') and reserved_amount=0 and paid_amount=0;
update public.earnings set fee_amount=gross_amount*5/100,net_amount=gross_amount-(gross_amount*5/100),updated_at=now()
 where earning_type='SELLER' and status in ('PENDING','AVAILABLE') and reserved_amount=0 and paid_amount=0;
select public.create_order_earnings(id) from public.orders where paid_at is not null and status not in ('CANCELLED','RETURNED');
update public.earnings e set status='AVAILABLE',available_at=coalesce(e.available_at,f.done_at,now())
 from public.fulfilments f where f.id=e.fulfilment_id and f.status='DONE' and e.status='PENDING';
select public.recalculate_balance(id) from public.organizations;

revoke all on function public.request_partial_payout(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.request_partial_payout(uuid,uuid,bigint,text) to authenticated;
revoke all on function public.buyer_confirm_order_received(uuid) from public,anon;
grant execute on function public.buyer_confirm_order_received(uuid) to authenticated;
