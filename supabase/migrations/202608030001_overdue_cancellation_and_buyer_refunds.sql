-- Hard supplier deadline, buyer wallet, and cancellation refund workflow.

alter table public.supplier_offers alter column lead_time_days set default 4;
update public.supplier_offers set lead_time_days=4 where lead_time_days is null;

create table if not exists public.buyer_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 0 check(balance >= 0),
  currency text not null default 'IRR' check(currency='IRR'),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete restrict,
  refund_id uuid references public.refunds(id) on delete restrict,
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount bigint not null check(amount > 0),
  description text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_refund_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  destination text not null default 'WALLET' check(destination in ('WALLET','BANK')),
  card_number text,
  updated_at timestamptz not null default now(),
  check(destination='WALLET' or card_number ~ '^[0-9]{16}$')
);

alter table public.refunds
  add column if not exists destination text check(destination in ('WALLET','BANK')),
  add column if not exists destination_card_number text,
  add column if not exists receipt_file_id uuid references public.storage_files(id) on delete set null,
  add column if not exists transfer_reference text;

alter table public.buyer_wallets enable row level security;
alter table public.buyer_wallet_transactions enable row level security;
alter table public.buyer_refund_preferences enable row level security;
drop policy if exists buyer_wallet_own_read on public.buyer_wallets;
create policy buyer_wallet_own_read on public.buyer_wallets for select to authenticated using(user_id=auth.uid());
drop policy if exists buyer_wallet_transactions_own_read on public.buyer_wallet_transactions;
create policy buyer_wallet_transactions_own_read on public.buyer_wallet_transactions for select to authenticated using(user_id=auth.uid());
drop policy if exists buyer_refund_preferences_own on public.buyer_refund_preferences;
create policy buyer_refund_preferences_own on public.buyer_refund_preferences for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.set_buyer_refund_preference(
  p_destination text,
  p_card_number text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_card text:=regexp_replace(coalesce(p_card_number,''),'\D','','g');
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_destination not in ('WALLET','BANK') then raise exception 'INVALID_DESTINATION'; end if;
  if p_destination='BANK' and v_card !~ '^[0-9]{16}$' then raise exception 'VALID_CARD_REQUIRED'; end if;
  insert into public.buyer_refund_preferences(user_id,destination,card_number,updated_at)
  values(v_user,p_destination,case when p_destination='BANK' then v_card end,now())
  on conflict(user_id) do update set destination=excluded.destination,
    card_number=excluded.card_number,updated_at=now();
  insert into public.buyer_wallets(user_id) values(v_user) on conflict do nothing;
end
$$;

create or replace function public.apply_buyer_wallet_to_order(p_order_id uuid)
returns bigint
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_balance bigint; v_use bigint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_order from public.orders where id=p_order_id and buyer_user_id=v_user for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.paid_at is not null then return v_order.total; end if;
  if exists(select 1 from public.buyer_wallet_transactions where idempotency_key='wallet-order:'||p_order_id) then
    return v_order.total;
  end if;
  insert into public.buyer_wallets(user_id) values(v_user) on conflict do nothing;
  select balance into v_balance from public.buyer_wallets where user_id=v_user for update;
  v_use:=least(v_balance,v_order.total);
  if v_use<=0 then return v_order.total; end if;
  update public.buyer_wallets set balance=balance-v_use,updated_at=now() where user_id=v_user;
  insert into public.buyer_wallet_transactions(user_id,order_id,direction,amount,description,idempotency_key)
  values(v_user,p_order_id,'DEBIT',v_use,'استفاده برای خرید '||v_order.number,'wallet-order:'||p_order_id)
  on conflict(idempotency_key) do nothing;
  insert into public.payments(order_id,provider,provider_payment_id,idempotency_key,amount,status,provider_response,captured_at)
  values(p_order_id,'WALLET','WALLET-'||v_order.number,'wallet-payment:'||p_order_id,v_use,'CAPTURED','{"source":"buyer_wallet"}',now())
  on conflict(idempotency_key) do nothing;
  update public.orders set discount_amount=discount_amount+v_use,total=total-v_use where id=p_order_id;
  return v_order.total-v_use;
end
$$;

create or replace function public.cancel_overdue_orders()
returns integer
language plpgsql security definer set search_path=public as $$
declare r record; v_count integer:=0; v_payment uuid; v_amount bigint; v_refund uuid;
  v_destination text; v_card text;
begin
  for r in
    select o.id,o.number,o.buyer_user_id
    from public.orders o
    where o.status not in ('DONE','CANCELLED','RETURNED')
      and exists(
        select 1 from public.fulfilments f where f.order_id=o.id
          and f.status not in ('SENT','DONE','CANCELLED','RETURNED')
          and f.created_at + interval '7 days' <= now()
      )
    for update skip locked
  loop
    update public.fulfilments set status='CANCELLED',cancelled_at=now(),auto_complete_at=null,updated_at=now()
      where order_id=r.id and status not in ('DONE','CANCELLED','RETURNED');
    update public.orders set status='CANCELLED',updated_at=now() where id=r.id;
    update public.earnings set status='REVERSED',updated_at=now()
      where order_id=r.id and status in ('PENDING','AVAILABLE','RESERVED');
    if r.buyer_user_id is not null then
      insert into public.order_cancellations(order_id,requested_by,reason,status,idempotency_key,review_message,requested_at,reviewed_at,completed_at)
      values(r.id,r.buyer_user_id,'لغو خودکار به علت عدم ارسال در مهلت هفت‌روزه','COMPLETED','auto-overdue:'||r.id,
        'سفارش پس از پایان مهلت قطعی تأمین‌کننده لغو شد.',now(),now(),now())
      on conflict(idempotency_key) do nothing;
      select id into v_payment from public.payments where order_id=r.id and status='CAPTURED' order by created_at limit 1;
      select coalesce(sum(amount),0) into v_amount from public.payments where order_id=r.id and status='CAPTURED';
      if v_payment is not null and v_amount>0 then
        select coalesce(destination,'WALLET'),card_number into v_destination,v_card
        from public.buyer_refund_preferences where user_id=r.buyer_user_id;
        v_destination:=coalesce(v_destination,'WALLET');
        insert into public.refunds(order_id,payment_id,requested_by,amount,reason,status,idempotency_key,destination,destination_card_number)
        values(r.id,v_payment,r.buyer_user_id,v_amount,'لغو خودکار سفارش به علت تأخیر تأمین‌کننده',
          case when v_destination='WALLET' then 'SUCCEEDED' else 'REQUESTED' end,
          'auto-overdue-refund:'||r.id,v_destination,case when v_destination='BANK' then v_card end)
        on conflict(idempotency_key) do update set destination=excluded.destination,destination_card_number=excluded.destination_card_number
        returning id into v_refund;
        if v_destination='WALLET' then
          insert into public.buyer_wallets(user_id,balance) values(r.buyer_user_id,v_amount)
          on conflict(user_id) do update set balance=public.buyer_wallets.balance+excluded.balance,updated_at=now();
          insert into public.buyer_wallet_transactions(user_id,order_id,refund_id,direction,amount,description,idempotency_key)
          values(r.buyer_user_id,r.id,v_refund,'CREDIT',v_amount,'بازپرداخت سفارش '||r.number,'wallet-refund:'||r.id)
          on conflict(idempotency_key) do nothing;
          update public.payments set status='REFUNDED',updated_at=now() where order_id=r.id and status='CAPTURED';
        end if;
      end if;
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$$;

create or replace function public.service_complete_buyer_bank_refund(
  p_refund_id uuid,p_receipt_file_id uuid,p_reference text,p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  update public.refunds set status='SUCCEEDED',processed_by=p_actor_id,processed_at=now(),updated_at=now(),
    receipt_file_id=p_receipt_file_id,transfer_reference=nullif(trim(p_reference),'')
  where id=p_refund_id and destination='BANK' and status in ('REQUESTED','APPROVED','PROCESSING');
  if not found then raise exception 'REFUND_NOT_PAYABLE'; end if;
  update public.payments set status='REFUNDED',updated_at=now()
    where order_id=(select order_id from public.refunds where id=p_refund_id) and status='CAPTURED';
  return p_refund_id;
end
$$;

create or replace function public.service_finalize_order_cancellation(
  p_request_id uuid,p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_request public.order_cancellations%rowtype; v_order public.orders%rowtype;
  v_payment uuid; v_amount bigint; v_refund uuid; v_destination text; v_card text;
begin
  select * into v_request from public.order_cancellations where id=p_request_id for update;
  if not found or v_request.status not in ('APPROVED','COMPLETED') then raise exception 'CANCELLATION_NOT_APPROVED'; end if;
  select * into v_order from public.orders where id=v_request.order_id for update;
  update public.fulfilments set status='CANCELLED',cancelled_at=now(),auto_complete_at=null,updated_at=now()
    where order_id=v_order.id and status not in ('DONE','CANCELLED','RETURNED');
  update public.orders set status='CANCELLED',updated_at=now() where id=v_order.id;
  update public.earnings set status='REVERSED',updated_at=now()
    where order_id=v_order.id and status in ('PENDING','AVAILABLE','RESERVED');
  update public.order_cancellations set status='COMPLETED',completed_at=now(),updated_at=now() where id=p_request_id;
  if exists(select 1 from public.refunds where idempotency_key='approved-cancellation-refund:'||v_order.id) then
    return p_request_id;
  end if;
  select id into v_payment from public.payments where order_id=v_order.id and status='CAPTURED' order by created_at limit 1;
  select coalesce(sum(amount),0) into v_amount from public.payments where order_id=v_order.id and status='CAPTURED';
  if v_payment is not null and v_amount>0 and v_order.buyer_user_id is not null then
    select coalesce(destination,'WALLET'),card_number into v_destination,v_card
      from public.buyer_refund_preferences where user_id=v_order.buyer_user_id;
    v_destination:=coalesce(v_destination,'WALLET');
    insert into public.refunds(order_id,payment_id,requested_by,processed_by,amount,reason,status,idempotency_key,destination,destination_card_number)
    values(v_order.id,v_payment,v_order.buyer_user_id,p_actor_id,v_amount,'لغو تأییدشده سفارش',
      case when v_destination='WALLET' then 'SUCCEEDED' else 'REQUESTED' end,
      'approved-cancellation-refund:'||v_order.id,v_destination,case when v_destination='BANK' then v_card end)
    on conflict(idempotency_key) do update set destination=excluded.destination,destination_card_number=excluded.destination_card_number
    returning id into v_refund;
    if v_destination='WALLET' then
      insert into public.buyer_wallets(user_id,balance) values(v_order.buyer_user_id,v_amount)
      on conflict(user_id) do update set balance=public.buyer_wallets.balance+excluded.balance,updated_at=now();
      insert into public.buyer_wallet_transactions(user_id,order_id,refund_id,direction,amount,description,idempotency_key)
      values(v_order.buyer_user_id,v_order.id,v_refund,'CREDIT',v_amount,'بازپرداخت سفارش '||v_order.number,'wallet-approved-refund:'||v_order.id)
      on conflict(idempotency_key) do nothing;
      update public.payments set status='REFUNDED',updated_at=now() where order_id=v_order.id and status='CAPTURED';
    end if;
  end if;
  return p_request_id;
end
$$;

revoke all on function public.apply_buyer_wallet_to_order(uuid) from public,anon;
grant execute on function public.apply_buyer_wallet_to_order(uuid) to authenticated;
revoke all on function public.set_buyer_refund_preference(text,text) from public,anon;
grant execute on function public.set_buyer_refund_preference(text,text) to authenticated;
revoke all on function public.cancel_overdue_orders() from public,anon,authenticated;
grant execute on function public.cancel_overdue_orders() to service_role;
revoke all on function public.service_complete_buyer_bank_refund(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.service_complete_buyer_bank_refund(uuid,uuid,text,uuid) to service_role;
revoke all on function public.service_finalize_order_cancellation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_finalize_order_cancellation(uuid,uuid) to service_role;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='chapli-cancel-overdue-orders';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('chapli-cancel-overdue-orders','23 * * * *','select public.cancel_overdue_orders();');
end
$$;
