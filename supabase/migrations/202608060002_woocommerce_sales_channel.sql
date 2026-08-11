-- WooCommerce is an independent seller sales channel. Credentials are encrypted
-- in the application before storage and are never exposed through client RLS.
create table public.woocommerce_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  store_id uuid not null unique references public.stores(id) on delete cascade,
  site_url text not null,
  consumer_key_encrypted text not null,
  consumer_secret_encrypted text not null,
  webhook_secret_encrypted text not null,
  webhook_id bigint,
  status text not null default 'CONNECTING' check(status in ('CONNECTING','CONNECTED','ERROR','DISCONNECTED')),
  price_divisor integer not null default 10 check(price_divisor in (1,10)),
  last_error text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.woocommerce_product_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.woocommerce_connections(id) on delete cascade,
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  woo_product_id bigint not null,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','ERROR','ARCHIVED')),
  last_error text,
  synced_at timestamptz not null default now(),
  unique(connection_id,seller_product_id), unique(connection_id,woo_product_id)
);

create table public.woocommerce_variant_links (
  id uuid primary key default gen_random_uuid(),
  product_link_id uuid not null references public.woocommerce_product_links(id) on delete cascade,
  seller_product_variant_id uuid not null unique references public.seller_product_variants(id) on delete cascade,
  woo_variation_id bigint not null,
  synced_at timestamptz not null default now(),
  unique(product_link_id,woo_variation_id)
);

create table public.woocommerce_webhook_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.woocommerce_connections(id) on delete cascade,
  delivery_id text not null,
  topic text,
  signature text,
  payload jsonb not null,
  status text not null default 'RECEIVED' check(status in ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(connection_id,delivery_id)
);

create table public.woocommerce_order_imports (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.woocommerce_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_order_id bigint not null,
  external_order_number text not null,
  status text not null default 'NEW' check(status in ('NEW','FUNDING','READY','CONVERTED','IGNORED','CANCELLED','ERROR')),
  customer_snapshot jsonb not null default '{}'::jsonb,
  shipping_address_snapshot jsonb not null default '{}'::jsonb,
  required_amount bigint not null default 0 check(required_amount>=0),
  funded_amount bigint not null default 0 check(funded_amount>=0),
  platform_order_ids uuid[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  converted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(connection_id,external_order_id)
);

create table public.woocommerce_order_import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.woocommerce_order_imports(id) on delete cascade,
  external_product_id bigint not null,
  external_variation_id bigint,
  seller_product_variant_id uuid not null references public.seller_product_variants(id) on delete restrict,
  quantity integer not null check(quantity between 1 and 999),
  unit_cost bigint not null check(unit_cost>=0),
  address_key text not null default 'shipping',
  item_snapshot jsonb not null default '{}'::jsonb
);

create table public.woocommerce_channel_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance bigint not null default 0 check(balance>=0),
  currency text not null default 'IRR' check(currency='IRR'),
  updated_at timestamptz not null default now()
);

