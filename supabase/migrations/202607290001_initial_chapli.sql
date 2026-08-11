create extension if not exists pgcrypto;

create type public.organization_type as enum ('PLATFORM','SELLER','SUPPLIER');
create type public.record_status as enum ('DRAFT','PENDING','ACTIVE','INACTIVE','APPROVED','REJECTED','SUSPENDED','CLOSED');
create type public.fulfilment_status as enum ('ASSIGNED','IN_PRODUCTION','QUALITY_CHECK','READY_TO_SEND','SENT','DONE','CANCELLED','RETURNED');
create type public.ticket_status as enum ('OPEN','WAITING_USER','WAITING_SUPPORT','RESOLVED','CLOSED');

create table public.users(
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 password_hash text not null,
 first_name text not null,
 last_name text not null,
 phone text,
 status text not null default 'ACTIVE',
 locale text not null default 'fa-IR',
 email_verified_at timestamptz,
 last_login_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.organizations(
 id uuid primary key default gen_random_uuid(),
 type public.organization_type not null,
 legal_name text not null,
 display_name text not null,
 slug text not null unique,
 status text not null default 'ACTIVE',
 profile jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.memberships(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 role text not null default 'OWNER',
 status text not null default 'ACTIVE',
 created_at timestamptz not null default now(),
 unique(user_id,organization_id)
);
create table public.stores(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,
 slug text not null unique,
 status text not null default 'DRAFT',
 default_locale text not null default 'fa-IR',
 default_currency text not null default 'IRR',
 description text,
 primary_category text,
 support_email text,
 support_phone text,
 social_url text,
 logo_url text,
 banner_url text,
 theme jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.sessions(
 token_hash text primary key,
 user_id uuid not null references public.users(id) on delete cascade,
 expires_at timestamptz not null,
 user_agent text,
 created_at timestamptz not null default now()
);
create table public.seller_onboarding_profiles(
 user_id uuid primary key references public.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 store_id uuid not null references public.stores(id) on delete cascade,
 data jsonb not null default '{}',
 status text not null default 'COMPLETED',
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.supplier_profiles(
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 national_id text,
 registration_number text,
 capacity_per_day integer not null default 0,
 lead_time_days integer not null default 1,
 methods text[] not null default '{}',
 categories text[] not null default '{}',
 bank_account jsonb not null default '{}',
 approval_mode text not null default 'AUTO',
 status text not null default 'APPROVED',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.facilities(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null, city text, address text, postal_code text,
 status text not null default 'ACTIVE',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.categories(id uuid primary key default gen_random_uuid(),parent_id uuid references public.categories(id),slug text unique not null,name text not null,status text not null default 'ACTIVE',sort_order integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.raw_products(id uuid primary key default gen_random_uuid(),category_id uuid references public.categories(id),name text not null,description text,images text[] not null default '{}',base_cost bigint not null default 0,suggested_price bigint not null default 0,has_back boolean not null default false,status text not null default 'ACTIVE',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.raw_product_colors(id uuid primary key default gen_random_uuid(),raw_product_id uuid not null references public.raw_products(id) on delete cascade,name text not null,hex text,mockup_front_url text,mockup_back_url text,status text not null default 'ACTIVE',unique(raw_product_id,name));
create table public.raw_product_sizes(id uuid primary key default gen_random_uuid(),raw_product_id uuid not null references public.raw_products(id) on delete cascade,name text not null,sort_order integer not null default 0,status text not null default 'ACTIVE',unique(raw_product_id,name));
create table public.raw_product_views(id uuid primary key default gen_random_uuid(),raw_product_id uuid not null references public.raw_products(id) on delete cascade,side text not null check(side in('FRONT','BACK')),background_by_color jsonb not null default '{}',overlay_by_color jsonb not null default '{}',print_area_x numeric(8,6) not null,print_area_y numeric(8,6) not null,print_area_width numeric(8,6) not null,print_area_height numeric(8,6) not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(raw_product_id,side));
create table public.supplier_offers(id uuid primary key default gen_random_uuid(),supplier_organization_id uuid not null references public.organizations(id),facility_id uuid not null references public.facilities(id),raw_product_id uuid not null references public.raw_products(id),base_cost bigint not null,lead_time_days integer not null,capacity_per_day integer not null,approval_status text not null default 'APPROVED',status text not null default 'ACTIVE',approved_at timestamptz,approved_by uuid references public.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(supplier_organization_id,facility_id,raw_product_id));
create table public.supplier_offer_variants(id uuid primary key default gen_random_uuid(),supplier_offer_id uuid not null references public.supplier_offers(id) on delete cascade,color_id uuid not null references public.raw_product_colors(id),size_ids uuid[] not null default '{}',stock_status text not null default 'AVAILABLE',created_at timestamptz not null default now());

create table public.designs(id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),raw_product_id uuid not null references public.raw_products(id),artwork_by_view jsonb not null default '{}',selected_color_ids uuid[] not null default '{}',selected_size_ids uuid[] not null default '{}',status text not null default 'DRAFT',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.seller_products(id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),raw_product_id uuid not null references public.raw_products(id),design_id uuid references public.designs(id),primary_supplier_offer_id uuid references public.supplier_offers(id),backup_supplier_offer_id uuid references public.supplier_offers(id),title text not null,description text,price bigint not null,discounted_price bigint,status text not null default 'DRAFT',details jsonb not null default '[]',images text[] not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),published_at timestamptz);
create table public.product_moderation_queue(id uuid primary key default gen_random_uuid(),seller_product_id uuid not null references public.seller_products(id),seller_id uuid not null references public.users(id),status text not null default 'PENDING',submitted_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references public.users(id),rejection_reason_id uuid,custom_message text);

create table public.orders(id uuid primary key default gen_random_uuid(),number text unique not null,buyer_user_id uuid references public.users(id),status text not null,subtotal bigint not null default 0,total bigint not null default 0,currency text not null default 'IRR',customer_snapshot jsonb not null default '{}',shipping_address_snapshot jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,seller_product_id uuid references public.seller_products(id),quantity integer not null check(quantity>0),unit_price bigint not null,cost_snapshot bigint not null default 0,product_snapshot jsonb not null default '{}',design_snapshot jsonb not null default '{}');
create table public.fulfilments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),supplier_organization_id uuid not null references public.organizations(id),facility_id uuid not null references public.facilities(id),supplier_offer_id uuid not null references public.supplier_offers(id),assignment_snapshot jsonb not null,status public.fulfilment_status not null default 'ASSIGNED',tracking_code text,sent_at timestamptz,auto_complete_at timestamptz,done_at timestamptz,cancelled_at timestamptz,returned_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.fulfilment_items(id uuid primary key default gen_random_uuid(),fulfilment_id uuid not null references public.fulfilments(id) on delete cascade,order_item_id uuid not null references public.order_items(id),quantity integer not null);
create table public.fulfilment_status_events(id uuid primary key default gen_random_uuid(),fulfilment_id uuid not null references public.fulfilments(id),from_status text,to_status text not null,actor_type text not null,actor_id text,idempotency_key text not null unique,occurred_at timestamptz not null default now());

create table public.bank_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),bank_name text,card_number text,iban text,priority integer not null default 1,status text not null default 'ACTIVE',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,priority));
create table public.balance_projections(id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations(id),pending bigint not null default 0,available bigint not null default 0,reserved bigint not null default 0,currency text not null default 'IRR',updated_at timestamptz not null default now());
create table public.payout_requests(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),bank_account_id uuid references public.bank_accounts(id),order_ids uuid[] not null default '{}',amount bigint not null,currency text not null default 'IRR',status text not null default 'REQUESTED',requested_at timestamptz not null default now(),processed_at timestamptz,processed_by uuid references public.users(id));
create table public.payout_payment_history(id uuid primary key default gen_random_uuid(),payout_request_id uuid not null unique references public.payout_requests(id),organization_id uuid not null references public.organizations(id),order_ids uuid[] not null,amount bigint not null,currency text not null,receipt_path text,receipt_text text,paid_at timestamptz not null default now(),admin_id uuid references public.users(id));

create table public.tickets(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),opened_by_user_id uuid not null references public.users(id),subject text not null,category text not null,priority text not null default 'NORMAL',status public.ticket_status not null default 'OPEN',reference_type text,reference_id text,assignee_id uuid references public.users(id),last_message_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.ticket_participants(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.tickets(id) on delete cascade,user_id uuid references public.users(id),organization_id uuid references public.organizations(id),role text not null,created_at timestamptz not null default now(),unique(ticket_id,user_id));
create table public.ticket_messages(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.tickets(id) on delete cascade,sender_id uuid references public.users(id),sender_role text not null,body text not null,visibility text not null default 'PUBLIC',created_at timestamptz not null default now());
create table public.ticket_attachments(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.tickets(id) on delete cascade,message_id uuid references public.ticket_messages(id) on delete cascade,storage_path text not null,file_name text not null,mime_type text,size_bytes bigint,scan_status text not null default 'PENDING',created_at timestamptz not null default now());
create table public.ticket_read_states(ticket_id uuid not null references public.tickets(id) on delete cascade,user_id uuid not null references public.users(id),last_read_message_id uuid references public.ticket_messages(id),last_read_at timestamptz,unread_count integer not null default 0,updated_at timestamptz not null default now(),primary key(ticket_id,user_id));

create table public.rejection_reasons(id uuid primary key default gen_random_uuid(),title text not null,sms_template text not null,status text not null default 'ACTIVE',sort_order integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.audit_events(id bigint generated always as identity primary key,actor_type text not null,actor_id text,action text not null,target_type text not null,target_id text,reason text,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());

create index memberships_user_status_idx on public.memberships(user_id,status);
create index stores_organization_idx on public.stores(organization_id,status);
create index seller_products_store_status_idx on public.seller_products(store_id,status,created_at desc);
create index supplier_offers_eligibility_idx on public.supplier_offers(raw_product_id,approval_status,status);
create index fulfilments_supplier_queue_idx on public.fulfilments(supplier_organization_id,status,created_at);
create index fulfilments_auto_done_idx on public.fulfilments(status,auto_complete_at) where status='SENT';
create index orders_unfinished_idx on public.orders(status,created_at);
create index tickets_org_inbox_idx on public.tickets(organization_id,status,last_message_at desc);
create index tickets_admin_inbox_idx on public.tickets(status,priority,last_message_at);
create index ticket_messages_thread_idx on public.ticket_messages(ticket_id,created_at);
create index sessions_expiry_idx on public.sessions(expires_at);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text; begin foreach t in array array['users','organizations','stores','supplier_profiles','facilities','raw_products','raw_product_views','supplier_offers','designs','seller_products','orders','fulfilments','bank_accounts','tickets','rejection_reasons'] loop execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',t||'_touch',t);end loop;end $$;

create or replace function public.register_seller(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=gen_random_uuid();oid uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();
begin
 insert into users(id,email,password_hash,first_name,last_name,phone) values(uid,lower(payload->>'email'),payload->>'passwordHash',payload->>'firstName',payload->>'lastName',payload->>'phone');
 insert into organizations(id,type,legal_name,display_name,slug,profile) values(oid,'SELLER',payload->>'storeName',payload->>'storeName','seller-'||(payload->>'slug'),jsonb_build_object('sellerType',payload->>'sellerType','experienceLevel',payload->>'experienceLevel','instagramHandle',payload->>'instagramHandle','websiteUrl',payload->>'websiteUrl'));
 insert into memberships(user_id,organization_id) values(uid,oid);
 insert into stores(id,organization_id,name,slug,description,primary_category,support_email,support_phone,social_url,theme) values(sid,oid,payload->>'storeName',payload->>'slug',payload->>'storeDescription',payload->>'primaryCategory',coalesce(nullif(payload->>'supportEmail',''),payload->>'email'),coalesce(nullif(payload->>'supportPhone',''),payload->>'phone'),payload->>'socialUrl',jsonb_build_object('primary',payload->>'brandColor','tone',payload->>'brandTone'));
 insert into seller_onboarding_profiles(user_id,organization_id,store_id,data,status,completed_at) values(uid,oid,sid,payload,'COMPLETED',now());
 insert into balance_projections(organization_id) values(oid);
 return uid;
end $$;

create or replace function public.register_supplier(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=gen_random_uuid();oid uuid:=gen_random_uuid();fid uuid:=gen_random_uuid();
begin
 insert into users(id,email,password_hash,first_name,last_name,phone) values(uid,lower(payload->>'email'),payload->>'passwordHash',payload->>'firstName',payload->>'lastName',payload->>'phone');
 insert into organizations(id,type,legal_name,display_name,slug) values(oid,'SUPPLIER',payload->>'legalName',payload->>'displayName','supplier-'||substr(oid::text,1,8));
 insert into memberships(user_id,organization_id) values(uid,oid);
 insert into supplier_profiles(organization_id,national_id,registration_number,capacity_per_day,lead_time_days,methods,categories,bank_account) values(oid,payload->>'nationalId',payload->>'registrationNumber',(payload->>'capacityPerDay')::int,(payload->>'leadTimeDays')::int,array(select jsonb_array_elements_text(payload->'methods')),array(select jsonb_array_elements_text(payload->'categories')),jsonb_build_object('iban',payload->>'iban','cardNumber',payload->>'cardNumber'));
 insert into facilities(id,organization_id,name,city,address,postal_code) values(fid,oid,'مرکز '||(payload->>'displayName'),payload->>'city',payload->>'address',payload->>'postalCode');
 insert into balance_projections(organization_id) values(oid);
 return uid;
end $$;

create or replace function public.mark_fulfilment_sent(p_fulfilment uuid,p_tracking text,p_actor uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if length(trim(p_tracking))<5 then raise exception 'TRACKING_REQUIRED';end if;
 update fulfilments set status='SENT',tracking_code=trim(p_tracking),sent_at=now(),auto_complete_at=now()+interval '10 days' where id=p_fulfilment and status not in('DONE','CANCELLED','RETURNED');
 insert into fulfilment_status_events(fulfilment_id,from_status,to_status,actor_type,actor_id,idempotency_key) values(p_fulfilment,'READY_TO_SEND','SENT','SUPPLIER',p_actor::text,p_fulfilment||':SENT') on conflict(idempotency_key) do nothing;
end $$;

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.stores enable row level security;
alter table public.raw_products enable row level security;
alter table public.raw_product_colors enable row level security;
alter table public.raw_product_sizes enable row level security;
alter table public.seller_products enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

create policy "public active stores" on public.stores for select to anon,authenticated using(status='ACTIVE');
create policy "public active raw products" on public.raw_products for select to anon,authenticated using(status='ACTIVE');
create policy "public published products" on public.seller_products for select to anon,authenticated using(status='PUBLISHED');

revoke all on function public.register_seller(jsonb) from public,anon,authenticated;
revoke all on function public.register_supplier(jsonb) from public,anon,authenticated;
revoke all on function public.mark_fulfilment_sent(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.register_seller(jsonb) to service_role;
grant execute on function public.register_supplier(jsonb) to service_role;
grant execute on function public.mark_fulfilment_sent(uuid,text,uuid) to service_role;
