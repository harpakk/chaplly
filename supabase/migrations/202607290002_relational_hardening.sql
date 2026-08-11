-- Chapli relational hardening
-- Replaces the temporary custom identity/session model with Supabase Auth,
-- normalizes catalog/design/commerce/finance data, and makes tenant isolation
-- a database concern.

create extension if not exists pgcrypto with schema extensions;

create type public.account_role as enum ('BUYER','SELLER','SUPPLIER','ADMIN');
create type public.account_state as enum ('PENDING','ACTIVE','RESTRICTED','SUSPENDED','CLOSED');
create type public.membership_state as enum ('INVITED','ACTIVE','REVOKED');
create type public.publication_state as enum ('DRAFT','PENDING','APPROVED','PUBLISHED','REJECTED','ARCHIVED');
create type public.order_state as enum ('DRAFT','CONFIRMED','IN_PRODUCTION','PARTIALLY_SENT','SENT','DONE','CANCELLED','RETURNED','DISPUTED');
create type public.payment_state as enum ('PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED','CANCELLED');
create type public.payout_state as enum ('REQUESTED','PROCESSING','PAID','REJECTED','CANCELLED');
create type public.earning_state as enum ('PENDING','AVAILABLE','RESERVED','PAID','REVERSED');
create type public.file_state as enum ('PENDING','READY','QUARANTINED','REJECTED','DELETED');
create type public.asset_kind as enum (
  'PRODUCT_IMAGE','RAW_PRODUCT_IMAGE','RAW_BACKGROUND','RAW_OVERLAY',
  'VARIANT_MOCKUP','DESIGN_SOURCE','DESIGN_PREVIEW','PRINTABLE_EXPORT',
  'AI_IMAGE','PAYOUT_RECEIPT','TICKET_ATTACHMENT','STORE_LOGO','STORE_BANNER',
  'TUTORIAL_VIDEO','TUTORIAL_FILE','TUTORIAL_THUMBNAIL','REEL_VIDEO'
);
create type public.moderation_state as enum ('PENDING','APPROVED','REJECTED');
create type public.side_name as enum ('FRONT','BACK');

-- Identity -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  primary_role public.account_role not null default 'BUYER',
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  avatar_path text,
  locale text not null default 'fa-IR',
  state public.account_state not null default 'ACTIVE',
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lower check (email = lower(email)),
  constraint profiles_email_unique unique (email)
);