create table public.woocommerce_channel_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid references public.woocommerce_order_imports(id) on delete set null,
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount bigint not null check(amount>0),
  source text not null check(source in ('ZARINPAL','SELLER_EARNINGS','ORDER')),
  reference text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.woocommerce_funding_payments (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.woocommerce_order_imports(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  authority text unique,
  amount bigint not null check(amount>0),
  status text not null default 'CREATED' check(status in ('CREATED','PENDING','SUCCEEDED','FAILED','CANCELLED')),
  ref_id text,
  response_payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.woocommerce_connections enable row level security;
alter table public.woocommerce_product_links enable row level security;
alter table public.woocommerce_variant_links enable row level security;
alter table public.woocommerce_webhook_events enable row level security;
alter table public.woocommerce_order_imports enable row level security;
alter table public.woocommerce_order_import_items enable row level security;
alter table public.woocommerce_channel_accounts enable row level security;
alter table public.woocommerce_channel_transactions enable row level security;
alter table public.woocommerce_funding_payments enable row level security;

revoke all on public.woocommerce_connections,public.woocommerce_product_links,
  public.woocommerce_variant_links,public.woocommerce_webhook_events,
  public.woocommerce_order_imports,public.woocommerce_order_import_items,
  public.woocommerce_channel_accounts,public.woocommerce_channel_transactions,
  public.woocommerce_funding_payments from anon,authenticated;
grant all on public.woocommerce_connections,public.woocommerce_product_links,
  public.woocommerce_variant_links,public.woocommerce_webhook_events,
  public.woocommerce_order_imports,public.woocommerce_order_import_items,
  public.woocommerce_channel_accounts,public.woocommerce_channel_transactions,
  public.woocommerce_funding_payments to service_role;

create index woocommerce_imports_org_status_idx on public.woocommerce_order_imports(organization_id,status,imported_at desc);
create index woocommerce_import_items_import_idx on public.woocommerce_order_import_items(import_id);
create index woocommerce_webhook_events_connection_idx on public.woocommerce_webhook_events(connection_id,received_at desc);

create or replace function public.service_apply_woocommerce_earnings(p_import_id uuid)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_import public.woocommerce_order_imports%rowtype; v_needed bigint; v_available bigint; v_use bigint; v_left bigint; v_payout uuid; r record; v_take bigint;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_import from public.woocommerce_order_imports where id=p_import_id for update;
  if not found or v_import.status in ('CONVERTED','IGNORED','CANCELLED') then raise exception 'IMPORT_NOT_FUNDABLE'; end if;
  v_needed:=greatest(0,v_import.required_amount-v_import.funded_amount);
  perform id from public.earnings where beneficiary_organization_id=v_import.organization_id and status='AVAILABLE' and coalesce(available_at,now())<=now() for update;
  select coalesce(sum(net_amount-reserved_amount-paid_amount),0) into v_available from public.earnings where beneficiary_organization_id=v_import.organization_id and status='AVAILABLE' and coalesce(available_at,now())<=now();
  v_use:=least(v_needed,v_available); if v_use<=0 then return v_needed; end if;
  insert into public.payout_requests(organization_id,amount,currency,status,idempotency_key,processed_at)
    values(v_import.organization_id,v_use,'IRR','PAID','woo-earnings:'||p_import_id,now())
    on conflict do nothing returning id into v_payout;
  if v_payout is null then return greatest(0,v_needed-(select coalesce(sum(amount),0) from public.woocommerce_channel_transactions where idempotency_key='woo-earnings:'||p_import_id)); end if;
  v_left:=v_use;
  for r in select id,(net_amount-reserved_amount-paid_amount) remaining from public.earnings where beneficiary_organization_id=v_import.organization_id and status='AVAILABLE' and coalesce(available_at,now())<=now() and net_amount>reserved_amount+paid_amount order by available_at,id for update loop
    exit when v_left=0; v_take:=least(v_left,r.remaining);
    insert into public.payout_request_items(payout_request_id,earning_id,amount) values(v_payout,r.id,v_take);
    update public.earnings set paid_amount=paid_amount+v_take,status=case when paid_amount+v_take>=net_amount then 'PAID'::public.earning_state else status end,paid_at=case when paid_amount+v_take>=net_amount then now() else paid_at end,updated_at=now() where id=r.id;
    v_left:=v_left-v_take;
  end loop;
  insert into public.woocommerce_channel_accounts(organization_id,balance) values(v_import.organization_id,v_use) on conflict(organization_id) do update set balance=woocommerce_channel_accounts.balance+excluded.balance,updated_at=now();
  insert into public.woocommerce_channel_transactions(organization_id,import_id,direction,amount,source,reference,idempotency_key) values(v_import.organization_id,p_import_id,'CREDIT',v_use,'SELLER_EARNINGS',v_payout::text,'woo-earnings:'||p_import_id);
  update public.woocommerce_order_imports set funded_amount=funded_amount+v_use,status=case when funded_amount+v_use>=required_amount then 'READY' else 'FUNDING' end,updated_at=now() where id=p_import_id;
  perform public.recalculate_balance(v_import.organization_id);
  return v_needed-v_use;
end $$;

create or replace function public.service_credit_woocommerce_funding(p_authority text,p_ref_id text,p_response jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_payment public.woocommerce_funding_payments%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_payment from public.woocommerce_funding_payments where authority=p_authority for update;
  if not found then raise exception 'FUNDING_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status='SUCCEEDED' then return v_payment.import_id; end if;
  update public.woocommerce_funding_payments set status='SUCCEEDED',ref_id=p_ref_id,response_payload=coalesce(p_response,'{}'),completed_at=now() where id=v_payment.id;
  insert into public.woocommerce_channel_accounts(organization_id,balance) values(v_payment.organization_id,v_payment.amount) on conflict(organization_id) do update set balance=woocommerce_channel_accounts.balance+excluded.balance,updated_at=now();
  insert into public.woocommerce_channel_transactions(organization_id,import_id,direction,amount,source,reference,idempotency_key) values(v_payment.organization_id,v_payment.import_id,'CREDIT',v_payment.amount,'ZARINPAL',p_ref_id,'woo-zarinpal:'||v_payment.id);
  update public.woocommerce_order_imports set funded_amount=funded_amount+v_payment.amount,status=case when funded_amount+v_payment.amount>=required_amount then 'READY' else 'FUNDING' end,updated_at=now() where id=v_payment.import_id;
  return v_payment.import_id;
end $$;

revoke all on function public.service_apply_woocommerce_earnings(uuid),public.service_credit_woocommerce_funding(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.service_apply_woocommerce_earnings(uuid),public.service_credit_woocommerce_funding(text,text,jsonb) to service_role;

create or replace function public.service_convert_woocommerce_import(p_import_id uuid,p_buyer_user_id uuid)
returns uuid[] language plpgsql security definer set search_path=public as $$
declare v_import public.woocommerce_order_imports%rowtype; v_balance bigint; v_order_id uuid; v_order_ids uuid[]:='{}'; v_number text; v_total bigint; v_item record; v_row record; v_order_item_id uuid; v_fulfilment_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_import from public.woocommerce_order_imports where id=p_import_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if v_import.status='CONVERTED' then return v_import.platform_order_ids; end if;
  if v_import.status<>'READY' or v_import.funded_amount<v_import.required_amount then raise exception 'IMPORT_NOT_FUNDED'; end if;
  if not exists(select 1 from public.memberships where organization_id=v_import.organization_id and user_id=p_buyer_user_id and status='ACTIVE') then raise exception 'BUYER_NOT_SELLER_MEMBER'; end if;
  if exists(
    select 1 from public.woocommerce_order_import_items wi
    left join public.seller_product_variants spv on spv.id=wi.seller_product_variant_id and spv.status='ACTIVE'
    left join public.supplier_offer_variants sov on sov.id=spv.supplier_offer_variant_id and sov.stock_status in ('AVAILABLE','LOW_STOCK') and sov.stock_quantity>=wi.quantity
    left join public.supplier_offers so on so.id=sov.supplier_offer_id and so.status='ACTIVE' and so.approval_status='APPROVED'
    where wi.import_id=p_import_id and (spv.id is null or sov.id is null or so.id is null)
  ) then raise exception 'VARIANT_UNAVAILABLE'; end if;
  insert into public.woocommerce_channel_accounts(organization_id) values(v_import.organization_id) on conflict do nothing;
  select balance into v_balance from public.woocommerce_channel_accounts where organization_id=v_import.organization_id for update;
  if v_balance<v_import.required_amount then raise exception 'CHANNEL_BALANCE_INSUFFICIENT'; end if;

  for v_item in select address_key,sum(unit_cost*quantity)::bigint total from public.woocommerce_order_import_items where import_id=p_import_id group by address_key loop
    v_order_id:=gen_random_uuid(); v_total:=v_item.total;
    v_number:='WC-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||upper(substr(v_order_id::text,1,4));
    insert into public.orders(id,number,buyer_user_id,status,subtotal,total,currency,customer_snapshot,shipping_address_snapshot,shipping_amount,idempotency_key)
    values(v_order_id,v_number,p_buyer_user_id,'CONFIRMED',v_total,v_total,'IRR',v_import.customer_snapshot||jsonb_build_object('woocommerceOrder',v_import.external_order_number,'channel','WOOCOMMERCE'),v_import.shipping_address_snapshot,0,'woo-import:'||p_import_id||':'||v_item.address_key);

    for v_row in
      select wi.*,spv.seller_product_id,spv.raw_product_variant_id,spv.supplier_offer_variant_id,
        sp.title,sp.description,sp.design_id,st.organization_id seller_org_id,
        so.supplier_organization_id,so.id offer_id,so.facility_id,so.lead_time_days,
        rpc.name color_name,rps.name size_name
      from public.woocommerce_order_import_items wi
      join public.seller_product_variants spv on spv.id=wi.seller_product_variant_id
      join public.seller_products sp on sp.id=spv.seller_product_id
      join public.stores st on st.id=sp.store_id
      join public.raw_product_variants rpv on rpv.id=spv.raw_product_variant_id
      join public.raw_product_colors rpc on rpc.id=rpv.color_id
      join public.raw_product_sizes rps on rps.id=rpv.size_id
      join public.supplier_offer_variants sov on sov.id=spv.supplier_offer_variant_id
      join public.supplier_offers so on so.id=sov.supplier_offer_id
      where wi.import_id=p_import_id and wi.address_key=v_item.address_key
    loop
      v_order_item_id:=gen_random_uuid();
      insert into public.order_items(id,order_id,seller_product_id,seller_product_variant_id,raw_product_variant_id,supplier_offer_variant_id,seller_organization_id,supplier_organization_id,quantity,unit_price,cost_snapshot,line_total,product_snapshot,design_snapshot)
      values(v_order_item_id,v_order_id,v_row.seller_product_id,v_row.seller_product_variant_id,v_row.raw_product_variant_id,v_row.supplier_offer_variant_id,v_row.seller_org_id,v_row.supplier_organization_id,v_row.quantity,v_row.unit_cost,v_row.unit_cost,v_row.unit_cost*v_row.quantity,jsonb_build_object('title',v_row.title,'description',v_row.description,'color',v_row.color_name,'size',v_row.size_name,'woocommerceProductId',v_row.external_product_id,'woocommerceVariationId',v_row.external_variation_id),coalesce((select jsonb_object_agg(rv.side,dv.canvas_document) from public.design_views dv join public.raw_product_views rv on rv.id=dv.raw_product_view_id where dv.design_id=v_row.design_id),'{}'::jsonb));
      select id into v_fulfilment_id from public.fulfilments where order_id=v_order_id and supplier_organization_id=v_row.supplier_organization_id and facility_id=v_row.facility_id and supplier_offer_id=v_row.offer_id limit 1;
      if v_fulfilment_id is null then
        v_fulfilment_id:=gen_random_uuid();
        insert into public.fulfilments(id,order_id,supplier_organization_id,facility_id,supplier_offer_id,assignment_snapshot,status,due_at)
        values(v_fulfilment_id,v_order_id,v_row.supplier_organization_id,v_row.facility_id,v_row.offer_id,jsonb_build_object('offerId',v_row.offer_id,'unitCost',v_row.unit_cost,'leadTimeDays',v_row.lead_time_days,'source','WOOCOMMERCE'),'ASSIGNED',now()+make_interval(days=>v_row.lead_time_days));
      end if;
      insert into public.fulfilment_items(fulfilment_id,order_item_id,quantity) values(v_fulfilment_id,v_order_item_id,v_row.quantity);
    end loop;
    update public.orders set paid_at=now() where id=v_order_id;
    insert into public.payments(order_id,provider,provider_payment_id,idempotency_key,amount,status,provider_response,captured_at)
    values(v_order_id,'WOOCOMMERCE_CHANNEL',p_import_id::text||':'||v_item.address_key,'woo-channel-payment:'||p_import_id||':'||v_item.address_key,v_total,'CAPTURED',jsonb_build_object('importId',p_import_id,'externalOrder',v_import.external_order_number),now());
    v_order_ids:=array_append(v_order_ids,v_order_id);
  end loop;
  update public.woocommerce_channel_accounts set balance=balance-v_import.required_amount,updated_at=now() where organization_id=v_import.organization_id;
  insert into public.woocommerce_channel_transactions(organization_id,import_id,direction,amount,source,reference,idempotency_key) values(v_import.organization_id,p_import_id,'DEBIT',v_import.required_amount,'ORDER',v_import.external_order_number,'woo-order:'||p_import_id);
  update public.woocommerce_order_imports set status='CONVERTED',platform_order_ids=v_order_ids,converted_at=now(),updated_at=now() where id=p_import_id;
  return v_order_ids;
end $$;

revoke all on function public.service_convert_woocommerce_import(uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_convert_woocommerce_import(uuid,uuid) to service_role;
