create table if not exists public.sms_event_configs (
  event_type text primary key,
  name text not null,
  recipient_role text not null check (recipient_role in ('BUYER','SELLER','SUPPLIER')),
  description text not null default '',
  pattern_id bigint,
  variable_keys text[] not null default '{}',
  enabled boolean not null default false,
  is_required_event boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sms_event_configs(event_type,name,recipient_role,description,pattern_id,variable_keys,enabled,is_required_event)
values
  ('BUYER_ORDER_PAID','ثبت سفارش خریدار','BUYER','بلافاصله بعد از پرداخت موفق سفارش',516974,array['buyerFirstName','orderNumber'],true,true),
  ('SUPPLIER_NEW_ORDER','سفارش جدید تأمین‌کننده','SUPPLIER','بلافاصله بعد از پرداخت موفق برای تأمین‌کننده',516977,array['productNames'],true,true),
  ('SELLER_NEW_ORDER','فروش جدید فروشنده','SELLER','بلافاصله بعد از پرداخت موفق برای فروشنده',516981,array['totalPrice','orderNumber'],true,true),
  ('BUYER_ORDER_SHIPPED','ارسال سفارش خریدار','BUYER','پس از ثبت روش ارسال و کد رهگیری توسط تأمین‌کننده',516905,array['orderNumber','carrier','trackingCode'],true,true),
  ('BUYER_REVIEW_REQUEST','درخواست ثبت دیدگاه','BUYER','دو روز پس از تکمیل سفارش',516971,array['buyerFirstName','productNames','orderNumber','reviewUrl'],true,true),
  ('SUPPLIER_SHIPPING_DEADLINE','یادآوری مهلت ارسال','SUPPLIER','۳۶ ساعت پیش از موعد ارسال تأمین‌کننده',516978,array['orderNumber'],true,true),
  ('BUYER_ORDER_DELIVERED','تحویل سفارش خریدار','BUYER','پس از تکمیل یا تأیید دریافت سفارش',null,array['buyerFirstName','orderNumber'],false,false),
  ('BUYER_ORDER_CANCELLED','لغو سفارش خریدار','BUYER','پس از لغو سفارش',null,array['buyerFirstName','orderNumber'],false,false),
  ('SELLER_ORDER_CANCELLED','لغو فروش برای فروشنده','SELLER','پس از لغو سفارش دارای محصول فروشنده',null,array['orderNumber','productNames'],false,false),
  ('SUPPLIER_ORDER_CANCELLED','لغو تولید برای تأمین‌کننده','SUPPLIER','پس از لغو مأموریت تولید',null,array['orderNumber','productNames'],false,false),
  ('BUYER_RETURN_APPROVED','تأیید درخواست مرجوعی','BUYER','پس از تأیید مرجوعی خریدار',null,array['buyerFirstName','orderNumber'],false,false),
  ('SELLER_PAYOUT_PAID','واریز تسویه فروشنده','SELLER','پس از ثبت پرداخت تسویه فروشنده',null,array['recipientName','amount','reference'],false,false),
  ('SUPPLIER_PAYOUT_PAID','واریز تسویه تأمین‌کننده','SUPPLIER','پس از ثبت پرداخت تسویه تأمین‌کننده',null,array['recipientName','amount','reference'],false,false),
  ('SUPPLIER_EXCEPTION_RESOLVED','نتیجه بررسی مشکل تولید','SUPPLIER','پس از تعیین تکلیف مشکل گزارش‌شده',null,array['orderNumber','resolution'],false,false)
on conflict(event_type) do update set
  name=excluded.name,
  recipient_role=excluded.recipient_role,
  description=excluded.description,
  is_required_event=excluded.is_required_event;

create index if not exists sms_event_configs_enabled_idx on public.sms_event_configs(enabled,event_type);
create index if not exists notification_outbox_sms_due_idx
  on public.notification_outbox(status,available_at,event_type)
  where status='PENDING';

drop trigger if exists sms_event_configs_touch on public.sms_event_configs;
create trigger sms_event_configs_touch before update on public.sms_event_configs
for each row execute function public.touch_updated_at();

alter table public.sms_event_configs enable row level security;
create policy admin_manage_sms_event_configs on public.sms_event_configs
for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy sms_event_configs_authenticated_read on public.sms_event_configs
for select to authenticated using(true);

create policy notification_preferences_own_insert on public.notification_preferences
for insert to authenticated with check(user_id=auth.uid());
create policy notification_preferences_own_update on public.notification_preferences
for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

grant select on public.sms_event_configs to authenticated;
grant insert,update,delete on public.sms_event_configs to authenticated;