create table public.buyer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'SUPER_ADMIN'
    check (role in ('SUPER_ADMIN','CATALOG_MANAGER','SUPPLIER_OPERATIONS','MODERATOR','SUPPORT','FINANCE','ANALYST')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.account_role;
begin
  requested_role := case upper(coalesce(new.raw_user_meta_data->>'role','BUYER'))
    when 'SELLER' then 'SELLER'::public.account_role
    when 'SUPPLIER' then 'SUPPLIER'::public.account_role
    when 'ADMIN' then 'ADMIN'::public.account_role
    else 'BUYER'::public.account_role
  end;

  insert into public.profiles(
    id, primary_role, email, first_name, last_name, phone,
    email_verified_at, phone_verified_at
  ) values (
    new.id,
    requested_role,
    lower(coalesce(new.email, new.id::text || '@invalid.local')),
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    nullif(coalesce(new.phone,new.raw_user_meta_data->>'phone'),''),
    new.email_confirmed_at,
    new.phone_confirmed_at
  )
  on conflict (id) do update set
    email = excluded.email,
    email_verified_at = excluded.email_verified_at,
    phone_verified_at = excluded.phone_verified_at,
    updated_at = now();

  if requested_role = 'BUYER' then
    insert into public.buyer_profiles(user_id) values(new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, email_confirmed_at, phone_confirmed_at on auth.users
for each row execute function public.handle_new_auth_user();

-- Move all actor references to Auth-backed profiles.
drop function if exists public.register_seller(jsonb);
drop function if exists public.register_supplier(jsonb);
drop function if exists public.mark_fulfilment_sent(uuid,text,uuid);
drop table if exists public.sessions;

alter table public.memberships drop constraint if exists memberships_user_id_fkey;
alter table public.seller_onboarding_profiles drop constraint if exists seller_onboarding_profiles_user_id_fkey;
alter table public.supplier_offers drop constraint if exists supplier_offers_approved_by_fkey;
alter table public.product_moderation_queue drop constraint if exists product_moderation_queue_seller_id_fkey;
alter table public.product_moderation_queue drop constraint if exists product_moderation_queue_reviewed_by_fkey;
alter table public.orders drop constraint if exists orders_buyer_user_id_fkey;
alter table public.payout_requests drop constraint if exists payout_requests_processed_by_fkey;
alter table public.payout_payment_history drop constraint if exists payout_payment_history_admin_id_fkey;
alter table public.tickets drop constraint if exists tickets_opened_by_user_id_fkey;
alter table public.tickets drop constraint if exists tickets_assignee_id_fkey;
alter table public.ticket_participants drop constraint if exists ticket_participants_user_id_fkey;
alter table public.ticket_messages drop constraint if exists ticket_messages_sender_id_fkey;
alter table public.ticket_read_states drop constraint if exists ticket_read_states_user_id_fkey;

drop table if exists public.users;

alter table public.memberships
  add constraint memberships_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.seller_onboarding_profiles
  add constraint seller_onboarding_profiles_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.supplier_offers
  add constraint supplier_offers_approved_by_fkey foreign key(approved_by) references public.profiles(id) on delete set null;
alter table public.product_moderation_queue
  add constraint product_moderation_queue_seller_id_fkey foreign key(seller_id) references public.profiles(id) on delete restrict,
  add constraint product_moderation_queue_reviewed_by_fkey foreign key(reviewed_by) references public.profiles(id) on delete set null;
alter table public.orders
  add constraint orders_buyer_user_id_fkey foreign key(buyer_user_id) references public.profiles(id) on delete set null;
alter table public.payout_requests
  add constraint payout_requests_processed_by_fkey foreign key(processed_by) references public.profiles(id) on delete set null;
alter table public.payout_payment_history
  add constraint payout_payment_history_admin_id_fkey foreign key(admin_id) references public.profiles(id) on delete set null;
alter table public.tickets
  add constraint tickets_opened_by_user_id_fkey foreign key(opened_by_user_id) references public.profiles(id) on delete restrict,
  add constraint tickets_assignee_id_fkey foreign key(assignee_id) references public.profiles(id) on delete set null;
alter table public.ticket_participants
  add constraint ticket_participants_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.ticket_messages
  add constraint ticket_messages_sender_id_fkey foreign key(sender_id) references public.profiles(id) on delete set null;
alter table public.ticket_read_states
  add constraint ticket_read_states_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;

alter table public.memberships
  alter column status drop default,
  alter column status type public.membership_state using status::public.membership_state,
  alter column status set default 'ACTIVE';

alter table public.organizations
  add column contact_email text,
  add column contact_phone text,
  add column website_url text,
  add column description text,
  add column national_id text,
  add column registration_number text,
  add constraint organizations_status_check check(status in ('PENDING','ACTIVE','RESTRICTED','SUSPENDED','CLOSED'));
alter table public.organizations drop column profile;

create table public.seller_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_type text,
  experience_level text,
  instagram_handle text,
  audience_size integer check(audience_size is null or audience_size >= 0),
  monthly_views bigint check(monthly_views is null or monthly_views >= 0),
  goal text,
  status text not null default 'ACTIVE' check(status in ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop table if exists public.seller_onboarding_profiles;

-- File metadata and storage ownership -----------------------------------------

create table public.storage_files (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  owner_organization_id uuid references public.organizations(id) on delete cascade,
  bucket text not null,
  path text not null,
  kind public.asset_kind not null,
  original_name text,
  mime_type text not null,
  size_bytes bigint not null default 0 check(size_bytes >= 0),
  checksum_sha256 text,
  width integer check(width is null or width > 0),
  height integer check(height is null or height > 0),
  state public.file_state not null default 'READY',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket,path),
  constraint storage_file_owner check(owner_user_id is not null or owner_organization_id is not null or kind in ('RAW_PRODUCT_IMAGE','RAW_BACKGROUND','RAW_OVERLAY','VARIANT_MOCKUP','TUTORIAL_VIDEO','TUTORIAL_FILE','TUTORIAL_THUMBNAIL'))
);

alter table public.stores
  add column owner_user_id uuid references public.profiles(id) on delete restrict,
  add column logo_file_id uuid references public.storage_files(id) on delete set null,
  add column banner_file_id uuid references public.storage_files(id) on delete set null,
  add column brand_color text not null default '#ef5b4c' check(brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column accent_color text not null default '#3d8b70' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column brand_tone text,
  add column follower_count integer not null default 0 check(follower_count >= 0),
  add column is_verified boolean not null default false,
  add constraint stores_status_check check(status in ('DRAFT','PENDING','ACTIVE','SUSPENDED','CLOSED'));
alter table public.stores
  drop column logo_url,
  drop column banner_url,
  drop column theme;

-- Buyer data -----------------------------------------------------------------

create table public.buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'خانه',
  recipient_name text not null,
  phone text not null,
  province text not null,
  city text not null,
  address_line text not null,
  postal_code text not null,
  delivery_note text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index buyer_addresses_one_default_idx on public.buyer_addresses(user_id) where is_default;

-- Catalog --------------------------------------------------------------------

alter table public.categories
  drop constraint if exists categories_parent_id_fkey;
alter table public.categories
  add constraint categories_parent_id_fkey foreign key(parent_id) references public.categories(id) on delete restrict,
  add column image_file_id uuid references public.storage_files(id) on delete set null,
  add column description text,
  add column seo_title text,
  add column seo_description text,
  add constraint categories_status_check check(status in ('ACTIVE','INACTIVE','ARCHIVED'));

alter table public.raw_products
  alter column category_id set not null,
  add column slug text,
  add column sku_prefix text,
  add column material text,
  add column weight_grams integer check(weight_grams is null or weight_grams > 0),
  add column production_notes text,
  add constraint raw_products_status_check check(status in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED'));
update public.raw_products set slug = 'raw-' || substr(id::text,1,8) where slug is null;
alter table public.raw_products alter column slug set not null;
create unique index raw_products_slug_idx on public.raw_products(slug);
alter table public.raw_products drop column images;

alter table public.raw_product_colors
  add column slug text,
  add column sort_order integer not null default 0,
  add constraint raw_product_colors_hex_check check(hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint raw_product_colors_status_check check(status in ('ACTIVE','INACTIVE'));
update public.raw_product_colors set slug='color-'||substr(id::text,1,8) where slug is null;
alter table public.raw_product_colors alter column slug set not null;
create unique index raw_product_colors_slug_idx on public.raw_product_colors(raw_product_id,slug);
alter table public.raw_product_colors drop column mockup_front_url, drop column mockup_back_url;

alter table public.raw_product_sizes
  add column label text,
  add constraint raw_product_sizes_status_check check(status in ('ACTIVE','INACTIVE'));

create table public.raw_product_variants (
  id uuid primary key default gen_random_uuid(),
  raw_product_id uuid not null references public.raw_products(id) on delete cascade,
  color_id uuid not null references public.raw_product_colors(id) on delete restrict,
  size_id uuid not null references public.raw_product_sizes(id) on delete restrict,
  sku text not null unique,
  additional_cost bigint not null default 0 check(additional_cost >= 0),
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(raw_product_id,color_id,size_id)
);

alter table public.raw_product_views
  drop constraint if exists raw_product_views_side_check;
alter table public.raw_product_views
  alter column side type public.side_name using side::public.side_name,
  add constraint raw_product_views_area_x check(print_area_x >= 0 and print_area_x <= 1),
  add constraint raw_product_views_area_y check(print_area_y >= 0 and print_area_y <= 1),
  add constraint raw_product_views_area_width check(print_area_width > 0 and print_area_width <= 1),
  add constraint raw_product_views_area_height check(print_area_height > 0 and print_area_height <= 1),
  add constraint raw_product_views_bounds_x check(print_area_x + print_area_width <= 1),
  add constraint raw_product_views_bounds_y check(print_area_y + print_area_height <= 1);
alter table public.raw_product_views
  drop column background_by_color,
  drop column overlay_by_color;

create table public.raw_product_variant_assets (
  id uuid primary key default gen_random_uuid(),
  raw_product_variant_id uuid not null references public.raw_product_variants(id) on delete cascade,
  raw_product_view_id uuid not null references public.raw_product_views(id) on delete cascade,
  background_file_id uuid not null references public.storage_files(id) on delete restrict,
  overlay_file_id uuid references public.storage_files(id) on delete set null,
  mockup_file_id uuid references public.storage_files(id) on delete set null,
  print_area_override_x numeric(8,6),
  print_area_override_y numeric(8,6),
  print_area_override_width numeric(8,6),
  print_area_override_height numeric(8,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(raw_product_variant_id,raw_product_view_id),
  constraint variant_asset_override_all_or_none check(
    (print_area_override_x is null and print_area_override_y is null and print_area_override_width is null and print_area_override_height is null)
    or
    (print_area_override_x between 0 and 1 and print_area_override_y between 0 and 1
      and print_area_override_width > 0 and print_area_override_width <= 1
      and print_area_override_height > 0 and print_area_override_height <= 1
      and print_area_override_x + print_area_override_width <= 1
      and print_area_override_y + print_area_override_height <= 1)
  )
);

create table public.raw_product_media (
  id uuid primary key default gen_random_uuid(),
  raw_product_id uuid not null references public.raw_products(id) on delete cascade,
  file_id uuid not null references public.storage_files(id) on delete restrict,
  alt_text text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  unique(raw_product_id,file_id)
);
create unique index raw_product_media_primary_idx on public.raw_product_media(raw_product_id) where is_primary;

create table public.print_methods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supplier capabilities -------------------------------------------------------

alter table public.supplier_profiles
  add column owner_user_id uuid references public.profiles(id) on delete restrict,
  add column description text,
  add column logo_file_id uuid references public.storage_files(id) on delete set null,
  add constraint supplier_profiles_capacity check(capacity_per_day >= 0),
  add constraint supplier_profiles_lead_time check(lead_time_days > 0),
  add constraint supplier_profiles_approval_mode check(approval_mode in ('AUTO','MANUAL')),
  add constraint supplier_profiles_status check(status in ('PENDING','APPROVED','REJECTED','SUSPENDED'));
alter table public.supplier_profiles drop column methods, drop column categories, drop column bank_account;

create table public.supplier_print_methods (
  supplier_organization_id uuid not null references public.organizations(id) on delete cascade,
  print_method_id uuid not null references public.print_methods(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(supplier_organization_id,print_method_id)
);

create table public.supplier_category_capabilities (
  supplier_organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(supplier_organization_id,category_id)
);

alter table public.facilities
  add column phone text,
  add column working_days smallint[] not null default array[0,1,2,3,4,5]::smallint[],
  add column cutoff_time time,
  add constraint facilities_status_check check(status in ('ACTIVE','PAUSED','CLOSED')),
  add constraint facilities_working_days_check check(working_days <@ array[0,1,2,3,4,5,6]::smallint[]);

alter table public.supplier_offers
  add column print_method_id uuid references public.print_methods(id) on delete restrict,
  add column minimum_order_quantity integer not null default 1 check(minimum_order_quantity > 0),
  add column notes text,
  add constraint supplier_offers_cost_check check(base_cost >= 0),
  add constraint supplier_offers_lead_time_check check(lead_time_days > 0),
  add constraint supplier_offers_capacity_check check(capacity_per_day > 0),
  add constraint supplier_offers_approval_check check(approval_status in ('PENDING','APPROVED','REJECTED')),
  add constraint supplier_offers_status_check check(status in ('ACTIVE','PAUSED','INACTIVE'));

drop table if exists public.supplier_offer_variants;
create table public.supplier_offer_variants (
  id uuid primary key default gen_random_uuid(),
  supplier_offer_id uuid not null references public.supplier_offers(id) on delete cascade,
  raw_product_variant_id uuid not null references public.raw_product_variants(id) on delete restrict,
  unit_cost bigint not null check(unit_cost >= 0),
  stock_status text not null default 'AVAILABLE' check(stock_status in ('AVAILABLE','LOW_STOCK','OUT_OF_STOCK','PAUSED')),
  stock_quantity integer check(stock_quantity is null or stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_offer_id,raw_product_variant_id)
);

-- Design and seller products --------------------------------------------------

alter table public.designs
  add column owner_user_id uuid references public.profiles(id) on delete restrict,
  add column name text not null default 'طرح بدون نام',
  add column schema_version integer not null default 1 check(schema_version > 0),
  add column version integer not null default 1 check(version > 0),
  add constraint designs_status_check check(status in ('DRAFT','READY','ARCHIVED'));
alter table public.designs drop column artwork_by_view, drop column selected_color_ids, drop column selected_size_ids;

create table public.design_views (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs(id) on delete cascade,
  raw_product_view_id uuid not null references public.raw_product_views(id) on delete restrict,
  canvas_document jsonb not null default '{"version":1,"objects":[]}'::jsonb,
  source_file_id uuid references public.storage_files(id) on delete set null,
  preview_file_id uuid references public.storage_files(id) on delete set null,
  printable_export_file_id uuid references public.storage_files(id) on delete set null,
  validation_state text not null default 'PENDING' check(validation_state in ('PENDING','VALID','WARNING','INVALID')),
  validation_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(design_id,raw_product_view_id),
  constraint design_canvas_is_object check(jsonb_typeof(canvas_document)='object'),
  constraint design_validation_messages_array check(jsonb_typeof(validation_messages)='array')
);

create table public.design_variants (
  design_id uuid not null references public.designs(id) on delete cascade,
  raw_product_variant_id uuid not null references public.raw_product_variants(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(design_id,raw_product_variant_id)
);

alter table public.seller_products
  add column slug text,
  add column subtitle text,
  add column moderation_status public.moderation_state not null default 'PENDING',
  add column seo_title text,
  add column seo_description text,
  add column rating_average numeric(3,2) not null default 0 check(rating_average between 0 and 5),
  add column review_count integer not null default 0 check(review_count >= 0),
  add column sales_count integer not null default 0 check(sales_count >= 0),
  add column view_count bigint not null default 0 check(view_count >= 0),
  add column is_featured boolean not null default false,
  add constraint seller_products_price_check check(price >= 0),
  add constraint seller_products_discount_check check(discounted_price is null or (discounted_price >= 0 and discounted_price < price)),
  add constraint seller_products_status_check check(status in ('DRAFT','PENDING','APPROVED','PUBLISHED','REJECTED','ARCHIVED'));
update public.seller_products set slug='product-'||substr(id::text,1,8) where slug is null;
alter table public.seller_products alter column slug set not null;
create unique index seller_products_store_slug_idx on public.seller_products(store_id,slug);
alter table public.seller_products drop column details, drop column images;

create table public.seller_product_variants (
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  raw_product_variant_id uuid not null references public.raw_product_variants(id) on delete restrict,
  supplier_offer_variant_id uuid not null references public.supplier_offer_variants(id) on delete restrict,
  backup_supplier_offer_variant_id uuid references public.supplier_offer_variants(id) on delete restrict,
  sku text not null unique,
  price bigint not null check(price >= 0),
  compare_at_price bigint check(compare_at_price is null or compare_at_price > price),
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','OUT_OF_STOCK')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(seller_product_id,raw_product_variant_id),
  constraint seller_product_variant_backup_diff check(backup_supplier_offer_variant_id is null or backup_supplier_offer_variant_id <> supplier_offer_variant_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  file_id uuid not null references public.storage_files(id) on delete restrict,
  alt_text text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(seller_product_id,file_id)
);
create unique index product_images_primary_idx on public.product_images(seller_product_id) where is_primary;

create table public.product_details (
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  title text not null,
  value text not null,
  sort_order integer not null default 0,
  unique(seller_product_id,title)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.product_tags (
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key(seller_product_id,tag_id)
);

create table public.graphic_styles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  caption text,
  image_file_id uuid references public.storage_files(id) on delete set null,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_graphic_styles (
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  graphic_style_id uuid not null references public.graphic_styles(id) on delete cascade,
  primary key(seller_product_id,graphic_style_id)
);

create table public.product_videos (
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  file_id uuid not null references public.storage_files(id) on delete restrict,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(seller_product_id,file_id)
);

create table public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  seed_key text unique,
  eyebrow text,
  title text not null,
  body text,
  desktop_file_id uuid references public.storage_files(id) on delete set null,
  mobile_file_id uuid references public.storage_files(id) on delete set null,
  external_image_url text,
  cta_label text not null,
  cta_url text not null,
  tone text not null default 'coral',
  placement text not null default 'HOME',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'ACTIVE' check(status in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banner_date_range check(ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Social, reviews, and buyer engagement --------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  rating smallint not null check(rating between 1 and 5),
  title text,
  body text,
  status text not null default 'PUBLISHED' check(status in ('PENDING','PUBLISHED','REJECTED','HIDDEN')),
  is_verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(buyer_user_id,seller_product_id,order_item_id)
);

create table public.wishlist_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,seller_product_id)
);

create table public.recent_product_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check(view_count > 0),
  primary key(user_id,seller_product_id)
);

create table public.reel_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  seller_product_id uuid references public.seller_products(id) on delete set null,
  video_file_id uuid not null references public.storage_files(id) on delete restrict,
  caption text not null,
  status text not null default 'PUBLISHED' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
  like_count integer not null default 0 check(like_count >= 0),
  save_count integer not null default 0 check(save_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reel_likes(
  reel_id uuid not null references public.reel_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(reel_id,user_id)
);
create table public.reel_saves(
  reel_id uuid not null references public.reel_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(reel_id,user_id)
);

-- Cart, checkout, order, shipment --------------------------------------------

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid references public.profiles(id) on delete cascade,
  anonymous_token uuid,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','CONVERTED','ABANDONED')),
  currency text not null default 'IRR',
  expires_at timestamptz not null default (now()+interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_identity check((buyer_user_id is not null) <> (anonymous_token is not null))
);
create unique index carts_active_buyer_idx on public.carts(buyer_user_id) where status='ACTIVE' and buyer_user_id is not null;
create unique index carts_active_anonymous_idx on public.carts(anonymous_token) where status='ACTIVE' and anonymous_token is not null;

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  seller_product_variant_id uuid not null references public.seller_product_variants(id) on delete cascade,
  quantity integer not null check(quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id,seller_product_variant_id)
);

alter table public.orders
  alter column status drop default,
  alter column status type public.order_state using status::public.order_state,
  alter column status set default 'CONFIRMED',
  add column idempotency_key text,
  add column shipping_address_id uuid references public.buyer_addresses(id) on delete set null,
  add column shipping_amount bigint not null default 0 check(shipping_amount >= 0),
  add column discount_amount bigint not null default 0 check(discount_amount >= 0),
  add column tax_amount bigint not null default 0 check(tax_amount >= 0),
  add column paid_at timestamptz,
  add column completed_at timestamptz,
  add constraint orders_totals_check check(subtotal >= 0 and total >= 0 and total = subtotal + shipping_amount + tax_amount - discount_amount);
create unique index orders_idempotency_idx on public.orders(idempotency_key) where idempotency_key is not null;

alter table public.order_items
  add column seller_product_variant_id uuid references public.seller_product_variants(id) on delete restrict,
  add column raw_product_variant_id uuid references public.raw_product_variants(id) on delete restrict,
  add column supplier_offer_variant_id uuid references public.supplier_offer_variants(id) on delete restrict,
  add column seller_organization_id uuid references public.organizations(id) on delete restrict,
  add column supplier_organization_id uuid references public.organizations(id) on delete restrict,
  add column line_total bigint not null default 0 check(line_total >= 0),
  add column created_at timestamptz not null default now(),
  add constraint order_items_unit_price_check check(unit_price >= 0),
  add constraint order_items_cost_check check(cost_snapshot >= 0);

alter table public.fulfilments
  alter column assignment_snapshot set default '{}'::jsonb,
  add column due_at timestamptz,
  add column disputed_at timestamptz,
  add column version integer not null default 1 check(version > 0);

create table public.fulfilment_files (
  fulfilment_id uuid not null references public.fulfilments(id) on delete cascade,
  file_id uuid not null references public.storage_files(id) on delete restrict,
  purpose text not null check(purpose in ('PRINT_FRONT','PRINT_BACK','REFERENCE','PACKING')),
  created_at timestamptz not null default now(),
  primary key(fulfilment_id,file_id,purpose)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  fulfilment_id uuid not null references public.fulfilments(id) on delete cascade,
  carrier text,
  service text,
  tracking_code text not null,
  status text not null default 'SENT' check(status in ('LABEL_CREATED','SENT','IN_TRANSIT','DELIVERED','RETURNED','LOST','CANCELLED')),
  shipped_at timestamptz not null default now(),
  delivered_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(carrier,tracking_code)
);

create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  description text,
  location text,
  provider_event_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(shipment_id,provider_event_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text,
  idempotency_key text not null unique,
  amount bigint not null check(amount > 0),
  currency text not null default 'IRR',
  status public.payment_state not null default 'PENDING',
  provider_response jsonb not null default '{}'::jsonb,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_payment_id)
);

-- Finance --------------------------------------------------------------------

create table public.earnings (
  id uuid primary key default gen_random_uuid(),
  beneficiary_organization_id uuid not null references public.organizations(id) on delete restrict,
  earning_type text not null check(earning_type in ('SELLER','SUPPLIER')),
  source_type text not null check(source_type in ('ORDER_ITEM','FULFILMENT','ADJUSTMENT')),
  source_id uuid not null,
  order_id uuid references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  fulfilment_id uuid references public.fulfilments(id) on delete restrict,
  gross_amount bigint not null check(gross_amount >= 0),
  fee_amount bigint not null default 0 check(fee_amount >= 0),
  net_amount bigint not null check(net_amount >= 0 and net_amount = gross_amount-fee_amount),
  currency text not null default 'IRR',
  status public.earning_state not null default 'PENDING',
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(beneficiary_organization_id,earning_type,source_type,source_id)
);

alter table public.bank_accounts
  add column account_holder_name text,
  add column verified_at timestamptz,
  add constraint bank_accounts_priority_check check(priority > 0),
  add constraint bank_accounts_status_check check(status in ('ACTIVE','INACTIVE','PENDING_VERIFICATION')),
  add constraint bank_accounts_identity_unique unique(organization_id,card_number,iban);

alter table public.payout_requests
  alter column status drop default,
  alter column status type public.payout_state using status::public.payout_state,
  alter column status set default 'REQUESTED',
  add column idempotency_key text,
  add column rejection_reason text,
  add constraint payout_requests_amount_check check(amount > 0);
alter table public.payout_requests drop column order_ids;
create unique index payout_requests_idempotency_idx on public.payout_requests(idempotency_key) where idempotency_key is not null;
create unique index payout_requests_one_open_idx on public.payout_requests(organization_id) where status in ('REQUESTED','PROCESSING');

create table public.payout_request_items (
  payout_request_id uuid not null references public.payout_requests(id) on delete restrict,
  earning_id uuid not null references public.earnings(id) on delete restrict,
  amount bigint not null check(amount > 0),
  created_at timestamptz not null default now(),
  primary key(payout_request_id,earning_id),
  unique(earning_id)
);

alter table public.payout_payment_history
  add column receipt_file_id uuid references public.storage_files(id) on delete set null,
  add column reference text;
alter table public.payout_payment_history drop column order_ids, drop column receipt_path;

create table public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  body text not null,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rejection_reasons
  add column code text,
  add column sms_template_id uuid references public.sms_templates(id) on delete restrict;
update public.rejection_reasons set code='REASON_'||substr(id::text,1,8) where code is null;
alter table public.rejection_reasons alter column code set not null;
create unique index rejection_reasons_code_idx on public.rejection_reasons(code);
alter table public.rejection_reasons drop column sms_template;

create table public.product_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references public.seller_products(id) on delete restrict,
  queue_id uuid references public.product_moderation_queue(id) on delete set null,
  decision public.moderation_state not null check(decision in ('APPROVED','REJECTED')),
  rejection_reason_id uuid references public.rejection_reasons(id) on delete restrict,
  custom_message text,
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint moderation_rejection_reason check(decision='APPROVED' or rejection_reason_id is not null)
);

create table public.ai_credit_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lifetime_granted integer not null default 1 check(lifetime_granted >= 0),
  lifetime_used integer not null default 0 check(lifetime_used >= 0 and lifetime_used <= lifetime_granted),
  updated_at timestamptz not null default now()
);
create table public.ai_credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  design_id uuid references public.designs(id) on delete set null,
  idempotency_key text not null unique,
  delta integer not null check(delta <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_phone text,
  template_id uuid references public.sms_templates(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'PENDING' check(status in ('PENDING','SENT','FAILED','CANCELLED')),
  attempts integer not null default 0 check(attempts >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tutorials ------------------------------------------------------------------

create table public.tutorials (
  id uuid primary key default gen_random_uuid(),
  seed_key text unique,
  title text not null,
  description text not null,
  video_file_id uuid references public.storage_files(id) on delete set null,
  thumbnail_file_id uuid references public.storage_files(id) on delete set null,
  attachment_file_id uuid references public.storage_files(id) on delete set null,
  duration_minutes integer check(duration_minutes is null or duration_minutes > 0),
  sort_order integer not null default 0,
  status text not null default 'PUBLISHED' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.tutorial_progress (
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed boolean not null default false,
  progress_percent integer not null default 0 check(progress_percent between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(tutorial_id,user_id)
);

-- Safer ticket constraints and references.
alter table public.ticket_participants drop constraint if exists ticket_participants_ticket_id_user_id_key;
create unique index ticket_participants_user_unique_idx on public.ticket_participants(ticket_id,user_id) where user_id is not null;
create unique index ticket_participants_org_unique_idx on public.ticket_participants(ticket_id,organization_id) where organization_id is not null;
alter table public.ticket_participants add constraint ticket_participant_identity check(user_id is not null or organization_id is not null);
alter table public.ticket_messages add constraint ticket_message_visibility_check check(visibility in ('PUBLIC','INTERNAL','SYSTEM'));
alter table public.ticket_messages add constraint ticket_sender_role_check check(sender_role in ('BUYER','SELLER','SUPPLIER','ADMIN','SYSTEM'));
alter table public.ticket_attachments
  add column file_id uuid references public.storage_files(id) on delete restrict,
  add constraint ticket_scan_status_check check(scan_status in ('PENDING','CLEAN','REJECTED'));

-- Audit/outbox immutability and useful indexes -------------------------------

alter table public.audit_events add column request_id text, add column ip_hash text;

create index profiles_role_state_idx on public.profiles(primary_role,state);
create index memberships_org_status_idx on public.memberships(organization_id,status,user_id);
create index stores_public_idx on public.stores(status,created_at desc);
create index raw_products_category_status_idx on public.raw_products(category_id,status,created_at desc);
create index raw_variants_product_status_idx on public.raw_product_variants(raw_product_id,status);
create index raw_variant_assets_variant_idx on public.raw_product_variant_assets(raw_product_variant_id,raw_product_view_id);
create index supplier_offer_variants_offer_stock_idx on public.supplier_offer_variants(supplier_offer_id,stock_status);
create index supplier_offer_variants_raw_idx on public.supplier_offer_variants(raw_product_variant_id,stock_status);
create index design_views_design_idx on public.design_views(design_id);
create index seller_product_public_idx on public.seller_products(status,moderation_status,published_at desc);
create index seller_product_variants_product_idx on public.seller_product_variants(seller_product_id,status);
create index product_images_product_sort_idx on public.product_images(seller_product_id,is_primary desc,sort_order);
create index reviews_product_status_idx on public.reviews(seller_product_id,status,created_at desc);
create index orders_buyer_created_idx on public.orders(buyer_user_id,created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_seller_org_idx on public.order_items(seller_organization_id,created_at desc);
create index order_items_supplier_org_idx on public.order_items(supplier_organization_id,created_at desc);
create index shipments_fulfilment_idx on public.shipments(fulfilment_id,created_at desc);
create index tracking_events_shipment_idx on public.tracking_events(shipment_id,occurred_at);
create index earnings_org_status_idx on public.earnings(beneficiary_organization_id,status,available_at);
create index payout_requests_queue_idx on public.payout_requests(status,requested_at);
create index storage_files_owner_user_idx on public.storage_files(owner_user_id,kind,created_at desc);
create index storage_files_owner_org_idx on public.storage_files(owner_organization_id,kind,created_at desc);
create index moderation_queue_status_idx on public.product_moderation_queue(status,submitted_at);
create index notification_outbox_pending_idx on public.notification_outbox(status,available_at) where status='PENDING';
create index reel_posts_public_idx on public.reel_posts(status,published_at desc);

-- Common updated_at triggers --------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path=public
as $$ begin new.updated_at=now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','buyer_profiles','admin_profiles','seller_profiles','storage_files',
    'raw_product_variants','raw_product_variant_assets','print_methods',
    'supplier_offer_variants','design_views','seller_product_variants',
    'graphic_styles','homepage_banners','reviews','reel_posts','carts','cart_items',
    'shipments','payments','earnings','sms_templates','ai_credit_accounts',
    'notification_outbox','tutorials','tutorial_progress'
  ] loop
    execute format('drop trigger if exists %I on public.%I',t||'_touch',t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',t||'_touch',t);
  end loop;
end $$;
