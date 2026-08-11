# Supabase backend inventory

Generated from the live database on 2026-07-31T14:06:37.864Z. Re-run with `npm run db:docs`.

Identity is sourced from `auth.users`. Application identities live in `public.profiles`, and role-specific profiles/memberships connect Buyers, Sellers, Suppliers and Admins.

## Public schema (96 tables)

### `_chapli_migrations`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `name` | `text` | yes | — |
| `applied_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `_chapli_migrations_pkey`: `PRIMARY KEY (name)`

Indexes:
- `_chapli_migrations_pkey`: `CREATE UNIQUE INDEX _chapli_migrations_pkey ON public._chapli_migrations USING btree (name)`

RLS policies:
- No client policy; table is server/service-only.

### `admin_profiles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `user_id` | `uuid` | yes | — |
| `role` | `text` | yes | 'SUPER_ADMIN'::text |
| `is_active` | `boolean` | yes | true |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `access_expires_at` | `timestamp with time zone` | no | — |

Constraints:
- `admin_profiles_role_check`: `CHECK (role = ANY (ARRAY['SUPER_ADMIN'::text, 'CATALOG_MANAGER'::text, 'SUPPLIER_OPERATIONS'::text, 'MODERATOR'::text, 'SUPPORT'::text, 'FINANCE'::text, 'ANALYST'::text]))`
- `admin_profiles_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `admin_profiles_pkey`: `PRIMARY KEY (user_id)`

Indexes:
- `admin_profiles_active_access_idx`: `CREATE INDEX admin_profiles_active_access_idx ON public.admin_profiles USING btree (access_expires_at) WHERE is_active`
- `admin_profiles_pkey`: `CREATE UNIQUE INDEX admin_profiles_pkey ON public.admin_profiles USING btree (user_id)`

RLS policies:
- `admin_manage_admin_profiles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `admin_profiles_read_own` (SELECT, roles: {authenticated}): using `(user_id = auth.uid())`; check `—`

### `ai_credit_accounts`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `user_id` | `uuid` | yes | — |
| `lifetime_granted` | `integer` | yes | 1 |
| `lifetime_used` | `integer` | yes | 0 |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `ai_credit_accounts_check`: `CHECK (lifetime_used >= 0 AND lifetime_used <= lifetime_granted)`
- `ai_credit_accounts_lifetime_granted_check`: `CHECK (lifetime_granted >= 0)`
- `ai_credit_accounts_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `ai_credit_accounts_pkey`: `PRIMARY KEY (user_id)`

Indexes:
- `ai_credit_accounts_pkey`: `CREATE UNIQUE INDEX ai_credit_accounts_pkey ON public.ai_credit_accounts USING btree (user_id)`

RLS policies:
- `admin_manage_ai_credit_accounts` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `ai_accounts_own_read` (SELECT, roles: {authenticated}): using `(user_id = auth.uid())`; check `—`

### `ai_credit_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `user_id` | `uuid` | yes | — |
| `design_id` | `uuid` | no | — |
| `idempotency_key` | `text` | yes | — |
| `delta` | `integer` | yes | — |
| `reason` | `text` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `ai_credit_events_delta_check`: `CHECK (delta <> 0)`
- `ai_credit_events_design_id_fkey`: `FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE SET NULL`
- `ai_credit_events_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `ai_credit_events_pkey`: `PRIMARY KEY (id)`
- `ai_credit_events_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `ai_credit_events_idempotency_key_key`: `CREATE UNIQUE INDEX ai_credit_events_idempotency_key_key ON public.ai_credit_events USING btree (idempotency_key)`
- `ai_credit_events_pkey`: `CREATE UNIQUE INDEX ai_credit_events_pkey ON public.ai_credit_events USING btree (id)`
- `idx_ai_credit_events_ai_credit_events_design_id_fkey_f64cc425`: `CREATE INDEX idx_ai_credit_events_ai_credit_events_design_id_fkey_f64cc425 ON public.ai_credit_events USING btree (design_id)`
- `idx_ai_credit_events_ai_credit_events_user_id_fkey_27a34fa9`: `CREATE INDEX idx_ai_credit_events_ai_credit_events_user_id_fkey_27a34fa9 ON public.ai_credit_events USING btree (user_id)`

RLS policies:
- `admin_manage_ai_credit_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `ai_events_own_read` (SELECT, roles: {authenticated}): using `(user_id = auth.uid())`; check `—`

### `analytics_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `bigint` | yes | — |
| `user_id` | `uuid` | no | — |
| `anonymous_session_hash` | `text` | no | — |
| `event_name` | `text` | yes | — |
| `occurred_at` | `timestamp with time zone` | yes | now() |
| `consent_state` | `text` | yes | 'ESSENTIAL'::text |
| `properties` | `jsonb` | yes | '{}'::jsonb |
| `context` | `jsonb` | yes | '{}'::jsonb |
| `release_version` | `text` | no | — |

Constraints:
- `analytics_events_check`: `CHECK (user_id IS NOT NULL OR anonymous_session_hash IS NOT NULL)`
- `analytics_events_consent_state_check`: `CHECK (consent_state = ANY (ARRAY['ESSENTIAL'::text, 'ANALYTICS'::text, 'MARKETING'::text, 'DENIED'::text]))`
- `analytics_events_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `analytics_events_pkey`: `PRIMARY KEY (id)`

Indexes:
- `analytics_events_pkey`: `CREATE UNIQUE INDEX analytics_events_pkey ON public.analytics_events USING btree (id)`
- `idx_analytics_events_analytics_events_user_id_fkey_5ed54691`: `CREATE INDEX idx_analytics_events_analytics_events_user_id_fkey_5ed54691 ON public.analytics_events USING btree (user_id)`

RLS policies:
- `admin_manage_analytics_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `analytics_events_insert_anon` (INSERT, roles: {anon}): using `—`; check `(user_id IS NULL)`
- `analytics_events_insert_auth` (INSERT, roles: {authenticated}): using `—`; check `((user_id IS NULL) OR (user_id = auth.uid()))`

### `app_releases`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `version` | `text` | yes | — |
| `commit_sha` | `text` | yes | — |
| `migration_version` | `text` | no | — |
| `environment` | `text` | yes | — |
| `status` | `text` | yes | 'DEPLOYING'::text |
| `metadata` | `jsonb` | yes | '{}'::jsonb |
| `deployed_by` | `uuid` | no | — |
| `started_at` | `timestamp with time zone` | yes | now() |
| `completed_at` | `timestamp with time zone` | no | — |

Constraints:
- `app_releases_environment_check`: `CHECK (environment = ANY (ARRAY['TEST'::text, 'STAGING'::text, 'PRODUCTION'::text]))`
- `app_releases_status_check`: `CHECK (status = ANY (ARRAY['DEPLOYING'::text, 'ACTIVE'::text, 'FAILED'::text, 'ROLLED_BACK'::text]))`
- `app_releases_deployed_by_fkey`: `FOREIGN KEY (deployed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `app_releases_pkey`: `PRIMARY KEY (id)`
- `app_releases_environment_commit_sha_key`: `UNIQUE (environment, commit_sha)`
- `app_releases_environment_version_key`: `UNIQUE (environment, version)`

Indexes:
- `app_releases_environment_commit_sha_key`: `CREATE UNIQUE INDEX app_releases_environment_commit_sha_key ON public.app_releases USING btree (environment, commit_sha)`
- `app_releases_environment_version_key`: `CREATE UNIQUE INDEX app_releases_environment_version_key ON public.app_releases USING btree (environment, version)`
- `app_releases_pkey`: `CREATE UNIQUE INDEX app_releases_pkey ON public.app_releases USING btree (id)`
- `idx_app_releases_app_releases_deployed_by_fkey_71c2cefe`: `CREATE INDEX idx_app_releases_app_releases_deployed_by_fkey_71c2cefe ON public.app_releases USING btree (deployed_by)`

RLS policies:
- `admin_manage_app_releases` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`

### `audit_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `bigint` | yes | — |
| `actor_type` | `text` | yes | — |
| `actor_id` | `text` | no | — |
| `action` | `text` | yes | — |
| `target_type` | `text` | yes | — |
| `target_id` | `text` | no | — |
| `reason` | `text` | no | — |
| `before_data` | `jsonb` | no | — |
| `after_data` | `jsonb` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `request_id` | `text` | no | — |
| `ip_hash` | `text` | no | — |

Constraints:
- `audit_events_pkey`: `PRIMARY KEY (id)`

Indexes:
- `audit_events_pkey`: `CREATE UNIQUE INDEX audit_events_pkey ON public.audit_events USING btree (id)`

RLS policies:
- `admin_manage_audit_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`

### `balance_projections`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `organization_id` | `uuid` | yes | — |
| `pending` | `bigint` | yes | 0 |
| `available` | `bigint` | yes | 0 |
| `reserved` | `bigint` | yes | 0 |
| `currency` | `text` | yes | 'IRR'::text |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `balance_projections_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- `balance_projections_pkey`: `PRIMARY KEY (id)`
- `balance_projections_organization_id_key`: `UNIQUE (organization_id)`

Indexes:
- `balance_projections_organization_id_key`: `CREATE UNIQUE INDEX balance_projections_organization_id_key ON public.balance_projections USING btree (organization_id)`
- `balance_projections_pkey`: `CREATE UNIQUE INDEX balance_projections_pkey ON public.balance_projections USING btree (id)`

RLS policies:
- `admin_manage_balance_projections` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `balances_org_read` (SELECT, roles: {authenticated}): using `is_org_member(organization_id)`; check `—`

### `bank_accounts`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `organization_id` | `uuid` | yes | — |
| `bank_name` | `text` | no | — |
| `card_number` | `text` | no | — |
| `iban` | `text` | no | — |
| `priority` | `integer` | yes | 1 |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `account_holder_name` | `text` | no | — |
| `verified_at` | `timestamp with time zone` | no | — |

Constraints:
- `bank_accounts_priority_check`: `CHECK (priority > 0)`
- `bank_accounts_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'PENDING_VERIFICATION'::text]))`
- `bank_accounts_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- `bank_accounts_pkey`: `PRIMARY KEY (id)`
- `bank_accounts_identity_unique`: `UNIQUE (organization_id, card_number, iban)`
- `bank_accounts_organization_id_priority_key`: `UNIQUE (organization_id, priority)`

Indexes:
- `bank_accounts_identity_unique`: `CREATE UNIQUE INDEX bank_accounts_identity_unique ON public.bank_accounts USING btree (organization_id, card_number, iban)`
- `bank_accounts_organization_id_priority_key`: `CREATE UNIQUE INDEX bank_accounts_organization_id_priority_key ON public.bank_accounts USING btree (organization_id, priority)`
- `bank_accounts_pkey`: `CREATE UNIQUE INDEX bank_accounts_pkey ON public.bank_accounts USING btree (id)`

RLS policies:
- `admin_manage_bank_accounts` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `bank_accounts_org` (ALL, roles: {authenticated}): using `is_org_member(organization_id, auth.uid(), ARRAY['OWNER'::text, 'FINANCE'::text])`; check `is_org_member(organization_id, auth.uid(), ARRAY['OWNER'::text, 'FINANCE'::text])`

### `buyer_addresses`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `user_id` | `uuid` | yes | — |
| `label` | `text` | yes | 'خانه'::text |
| `recipient_name` | `text` | yes | — |
| `phone` | `text` | yes | — |
| `province` | `text` | yes | — |
| `city` | `text` | yes | — |
| `address_line` | `text` | yes | — |
| `postal_code` | `text` | yes | — |
| `delivery_note` | `text` | no | — |
| `is_default` | `boolean` | yes | false |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `buyer_addresses_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `buyer_addresses_pkey`: `PRIMARY KEY (id)`

Indexes:
- `buyer_addresses_one_default_idx`: `CREATE UNIQUE INDEX buyer_addresses_one_default_idx ON public.buyer_addresses USING btree (user_id) WHERE is_default`
- `buyer_addresses_pkey`: `CREATE UNIQUE INDEX buyer_addresses_pkey ON public.buyer_addresses USING btree (id)`

RLS policies:
- `admin_manage_buyer_addresses` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `buyer_addresses_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `buyer_profiles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `user_id` | `uuid` | yes | — |
| `display_name` | `text` | no | — |
| `marketing_consent` | `boolean` | yes | false |
| `marketing_consent_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `buyer_profiles_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `buyer_profiles_pkey`: `PRIMARY KEY (user_id)`

Indexes:
- `buyer_profiles_pkey`: `CREATE UNIQUE INDEX buyer_profiles_pkey ON public.buyer_profiles USING btree (user_id)`

RLS policies:
- `admin_manage_buyer_profiles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `buyer_profiles_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `cart_items`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `cart_id` | `uuid` | yes | — |
| `seller_product_variant_id` | `uuid` | yes | — |
| `quantity` | `integer` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `cart_items_quantity_check`: `CHECK (quantity >= 1 AND quantity <= 99)`
- `cart_items_cart_id_fkey`: `FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE`
- `cart_items_seller_product_variant_id_fkey`: `FOREIGN KEY (seller_product_variant_id) REFERENCES seller_product_variants(id) ON DELETE CASCADE`
- `cart_items_pkey`: `PRIMARY KEY (id)`
- `cart_items_cart_id_seller_product_variant_id_key`: `UNIQUE (cart_id, seller_product_variant_id)`

Indexes:
- `cart_items_cart_id_seller_product_variant_id_key`: `CREATE UNIQUE INDEX cart_items_cart_id_seller_product_variant_id_key ON public.cart_items USING btree (cart_id, seller_product_variant_id)`
- `cart_items_pkey`: `CREATE UNIQUE INDEX cart_items_pkey ON public.cart_items USING btree (id)`
- `idx_cart_items_cart_items_seller_product_variant_id_fk_2fa81feb`: `CREATE INDEX idx_cart_items_cart_items_seller_product_variant_id_fk_2fa81feb ON public.cart_items USING btree (seller_product_variant_id)`

RLS policies:
- `admin_manage_cart_items` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `cart_items_own` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM carts c   WHERE ((c.id = cart_items.cart_id) AND (c.buyer_user_id = auth.uid()))))`; check `(EXISTS ( SELECT 1    FROM carts c   WHERE ((c.id = cart_items.cart_id) AND (c.buyer_user_id = auth.uid()))))`

### `carts`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `buyer_user_id` | `uuid` | no | — |
| `anonymous_token` | `uuid` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `currency` | `text` | yes | 'IRR'::text |
| `expires_at` | `timestamp with time zone` | yes | (now() + '30 days'::interval) |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `cart_identity`: `CHECK ((buyer_user_id IS NOT NULL) <> (anonymous_token IS NOT NULL))`
- `carts_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'CONVERTED'::text, 'ABANDONED'::text]))`
- `carts_buyer_user_id_fkey`: `FOREIGN KEY (buyer_user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `carts_pkey`: `PRIMARY KEY (id)`

Indexes:
- `carts_active_anonymous_idx`: `CREATE UNIQUE INDEX carts_active_anonymous_idx ON public.carts USING btree (anonymous_token) WHERE ((status = 'ACTIVE'::text) AND (anonymous_token IS NOT NULL))`
- `carts_active_buyer_idx`: `CREATE UNIQUE INDEX carts_active_buyer_idx ON public.carts USING btree (buyer_user_id) WHERE ((status = 'ACTIVE'::text) AND (buyer_user_id IS NOT NULL))`
- `carts_pkey`: `CREATE UNIQUE INDEX carts_pkey ON public.carts USING btree (id)`

RLS policies:
- `admin_manage_carts` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `carts_own` (ALL, roles: {authenticated}): using `(buyer_user_id = auth.uid())`; check `(buyer_user_id = auth.uid())`

### `categories`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `parent_id` | `uuid` | no | — |
| `slug` | `text` | yes | — |
| `name` | `text` | yes | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `sort_order` | `integer` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `image_file_id` | `uuid` | no | — |
| `description` | `text` | no | — |
| `seo_title` | `text` | no | — |
| `seo_description` | `text` | no | — |

Constraints:
- `categories_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text]))`
- `categories_image_file_id_fkey`: `FOREIGN KEY (image_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `categories_parent_id_fkey`: `FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT`
- `categories_pkey`: `PRIMARY KEY (id)`
- `categories_slug_key`: `UNIQUE (slug)`

Indexes:
- `categories_pkey`: `CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id)`
- `categories_slug_key`: `CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug)`
- `idx_categories_categories_image_file_id_fkey_143ce23a`: `CREATE INDEX idx_categories_categories_image_file_id_fkey_143ce23a ON public.categories USING btree (image_file_id)`
- `idx_categories_categories_parent_id_fkey_a9413d54`: `CREATE INDEX idx_categories_categories_parent_id_fkey_a9413d54 ON public.categories USING btree (parent_id)`

RLS policies:
- `admin_manage_categories` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `categories_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `design_mockup_renders`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `design_id` | `uuid` | yes | — |
| `mockup_id` | `uuid` | yes | — |
| `side` | `text` | yes | — |
| `file_id` | `uuid` | yes | — |
| `sort_order` | `integer` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `design_mockup_renders_side_check`: `CHECK (side = ANY (ARRAY['FRONT'::text, 'BACK'::text]))`
- `design_mockup_renders_design_id_fkey`: `FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE`
- `design_mockup_renders_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `design_mockup_renders_mockup_id_fkey`: `FOREIGN KEY (mockup_id) REFERENCES raw_product_mockups(id) ON DELETE RESTRICT`
- `design_mockup_renders_pkey`: `PRIMARY KEY (id)`
- `design_mockup_renders_design_id_mockup_id_side_key`: `UNIQUE (design_id, mockup_id, side)`

Indexes:
- `design_mockup_renders_design_id_mockup_id_side_key`: `CREATE UNIQUE INDEX design_mockup_renders_design_id_mockup_id_side_key ON public.design_mockup_renders USING btree (design_id, mockup_id, side)`
- `design_mockup_renders_pkey`: `CREATE UNIQUE INDEX design_mockup_renders_pkey ON public.design_mockup_renders USING btree (id)`

RLS policies:
- `design_mockup_renders_own` (SELECT, roles: {authenticated}): using `((EXISTS ( SELECT 1    FROM designs design   WHERE ((design.id = design_mockup_renders.design_id) AND (design.owner_user_id = auth.uid())))) OR is_admin())`; check `—`

### `design_variants`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `design_id` | `uuid` | yes | — |
| `raw_product_variant_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `design_variants_design_id_fkey`: `FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE`
- `design_variants_raw_product_variant_id_fkey`: `FOREIGN KEY (raw_product_variant_id) REFERENCES raw_product_variants(id) ON DELETE RESTRICT`
- `design_variants_pkey`: `PRIMARY KEY (design_id, raw_product_variant_id)`

Indexes:
- `design_variants_pkey`: `CREATE UNIQUE INDEX design_variants_pkey ON public.design_variants USING btree (design_id, raw_product_variant_id)`
- `idx_design_variants_design_variants_raw_product_varian_58b3a10d`: `CREATE INDEX idx_design_variants_design_variants_raw_product_varian_58b3a10d ON public.design_variants USING btree (raw_product_variant_id)`

RLS policies:
- `admin_manage_design_variants` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `design_variants_owner` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM designs d   WHERE ((d.id = design_variants.design_id) AND ((d.owner_user_id = auth.uid()) OR can_manage_store(d.store_id)))))`; check `(EXISTS ( SELECT 1    FROM designs d   WHERE ((d.id = design_variants.design_id) AND ((d.owner_user_id = auth.uid()) OR can_manage_store(d.store_id)))))`

### `design_views`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `design_id` | `uuid` | yes | — |
| `raw_product_view_id` | `uuid` | yes | — |
| `canvas_document` | `jsonb` | yes | '{"objects": [], "version": 1}'::jsonb |
| `source_file_id` | `uuid` | no | — |
| `preview_file_id` | `uuid` | no | — |
| `printable_export_file_id` | `uuid` | no | — |
| `validation_state` | `text` | yes | 'PENDING'::text |
| `validation_messages` | `jsonb` | yes | '[]'::jsonb |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `design_canvas_is_object`: `CHECK (jsonb_typeof(canvas_document) = 'object'::text)`
- `design_validation_messages_array`: `CHECK (jsonb_typeof(validation_messages) = 'array'::text)`
- `design_views_validation_state_check`: `CHECK (validation_state = ANY (ARRAY['PENDING'::text, 'VALID'::text, 'WARNING'::text, 'INVALID'::text]))`
- `design_views_design_id_fkey`: `FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE`
- `design_views_preview_file_id_fkey`: `FOREIGN KEY (preview_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `design_views_printable_export_file_id_fkey`: `FOREIGN KEY (printable_export_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `design_views_raw_product_view_id_fkey`: `FOREIGN KEY (raw_product_view_id) REFERENCES raw_product_views(id) ON DELETE RESTRICT`
- `design_views_source_file_id_fkey`: `FOREIGN KEY (source_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `design_views_pkey`: `PRIMARY KEY (id)`
- `design_views_design_id_raw_product_view_id_key`: `UNIQUE (design_id, raw_product_view_id)`

Indexes:
- `design_views_design_id_raw_product_view_id_key`: `CREATE UNIQUE INDEX design_views_design_id_raw_product_view_id_key ON public.design_views USING btree (design_id, raw_product_view_id)`
- `design_views_design_idx`: `CREATE INDEX design_views_design_idx ON public.design_views USING btree (design_id)`
- `design_views_pkey`: `CREATE UNIQUE INDEX design_views_pkey ON public.design_views USING btree (id)`
- `idx_design_views_design_views_preview_file_id_fkey_b069a3b6`: `CREATE INDEX idx_design_views_design_views_preview_file_id_fkey_b069a3b6 ON public.design_views USING btree (preview_file_id)`
- `idx_design_views_design_views_printable_export_file_id_cdcffd56`: `CREATE INDEX idx_design_views_design_views_printable_export_file_id_cdcffd56 ON public.design_views USING btree (printable_export_file_id)`
- `idx_design_views_design_views_raw_product_view_id_fkey_d0f31353`: `CREATE INDEX idx_design_views_design_views_raw_product_view_id_fkey_d0f31353 ON public.design_views USING btree (raw_product_view_id)`
- `idx_design_views_design_views_source_file_id_fkey_c74c3614`: `CREATE INDEX idx_design_views_design_views_source_file_id_fkey_c74c3614 ON public.design_views USING btree (source_file_id)`

RLS policies:
- `admin_manage_design_views` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `design_views_owner` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM designs d   WHERE ((d.id = design_views.design_id) AND ((d.owner_user_id = auth.uid()) OR can_manage_store(d.store_id)))))`; check `(EXISTS ( SELECT 1    FROM designs d   WHERE ((d.id = design_views.design_id) AND ((d.owner_user_id = auth.uid()) OR can_manage_store(d.store_id)))))`

### `designs`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `store_id` | `uuid` | yes | — |
| `raw_product_id` | `uuid` | yes | — |
| `status` | `text` | yes | 'DRAFT'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `owner_user_id` | `uuid` | no | — |
| `name` | `text` | yes | 'طرح بدون نام'::text |
| `schema_version` | `integer` | yes | 1 |
| `version` | `integer` | yes | 1 |

Constraints:
- `designs_schema_version_check`: `CHECK (schema_version > 0)`
- `designs_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'READY'::text, 'ARCHIVED'::text]))`
- `designs_version_check`: `CHECK (version > 0)`
- `designs_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `designs_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id)`
- `designs_store_id_fkey`: `FOREIGN KEY (store_id) REFERENCES stores(id)`
- `designs_pkey`: `PRIMARY KEY (id)`

Indexes:
- `designs_pkey`: `CREATE UNIQUE INDEX designs_pkey ON public.designs USING btree (id)`
- `idx_designs_designs_owner_user_id_fkey_4c7cc311`: `CREATE INDEX idx_designs_designs_owner_user_id_fkey_4c7cc311 ON public.designs USING btree (owner_user_id)`
- `idx_designs_designs_raw_product_id_fkey_50836b1a`: `CREATE INDEX idx_designs_designs_raw_product_id_fkey_50836b1a ON public.designs USING btree (raw_product_id)`
- `idx_designs_designs_store_id_fkey_8c1e0454`: `CREATE INDEX idx_designs_designs_store_id_fkey_8c1e0454 ON public.designs USING btree (store_id)`

RLS policies:
- `admin_manage_designs` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `designs_owner` (ALL, roles: {authenticated}): using `((owner_user_id = auth.uid()) OR can_manage_store(store_id))`; check `((owner_user_id = auth.uid()) AND can_manage_store(store_id))`

### `disputes`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `order_item_id` | `uuid` | no | — |
| `opened_by` | `uuid` | yes | — |
| `assigned_to` | `uuid` | no | — |
| `reason` | `text` | yes | — |
| `description` | `text` | yes | — |
| `status` | `text` | yes | 'OPEN'::text |
| `idempotency_key` | `text` | yes | — |
| `resolution` | `text` | no | — |
| `opened_at` | `timestamp with time zone` | yes | now() |
| `resolved_at` | `timestamp with time zone` | no | — |
| `closed_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `disputes_status_check`: `CHECK (status = ANY (ARRAY['OPEN'::text, 'UNDER_REVIEW'::text, 'RESOLVED'::text, 'REJECTED'::text, 'CLOSED'::text]))`
- `disputes_assigned_to_fkey`: `FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL`
- `disputes_opened_by_fkey`: `FOREIGN KEY (opened_by) REFERENCES profiles(id) ON DELETE RESTRICT`
- `disputes_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `disputes_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT`
- `disputes_pkey`: `PRIMARY KEY (id)`
- `disputes_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `disputes_idempotency_key_key`: `CREATE UNIQUE INDEX disputes_idempotency_key_key ON public.disputes USING btree (idempotency_key)`
- `disputes_pkey`: `CREATE UNIQUE INDEX disputes_pkey ON public.disputes USING btree (id)`
- `idx_disputes_disputes_assigned_to_fkey_93665206`: `CREATE INDEX idx_disputes_disputes_assigned_to_fkey_93665206 ON public.disputes USING btree (assigned_to)`
- `idx_disputes_disputes_opened_by_fkey_1f2a2d2d`: `CREATE INDEX idx_disputes_disputes_opened_by_fkey_1f2a2d2d ON public.disputes USING btree (opened_by)`
- `idx_disputes_disputes_order_id_fkey_fe545aeb`: `CREATE INDEX idx_disputes_disputes_order_id_fkey_fe545aeb ON public.disputes USING btree (order_id)`
- `idx_disputes_disputes_order_item_id_fkey_489333f2`: `CREATE INDEX idx_disputes_disputes_order_item_id_fkey_489333f2 ON public.disputes USING btree (order_item_id)`

RLS policies:
- `admin_manage_disputes` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `disputes_order_read` (SELECT, roles: {authenticated}): using `can_access_order(order_id)`; check `—`

### `earnings`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `beneficiary_organization_id` | `uuid` | yes | — |
| `earning_type` | `text` | yes | — |
| `source_type` | `text` | yes | — |
| `source_id` | `uuid` | yes | — |
| `order_id` | `uuid` | no | — |
| `order_item_id` | `uuid` | no | — |
| `fulfilment_id` | `uuid` | no | — |
| `gross_amount` | `bigint` | yes | — |
| `fee_amount` | `bigint` | yes | 0 |
| `net_amount` | `bigint` | yes | — |
| `currency` | `text` | yes | 'IRR'::text |
| `status` | `earning_state` | yes | 'PENDING'::earning_state |
| `available_at` | `timestamp with time zone` | no | — |
| `paid_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `earnings_check`: `CHECK (net_amount >= 0 AND net_amount = (gross_amount - fee_amount))`
- `earnings_earning_type_check`: `CHECK (earning_type = ANY (ARRAY['SELLER'::text, 'SUPPLIER'::text]))`
- `earnings_fee_amount_check`: `CHECK (fee_amount >= 0)`
- `earnings_gross_amount_check`: `CHECK (gross_amount >= 0)`
- `earnings_source_type_check`: `CHECK (source_type = ANY (ARRAY['ORDER_ITEM'::text, 'FULFILMENT'::text, 'ADJUSTMENT'::text]))`
- `earnings_beneficiary_organization_id_fkey`: `FOREIGN KEY (beneficiary_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- `earnings_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id) ON DELETE RESTRICT`
- `earnings_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `earnings_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT`
- `earnings_pkey`: `PRIMARY KEY (id)`
- `earnings_beneficiary_organization_id_earning_type_source_ty_key`: `UNIQUE (beneficiary_organization_id, earning_type, source_type, source_id)`

Indexes:
- `earnings_beneficiary_organization_id_earning_type_source_ty_key`: `CREATE UNIQUE INDEX earnings_beneficiary_organization_id_earning_type_source_ty_key ON public.earnings USING btree (beneficiary_organization_id, earning_type, source_type, source_id)`
- `earnings_org_status_idx`: `CREATE INDEX earnings_org_status_idx ON public.earnings USING btree (beneficiary_organization_id, status, available_at)`
- `earnings_pkey`: `CREATE UNIQUE INDEX earnings_pkey ON public.earnings USING btree (id)`
- `idx_earnings_earnings_fulfilment_id_fkey_7a10edcb`: `CREATE INDEX idx_earnings_earnings_fulfilment_id_fkey_7a10edcb ON public.earnings USING btree (fulfilment_id)`
- `idx_earnings_earnings_order_id_fkey_05f4e14f`: `CREATE INDEX idx_earnings_earnings_order_id_fkey_05f4e14f ON public.earnings USING btree (order_id)`
- `idx_earnings_earnings_order_item_id_fkey_1e081e65`: `CREATE INDEX idx_earnings_earnings_order_item_id_fkey_1e081e65 ON public.earnings USING btree (order_item_id)`

RLS policies:
- `admin_manage_earnings` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `earnings_org_read` (SELECT, roles: {authenticated}): using `is_org_member(beneficiary_organization_id)`; check `—`

### `facilities`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `organization_id` | `uuid` | yes | — |
| `name` | `text` | yes | — |
| `city` | `text` | no | — |
| `address` | `text` | no | — |
| `postal_code` | `text` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `phone` | `text` | no | — |
| `working_days` | `ARRAY` | yes | ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint] |
| `cutoff_time` | `time without time zone` | no | — |

Constraints:
- `facilities_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text, 'CLOSED'::text]))`
- `facilities_working_days_check`: `CHECK (working_days <@ ARRAY[0::smallint, 1::smallint, 2::smallint, 3::smallint, 4::smallint, 5::smallint, 6::smallint])`
- `facilities_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `facilities_pkey`: `PRIMARY KEY (id)`

Indexes:
- `facilities_pkey`: `CREATE UNIQUE INDEX facilities_pkey ON public.facilities USING btree (id)`
- `idx_facilities_facilities_organization_id_fkey_ad458476`: `CREATE INDEX idx_facilities_facilities_organization_id_fkey_ad458476 ON public.facilities USING btree (organization_id)`

RLS policies:
- `admin_manage_facilities` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `facilities_org_manage` (ALL, roles: {authenticated}): using `is_org_member(organization_id)`; check `is_org_member(organization_id)`
- `facilities_supplier_read` (SELECT, roles: {authenticated}): using `((status = 'ACTIVE'::text) OR is_org_member(organization_id))`; check `—`

### `fulfilment_exceptions`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `fulfilment_id` | `uuid` | yes | — |
| `supplier_organization_id` | `uuid` | yes | — |
| `reported_by` | `uuid` | yes | — |
| `exception_type` | `text` | yes | — |
| `description` | `text` | yes | — |
| `status` | `text` | yes | 'OPEN'::text |
| `resolution` | `text` | no | — |
| `reviewed_by` | `uuid` | no | — |
| `idempotency_key` | `text` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `reviewed_at` | `timestamp with time zone` | no | — |
| `resolved_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `fulfilment_exceptions_description_check`: `CHECK (length(description) >= 10 AND length(description) <= 2000)`
- `fulfilment_exceptions_exception_type_check`: `CHECK (exception_type = ANY (ARRAY['CANNOT_SUPPLY'::text, 'DAMAGED_PRINT'::text, 'FILE_ISSUE'::text, 'CAPACITY'::text, 'CANCELLATION'::text, 'RETURN'::text, 'OTHER'::text]))`
- `fulfilment_exceptions_status_check`: `CHECK (status = ANY (ARRAY['OPEN'::text, 'ACKNOWLEDGED'::text, 'RESOLVED'::text, 'REJECTED'::text]))`
- `fulfilment_exceptions_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id) ON DELETE RESTRICT`
- `fulfilment_exceptions_reported_by_fkey`: `FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE RESTRICT`
- `fulfilment_exceptions_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `fulfilment_exceptions_supplier_organization_id_fkey`: `FOREIGN KEY (supplier_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- `fulfilment_exceptions_pkey`: `PRIMARY KEY (id)`
- `fulfilment_exceptions_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `fulfilment_exceptions_fulfilment_idx`: `CREATE INDEX fulfilment_exceptions_fulfilment_idx ON public.fulfilment_exceptions USING btree (fulfilment_id)`
- `fulfilment_exceptions_idempotency_key_key`: `CREATE UNIQUE INDEX fulfilment_exceptions_idempotency_key_key ON public.fulfilment_exceptions USING btree (idempotency_key)`
- `fulfilment_exceptions_open_idx`: `CREATE INDEX fulfilment_exceptions_open_idx ON public.fulfilment_exceptions USING btree (created_at) WHERE (status = ANY (ARRAY['OPEN'::text, 'ACKNOWLEDGED'::text]))`
- `fulfilment_exceptions_pkey`: `CREATE UNIQUE INDEX fulfilment_exceptions_pkey ON public.fulfilment_exceptions USING btree (id)`
- `fulfilment_exceptions_reporter_idx`: `CREATE INDEX fulfilment_exceptions_reporter_idx ON public.fulfilment_exceptions USING btree (reported_by)`
- `fulfilment_exceptions_reviewer_idx`: `CREATE INDEX fulfilment_exceptions_reviewer_idx ON public.fulfilment_exceptions USING btree (reviewed_by)`
- `fulfilment_exceptions_supplier_idx`: `CREATE INDEX fulfilment_exceptions_supplier_idx ON public.fulfilment_exceptions USING btree (supplier_organization_id)`

RLS policies:
- `fulfilment_exceptions_admin_all` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `fulfilment_exceptions_supplier_read` (SELECT, roles: {authenticated}): using `is_org_member(supplier_organization_id)`; check `—`

### `fulfilment_files`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `fulfilment_id` | `uuid` | yes | — |
| `file_id` | `uuid` | yes | — |
| `purpose` | `text` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `fulfilment_files_purpose_check`: `CHECK (purpose = ANY (ARRAY['PRINT_FRONT'::text, 'PRINT_BACK'::text, 'REFERENCE'::text, 'PACKING'::text]))`
- `fulfilment_files_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `fulfilment_files_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id) ON DELETE CASCADE`
- `fulfilment_files_pkey`: `PRIMARY KEY (fulfilment_id, file_id, purpose)`

Indexes:
- `fulfilment_files_pkey`: `CREATE UNIQUE INDEX fulfilment_files_pkey ON public.fulfilment_files USING btree (fulfilment_id, file_id, purpose)`
- `idx_fulfilment_files_fulfilment_files_file_id_fkey_1c4425a0`: `CREATE INDEX idx_fulfilment_files_fulfilment_files_file_id_fkey_1c4425a0 ON public.fulfilment_files USING btree (file_id)`

RLS policies:
- `admin_manage_fulfilment_files` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `fulfilment_files_access` (SELECT, roles: {authenticated}): using `can_access_fulfilment(fulfilment_id)`; check `—`

### `fulfilment_items`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `fulfilment_id` | `uuid` | yes | — |
| `order_item_id` | `uuid` | yes | — |
| `quantity` | `integer` | yes | — |

Constraints:
- `fulfilment_items_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id) ON DELETE CASCADE`
- `fulfilment_items_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id)`
- `fulfilment_items_pkey`: `PRIMARY KEY (id)`

Indexes:
- `fulfilment_items_pkey`: `CREATE UNIQUE INDEX fulfilment_items_pkey ON public.fulfilment_items USING btree (id)`
- `idx_fulfilment_items_fulfilment_items_fulfilment_id_fk_e06236da`: `CREATE INDEX idx_fulfilment_items_fulfilment_items_fulfilment_id_fk_e06236da ON public.fulfilment_items USING btree (fulfilment_id)`
- `idx_fulfilment_items_fulfilment_items_order_item_id_fk_68c54744`: `CREATE INDEX idx_fulfilment_items_fulfilment_items_order_item_id_fk_68c54744 ON public.fulfilment_items USING btree (order_item_id)`

RLS policies:
- `admin_manage_fulfilment_items` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `fulfilment_items_access` (SELECT, roles: {authenticated}): using `can_access_fulfilment(fulfilment_id)`; check `—`

### `fulfilment_status_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `fulfilment_id` | `uuid` | yes | — |
| `from_status` | `text` | no | — |
| `to_status` | `text` | yes | — |
| `actor_type` | `text` | yes | — |
| `actor_id` | `text` | no | — |
| `idempotency_key` | `text` | yes | — |
| `occurred_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `fulfilment_status_events_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id)`
- `fulfilment_status_events_pkey`: `PRIMARY KEY (id)`
- `fulfilment_status_events_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `fulfilment_status_events_idempotency_key_key`: `CREATE UNIQUE INDEX fulfilment_status_events_idempotency_key_key ON public.fulfilment_status_events USING btree (idempotency_key)`
- `fulfilment_status_events_pkey`: `CREATE UNIQUE INDEX fulfilment_status_events_pkey ON public.fulfilment_status_events USING btree (id)`
- `idx_fulfilment_status_events_fulfilment_status_events__6b7402dd`: `CREATE INDEX idx_fulfilment_status_events_fulfilment_status_events__6b7402dd ON public.fulfilment_status_events USING btree (fulfilment_id)`

RLS policies:
- `admin_manage_fulfilment_status_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `fulfilment_events_access` (SELECT, roles: {authenticated}): using `can_access_fulfilment(fulfilment_id)`; check `—`

### `fulfilments`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `supplier_organization_id` | `uuid` | yes | — |
| `facility_id` | `uuid` | yes | — |
| `supplier_offer_id` | `uuid` | yes | — |
| `assignment_snapshot` | `jsonb` | yes | '{}'::jsonb |
| `status` | `fulfilment_status` | yes | 'ASSIGNED'::fulfilment_status |
| `tracking_code` | `text` | no | — |
| `sent_at` | `timestamp with time zone` | no | — |
| `auto_complete_at` | `timestamp with time zone` | no | — |
| `done_at` | `timestamp with time zone` | no | — |
| `cancelled_at` | `timestamp with time zone` | no | — |
| `returned_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `due_at` | `timestamp with time zone` | no | — |
| `disputed_at` | `timestamp with time zone` | no | — |
| `version` | `integer` | yes | 1 |

Constraints:
- `fulfilments_version_check`: `CHECK (version > 0)`
- `fulfilments_facility_id_fkey`: `FOREIGN KEY (facility_id) REFERENCES facilities(id)`
- `fulfilments_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id)`
- `fulfilments_supplier_offer_id_fkey`: `FOREIGN KEY (supplier_offer_id) REFERENCES supplier_offers(id)`
- `fulfilments_supplier_organization_id_fkey`: `FOREIGN KEY (supplier_organization_id) REFERENCES organizations(id)`
- `fulfilments_pkey`: `PRIMARY KEY (id)`

Indexes:
- `fulfilments_auto_done_idx`: `CREATE INDEX fulfilments_auto_done_idx ON public.fulfilments USING btree (status, auto_complete_at) WHERE (status = 'SENT'::fulfilment_status)`
- `fulfilments_pkey`: `CREATE UNIQUE INDEX fulfilments_pkey ON public.fulfilments USING btree (id)`
- `fulfilments_supplier_queue_idx`: `CREATE INDEX fulfilments_supplier_queue_idx ON public.fulfilments USING btree (supplier_organization_id, status, created_at)`
- `idx_fulfilments_fulfilments_facility_id_fkey_7334ef48`: `CREATE INDEX idx_fulfilments_fulfilments_facility_id_fkey_7334ef48 ON public.fulfilments USING btree (facility_id)`
- `idx_fulfilments_fulfilments_order_id_fkey_f2436af5`: `CREATE INDEX idx_fulfilments_fulfilments_order_id_fkey_f2436af5 ON public.fulfilments USING btree (order_id)`
- `idx_fulfilments_fulfilments_supplier_offer_id_fkey_70650cf4`: `CREATE INDEX idx_fulfilments_fulfilments_supplier_offer_id_fkey_70650cf4 ON public.fulfilments USING btree (supplier_offer_id)`

RLS policies:
- `admin_manage_fulfilments` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `fulfilments_access` (SELECT, roles: {authenticated}): using `can_access_fulfilment(id)`; check `—`

### `graphic_styles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `slug` | `text` | yes | — |
| `name` | `text` | yes | — |
| `caption` | `text` | no | — |
| `image_file_id` | `uuid` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `sort_order` | `integer` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `graphic_styles_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))`
- `graphic_styles_image_file_id_fkey`: `FOREIGN KEY (image_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `graphic_styles_pkey`: `PRIMARY KEY (id)`
- `graphic_styles_name_key`: `UNIQUE (name)`
- `graphic_styles_slug_key`: `UNIQUE (slug)`

Indexes:
- `graphic_styles_name_key`: `CREATE UNIQUE INDEX graphic_styles_name_key ON public.graphic_styles USING btree (name)`
- `graphic_styles_pkey`: `CREATE UNIQUE INDEX graphic_styles_pkey ON public.graphic_styles USING btree (id)`
- `graphic_styles_slug_key`: `CREATE UNIQUE INDEX graphic_styles_slug_key ON public.graphic_styles USING btree (slug)`
- `idx_graphic_styles_graphic_styles_image_file_id_fkey_2aedbea8`: `CREATE INDEX idx_graphic_styles_graphic_styles_image_file_id_fkey_2aedbea8 ON public.graphic_styles USING btree (image_file_id)`

RLS policies:
- `admin_manage_graphic_styles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `graphic_styles_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `homepage_banners`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seed_key` | `text` | no | — |
| `eyebrow` | `text` | no | — |
| `title` | `text` | yes | — |
| `body` | `text` | no | — |
| `desktop_file_id` | `uuid` | no | — |
| `mobile_file_id` | `uuid` | no | — |
| `external_image_url` | `text` | no | — |
| `cta_label` | `text` | yes | — |
| `cta_url` | `text` | yes | — |
| `tone` | `text` | yes | 'coral'::text |
| `placement` | `text` | yes | 'HOME'::text |
| `starts_at` | `timestamp with time zone` | no | — |
| `ends_at` | `timestamp with time zone` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `sort_order` | `integer` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `banner_date_range`: `CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)`
- `homepage_banners_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text]))`
- `homepage_banners_desktop_file_id_fkey`: `FOREIGN KEY (desktop_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `homepage_banners_mobile_file_id_fkey`: `FOREIGN KEY (mobile_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `homepage_banners_pkey`: `PRIMARY KEY (id)`
- `homepage_banners_seed_key_key`: `UNIQUE (seed_key)`

Indexes:
- `homepage_banners_pkey`: `CREATE UNIQUE INDEX homepage_banners_pkey ON public.homepage_banners USING btree (id)`
- `homepage_banners_seed_key_key`: `CREATE UNIQUE INDEX homepage_banners_seed_key_key ON public.homepage_banners USING btree (seed_key)`
- `idx_homepage_banners_homepage_banners_desktop_file_id__efde8364`: `CREATE INDEX idx_homepage_banners_homepage_banners_desktop_file_id__efde8364 ON public.homepage_banners USING btree (desktop_file_id)`
- `idx_homepage_banners_homepage_banners_mobile_file_id_f_fd5c2b53`: `CREATE INDEX idx_homepage_banners_homepage_banners_mobile_file_id_f_fd5c2b53 ON public.homepage_banners USING btree (mobile_file_id)`

RLS policies:
- `admin_manage_homepage_banners` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `homepage_banners_public_read` (SELECT, roles: {anon,authenticated}): using `((status = 'ACTIVE'::text) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now())))`; check `—`

### `memberships`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `user_id` | `uuid` | yes | — |
| `organization_id` | `uuid` | yes | — |
| `role` | `text` | yes | 'OWNER'::text |
| `status` | `membership_state` | yes | 'ACTIVE'::membership_state |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `memberships_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `memberships_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `memberships_pkey`: `PRIMARY KEY (id)`
- `memberships_user_id_organization_id_key`: `UNIQUE (user_id, organization_id)`

Indexes:
- `memberships_org_status_idx`: `CREATE INDEX memberships_org_status_idx ON public.memberships USING btree (organization_id, status, user_id)`
- `memberships_pkey`: `CREATE UNIQUE INDEX memberships_pkey ON public.memberships USING btree (id)`
- `memberships_user_id_organization_id_key`: `CREATE UNIQUE INDEX memberships_user_id_organization_id_key ON public.memberships USING btree (user_id, organization_id)`
- `memberships_user_status_idx`: `CREATE INDEX memberships_user_status_idx ON public.memberships USING btree (user_id, status)`

RLS policies:
- `admin_manage_memberships` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `memberships_member_read` (SELECT, roles: {authenticated}): using `((user_id = auth.uid()) OR is_org_member(organization_id))`; check `—`
- `memberships_owner_manage` (ALL, roles: {authenticated}): using `is_org_member(organization_id, auth.uid(), ARRAY['OWNER'::text])`; check `is_org_member(organization_id, auth.uid(), ARRAY['OWNER'::text])`

### `notification_deliveries`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `outbox_id` | `uuid` | yes | — |
| `channel` | `text` | yes | — |
| `provider` | `text` | yes | — |
| `provider_message_id` | `text` | no | — |
| `attempt_number` | `integer` | yes | — |
| `status` | `text` | yes | 'PENDING'::text |
| `provider_response` | `jsonb` | yes | '{}'::jsonb |
| `error_code` | `text` | no | — |
| `error_message` | `text` | no | — |
| `attempted_at` | `timestamp with time zone` | yes | now() |
| `delivered_at` | `timestamp with time zone` | no | — |

Constraints:
- `notification_deliveries_attempt_number_check`: `CHECK (attempt_number > 0)`
- `notification_deliveries_channel_check`: `CHECK (channel = ANY (ARRAY['IN_APP'::text, 'SMS'::text, 'EMAIL'::text, 'PUSH'::text]))`
- `notification_deliveries_status_check`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'DELIVERED'::text, 'FAILED'::text, 'BOUNCED'::text, 'CANCELLED'::text]))`
- `notification_deliveries_outbox_id_fkey`: `FOREIGN KEY (outbox_id) REFERENCES notification_outbox(id) ON DELETE CASCADE`
- `notification_deliveries_pkey`: `PRIMARY KEY (id)`
- `notification_deliveries_outbox_id_channel_attempt_number_key`: `UNIQUE (outbox_id, channel, attempt_number)`
- `notification_deliveries_provider_provider_message_id_key`: `UNIQUE (provider, provider_message_id)`

Indexes:
- `notification_deliveries_outbox_id_channel_attempt_number_key`: `CREATE UNIQUE INDEX notification_deliveries_outbox_id_channel_attempt_number_key ON public.notification_deliveries USING btree (outbox_id, channel, attempt_number)`
- `notification_deliveries_pkey`: `CREATE UNIQUE INDEX notification_deliveries_pkey ON public.notification_deliveries USING btree (id)`
- `notification_deliveries_provider_provider_message_id_key`: `CREATE UNIQUE INDEX notification_deliveries_provider_provider_message_id_key ON public.notification_deliveries USING btree (provider, provider_message_id)`

RLS policies:
- `admin_manage_notification_deliveries` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `notification_deliveries_recipient_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM notification_outbox o   WHERE ((o.id = notification_deliveries.outbox_id) AND (o.recipient_user_id = auth.uid()))))`; check `—`

### `notification_outbox`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `event_type` | `text` | yes | — |
| `recipient_user_id` | `uuid` | no | — |
| `recipient_phone` | `text` | no | — |
| `template_id` | `uuid` | no | — |
| `payload` | `jsonb` | yes | '{}'::jsonb |
| `idempotency_key` | `text` | yes | — |
| `status` | `text` | yes | 'PENDING'::text |
| `attempts` | `integer` | yes | 0 |
| `available_at` | `timestamp with time zone` | yes | now() |
| `sent_at` | `timestamp with time zone` | no | — |
| `last_error` | `text` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `notification_outbox_attempts_check`: `CHECK (attempts >= 0)`
- `notification_outbox_status_check`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'FAILED'::text, 'CANCELLED'::text]))`
- `notification_outbox_recipient_user_id_fkey`: `FOREIGN KEY (recipient_user_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `notification_outbox_template_id_fkey`: `FOREIGN KEY (template_id) REFERENCES sms_templates(id) ON DELETE SET NULL`
- `notification_outbox_pkey`: `PRIMARY KEY (id)`
- `notification_outbox_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `idx_notification_outbox_notification_outbox_recipient__5fe891f2`: `CREATE INDEX idx_notification_outbox_notification_outbox_recipient__5fe891f2 ON public.notification_outbox USING btree (recipient_user_id)`
- `idx_notification_outbox_notification_outbox_template_i_a24a9389`: `CREATE INDEX idx_notification_outbox_notification_outbox_template_i_a24a9389 ON public.notification_outbox USING btree (template_id)`
- `notification_outbox_idempotency_key_key`: `CREATE UNIQUE INDEX notification_outbox_idempotency_key_key ON public.notification_outbox USING btree (idempotency_key)`
- `notification_outbox_pending_idx`: `CREATE INDEX notification_outbox_pending_idx ON public.notification_outbox USING btree (status, available_at) WHERE (status = 'PENDING'::text)`
- `notification_outbox_pkey`: `CREATE UNIQUE INDEX notification_outbox_pkey ON public.notification_outbox USING btree (id)`

RLS policies:
- `admin_manage_notification_outbox` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`

### `notification_preferences`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `user_id` | `uuid` | yes | — |
| `event_type` | `text` | yes | — |
| `channel` | `text` | yes | — |
| `enabled` | `boolean` | yes | true |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `notification_preferences_channel_check`: `CHECK (channel = ANY (ARRAY['IN_APP'::text, 'SMS'::text, 'EMAIL'::text, 'PUSH'::text]))`
- `notification_preferences_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `notification_preferences_pkey`: `PRIMARY KEY (id)`
- `notification_preferences_user_id_event_type_channel_key`: `UNIQUE (user_id, event_type, channel)`

Indexes:
- `notification_preferences_pkey`: `CREATE UNIQUE INDEX notification_preferences_pkey ON public.notification_preferences USING btree (id)`
- `notification_preferences_user_id_event_type_channel_key`: `CREATE UNIQUE INDEX notification_preferences_user_id_event_type_channel_key ON public.notification_preferences USING btree (user_id, event_type, channel)`

RLS policies:
- `admin_manage_notification_preferences` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `notification_preferences_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `operational_reconciliation`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `issue_type` | `text` | no | — |
| `entity_id` | `uuid` | no | — |
| `reference` | `text` | no | — |
| `detail` | `jsonb` | no | — |

Constraints:

Indexes:

RLS policies:
- No client policy; table is server/service-only.

### `order_cancellations`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `requested_by` | `uuid` | yes | — |
| `reviewed_by` | `uuid` | no | — |
| `reason` | `text` | yes | — |
| `status` | `text` | yes | 'REQUESTED'::text |
| `idempotency_key` | `text` | yes | — |
| `review_message` | `text` | no | — |
| `requested_at` | `timestamp with time zone` | yes | now() |
| `reviewed_at` | `timestamp with time zone` | no | — |
| `completed_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `order_cancellations_status_check`: `CHECK (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text, 'REJECTED'::text, 'COMPLETED'::text, 'CANCELLED'::text]))`
- `order_cancellations_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `order_cancellations_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE RESTRICT`
- `order_cancellations_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `order_cancellations_pkey`: `PRIMARY KEY (id)`
- `order_cancellations_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `idx_order_cancellations_order_cancellations_requested__e54d0bdb`: `CREATE INDEX idx_order_cancellations_order_cancellations_requested__e54d0bdb ON public.order_cancellations USING btree (requested_by)`
- `idx_order_cancellations_order_cancellations_reviewed_b_2273b95b`: `CREATE INDEX idx_order_cancellations_order_cancellations_reviewed_b_2273b95b ON public.order_cancellations USING btree (reviewed_by)`
- `order_cancellations_idempotency_key_key`: `CREATE UNIQUE INDEX order_cancellations_idempotency_key_key ON public.order_cancellations USING btree (idempotency_key)`
- `order_cancellations_one_active_idx`: `CREATE UNIQUE INDEX order_cancellations_one_active_idx ON public.order_cancellations USING btree (order_id) WHERE (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text]))`
- `order_cancellations_pkey`: `CREATE UNIQUE INDEX order_cancellations_pkey ON public.order_cancellations USING btree (id)`

RLS policies:
- `admin_manage_order_cancellations` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `cancellations_order_read` (SELECT, roles: {authenticated}): using `can_access_order(order_id)`; check `—`

### `order_items`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `seller_product_id` | `uuid` | no | — |
| `quantity` | `integer` | yes | — |
| `unit_price` | `bigint` | yes | — |
| `cost_snapshot` | `bigint` | yes | 0 |
| `product_snapshot` | `jsonb` | yes | '{}'::jsonb |
| `design_snapshot` | `jsonb` | yes | '{}'::jsonb |
| `seller_product_variant_id` | `uuid` | no | — |
| `raw_product_variant_id` | `uuid` | no | — |
| `supplier_offer_variant_id` | `uuid` | no | — |
| `seller_organization_id` | `uuid` | no | — |
| `supplier_organization_id` | `uuid` | no | — |
| `line_total` | `bigint` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `order_items_cost_check`: `CHECK (cost_snapshot >= 0)`
- `order_items_line_total_check`: `CHECK (line_total >= 0)`
- `order_items_quantity_check`: `CHECK (quantity > 0)`
- `order_items_unit_price_check`: `CHECK (unit_price >= 0)`
- `order_items_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_items_raw_product_variant_id_fkey`: `FOREIGN KEY (raw_product_variant_id) REFERENCES raw_product_variants(id) ON DELETE RESTRICT`
- `order_items_seller_organization_id_fkey`: `FOREIGN KEY (seller_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- `order_items_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id)`
- `order_items_seller_product_variant_id_fkey`: `FOREIGN KEY (seller_product_variant_id) REFERENCES seller_product_variants(id) ON DELETE RESTRICT`
- `order_items_supplier_offer_variant_id_fkey`: `FOREIGN KEY (supplier_offer_variant_id) REFERENCES supplier_offer_variants(id) ON DELETE RESTRICT`
- `order_items_supplier_organization_id_fkey`: `FOREIGN KEY (supplier_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- `order_items_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_order_items_order_items_raw_product_variant_id_fke_6ae6fa58`: `CREATE INDEX idx_order_items_order_items_raw_product_variant_id_fke_6ae6fa58 ON public.order_items USING btree (raw_product_variant_id)`
- `idx_order_items_order_items_seller_product_id_fkey_ca4afa12`: `CREATE INDEX idx_order_items_order_items_seller_product_id_fkey_ca4afa12 ON public.order_items USING btree (seller_product_id)`
- `idx_order_items_order_items_seller_product_variant_id__6be353cb`: `CREATE INDEX idx_order_items_order_items_seller_product_variant_id__6be353cb ON public.order_items USING btree (seller_product_variant_id)`
- `idx_order_items_order_items_supplier_offer_variant_id__8d13aa96`: `CREATE INDEX idx_order_items_order_items_supplier_offer_variant_id__8d13aa96 ON public.order_items USING btree (supplier_offer_variant_id)`
- `order_items_order_idx`: `CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id)`
- `order_items_pkey`: `CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id)`
- `order_items_seller_org_idx`: `CREATE INDEX order_items_seller_org_idx ON public.order_items USING btree (seller_organization_id, created_at DESC)`
- `order_items_supplier_org_idx`: `CREATE INDEX order_items_supplier_org_idx ON public.order_items USING btree (supplier_organization_id, created_at DESC)`

RLS policies:
- `admin_manage_order_items` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `order_items_access` (SELECT, roles: {authenticated}): using `can_access_order(order_id)`; check `—`

### `orders`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `number` | `text` | yes | — |
| `buyer_user_id` | `uuid` | no | — |
| `status` | `order_state` | yes | 'CONFIRMED'::order_state |
| `subtotal` | `bigint` | yes | 0 |
| `total` | `bigint` | yes | 0 |
| `currency` | `text` | yes | 'IRR'::text |
| `customer_snapshot` | `jsonb` | yes | '{}'::jsonb |
| `shipping_address_snapshot` | `jsonb` | yes | '{}'::jsonb |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `idempotency_key` | `text` | no | — |
| `shipping_address_id` | `uuid` | no | — |
| `shipping_amount` | `bigint` | yes | 0 |
| `discount_amount` | `bigint` | yes | 0 |
| `tax_amount` | `bigint` | yes | 0 |
| `paid_at` | `timestamp with time zone` | no | — |
| `completed_at` | `timestamp with time zone` | no | — |

Constraints:
- `orders_discount_amount_check`: `CHECK (discount_amount >= 0)`
- `orders_shipping_amount_check`: `CHECK (shipping_amount >= 0)`
- `orders_tax_amount_check`: `CHECK (tax_amount >= 0)`
- `orders_totals_check`: `CHECK (subtotal >= 0 AND total >= 0 AND total = (subtotal + shipping_amount + tax_amount - discount_amount))`
- `orders_buyer_user_id_fkey`: `FOREIGN KEY (buyer_user_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `orders_shipping_address_id_fkey`: `FOREIGN KEY (shipping_address_id) REFERENCES buyer_addresses(id) ON DELETE SET NULL`
- `orders_pkey`: `PRIMARY KEY (id)`
- `orders_number_key`: `UNIQUE (number)`

Indexes:
- `idx_orders_orders_shipping_address_id_fkey_69239fb3`: `CREATE INDEX idx_orders_orders_shipping_address_id_fkey_69239fb3 ON public.orders USING btree (shipping_address_id)`
- `orders_buyer_created_idx`: `CREATE INDEX orders_buyer_created_idx ON public.orders USING btree (buyer_user_id, created_at DESC)`
- `orders_idempotency_idx`: `CREATE UNIQUE INDEX orders_idempotency_idx ON public.orders USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL)`
- `orders_number_key`: `CREATE UNIQUE INDEX orders_number_key ON public.orders USING btree (number)`
- `orders_pkey`: `CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)`
- `orders_unfinished_idx`: `CREATE INDEX orders_unfinished_idx ON public.orders USING btree (status, created_at)`

RLS policies:
- `admin_manage_orders` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `orders_access` (SELECT, roles: {authenticated}): using `can_access_order(id)`; check `—`

### `organizations`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `type` | `organization_type` | yes | — |
| `legal_name` | `text` | yes | — |
| `display_name` | `text` | yes | — |
| `slug` | `text` | yes | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `contact_email` | `text` | no | — |
| `contact_phone` | `text` | no | — |
| `website_url` | `text` | no | — |
| `description` | `text` | no | — |
| `national_id` | `text` | no | — |
| `registration_number` | `text` | no | — |

Constraints:
- `organizations_status_check`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'RESTRICTED'::text, 'SUSPENDED'::text, 'CLOSED'::text]))`
- `organizations_pkey`: `PRIMARY KEY (id)`
- `organizations_slug_key`: `UNIQUE (slug)`

Indexes:
- `organizations_pkey`: `CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id)`
- `organizations_slug_key`: `CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug)`

RLS policies:
- `admin_manage_organizations` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `organizations_member_read` (SELECT, roles: {authenticated}): using `is_org_member(id)`; check `—`
- `organizations_owner_update` (UPDATE, roles: {authenticated}): using `is_org_member(id, auth.uid(), ARRAY['OWNER'::text])`; check `is_org_member(id, auth.uid(), ARRAY['OWNER'::text])`

### `payment_attempts`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `payment_id` | `uuid` | no | — |
| `provider` | `text` | yes | — |
| `provider_attempt_id` | `text` | no | — |
| `idempotency_key` | `text` | yes | — |
| `amount` | `bigint` | yes | — |
| `currency` | `text` | yes | 'IRR'::text |
| `status` | `text` | yes | 'CREATED'::text |
| `request_payload` | `jsonb` | yes | '{}'::jsonb |
| `response_payload` | `jsonb` | yes | '{}'::jsonb |
| `failure_code` | `text` | no | — |
| `failure_message` | `text` | no | — |
| `expires_at` | `timestamp with time zone` | no | — |
| `completed_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `payment_attempts_amount_check`: `CHECK (amount > 0)`
- `payment_attempts_currency_check`: `CHECK (currency = 'IRR'::text)`
- `payment_attempts_status_check`: `CHECK (status = ANY (ARRAY['CREATED'::text, 'PENDING'::text, 'AUTHORIZED'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'CANCELLED'::text, 'EXPIRED'::text]))`
- `payment_attempts_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `payment_attempts_payment_id_fkey`: `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL`
- `payment_attempts_pkey`: `PRIMARY KEY (id)`
- `payment_attempts_idempotency_key_key`: `UNIQUE (idempotency_key)`
- `payment_attempts_provider_provider_attempt_id_key`: `UNIQUE (provider, provider_attempt_id)`

Indexes:
- `idx_payment_attempts_payment_attempts_order_id_fkey_3e746a32`: `CREATE INDEX idx_payment_attempts_payment_attempts_order_id_fkey_3e746a32 ON public.payment_attempts USING btree (order_id)`
- `idx_payment_attempts_payment_attempts_payment_id_fkey_261bebe9`: `CREATE INDEX idx_payment_attempts_payment_attempts_payment_id_fkey_261bebe9 ON public.payment_attempts USING btree (payment_id)`
- `payment_attempts_idempotency_key_key`: `CREATE UNIQUE INDEX payment_attempts_idempotency_key_key ON public.payment_attempts USING btree (idempotency_key)`
- `payment_attempts_pkey`: `CREATE UNIQUE INDEX payment_attempts_pkey ON public.payment_attempts USING btree (id)`
- `payment_attempts_provider_provider_attempt_id_key`: `CREATE UNIQUE INDEX payment_attempts_provider_provider_attempt_id_key ON public.payment_attempts USING btree (provider, provider_attempt_id)`

RLS policies:
- `admin_manage_payment_attempts` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `payment_attempts_order_read` (SELECT, roles: {authenticated}): using `can_access_order(order_id)`; check `—`

### `payments`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `provider` | `text` | yes | — |
| `provider_payment_id` | `text` | no | — |
| `idempotency_key` | `text` | yes | — |
| `amount` | `bigint` | yes | — |
| `currency` | `text` | yes | 'IRR'::text |
| `status` | `payment_state` | yes | 'PENDING'::payment_state |
| `provider_response` | `jsonb` | yes | '{}'::jsonb |
| `captured_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `payments_amount_check`: `CHECK (amount > 0)`
- `payments_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `payments_pkey`: `PRIMARY KEY (id)`
- `payments_idempotency_key_key`: `UNIQUE (idempotency_key)`
- `payments_provider_provider_payment_id_key`: `UNIQUE (provider, provider_payment_id)`

Indexes:
- `idx_payments_payments_order_id_fkey_54f643fe`: `CREATE INDEX idx_payments_payments_order_id_fkey_54f643fe ON public.payments USING btree (order_id)`
- `payments_idempotency_key_key`: `CREATE UNIQUE INDEX payments_idempotency_key_key ON public.payments USING btree (idempotency_key)`
- `payments_pkey`: `CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id)`
- `payments_provider_provider_payment_id_key`: `CREATE UNIQUE INDEX payments_provider_provider_payment_id_key ON public.payments USING btree (provider, provider_payment_id)`

RLS policies:
- `admin_manage_payments` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `payments_buyer_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM orders o   WHERE ((o.id = payments.order_id) AND (o.buyer_user_id = auth.uid()))))`; check `—`

### `payout_payment_history`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `payout_request_id` | `uuid` | yes | — |
| `organization_id` | `uuid` | yes | — |
| `amount` | `bigint` | yes | — |
| `currency` | `text` | yes | — |
| `receipt_text` | `text` | no | — |
| `paid_at` | `timestamp with time zone` | yes | now() |
| `admin_id` | `uuid` | no | — |
| `receipt_file_id` | `uuid` | no | — |
| `reference` | `text` | no | — |

Constraints:
- `payout_payment_history_admin_id_fkey`: `FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `payout_payment_history_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- `payout_payment_history_payout_request_id_fkey`: `FOREIGN KEY (payout_request_id) REFERENCES payout_requests(id)`
- `payout_payment_history_receipt_file_id_fkey`: `FOREIGN KEY (receipt_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `payout_payment_history_pkey`: `PRIMARY KEY (id)`
- `payout_payment_history_payout_request_id_key`: `UNIQUE (payout_request_id)`

Indexes:
- `idx_payout_payment_history_payout_payment_history_admi_c533b208`: `CREATE INDEX idx_payout_payment_history_payout_payment_history_admi_c533b208 ON public.payout_payment_history USING btree (admin_id)`
- `idx_payout_payment_history_payout_payment_history_orga_4535c8a7`: `CREATE INDEX idx_payout_payment_history_payout_payment_history_orga_4535c8a7 ON public.payout_payment_history USING btree (organization_id)`
- `idx_payout_payment_history_payout_payment_history_rece_5c1da324`: `CREATE INDEX idx_payout_payment_history_payout_payment_history_rece_5c1da324 ON public.payout_payment_history USING btree (receipt_file_id)`
- `payout_payment_history_payout_request_id_key`: `CREATE UNIQUE INDEX payout_payment_history_payout_request_id_key ON public.payout_payment_history USING btree (payout_request_id)`
- `payout_payment_history_pkey`: `CREATE UNIQUE INDEX payout_payment_history_pkey ON public.payout_payment_history USING btree (id)`

RLS policies:
- `admin_manage_payout_payment_history` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `payout_history_org_read` (SELECT, roles: {authenticated}): using `is_org_member(organization_id)`; check `—`

### `payout_request_items`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `payout_request_id` | `uuid` | yes | — |
| `earning_id` | `uuid` | yes | — |
| `amount` | `bigint` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `payout_request_items_amount_check`: `CHECK (amount > 0)`
- `payout_request_items_earning_id_fkey`: `FOREIGN KEY (earning_id) REFERENCES earnings(id) ON DELETE RESTRICT`
- `payout_request_items_payout_request_id_fkey`: `FOREIGN KEY (payout_request_id) REFERENCES payout_requests(id) ON DELETE RESTRICT`
- `payout_request_items_pkey`: `PRIMARY KEY (payout_request_id, earning_id)`
- `payout_request_items_earning_id_key`: `UNIQUE (earning_id)`

Indexes:
- `payout_request_items_earning_id_key`: `CREATE UNIQUE INDEX payout_request_items_earning_id_key ON public.payout_request_items USING btree (earning_id)`
- `payout_request_items_pkey`: `CREATE UNIQUE INDEX payout_request_items_pkey ON public.payout_request_items USING btree (payout_request_id, earning_id)`

RLS policies:
- `admin_manage_payout_request_items` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `payout_items_org_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM payout_requests p   WHERE ((p.id = payout_request_items.payout_request_id) AND is_org_member(p.organization_id))))`; check `—`

### `payout_requests`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `organization_id` | `uuid` | yes | — |
| `bank_account_id` | `uuid` | no | — |
| `amount` | `bigint` | yes | — |
| `currency` | `text` | yes | 'IRR'::text |
| `status` | `payout_state` | yes | 'REQUESTED'::payout_state |
| `requested_at` | `timestamp with time zone` | yes | now() |
| `processed_at` | `timestamp with time zone` | no | — |
| `processed_by` | `uuid` | no | — |
| `idempotency_key` | `text` | no | — |
| `rejection_reason` | `text` | no | — |

Constraints:
- `payout_requests_amount_check`: `CHECK (amount > 0)`
- `payout_requests_bank_account_id_fkey`: `FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)`
- `payout_requests_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- `payout_requests_processed_by_fkey`: `FOREIGN KEY (processed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `payout_requests_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_payout_requests_payout_requests_bank_account_id_fk_8aa4ff4a`: `CREATE INDEX idx_payout_requests_payout_requests_bank_account_id_fk_8aa4ff4a ON public.payout_requests USING btree (bank_account_id)`
- `idx_payout_requests_payout_requests_processed_by_fkey_64545c68`: `CREATE INDEX idx_payout_requests_payout_requests_processed_by_fkey_64545c68 ON public.payout_requests USING btree (processed_by)`
- `payout_requests_idempotency_idx`: `CREATE UNIQUE INDEX payout_requests_idempotency_idx ON public.payout_requests USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL)`
- `payout_requests_one_open_idx`: `CREATE UNIQUE INDEX payout_requests_one_open_idx ON public.payout_requests USING btree (organization_id) WHERE (status = ANY (ARRAY['REQUESTED'::payout_state, 'PROCESSING'::payout_state]))`
- `payout_requests_pkey`: `CREATE UNIQUE INDEX payout_requests_pkey ON public.payout_requests USING btree (id)`
- `payout_requests_queue_idx`: `CREATE INDEX payout_requests_queue_idx ON public.payout_requests USING btree (status, requested_at)`

RLS policies:
- `admin_manage_payout_requests` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `payouts_org_read` (SELECT, roles: {authenticated}): using `is_org_member(organization_id)`; check `—`

### `print_methods`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `slug` | `text` | yes | — |
| `name` | `text` | yes | — |
| `description` | `text` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `print_methods_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))`
- `print_methods_pkey`: `PRIMARY KEY (id)`
- `print_methods_slug_key`: `UNIQUE (slug)`

Indexes:
- `print_methods_pkey`: `CREATE UNIQUE INDEX print_methods_pkey ON public.print_methods USING btree (id)`
- `print_methods_slug_key`: `CREATE UNIQUE INDEX print_methods_slug_key ON public.print_methods USING btree (slug)`

RLS policies:
- `admin_manage_print_methods` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `print_methods_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `product_details`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seller_product_id` | `uuid` | yes | — |
| `title` | `text` | yes | — |
| `value` | `text` | yes | — |
| `sort_order` | `integer` | yes | 0 |

Constraints:
- `product_details_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `product_details_pkey`: `PRIMARY KEY (id)`
- `product_details_seller_product_id_title_key`: `UNIQUE (seller_product_id, title)`

Indexes:
- `product_details_pkey`: `CREATE UNIQUE INDEX product_details_pkey ON public.product_details USING btree (id)`
- `product_details_seller_product_id_title_key`: `CREATE UNIQUE INDEX product_details_seller_product_id_title_key ON public.product_details USING btree (seller_product_id, title)`

RLS policies:
- `admin_manage_product_details` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `product_details_owner` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_details.seller_product_id) AND can_manage_store(p.store_id))))`; check `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_details.seller_product_id) AND can_manage_store(p.store_id))))`
- `product_details_public_read` (SELECT, roles: {anon,authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_details.seller_product_id) AND (p.status = 'PUBLISHED'::text) AND (p.moderation_status = 'APPROVED'::moderation_state))))`; check `—`

### `product_graphic_styles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `seller_product_id` | `uuid` | yes | — |
| `graphic_style_id` | `uuid` | yes | — |

Constraints:
- `product_graphic_styles_graphic_style_id_fkey`: `FOREIGN KEY (graphic_style_id) REFERENCES graphic_styles(id) ON DELETE CASCADE`
- `product_graphic_styles_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `product_graphic_styles_pkey`: `PRIMARY KEY (seller_product_id, graphic_style_id)`

Indexes:
- `idx_product_graphic_styles_product_graphic_styles_grap_6e5e859b`: `CREATE INDEX idx_product_graphic_styles_product_graphic_styles_grap_6e5e859b ON public.product_graphic_styles USING btree (graphic_style_id)`
- `product_graphic_styles_pkey`: `CREATE UNIQUE INDEX product_graphic_styles_pkey ON public.product_graphic_styles USING btree (seller_product_id, graphic_style_id)`

RLS policies:
- `admin_manage_product_graphic_styles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `product_graphic_styles_public_read` (SELECT, roles: {anon,authenticated}): using `true`; check `—`

### `product_images`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seller_product_id` | `uuid` | yes | — |
| `file_id` | `uuid` | yes | — |
| `alt_text` | `text` | yes | — |
| `sort_order` | `integer` | yes | 0 |
| `is_primary` | `boolean` | yes | false |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `product_images_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `product_images_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `product_images_pkey`: `PRIMARY KEY (id)`
- `product_images_seller_product_id_file_id_key`: `UNIQUE (seller_product_id, file_id)`

Indexes:
- `idx_product_images_product_images_file_id_fkey_cdfae10b`: `CREATE INDEX idx_product_images_product_images_file_id_fkey_cdfae10b ON public.product_images USING btree (file_id)`
- `product_images_pkey`: `CREATE UNIQUE INDEX product_images_pkey ON public.product_images USING btree (id)`
- `product_images_primary_idx`: `CREATE UNIQUE INDEX product_images_primary_idx ON public.product_images USING btree (seller_product_id) WHERE is_primary`
- `product_images_product_sort_idx`: `CREATE INDEX product_images_product_sort_idx ON public.product_images USING btree (seller_product_id, is_primary DESC, sort_order)`
- `product_images_seller_product_id_file_id_key`: `CREATE UNIQUE INDEX product_images_seller_product_id_file_id_key ON public.product_images USING btree (seller_product_id, file_id)`

RLS policies:
- `admin_manage_product_images` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `product_images_owner` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_images.seller_product_id) AND can_manage_store(p.store_id))))`; check `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_images.seller_product_id) AND can_manage_store(p.store_id))))`
- `product_images_public_read` (SELECT, roles: {anon,authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_images.seller_product_id) AND (p.status = 'PUBLISHED'::text) AND (p.moderation_status = 'APPROVED'::moderation_state))))`; check `—`

### `product_moderation_decisions`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seller_product_id` | `uuid` | yes | — |
| `queue_id` | `uuid` | no | — |
| `decision` | `moderation_state` | yes | — |
| `rejection_reason_id` | `uuid` | no | — |
| `custom_message` | `text` | no | — |
| `admin_user_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `moderation_rejection_reason`: `CHECK (decision = 'APPROVED'::moderation_state OR rejection_reason_id IS NOT NULL)`
- `product_moderation_decisions_decision_check`: `CHECK (decision = ANY (ARRAY['APPROVED'::moderation_state, 'REJECTED'::moderation_state]))`
- `product_moderation_decisions_admin_user_id_fkey`: `FOREIGN KEY (admin_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `product_moderation_decisions_queue_id_fkey`: `FOREIGN KEY (queue_id) REFERENCES product_moderation_queue(id) ON DELETE SET NULL`
- `product_moderation_decisions_rejection_reason_id_fkey`: `FOREIGN KEY (rejection_reason_id) REFERENCES rejection_reasons(id) ON DELETE RESTRICT`
- `product_moderation_decisions_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE RESTRICT`
- `product_moderation_decisions_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_product_moderation_decisions_product_moderation_de_155e72b6`: `CREATE INDEX idx_product_moderation_decisions_product_moderation_de_155e72b6 ON public.product_moderation_decisions USING btree (queue_id)`
- `idx_product_moderation_decisions_product_moderation_de_19b98753`: `CREATE INDEX idx_product_moderation_decisions_product_moderation_de_19b98753 ON public.product_moderation_decisions USING btree (admin_user_id)`
- `idx_product_moderation_decisions_product_moderation_de_e17fb783`: `CREATE INDEX idx_product_moderation_decisions_product_moderation_de_e17fb783 ON public.product_moderation_decisions USING btree (seller_product_id)`
- `idx_product_moderation_decisions_product_moderation_de_e80ade32`: `CREATE INDEX idx_product_moderation_decisions_product_moderation_de_e80ade32 ON public.product_moderation_decisions USING btree (rejection_reason_id)`
- `product_moderation_decisions_pkey`: `CREATE UNIQUE INDEX product_moderation_decisions_pkey ON public.product_moderation_decisions USING btree (id)`

RLS policies:
- `admin_manage_product_moderation_decisions` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`

### `product_moderation_queue`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seller_product_id` | `uuid` | yes | — |
| `seller_id` | `uuid` | yes | — |
| `status` | `text` | yes | 'PENDING'::text |
| `submitted_at` | `timestamp with time zone` | yes | now() |
| `reviewed_at` | `timestamp with time zone` | no | — |
| `reviewed_by` | `uuid` | no | — |
| `rejection_reason_id` | `uuid` | no | — |
| `custom_message` | `text` | no | — |

Constraints:
- `product_moderation_queue_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `product_moderation_queue_seller_id_fkey`: `FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `product_moderation_queue_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id)`
- `product_moderation_queue_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_product_moderation_queue_product_moderation_queue__5b2d3f42`: `CREATE INDEX idx_product_moderation_queue_product_moderation_queue__5b2d3f42 ON public.product_moderation_queue USING btree (reviewed_by)`
- `idx_product_moderation_queue_product_moderation_queue__8fe55e7a`: `CREATE INDEX idx_product_moderation_queue_product_moderation_queue__8fe55e7a ON public.product_moderation_queue USING btree (seller_id)`
- `idx_product_moderation_queue_product_moderation_queue__ca8cc248`: `CREATE INDEX idx_product_moderation_queue_product_moderation_queue__ca8cc248 ON public.product_moderation_queue USING btree (seller_product_id)`
- `moderation_queue_status_idx`: `CREATE INDEX moderation_queue_status_idx ON public.product_moderation_queue USING btree (status, submitted_at)`
- `product_moderation_queue_pkey`: `CREATE UNIQUE INDEX product_moderation_queue_pkey ON public.product_moderation_queue USING btree (id)`

RLS policies:
- `admin_manage_product_moderation_queue` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`

### `product_tags`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `seller_product_id` | `uuid` | yes | — |
| `tag_id` | `uuid` | yes | — |

Constraints:
- `product_tags_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `product_tags_tag_id_fkey`: `FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE`
- `product_tags_pkey`: `PRIMARY KEY (seller_product_id, tag_id)`

Indexes:
- `idx_product_tags_product_tags_tag_id_fkey_31524596`: `CREATE INDEX idx_product_tags_product_tags_tag_id_fkey_31524596 ON public.product_tags USING btree (tag_id)`
- `product_tags_pkey`: `CREATE UNIQUE INDEX product_tags_pkey ON public.product_tags USING btree (seller_product_id, tag_id)`

RLS policies:
- `admin_manage_product_tags` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `product_tags_public_read` (SELECT, roles: {anon,authenticated}): using `true`; check `—`

### `product_videos`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seller_product_id` | `uuid` | yes | — |
| `file_id` | `uuid` | yes | — |
| `caption` | `text` | no | — |
| `sort_order` | `integer` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `product_videos_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `product_videos_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `product_videos_pkey`: `PRIMARY KEY (id)`
- `product_videos_seller_product_id_file_id_key`: `UNIQUE (seller_product_id, file_id)`

Indexes:
- `idx_product_videos_product_videos_file_id_fkey_9de38f79`: `CREATE INDEX idx_product_videos_product_videos_file_id_fkey_9de38f79 ON public.product_videos USING btree (file_id)`
- `product_videos_pkey`: `CREATE UNIQUE INDEX product_videos_pkey ON public.product_videos USING btree (id)`
- `product_videos_seller_product_id_file_id_key`: `CREATE UNIQUE INDEX product_videos_seller_product_id_file_id_key ON public.product_videos USING btree (seller_product_id, file_id)`

RLS policies:
- `admin_manage_product_videos` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `product_videos_owner` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_videos.seller_product_id) AND can_manage_store(p.store_id))))`; check `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_videos.seller_product_id) AND can_manage_store(p.store_id))))`
- `product_videos_public_read` (SELECT, roles: {anon,authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = product_videos.seller_product_id) AND (p.status = 'PUBLISHED'::text) AND (p.moderation_status = 'APPROVED'::moderation_state))))`; check `—`

### `profiles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | — |
| `primary_role` | `account_role` | yes | 'BUYER'::account_role |
| `email` | `text` | yes | — |
| `first_name` | `text` | yes | ''::text |
| `last_name` | `text` | yes | ''::text |
| `phone` | `text` | no | — |
| `avatar_path` | `text` | no | — |
| `locale` | `text` | yes | 'fa-IR'::text |
| `state` | `account_state` | yes | 'ACTIVE'::account_state |
| `email_verified_at` | `timestamp with time zone` | no | — |
| `phone_verified_at` | `timestamp with time zone` | no | — |
| `last_login_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `profiles_email_lower`: `CHECK (email = lower(email))`
- `profiles_id_fkey`: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `profiles_pkey`: `PRIMARY KEY (id)`
- `profiles_email_unique`: `UNIQUE (email)`

Indexes:
- `profiles_email_unique`: `CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (email)`
- `profiles_pkey`: `CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)`
- `profiles_role_state_idx`: `CREATE INDEX profiles_role_state_idx ON public.profiles USING btree (primary_role, state)`

RLS policies:
- `admin_manage_profiles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `profiles_read_own` (SELECT, roles: {authenticated}): using `(id = auth.uid())`; check `—`
- `profiles_update_own` (UPDATE, roles: {authenticated}): using `(id = auth.uid())`; check `(id = auth.uid())`

### `rate_limit_counters`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `identity_hash` | `text` | yes | — |
| `action` | `text` | yes | — |
| `window_started_at` | `timestamp with time zone` | yes | — |
| `request_count` | `integer` | yes | 1 |
| `expires_at` | `timestamp with time zone` | yes | — |

Constraints:
- `rate_limit_counters_request_count_check`: `CHECK (request_count > 0)`
- `rate_limit_counters_pkey`: `PRIMARY KEY (identity_hash, action, window_started_at)`

Indexes:
- `rate_limit_counters_expiry_idx`: `CREATE INDEX rate_limit_counters_expiry_idx ON public.rate_limit_counters USING btree (expires_at)`
- `rate_limit_counters_pkey`: `CREATE UNIQUE INDEX rate_limit_counters_pkey ON public.rate_limit_counters USING btree (identity_hash, action, window_started_at)`

RLS policies:
- `rate_limit_counters_admin_read` (SELECT, roles: {authenticated}): using `is_admin()`; check `—`

### `raw_product_colors`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_id` | `uuid` | yes | — |
| `name` | `text` | yes | — |
| `hex` | `text` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `slug` | `text` | yes | — |
| `sort_order` | `integer` | yes | 0 |

Constraints:
- `raw_product_colors_hex_check`: `CHECK (hex IS NULL OR hex ~ '^#[0-9A-Fa-f]{6}$'::text)`
- `raw_product_colors_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))`
- `raw_product_colors_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id) ON DELETE CASCADE`
- `raw_product_colors_pkey`: `PRIMARY KEY (id)`
- `raw_product_colors_raw_product_id_name_key`: `UNIQUE (raw_product_id, name)`

Indexes:
- `raw_product_colors_pkey`: `CREATE UNIQUE INDEX raw_product_colors_pkey ON public.raw_product_colors USING btree (id)`
- `raw_product_colors_raw_product_id_name_key`: `CREATE UNIQUE INDEX raw_product_colors_raw_product_id_name_key ON public.raw_product_colors USING btree (raw_product_id, name)`
- `raw_product_colors_slug_idx`: `CREATE UNIQUE INDEX raw_product_colors_slug_idx ON public.raw_product_colors USING btree (raw_product_id, slug)`

RLS policies:
- `admin_manage_raw_product_colors` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_colors_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `raw_product_media`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_id` | `uuid` | yes | — |
| `file_id` | `uuid` | yes | — |
| `alt_text` | `text` | yes | — |
| `sort_order` | `integer` | yes | 0 |
| `is_primary` | `boolean` | yes | false |

Constraints:
- `raw_product_media_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `raw_product_media_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id) ON DELETE CASCADE`
- `raw_product_media_pkey`: `PRIMARY KEY (id)`
- `raw_product_media_raw_product_id_file_id_key`: `UNIQUE (raw_product_id, file_id)`

Indexes:
- `idx_raw_product_media_raw_product_media_file_id_fkey_60334fb8`: `CREATE INDEX idx_raw_product_media_raw_product_media_file_id_fkey_60334fb8 ON public.raw_product_media USING btree (file_id)`
- `raw_product_media_pkey`: `CREATE UNIQUE INDEX raw_product_media_pkey ON public.raw_product_media USING btree (id)`
- `raw_product_media_primary_idx`: `CREATE UNIQUE INDEX raw_product_media_primary_idx ON public.raw_product_media USING btree (raw_product_id) WHERE is_primary`
- `raw_product_media_raw_product_id_file_id_key`: `CREATE UNIQUE INDEX raw_product_media_raw_product_id_file_id_key ON public.raw_product_media USING btree (raw_product_id, file_id)`

RLS policies:
- `admin_manage_raw_product_media` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_media_public_read` (SELECT, roles: {anon,authenticated}): using `true`; check `—`

### `raw_product_mockup_views`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `mockup_id` | `uuid` | yes | — |
| `side` | `text` | yes | — |
| `background_file_id` | `uuid` | yes | — |
| `area_x` | `numeric` | yes | — |
| `area_y` | `numeric` | yes | — |
| `area_width` | `numeric` | yes | — |
| `area_height` | `numeric` | yes | — |
| `perspective_points` | `jsonb` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `rotation_degrees` | `numeric` | yes | 0 |

Constraints:
- `raw_product_mockup_views_area_height_check`: `CHECK (area_height > 0::numeric AND area_height <= 1::numeric)`
- `raw_product_mockup_views_area_width_check`: `CHECK (area_width > 0::numeric AND area_width <= 1::numeric)`
- `raw_product_mockup_views_area_x_check`: `CHECK (area_x >= 0::numeric AND area_x <= 1::numeric)`
- `raw_product_mockup_views_area_y_check`: `CHECK (area_y >= 0::numeric AND area_y <= 1::numeric)`
- `raw_product_mockup_views_check`: `CHECK ((area_x + area_width) <= 1::numeric)`
- `raw_product_mockup_views_check1`: `CHECK ((area_y + area_height) <= 1::numeric)`
- `raw_product_mockup_views_rotation_check`: `CHECK (rotation_degrees >= '-180'::integer::numeric AND rotation_degrees <= 180::numeric)`
- `raw_product_mockup_views_side_check`: `CHECK (side = ANY (ARRAY['FRONT'::text, 'BACK'::text]))`
- `raw_product_mockup_views_background_file_id_fkey`: `FOREIGN KEY (background_file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `raw_product_mockup_views_mockup_id_fkey`: `FOREIGN KEY (mockup_id) REFERENCES raw_product_mockups(id) ON DELETE CASCADE`
- `raw_product_mockup_views_pkey`: `PRIMARY KEY (id)`
- `raw_product_mockup_views_mockup_id_side_key`: `UNIQUE (mockup_id, side)`

Indexes:
- `raw_product_mockup_views_mockup_id_side_key`: `CREATE UNIQUE INDEX raw_product_mockup_views_mockup_id_side_key ON public.raw_product_mockup_views USING btree (mockup_id, side)`
- `raw_product_mockup_views_pkey`: `CREATE UNIQUE INDEX raw_product_mockup_views_pkey ON public.raw_product_mockup_views USING btree (id)`

RLS policies:
- `mockup_views_admin` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `mockup_views_read` (SELECT, roles: {authenticated}): using `true`; check `—`

### `raw_product_mockups`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_id` | `uuid` | yes | — |
| `name` | `text` | yes | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_by` | `uuid` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `raw_product_mockups_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))`
- `raw_product_mockups_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `raw_product_mockups_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id) ON DELETE CASCADE`
- `raw_product_mockups_pkey`: `PRIMARY KEY (id)`

Indexes:
- `raw_product_mockups_pkey`: `CREATE UNIQUE INDEX raw_product_mockups_pkey ON public.raw_product_mockups USING btree (id)`

RLS policies:
- `mockups_admin` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `mockups_read` (SELECT, roles: {authenticated}): using `((status = 'ACTIVE'::text) OR is_admin())`; check `—`

### `raw_product_sizes`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_id` | `uuid` | yes | — |
| `name` | `text` | yes | — |
| `sort_order` | `integer` | yes | 0 |
| `status` | `text` | yes | 'ACTIVE'::text |
| `label` | `text` | no | — |

Constraints:
- `raw_product_sizes_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))`
- `raw_product_sizes_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id) ON DELETE CASCADE`
- `raw_product_sizes_pkey`: `PRIMARY KEY (id)`
- `raw_product_sizes_raw_product_id_name_key`: `UNIQUE (raw_product_id, name)`

Indexes:
- `raw_product_sizes_pkey`: `CREATE UNIQUE INDEX raw_product_sizes_pkey ON public.raw_product_sizes USING btree (id)`
- `raw_product_sizes_raw_product_id_name_key`: `CREATE UNIQUE INDEX raw_product_sizes_raw_product_id_name_key ON public.raw_product_sizes USING btree (raw_product_id, name)`

RLS policies:
- `admin_manage_raw_product_sizes` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_sizes_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `raw_product_variant_assets`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_variant_id` | `uuid` | yes | — |
| `raw_product_view_id` | `uuid` | yes | — |
| `background_file_id` | `uuid` | yes | — |
| `overlay_file_id` | `uuid` | no | — |
| `mockup_file_id` | `uuid` | no | — |
| `print_area_override_x` | `numeric` | no | — |
| `print_area_override_y` | `numeric` | no | — |
| `print_area_override_width` | `numeric` | no | — |
| `print_area_override_height` | `numeric` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `variant_asset_override_all_or_none`: `CHECK (print_area_override_x IS NULL AND print_area_override_y IS NULL AND print_area_override_width IS NULL AND print_area_override_height IS NULL OR print_area_override_x >= 0::numeric AND print_area_override_x <= 1::numeric AND print_area_override_y >= 0::numeric AND print_area_override_y <= 1::numeric AND print_area_override_width > 0::numeric AND print_area_override_width <= 1::numeric AND print_area_override_height > 0::numeric AND print_area_override_height <= 1::numeric AND (print_area_override_x + print_area_override_width) <= 1::numeric AND (print_area_override_y + print_area_override_height) <= 1::numeric)`
- `raw_product_variant_assets_background_file_id_fkey`: `FOREIGN KEY (background_file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `raw_product_variant_assets_mockup_file_id_fkey`: `FOREIGN KEY (mockup_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `raw_product_variant_assets_overlay_file_id_fkey`: `FOREIGN KEY (overlay_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `raw_product_variant_assets_raw_product_variant_id_fkey`: `FOREIGN KEY (raw_product_variant_id) REFERENCES raw_product_variants(id) ON DELETE CASCADE`
- `raw_product_variant_assets_raw_product_view_id_fkey`: `FOREIGN KEY (raw_product_view_id) REFERENCES raw_product_views(id) ON DELETE CASCADE`
- `raw_product_variant_assets_pkey`: `PRIMARY KEY (id)`
- `raw_product_variant_assets_raw_product_variant_id_raw_produ_key`: `UNIQUE (raw_product_variant_id, raw_product_view_id)`

Indexes:
- `idx_raw_product_variant_assets_raw_product_variant_ass_67fb563b`: `CREATE INDEX idx_raw_product_variant_assets_raw_product_variant_ass_67fb563b ON public.raw_product_variant_assets USING btree (mockup_file_id)`
- `idx_raw_product_variant_assets_raw_product_variant_ass_6a3daa2b`: `CREATE INDEX idx_raw_product_variant_assets_raw_product_variant_ass_6a3daa2b ON public.raw_product_variant_assets USING btree (raw_product_view_id)`
- `idx_raw_product_variant_assets_raw_product_variant_ass_798ffcb8`: `CREATE INDEX idx_raw_product_variant_assets_raw_product_variant_ass_798ffcb8 ON public.raw_product_variant_assets USING btree (background_file_id)`
- `idx_raw_product_variant_assets_raw_product_variant_ass_9d0aec18`: `CREATE INDEX idx_raw_product_variant_assets_raw_product_variant_ass_9d0aec18 ON public.raw_product_variant_assets USING btree (overlay_file_id)`
- `raw_product_variant_assets_pkey`: `CREATE UNIQUE INDEX raw_product_variant_assets_pkey ON public.raw_product_variant_assets USING btree (id)`
- `raw_product_variant_assets_raw_product_variant_id_raw_produ_key`: `CREATE UNIQUE INDEX raw_product_variant_assets_raw_product_variant_id_raw_produ_key ON public.raw_product_variant_assets USING btree (raw_product_variant_id, raw_product_view_id)`
- `raw_variant_assets_variant_idx`: `CREATE INDEX raw_variant_assets_variant_idx ON public.raw_product_variant_assets USING btree (raw_product_variant_id, raw_product_view_id)`

RLS policies:
- `admin_manage_raw_product_variant_assets` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_variant_assets_auth_read` (SELECT, roles: {authenticated}): using `true`; check `—`

### `raw_product_variants`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_id` | `uuid` | yes | — |
| `color_id` | `uuid` | yes | — |
| `size_id` | `uuid` | yes | — |
| `sku` | `text` | yes | — |
| `additional_cost` | `bigint` | yes | 0 |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `raw_product_variants_additional_cost_check`: `CHECK (additional_cost >= 0)`
- `raw_product_variants_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text]))`
- `raw_product_variants_color_id_fkey`: `FOREIGN KEY (color_id) REFERENCES raw_product_colors(id) ON DELETE RESTRICT`
- `raw_product_variants_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id) ON DELETE CASCADE`
- `raw_product_variants_size_id_fkey`: `FOREIGN KEY (size_id) REFERENCES raw_product_sizes(id) ON DELETE RESTRICT`
- `raw_product_variants_pkey`: `PRIMARY KEY (id)`
- `raw_product_variants_raw_product_id_color_id_size_id_key`: `UNIQUE (raw_product_id, color_id, size_id)`
- `raw_product_variants_sku_key`: `UNIQUE (sku)`

Indexes:
- `idx_raw_product_variants_raw_product_variants_color_id_3ed1c3cf`: `CREATE INDEX idx_raw_product_variants_raw_product_variants_color_id_3ed1c3cf ON public.raw_product_variants USING btree (color_id)`
- `idx_raw_product_variants_raw_product_variants_size_id__7941f19f`: `CREATE INDEX idx_raw_product_variants_raw_product_variants_size_id__7941f19f ON public.raw_product_variants USING btree (size_id)`
- `raw_product_variants_pkey`: `CREATE UNIQUE INDEX raw_product_variants_pkey ON public.raw_product_variants USING btree (id)`
- `raw_product_variants_raw_product_id_color_id_size_id_key`: `CREATE UNIQUE INDEX raw_product_variants_raw_product_id_color_id_size_id_key ON public.raw_product_variants USING btree (raw_product_id, color_id, size_id)`
- `raw_product_variants_sku_key`: `CREATE UNIQUE INDEX raw_product_variants_sku_key ON public.raw_product_variants USING btree (sku)`
- `raw_variants_product_status_idx`: `CREATE INDEX raw_variants_product_status_idx ON public.raw_product_variants USING btree (raw_product_id, status)`

RLS policies:
- `admin_manage_raw_product_variants` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_variants_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `raw_product_views`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `raw_product_id` | `uuid` | yes | — |
| `side` | `side_name` | yes | — |
| `print_area_x` | `numeric` | yes | — |
| `print_area_y` | `numeric` | yes | — |
| `print_area_width` | `numeric` | yes | — |
| `print_area_height` | `numeric` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `background_file_id` | `uuid` | no | — |
| `overlay_file_id` | `uuid` | no | — |
| `mockup_file_id` | `uuid` | no | — |

Constraints:
- `raw_product_views_area_height`: `CHECK (print_area_height > 0::numeric AND print_area_height <= 1::numeric)`
- `raw_product_views_area_width`: `CHECK (print_area_width > 0::numeric AND print_area_width <= 1::numeric)`
- `raw_product_views_area_x`: `CHECK (print_area_x >= 0::numeric AND print_area_x <= 1::numeric)`
- `raw_product_views_area_y`: `CHECK (print_area_y >= 0::numeric AND print_area_y <= 1::numeric)`
- `raw_product_views_bounds_x`: `CHECK ((print_area_x + print_area_width) <= 1::numeric)`
- `raw_product_views_bounds_y`: `CHECK ((print_area_y + print_area_height) <= 1::numeric)`
- `raw_product_views_background_file_id_fkey`: `FOREIGN KEY (background_file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `raw_product_views_mockup_file_id_fkey`: `FOREIGN KEY (mockup_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `raw_product_views_overlay_file_id_fkey`: `FOREIGN KEY (overlay_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `raw_product_views_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id) ON DELETE CASCADE`
- `raw_product_views_pkey`: `PRIMARY KEY (id)`
- `raw_product_views_raw_product_id_side_key`: `UNIQUE (raw_product_id, side)`

Indexes:
- `raw_product_views_background_file_idx`: `CREATE INDEX raw_product_views_background_file_idx ON public.raw_product_views USING btree (background_file_id)`
- `raw_product_views_pkey`: `CREATE UNIQUE INDEX raw_product_views_pkey ON public.raw_product_views USING btree (id)`
- `raw_product_views_raw_product_id_side_key`: `CREATE UNIQUE INDEX raw_product_views_raw_product_id_side_key ON public.raw_product_views USING btree (raw_product_id, side)`

RLS policies:
- `admin_manage_raw_product_views` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_views_public_read` (SELECT, roles: {anon,authenticated}): using `true`; check `—`

### `raw_products`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `category_id` | `uuid` | yes | — |
| `name` | `text` | yes | — |
| `description` | `text` | no | — |
| `base_cost` | `bigint` | yes | 0 |
| `suggested_price` | `bigint` | yes | 0 |
| `has_back` | `boolean` | yes | false |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `slug` | `text` | yes | — |
| `sku_prefix` | `text` | no | — |
| `material` | `text` | no | — |
| `weight_grams` | `integer` | no | — |
| `production_notes` | `text` | no | — |
| `version` | `integer` | yes | 1 |

Constraints:
- `raw_products_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text]))`
- `raw_products_weight_grams_check`: `CHECK (weight_grams IS NULL OR weight_grams > 0)`
- `raw_products_category_id_fkey`: `FOREIGN KEY (category_id) REFERENCES categories(id)`
- `raw_products_pkey`: `PRIMARY KEY (id)`

Indexes:
- `raw_products_category_status_idx`: `CREATE INDEX raw_products_category_status_idx ON public.raw_products USING btree (category_id, status, created_at DESC)`
- `raw_products_pkey`: `CREATE UNIQUE INDEX raw_products_pkey ON public.raw_products USING btree (id)`
- `raw_products_slug_idx`: `CREATE UNIQUE INDEX raw_products_slug_idx ON public.raw_products USING btree (slug)`

RLS policies:
- `admin_manage_raw_products` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `raw_products_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `recent_product_views`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `user_id` | `uuid` | yes | — |
| `seller_product_id` | `uuid` | yes | — |
| `viewed_at` | `timestamp with time zone` | yes | now() |
| `view_count` | `integer` | yes | 1 |

Constraints:
- `recent_product_views_view_count_check`: `CHECK (view_count > 0)`
- `recent_product_views_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `recent_product_views_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `recent_product_views_pkey`: `PRIMARY KEY (user_id, seller_product_id)`

Indexes:
- `idx_recent_product_views_recent_product_views_seller_p_73386fb0`: `CREATE INDEX idx_recent_product_views_recent_product_views_seller_p_73386fb0 ON public.recent_product_views USING btree (seller_product_id)`
- `recent_product_views_pkey`: `CREATE UNIQUE INDEX recent_product_views_pkey ON public.recent_product_views USING btree (user_id, seller_product_id)`

RLS policies:
- `admin_manage_recent_product_views` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `recent_views_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `reel_likes`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `reel_id` | `uuid` | yes | — |
| `user_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `reel_likes_reel_id_fkey`: `FOREIGN KEY (reel_id) REFERENCES reel_posts(id) ON DELETE CASCADE`
- `reel_likes_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `reel_likes_pkey`: `PRIMARY KEY (reel_id, user_id)`

Indexes:
- `idx_reel_likes_reel_likes_user_id_fkey_b60d14cc`: `CREATE INDEX idx_reel_likes_reel_likes_user_id_fkey_b60d14cc ON public.reel_likes USING btree (user_id)`
- `reel_likes_pkey`: `CREATE UNIQUE INDEX reel_likes_pkey ON public.reel_likes USING btree (reel_id, user_id)`

RLS policies:
- `admin_manage_reel_likes` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `reel_likes_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `reel_posts`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `store_id` | `uuid` | yes | — |
| `seller_product_id` | `uuid` | no | — |
| `video_file_id` | `uuid` | yes | — |
| `caption` | `text` | yes | — |
| `status` | `text` | yes | 'PUBLISHED'::text |
| `like_count` | `integer` | yes | 0 |
| `save_count` | `integer` | yes | 0 |
| `published_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `reel_posts_like_count_check`: `CHECK (like_count >= 0)`
- `reel_posts_save_count_check`: `CHECK (save_count >= 0)`
- `reel_posts_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'ARCHIVED'::text]))`
- `reel_posts_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE SET NULL`
- `reel_posts_store_id_fkey`: `FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE`
- `reel_posts_video_file_id_fkey`: `FOREIGN KEY (video_file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `reel_posts_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_reel_posts_reel_posts_seller_product_id_fkey_717b2ca3`: `CREATE INDEX idx_reel_posts_reel_posts_seller_product_id_fkey_717b2ca3 ON public.reel_posts USING btree (seller_product_id)`
- `idx_reel_posts_reel_posts_store_id_fkey_83702f51`: `CREATE INDEX idx_reel_posts_reel_posts_store_id_fkey_83702f51 ON public.reel_posts USING btree (store_id)`
- `idx_reel_posts_reel_posts_video_file_id_fkey_74e470ae`: `CREATE INDEX idx_reel_posts_reel_posts_video_file_id_fkey_74e470ae ON public.reel_posts USING btree (video_file_id)`
- `reel_posts_pkey`: `CREATE UNIQUE INDEX reel_posts_pkey ON public.reel_posts USING btree (id)`
- `reel_posts_public_idx`: `CREATE INDEX reel_posts_public_idx ON public.reel_posts USING btree (status, published_at DESC)`

RLS policies:
- `admin_manage_reel_posts` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `reels_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'PUBLISHED'::text)`; check `—`
- `reels_store_manage` (ALL, roles: {authenticated}): using `can_manage_store(store_id)`; check `can_manage_store(store_id)`

### `reel_saves`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `reel_id` | `uuid` | yes | — |
| `user_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `reel_saves_reel_id_fkey`: `FOREIGN KEY (reel_id) REFERENCES reel_posts(id) ON DELETE CASCADE`
- `reel_saves_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `reel_saves_pkey`: `PRIMARY KEY (reel_id, user_id)`

Indexes:
- `idx_reel_saves_reel_saves_user_id_fkey_6553e04c`: `CREATE INDEX idx_reel_saves_reel_saves_user_id_fkey_6553e04c ON public.reel_saves USING btree (user_id)`
- `reel_saves_pkey`: `CREATE UNIQUE INDEX reel_saves_pkey ON public.reel_saves USING btree (reel_id, user_id)`

RLS policies:
- `admin_manage_reel_saves` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `reel_saves_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `refunds`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_id` | `uuid` | yes | — |
| `payment_id` | `uuid` | yes | — |
| `requested_by` | `uuid` | no | — |
| `processed_by` | `uuid` | no | — |
| `amount` | `bigint` | yes | — |
| `currency` | `text` | yes | 'IRR'::text |
| `reason` | `text` | yes | — |
| `status` | `text` | yes | 'REQUESTED'::text |
| `idempotency_key` | `text` | yes | — |
| `provider_ref` | `text` | no | — |
| `provider_response` | `jsonb` | yes | '{}'::jsonb |
| `requested_at` | `timestamp with time zone` | yes | now() |
| `processed_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `refunds_amount_check`: `CHECK (amount > 0)`
- `refunds_currency_check`: `CHECK (currency = 'IRR'::text)`
- `refunds_status_check`: `CHECK (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text, 'PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'REJECTED'::text, 'CANCELLED'::text]))`
- `refunds_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `refunds_payment_id_fkey`: `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT`
- `refunds_processed_by_fkey`: `FOREIGN KEY (processed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `refunds_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `refunds_pkey`: `PRIMARY KEY (id)`
- `refunds_idempotency_key_key`: `UNIQUE (idempotency_key)`
- `refunds_provider_ref_key`: `UNIQUE (provider_ref)`

Indexes:
- `idx_refunds_refunds_order_id_fkey_2aed9b35`: `CREATE INDEX idx_refunds_refunds_order_id_fkey_2aed9b35 ON public.refunds USING btree (order_id)`
- `idx_refunds_refunds_payment_id_fkey_39982d06`: `CREATE INDEX idx_refunds_refunds_payment_id_fkey_39982d06 ON public.refunds USING btree (payment_id)`
- `idx_refunds_refunds_processed_by_fkey_58f48b68`: `CREATE INDEX idx_refunds_refunds_processed_by_fkey_58f48b68 ON public.refunds USING btree (processed_by)`
- `idx_refunds_refunds_requested_by_fkey_aa3408dc`: `CREATE INDEX idx_refunds_refunds_requested_by_fkey_aa3408dc ON public.refunds USING btree (requested_by)`
- `refunds_idempotency_key_key`: `CREATE UNIQUE INDEX refunds_idempotency_key_key ON public.refunds USING btree (idempotency_key)`
- `refunds_pkey`: `CREATE UNIQUE INDEX refunds_pkey ON public.refunds USING btree (id)`
- `refunds_provider_ref_key`: `CREATE UNIQUE INDEX refunds_provider_ref_key ON public.refunds USING btree (provider_ref)`

RLS policies:
- `admin_manage_refunds` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `refunds_order_read` (SELECT, roles: {authenticated}): using `can_access_order(order_id)`; check `—`

### `rejection_reasons`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `title` | `text` | yes | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `sort_order` | `integer` | yes | 0 |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `code` | `text` | yes | — |
| `sms_template_id` | `uuid` | no | — |

Constraints:
- `rejection_reasons_sms_template_id_fkey`: `FOREIGN KEY (sms_template_id) REFERENCES sms_templates(id) ON DELETE RESTRICT`
- `rejection_reasons_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_rejection_reasons_rejection_reasons_sms_template_i_46946771`: `CREATE INDEX idx_rejection_reasons_rejection_reasons_sms_template_i_46946771 ON public.rejection_reasons USING btree (sms_template_id)`
- `rejection_reasons_code_idx`: `CREATE UNIQUE INDEX rejection_reasons_code_idx ON public.rejection_reasons USING btree (code)`
- `rejection_reasons_pkey`: `CREATE UNIQUE INDEX rejection_reasons_pkey ON public.rejection_reasons USING btree (id)`

RLS policies:
- `admin_manage_rejection_reasons` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `rejection_reasons_authenticated_read` (SELECT, roles: {authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `reprints`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_item_id` | `uuid` | yes | — |
| `original_fulfilment_id` | `uuid` | yes | — |
| `replacement_fulfilment_id` | `uuid` | no | — |
| `requested_by` | `uuid` | yes | — |
| `approved_by` | `uuid` | no | — |
| `reason` | `text` | yes | — |
| `status` | `text` | yes | 'REQUESTED'::text |
| `idempotency_key` | `text` | yes | — |
| `requested_at` | `timestamp with time zone` | yes | now() |
| `approved_at` | `timestamp with time zone` | no | — |
| `completed_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `reprints_status_check`: `CHECK (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text, 'IN_PRODUCTION'::text, 'SENT'::text, 'DONE'::text, 'REJECTED'::text, 'CANCELLED'::text]))`
- `reprints_approved_by_fkey`: `FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `reprints_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT`
- `reprints_original_fulfilment_id_fkey`: `FOREIGN KEY (original_fulfilment_id) REFERENCES fulfilments(id) ON DELETE RESTRICT`
- `reprints_replacement_fulfilment_id_fkey`: `FOREIGN KEY (replacement_fulfilment_id) REFERENCES fulfilments(id) ON DELETE RESTRICT`
- `reprints_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE RESTRICT`
- `reprints_pkey`: `PRIMARY KEY (id)`
- `reprints_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `idx_reprints_reprints_approved_by_fkey_938b3a32`: `CREATE INDEX idx_reprints_reprints_approved_by_fkey_938b3a32 ON public.reprints USING btree (approved_by)`
- `idx_reprints_reprints_order_item_id_fkey_c98dc302`: `CREATE INDEX idx_reprints_reprints_order_item_id_fkey_c98dc302 ON public.reprints USING btree (order_item_id)`
- `idx_reprints_reprints_original_fulfilment_id_fkey_5c3c8dbb`: `CREATE INDEX idx_reprints_reprints_original_fulfilment_id_fkey_5c3c8dbb ON public.reprints USING btree (original_fulfilment_id)`
- `idx_reprints_reprints_replacement_fulfilment_id_fkey_98b87ac4`: `CREATE INDEX idx_reprints_reprints_replacement_fulfilment_id_fkey_98b87ac4 ON public.reprints USING btree (replacement_fulfilment_id)`
- `idx_reprints_reprints_requested_by_fkey_8d7de2b6`: `CREATE INDEX idx_reprints_reprints_requested_by_fkey_8d7de2b6 ON public.reprints USING btree (requested_by)`
- `reprints_idempotency_key_key`: `CREATE UNIQUE INDEX reprints_idempotency_key_key ON public.reprints USING btree (idempotency_key)`
- `reprints_pkey`: `CREATE UNIQUE INDEX reprints_pkey ON public.reprints USING btree (id)`

RLS policies:
- `admin_manage_reprints` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `reprints_fulfilment_read` (SELECT, roles: {authenticated}): using `can_access_fulfilment(original_fulfilment_id)`; check `—`

### `return_requests`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `order_item_id` | `uuid` | yes | — |
| `buyer_user_id` | `uuid` | yes | — |
| `reviewed_by` | `uuid` | no | — |
| `reason` | `text` | yes | — |
| `description` | `text` | no | — |
| `status` | `text` | yes | 'REQUESTED'::text |
| `idempotency_key` | `text` | yes | — |
| `return_tracking_code` | `text` | no | — |
| `resolution` | `text` | no | — |
| `requested_at` | `timestamp with time zone` | yes | now() |
| `reviewed_at` | `timestamp with time zone` | no | — |
| `received_at` | `timestamp with time zone` | no | — |
| `resolved_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `return_requests_status_check`: `CHECK (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text, 'REJECTED'::text, 'IN_TRANSIT'::text, 'RECEIVED'::text, 'RESOLVED'::text, 'CANCELLED'::text]))`
- `return_requests_buyer_user_id_fkey`: `FOREIGN KEY (buyer_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `return_requests_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT`
- `return_requests_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `return_requests_pkey`: `PRIMARY KEY (id)`
- `return_requests_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `idx_return_requests_return_requests_buyer_user_id_fkey_393262d7`: `CREATE INDEX idx_return_requests_return_requests_buyer_user_id_fkey_393262d7 ON public.return_requests USING btree (buyer_user_id)`
- `idx_return_requests_return_requests_reviewed_by_fkey_18e4ac8b`: `CREATE INDEX idx_return_requests_return_requests_reviewed_by_fkey_18e4ac8b ON public.return_requests USING btree (reviewed_by)`
- `return_requests_idempotency_key_key`: `CREATE UNIQUE INDEX return_requests_idempotency_key_key ON public.return_requests USING btree (idempotency_key)`
- `return_requests_one_active_idx`: `CREATE UNIQUE INDEX return_requests_one_active_idx ON public.return_requests USING btree (order_item_id) WHERE (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text, 'IN_TRANSIT'::text, 'RECEIVED'::text]))`
- `return_requests_pkey`: `CREATE UNIQUE INDEX return_requests_pkey ON public.return_requests USING btree (id)`

RLS policies:
- `admin_manage_return_requests` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `returns_order_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM order_items oi   WHERE ((oi.id = return_requests.order_item_id) AND can_access_order(oi.order_id))))`; check `—`

### `reviews`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `buyer_user_id` | `uuid` | yes | — |
| `seller_product_id` | `uuid` | yes | — |
| `order_item_id` | `uuid` | no | — |
| `rating` | `smallint` | yes | — |
| `title` | `text` | no | — |
| `body` | `text` | no | — |
| `status` | `text` | yes | 'PUBLISHED'::text |
| `is_verified_purchase` | `boolean` | yes | false |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `reviews_rating_check`: `CHECK (rating >= 1 AND rating <= 5)`
- `reviews_status_check`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'PUBLISHED'::text, 'REJECTED'::text, 'HIDDEN'::text]))`
- `reviews_buyer_user_id_fkey`: `FOREIGN KEY (buyer_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `reviews_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL`
- `reviews_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `reviews_pkey`: `PRIMARY KEY (id)`
- `reviews_buyer_user_id_seller_product_id_order_item_id_key`: `UNIQUE (buyer_user_id, seller_product_id, order_item_id)`

Indexes:
- `idx_reviews_reviews_order_item_id_fkey_098b1e2e`: `CREATE INDEX idx_reviews_reviews_order_item_id_fkey_098b1e2e ON public.reviews USING btree (order_item_id)`
- `reviews_buyer_user_id_seller_product_id_order_item_id_key`: `CREATE UNIQUE INDEX reviews_buyer_user_id_seller_product_id_order_item_id_key ON public.reviews USING btree (buyer_user_id, seller_product_id, order_item_id)`
- `reviews_pkey`: `CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id)`
- `reviews_product_status_idx`: `CREATE INDEX reviews_product_status_idx ON public.reviews USING btree (seller_product_id, status, created_at DESC)`

RLS policies:
- `admin_manage_reviews` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `reviews_buyer_insert` (INSERT, roles: {authenticated}): using `—`; check `(buyer_user_id = auth.uid())`
- `reviews_buyer_update` (UPDATE, roles: {authenticated}): using `(buyer_user_id = auth.uid())`; check `(buyer_user_id = auth.uid())`
- `reviews_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'PUBLISHED'::text)`; check `—`

### `seller_product_variants`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seller_product_id` | `uuid` | yes | — |
| `raw_product_variant_id` | `uuid` | yes | — |
| `supplier_offer_variant_id` | `uuid` | no | — |
| `backup_supplier_offer_variant_id` | `uuid` | no | — |
| `sku` | `text` | yes | — |
| `price` | `bigint` | yes | — |
| `compare_at_price` | `bigint` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `seller_product_variant_backup_diff`: `CHECK (backup_supplier_offer_variant_id IS NULL OR backup_supplier_offer_variant_id <> supplier_offer_variant_id)`
- `seller_product_variants_check`: `CHECK (compare_at_price IS NULL OR compare_at_price > price)`
- `seller_product_variants_price_check`: `CHECK (price >= 0)`
- `seller_product_variants_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'OUT_OF_STOCK'::text]))`
- `seller_product_variants_backup_supplier_offer_variant_id_fkey`: `FOREIGN KEY (backup_supplier_offer_variant_id) REFERENCES supplier_offer_variants(id) ON DELETE RESTRICT`
- `seller_product_variants_raw_product_variant_id_fkey`: `FOREIGN KEY (raw_product_variant_id) REFERENCES raw_product_variants(id) ON DELETE RESTRICT`
- `seller_product_variants_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `seller_product_variants_supplier_offer_variant_id_fkey`: `FOREIGN KEY (supplier_offer_variant_id) REFERENCES supplier_offer_variants(id) ON DELETE RESTRICT`
- `seller_product_variants_pkey`: `PRIMARY KEY (id)`
- `seller_product_variants_seller_product_id_raw_product_varia_key`: `UNIQUE (seller_product_id, raw_product_variant_id)`
- `seller_product_variants_sku_key`: `UNIQUE (sku)`

Indexes:
- `idx_seller_product_variants_seller_product_variants_ba_99dd0813`: `CREATE INDEX idx_seller_product_variants_seller_product_variants_ba_99dd0813 ON public.seller_product_variants USING btree (backup_supplier_offer_variant_id)`
- `idx_seller_product_variants_seller_product_variants_ra_0c9f0dc1`: `CREATE INDEX idx_seller_product_variants_seller_product_variants_ra_0c9f0dc1 ON public.seller_product_variants USING btree (raw_product_variant_id)`
- `idx_seller_product_variants_seller_product_variants_su_fa1e402b`: `CREATE INDEX idx_seller_product_variants_seller_product_variants_su_fa1e402b ON public.seller_product_variants USING btree (supplier_offer_variant_id)`
- `seller_product_variants_pkey`: `CREATE UNIQUE INDEX seller_product_variants_pkey ON public.seller_product_variants USING btree (id)`
- `seller_product_variants_product_idx`: `CREATE INDEX seller_product_variants_product_idx ON public.seller_product_variants USING btree (seller_product_id, status)`
- `seller_product_variants_seller_product_id_raw_product_varia_key`: `CREATE UNIQUE INDEX seller_product_variants_seller_product_id_raw_product_varia_key ON public.seller_product_variants USING btree (seller_product_id, raw_product_variant_id)`
- `seller_product_variants_sku_key`: `CREATE UNIQUE INDEX seller_product_variants_sku_key ON public.seller_product_variants USING btree (sku)`

RLS policies:
- `admin_manage_seller_product_variants` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `seller_product_variants_owner` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = seller_product_variants.seller_product_id) AND can_manage_store(p.store_id))))`; check `(EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = seller_product_variants.seller_product_id) AND can_manage_store(p.store_id))))`
- `seller_product_variants_public_read` (SELECT, roles: {anon,authenticated}): using `((status = 'ACTIVE'::text) AND (EXISTS ( SELECT 1    FROM seller_products p   WHERE ((p.id = seller_product_variants.seller_product_id) AND (p.status = 'PUBLISHED'::text) AND (p.moderation_status = 'APPROVED'::moderation_state)))))`; check `—`

### `seller_products`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `store_id` | `uuid` | yes | — |
| `raw_product_id` | `uuid` | yes | — |
| `design_id` | `uuid` | no | — |
| `primary_supplier_offer_id` | `uuid` | no | — |
| `backup_supplier_offer_id` | `uuid` | no | — |
| `title` | `text` | yes | — |
| `description` | `text` | no | — |
| `price` | `bigint` | yes | — |
| `discounted_price` | `bigint` | no | — |
| `status` | `text` | yes | 'DRAFT'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `published_at` | `timestamp with time zone` | no | — |
| `slug` | `text` | yes | — |
| `subtitle` | `text` | no | — |
| `moderation_status` | `moderation_state` | yes | 'PENDING'::moderation_state |
| `seo_title` | `text` | no | — |
| `seo_description` | `text` | no | — |
| `rating_average` | `numeric` | yes | 0 |
| `review_count` | `integer` | yes | 0 |
| `sales_count` | `integer` | yes | 0 |
| `view_count` | `bigint` | yes | 0 |
| `is_featured` | `boolean` | yes | false |
| `version` | `integer` | yes | 1 |

Constraints:
- `seller_products_discount_check`: `CHECK (discounted_price IS NULL OR discounted_price >= 0 AND discounted_price < price)`
- `seller_products_price_check`: `CHECK (price >= 0)`
- `seller_products_rating_average_check`: `CHECK (rating_average >= 0::numeric AND rating_average <= 5::numeric)`
- `seller_products_review_count_check`: `CHECK (review_count >= 0)`
- `seller_products_sales_count_check`: `CHECK (sales_count >= 0)`
- `seller_products_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'PENDING'::text, 'APPROVED'::text, 'PUBLISHED'::text, 'REJECTED'::text, 'ARCHIVED'::text]))`
- `seller_products_view_count_check`: `CHECK (view_count >= 0)`
- `seller_products_backup_supplier_offer_id_fkey`: `FOREIGN KEY (backup_supplier_offer_id) REFERENCES supplier_offers(id)`
- `seller_products_design_id_fkey`: `FOREIGN KEY (design_id) REFERENCES designs(id)`
- `seller_products_primary_supplier_offer_id_fkey`: `FOREIGN KEY (primary_supplier_offer_id) REFERENCES supplier_offers(id)`
- `seller_products_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id)`
- `seller_products_store_id_fkey`: `FOREIGN KEY (store_id) REFERENCES stores(id)`
- `seller_products_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_seller_products_seller_products_backup_supplier_of_3a6e834e`: `CREATE INDEX idx_seller_products_seller_products_backup_supplier_of_3a6e834e ON public.seller_products USING btree (backup_supplier_offer_id)`
- `idx_seller_products_seller_products_design_id_fkey_e877401a`: `CREATE INDEX idx_seller_products_seller_products_design_id_fkey_e877401a ON public.seller_products USING btree (design_id)`
- `idx_seller_products_seller_products_primary_supplier_o_7aa39c9c`: `CREATE INDEX idx_seller_products_seller_products_primary_supplier_o_7aa39c9c ON public.seller_products USING btree (primary_supplier_offer_id)`
- `idx_seller_products_seller_products_raw_product_id_fke_e31c1e6d`: `CREATE INDEX idx_seller_products_seller_products_raw_product_id_fke_e31c1e6d ON public.seller_products USING btree (raw_product_id)`
- `seller_product_public_idx`: `CREATE INDEX seller_product_public_idx ON public.seller_products USING btree (status, moderation_status, published_at DESC)`
- `seller_products_pkey`: `CREATE UNIQUE INDEX seller_products_pkey ON public.seller_products USING btree (id)`
- `seller_products_store_slug_idx`: `CREATE UNIQUE INDEX seller_products_store_slug_idx ON public.seller_products USING btree (store_id, slug)`
- `seller_products_store_status_idx`: `CREATE INDEX seller_products_store_status_idx ON public.seller_products USING btree (store_id, status, created_at DESC)`

RLS policies:
- `admin_manage_seller_products` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `seller_products_public_read` (SELECT, roles: {anon,authenticated}): using `((status = 'PUBLISHED'::text) AND (moderation_status = 'APPROVED'::moderation_state))`; check `—`
- `seller_products_store_manage` (ALL, roles: {authenticated}): using `can_manage_store(store_id)`; check `can_manage_store(store_id)`

### `seller_profiles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `organization_id` | `uuid` | yes | — |
| `owner_user_id` | `uuid` | yes | — |
| `seller_type` | `text` | no | — |
| `experience_level` | `text` | no | — |
| `instagram_handle` | `text` | no | — |
| `audience_size` | `integer` | no | — |
| `monthly_views` | `bigint` | no | — |
| `goal` | `text` | no | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `seller_profiles_audience_size_check`: `CHECK (audience_size IS NULL OR audience_size >= 0)`
- `seller_profiles_monthly_views_check`: `CHECK (monthly_views IS NULL OR monthly_views >= 0)`
- `seller_profiles_status_check`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text]))`
- `seller_profiles_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `seller_profiles_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `seller_profiles_pkey`: `PRIMARY KEY (organization_id)`

Indexes:
- `idx_seller_profiles_seller_profiles_owner_user_id_fkey_3bbee209`: `CREATE INDEX idx_seller_profiles_seller_profiles_owner_user_id_fkey_3bbee209 ON public.seller_profiles USING btree (owner_user_id)`
- `seller_profiles_pkey`: `CREATE UNIQUE INDEX seller_profiles_pkey ON public.seller_profiles USING btree (organization_id)`

RLS policies:
- `admin_manage_seller_profiles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `seller_profiles_org` (ALL, roles: {authenticated}): using `is_org_member(organization_id)`; check `is_org_member(organization_id)`

### `shipments`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `fulfilment_id` | `uuid` | yes | — |
| `carrier` | `text` | no | — |
| `service` | `text` | no | — |
| `tracking_code` | `text` | yes | — |
| `status` | `text` | yes | 'SENT'::text |
| `shipped_at` | `timestamp with time zone` | yes | now() |
| `delivered_at` | `timestamp with time zone` | no | — |
| `returned_at` | `timestamp with time zone` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `shipments_status_check`: `CHECK (status = ANY (ARRAY['LABEL_CREATED'::text, 'SENT'::text, 'IN_TRANSIT'::text, 'DELIVERED'::text, 'RETURNED'::text, 'LOST'::text, 'CANCELLED'::text]))`
- `shipments_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id) ON DELETE CASCADE`
- `shipments_pkey`: `PRIMARY KEY (id)`
- `shipments_carrier_tracking_code_key`: `UNIQUE (carrier, tracking_code)`

Indexes:
- `shipments_carrier_tracking_code_key`: `CREATE UNIQUE INDEX shipments_carrier_tracking_code_key ON public.shipments USING btree (carrier, tracking_code)`
- `shipments_fulfilment_idx`: `CREATE INDEX shipments_fulfilment_idx ON public.shipments USING btree (fulfilment_id, created_at DESC)`
- `shipments_pkey`: `CREATE UNIQUE INDEX shipments_pkey ON public.shipments USING btree (id)`

RLS policies:
- `admin_manage_shipments` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `shipments_access` (SELECT, roles: {authenticated}): using `can_access_fulfilment(fulfilment_id)`; check `—`

### `sms_templates`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `key` | `text` | yes | — |
| `name` | `text` | yes | — |
| `body` | `text` | yes | — |
| `status` | `text` | yes | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `sms_templates_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))`
- `sms_templates_pkey`: `PRIMARY KEY (id)`
- `sms_templates_key_key`: `UNIQUE (key)`

Indexes:
- `sms_templates_key_key`: `CREATE UNIQUE INDEX sms_templates_key_key ON public.sms_templates USING btree (key)`
- `sms_templates_pkey`: `CREATE UNIQUE INDEX sms_templates_pkey ON public.sms_templates USING btree (id)`

RLS policies:
- `admin_manage_sms_templates` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `sms_templates_authenticated_read` (SELECT, roles: {authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `storage_files`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `owner_user_id` | `uuid` | no | — |
| `owner_organization_id` | `uuid` | no | — |
| `bucket` | `text` | yes | — |
| `path` | `text` | yes | — |
| `kind` | `asset_kind` | yes | — |
| `original_name` | `text` | no | — |
| `mime_type` | `text` | yes | — |
| `size_bytes` | `bigint` | yes | 0 |
| `checksum_sha256` | `text` | no | — |
| `width` | `integer` | no | — |
| `height` | `integer` | no | — |
| `state` | `file_state` | yes | 'READY'::file_state |
| `metadata` | `jsonb` | yes | '{}'::jsonb |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `storage_file_owner`: `CHECK (owner_user_id IS NOT NULL OR owner_organization_id IS NOT NULL OR (kind = ANY (ARRAY['RAW_PRODUCT_IMAGE'::asset_kind, 'RAW_BACKGROUND'::asset_kind, 'RAW_OVERLAY'::asset_kind, 'VARIANT_MOCKUP'::asset_kind, 'TUTORIAL_VIDEO'::asset_kind, 'TUTORIAL_FILE'::asset_kind, 'TUTORIAL_THUMBNAIL'::asset_kind])))`
- `storage_files_height_check`: `CHECK (height IS NULL OR height > 0)`
- `storage_files_size_bytes_check`: `CHECK (size_bytes >= 0)`
- `storage_files_width_check`: `CHECK (width IS NULL OR width > 0)`
- `storage_files_owner_organization_id_fkey`: `FOREIGN KEY (owner_organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `storage_files_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `storage_files_pkey`: `PRIMARY KEY (id)`
- `storage_files_bucket_path_key`: `UNIQUE (bucket, path)`

Indexes:
- `storage_files_bucket_path_key`: `CREATE UNIQUE INDEX storage_files_bucket_path_key ON public.storage_files USING btree (bucket, path)`
- `storage_files_owner_org_idx`: `CREATE INDEX storage_files_owner_org_idx ON public.storage_files USING btree (owner_organization_id, kind, created_at DESC)`
- `storage_files_owner_user_idx`: `CREATE INDEX storage_files_owner_user_idx ON public.storage_files USING btree (owner_user_id, kind, created_at DESC)`
- `storage_files_pkey`: `CREATE UNIQUE INDEX storage_files_pkey ON public.storage_files USING btree (id)`

RLS policies:
- `admin_manage_storage_files` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `storage_files_owner_insert` (INSERT, roles: {authenticated}): using `—`; check `((owner_user_id = auth.uid()) OR is_org_member(owner_organization_id))`
- `storage_files_owner_read` (SELECT, roles: {authenticated}): using `((owner_user_id = auth.uid()) OR is_org_member(owner_organization_id) OR (EXISTS ( SELECT 1    FROM fulfilment_files ff   WHERE ((ff.file_id = storage_files.id) AND can_access_fulfilment(ff.fulfilment_id)))))`; check `—`
- `storage_files_owner_update` (UPDATE, roles: {authenticated}): using `((owner_user_id = auth.uid()) OR is_org_member(owner_organization_id))`; check `((owner_user_id = auth.uid()) OR is_org_member(owner_organization_id))`
- `storage_files_public_read` (SELECT, roles: {anon,authenticated}): using `((bucket = ANY (ARRAY['product-images'::text, 'variant-mockups'::text])) AND (state = 'READY'::file_state))`; check `—`

### `store_domains`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `store_id` | `uuid` | yes | — |
| `hostname` | `text` | yes | — |
| `domain_type` | `text` | yes | 'SUBDOMAIN'::text |
| `status` | `text` | yes | 'PENDING'::text |
| `verification_token` | `text` | yes | encode(gen_random_bytes(24), 'hex'::text) |
| `verification_records` | `jsonb` | yes | '[]'::jsonb |
| `certificate_status` | `text` | yes | 'PENDING'::text |
| `verified_at` | `timestamp with time zone` | no | — |
| `activated_at` | `timestamp with time zone` | no | — |
| `last_checked_at` | `timestamp with time zone` | no | — |
| `last_error` | `text` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `store_domains_certificate_status_check`: `CHECK (certificate_status = ANY (ARRAY['PENDING'::text, 'ISSUING'::text, 'ACTIVE'::text, 'FAILED'::text, 'REVOKED'::text]))`
- `store_domains_domain_type_check`: `CHECK (domain_type = ANY (ARRAY['SUBDOMAIN'::text, 'CUSTOM'::text]))`
- `store_domains_hostname_check`: `CHECK (hostname = lower(hostname) AND hostname ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'::text)`
- `store_domains_status_check`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'VERIFYING'::text, 'ACTIVE'::text, 'FAILED'::text, 'REMOVED'::text]))`
- `store_domains_store_id_fkey`: `FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE`
- `store_domains_pkey`: `PRIMARY KEY (id)`

Indexes:
- `store_domains_hostname_lower_idx`: `CREATE UNIQUE INDEX store_domains_hostname_lower_idx ON public.store_domains USING btree (lower(hostname))`
- `store_domains_one_active_idx`: `CREATE UNIQUE INDEX store_domains_one_active_idx ON public.store_domains USING btree (store_id) WHERE (status = 'ACTIVE'::text)`
- `store_domains_pkey`: `CREATE UNIQUE INDEX store_domains_pkey ON public.store_domains USING btree (id)`

RLS policies:
- `admin_manage_store_domains` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `store_domains_store_manage` (ALL, roles: {authenticated}): using `can_manage_store(store_id)`; check `can_manage_store(store_id)`

### `stores`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `organization_id` | `uuid` | yes | — |
| `name` | `text` | yes | — |
| `slug` | `text` | yes | — |
| `status` | `text` | yes | 'DRAFT'::text |
| `default_locale` | `text` | yes | 'fa-IR'::text |
| `default_currency` | `text` | yes | 'IRR'::text |
| `description` | `text` | no | — |
| `primary_category` | `text` | no | — |
| `support_email` | `text` | no | — |
| `support_phone` | `text` | no | — |
| `social_url` | `text` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `owner_user_id` | `uuid` | no | — |
| `logo_file_id` | `uuid` | no | — |
| `banner_file_id` | `uuid` | no | — |
| `brand_color` | `text` | yes | '#ef5b4c'::text |
| `accent_color` | `text` | yes | '#3d8b70'::text |
| `brand_tone` | `text` | no | — |
| `follower_count` | `integer` | yes | 0 |
| `is_verified` | `boolean` | yes | false |
| `version` | `integer` | yes | 1 |

Constraints:
- `stores_accent_color_check`: `CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'::text)`
- `stores_brand_color_check`: `CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'::text)`
- `stores_follower_count_check`: `CHECK (follower_count >= 0)`
- `stores_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'PENDING'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text]))`
- `stores_banner_file_id_fkey`: `FOREIGN KEY (banner_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `stores_logo_file_id_fkey`: `FOREIGN KEY (logo_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `stores_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `stores_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `stores_pkey`: `PRIMARY KEY (id)`
- `stores_slug_key`: `UNIQUE (slug)`

Indexes:
- `idx_stores_stores_banner_file_id_fkey_202708f3`: `CREATE INDEX idx_stores_stores_banner_file_id_fkey_202708f3 ON public.stores USING btree (banner_file_id)`
- `idx_stores_stores_logo_file_id_fkey_668fe1b2`: `CREATE INDEX idx_stores_stores_logo_file_id_fkey_668fe1b2 ON public.stores USING btree (logo_file_id)`
- `idx_stores_stores_owner_user_id_fkey_7f6bf3eb`: `CREATE INDEX idx_stores_stores_owner_user_id_fkey_7f6bf3eb ON public.stores USING btree (owner_user_id)`
- `stores_organization_idx`: `CREATE INDEX stores_organization_idx ON public.stores USING btree (organization_id, status)`
- `stores_pkey`: `CREATE UNIQUE INDEX stores_pkey ON public.stores USING btree (id)`
- `stores_public_idx`: `CREATE INDEX stores_public_idx ON public.stores USING btree (status, created_at DESC)`
- `stores_slug_key`: `CREATE UNIQUE INDEX stores_slug_key ON public.stores USING btree (slug)`

RLS policies:
- `admin_manage_stores` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `stores_org_manage` (ALL, roles: {authenticated}): using `can_manage_store(id)`; check `is_org_member(organization_id)`
- `stores_public_read` (SELECT, roles: {anon,authenticated}): using `(status = 'ACTIVE'::text)`; check `—`

### `supplier_assignment_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `fulfilment_id` | `uuid` | yes | — |
| `from_supplier_organization_id` | `uuid` | no | — |
| `to_supplier_organization_id` | `uuid` | yes | — |
| `from_supplier_offer_id` | `uuid` | no | — |
| `to_supplier_offer_id` | `uuid` | yes | — |
| `changed_by` | `uuid` | no | — |
| `reason` | `text` | yes | — |
| `idempotency_key` | `text` | yes | — |
| `snapshot` | `jsonb` | yes | '{}'::jsonb |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `supplier_assignment_events_changed_by_fkey`: `FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `supplier_assignment_events_from_supplier_offer_id_fkey`: `FOREIGN KEY (from_supplier_offer_id) REFERENCES supplier_offers(id) ON DELETE RESTRICT`
- `supplier_assignment_events_from_supplier_organization_id_fkey`: `FOREIGN KEY (from_supplier_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- `supplier_assignment_events_fulfilment_id_fkey`: `FOREIGN KEY (fulfilment_id) REFERENCES fulfilments(id) ON DELETE CASCADE`
- `supplier_assignment_events_to_supplier_offer_id_fkey`: `FOREIGN KEY (to_supplier_offer_id) REFERENCES supplier_offers(id) ON DELETE RESTRICT`
- `supplier_assignment_events_to_supplier_organization_id_fkey`: `FOREIGN KEY (to_supplier_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- `supplier_assignment_events_pkey`: `PRIMARY KEY (id)`
- `supplier_assignment_events_idempotency_key_key`: `UNIQUE (idempotency_key)`

Indexes:
- `idx_supplier_assignment_events_supplier_assignment_eve_41da7ec5`: `CREATE INDEX idx_supplier_assignment_events_supplier_assignment_eve_41da7ec5 ON public.supplier_assignment_events USING btree (from_supplier_organization_id)`
- `idx_supplier_assignment_events_supplier_assignment_eve_4d5e3218`: `CREATE INDEX idx_supplier_assignment_events_supplier_assignment_eve_4d5e3218 ON public.supplier_assignment_events USING btree (changed_by)`
- `idx_supplier_assignment_events_supplier_assignment_eve_4ea657eb`: `CREATE INDEX idx_supplier_assignment_events_supplier_assignment_eve_4ea657eb ON public.supplier_assignment_events USING btree (fulfilment_id)`
- `idx_supplier_assignment_events_supplier_assignment_eve_4fe14f4c`: `CREATE INDEX idx_supplier_assignment_events_supplier_assignment_eve_4fe14f4c ON public.supplier_assignment_events USING btree (from_supplier_offer_id)`
- `idx_supplier_assignment_events_supplier_assignment_eve_613a2b94`: `CREATE INDEX idx_supplier_assignment_events_supplier_assignment_eve_613a2b94 ON public.supplier_assignment_events USING btree (to_supplier_organization_id)`
- `idx_supplier_assignment_events_supplier_assignment_eve_82a1126f`: `CREATE INDEX idx_supplier_assignment_events_supplier_assignment_eve_82a1126f ON public.supplier_assignment_events USING btree (to_supplier_offer_id)`
- `supplier_assignment_events_idempotency_key_key`: `CREATE UNIQUE INDEX supplier_assignment_events_idempotency_key_key ON public.supplier_assignment_events USING btree (idempotency_key)`
- `supplier_assignment_events_pkey`: `CREATE UNIQUE INDEX supplier_assignment_events_pkey ON public.supplier_assignment_events USING btree (id)`

RLS policies:
- `admin_manage_supplier_assignment_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `assignment_events_fulfilment_read` (SELECT, roles: {authenticated}): using `can_access_fulfilment(fulfilment_id)`; check `—`

### `supplier_category_capabilities`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `supplier_organization_id` | `uuid` | yes | — |
| `category_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `supplier_category_capabilities_category_id_fkey`: `FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE`
- `supplier_category_capabilities_supplier_organization_id_fkey`: `FOREIGN KEY (supplier_organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `supplier_category_capabilities_pkey`: `PRIMARY KEY (supplier_organization_id, category_id)`

Indexes:
- `idx_supplier_category_capabilities_supplier_category_c_eef1169c`: `CREATE INDEX idx_supplier_category_capabilities_supplier_category_c_eef1169c ON public.supplier_category_capabilities USING btree (category_id)`
- `supplier_category_capabilities_pkey`: `CREATE UNIQUE INDEX supplier_category_capabilities_pkey ON public.supplier_category_capabilities USING btree (supplier_organization_id, category_id)`

RLS policies:
- `admin_manage_supplier_category_capabilities` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `supplier_categories_manage` (ALL, roles: {authenticated}): using `is_org_member(supplier_organization_id)`; check `is_org_member(supplier_organization_id)`
- `supplier_categories_read` (SELECT, roles: {authenticated}): using `true`; check `—`

### `supplier_offer_variants`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `supplier_offer_id` | `uuid` | yes | — |
| `raw_product_variant_id` | `uuid` | yes | — |
| `unit_cost` | `bigint` | yes | — |
| `stock_status` | `text` | yes | 'AVAILABLE'::text |
| `stock_quantity` | `integer` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `supplier_offer_variants_stock_quantity_check`: `CHECK (stock_quantity IS NULL OR stock_quantity >= 0)`
- `supplier_offer_variants_stock_status_check`: `CHECK (stock_status = ANY (ARRAY['AVAILABLE'::text, 'LOW_STOCK'::text, 'OUT_OF_STOCK'::text, 'PAUSED'::text]))`
- `supplier_offer_variants_unit_cost_check`: `CHECK (unit_cost >= 0)`
- `supplier_offer_variants_raw_product_variant_id_fkey`: `FOREIGN KEY (raw_product_variant_id) REFERENCES raw_product_variants(id) ON DELETE RESTRICT`
- `supplier_offer_variants_supplier_offer_id_fkey`: `FOREIGN KEY (supplier_offer_id) REFERENCES supplier_offers(id) ON DELETE CASCADE`
- `supplier_offer_variants_pkey`: `PRIMARY KEY (id)`
- `supplier_offer_variants_supplier_offer_id_raw_product_varia_key`: `UNIQUE (supplier_offer_id, raw_product_variant_id)`

Indexes:
- `supplier_offer_variants_offer_stock_idx`: `CREATE INDEX supplier_offer_variants_offer_stock_idx ON public.supplier_offer_variants USING btree (supplier_offer_id, stock_status)`
- `supplier_offer_variants_pkey`: `CREATE UNIQUE INDEX supplier_offer_variants_pkey ON public.supplier_offer_variants USING btree (id)`
- `supplier_offer_variants_raw_idx`: `CREATE INDEX supplier_offer_variants_raw_idx ON public.supplier_offer_variants USING btree (raw_product_variant_id, stock_status)`
- `supplier_offer_variants_supplier_offer_id_raw_product_varia_key`: `CREATE UNIQUE INDEX supplier_offer_variants_supplier_offer_id_raw_product_varia_key ON public.supplier_offer_variants USING btree (supplier_offer_id, raw_product_variant_id)`

RLS policies:
- `admin_manage_supplier_offer_variants` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `supplier_offer_variants_manage` (ALL, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM supplier_offers o   WHERE ((o.id = supplier_offer_variants.supplier_offer_id) AND is_org_member(o.supplier_organization_id))))`; check `(EXISTS ( SELECT 1    FROM supplier_offers o   WHERE ((o.id = supplier_offer_variants.supplier_offer_id) AND is_org_member(o.supplier_organization_id))))`
- `supplier_offer_variants_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM supplier_offers o   WHERE ((o.id = supplier_offer_variants.supplier_offer_id) AND (((o.approval_status = 'APPROVED'::text) AND (o.status = 'ACTIVE'::text)) OR is_org_member(o.supplier_organization_id)))))`; check `—`

### `supplier_offers`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `supplier_organization_id` | `uuid` | yes | — |
| `facility_id` | `uuid` | yes | — |
| `raw_product_id` | `uuid` | yes | — |
| `base_cost` | `bigint` | yes | — |
| `lead_time_days` | `integer` | yes | — |
| `capacity_per_day` | `integer` | yes | — |
| `approval_status` | `text` | yes | 'APPROVED'::text |
| `status` | `text` | yes | 'ACTIVE'::text |
| `approved_at` | `timestamp with time zone` | no | — |
| `approved_by` | `uuid` | no | — |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `print_method_id` | `uuid` | no | — |
| `minimum_order_quantity` | `integer` | yes | 1 |
| `notes` | `text` | no | — |

Constraints:
- `supplier_offers_approval_check`: `CHECK (approval_status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text]))`
- `supplier_offers_capacity_check`: `CHECK (capacity_per_day > 0)`
- `supplier_offers_cost_check`: `CHECK (base_cost >= 0)`
- `supplier_offers_lead_time_check`: `CHECK (lead_time_days > 0)`
- `supplier_offers_minimum_order_quantity_check`: `CHECK (minimum_order_quantity > 0)`
- `supplier_offers_status_check`: `CHECK (status = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text, 'INACTIVE'::text]))`
- `supplier_offers_approved_by_fkey`: `FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `supplier_offers_facility_id_fkey`: `FOREIGN KEY (facility_id) REFERENCES facilities(id)`
- `supplier_offers_print_method_id_fkey`: `FOREIGN KEY (print_method_id) REFERENCES print_methods(id) ON DELETE RESTRICT`
- `supplier_offers_raw_product_id_fkey`: `FOREIGN KEY (raw_product_id) REFERENCES raw_products(id)`
- `supplier_offers_supplier_organization_id_fkey`: `FOREIGN KEY (supplier_organization_id) REFERENCES organizations(id)`
- `supplier_offers_pkey`: `PRIMARY KEY (id)`
- `supplier_offers_supplier_organization_id_facility_id_raw_pr_key`: `UNIQUE (supplier_organization_id, facility_id, raw_product_id)`

Indexes:
- `idx_supplier_offers_supplier_offers_approved_by_fkey_77fa16aa`: `CREATE INDEX idx_supplier_offers_supplier_offers_approved_by_fkey_77fa16aa ON public.supplier_offers USING btree (approved_by)`
- `idx_supplier_offers_supplier_offers_facility_id_fkey_e2216763`: `CREATE INDEX idx_supplier_offers_supplier_offers_facility_id_fkey_e2216763 ON public.supplier_offers USING btree (facility_id)`
- `idx_supplier_offers_supplier_offers_print_method_id_fk_63fe8bde`: `CREATE INDEX idx_supplier_offers_supplier_offers_print_method_id_fk_63fe8bde ON public.supplier_offers USING btree (print_method_id)`
- `supplier_offers_eligibility_idx`: `CREATE INDEX supplier_offers_eligibility_idx ON public.supplier_offers USING btree (raw_product_id, approval_status, status)`
- `supplier_offers_pkey`: `CREATE UNIQUE INDEX supplier_offers_pkey ON public.supplier_offers USING btree (id)`
- `supplier_offers_supplier_organization_id_facility_id_raw_pr_key`: `CREATE UNIQUE INDEX supplier_offers_supplier_organization_id_facility_id_raw_pr_key ON public.supplier_offers USING btree (supplier_organization_id, facility_id, raw_product_id)`

RLS policies:
- `admin_manage_supplier_offers` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `supplier_offers_eligible_read` (SELECT, roles: {authenticated}): using `(((approval_status = 'APPROVED'::text) AND (status = 'ACTIVE'::text)) OR is_org_member(supplier_organization_id))`; check `—`
- `supplier_offers_org_manage` (ALL, roles: {authenticated}): using `is_org_member(supplier_organization_id)`; check `is_org_member(supplier_organization_id)`

### `supplier_print_methods`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `supplier_organization_id` | `uuid` | yes | — |
| `print_method_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `supplier_print_methods_print_method_id_fkey`: `FOREIGN KEY (print_method_id) REFERENCES print_methods(id) ON DELETE CASCADE`
- `supplier_print_methods_supplier_organization_id_fkey`: `FOREIGN KEY (supplier_organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `supplier_print_methods_pkey`: `PRIMARY KEY (supplier_organization_id, print_method_id)`

Indexes:
- `idx_supplier_print_methods_supplier_print_methods_prin_ee2c3748`: `CREATE INDEX idx_supplier_print_methods_supplier_print_methods_prin_ee2c3748 ON public.supplier_print_methods USING btree (print_method_id)`
- `supplier_print_methods_pkey`: `CREATE UNIQUE INDEX supplier_print_methods_pkey ON public.supplier_print_methods USING btree (supplier_organization_id, print_method_id)`

RLS policies:
- `admin_manage_supplier_print_methods` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `supplier_print_methods_manage` (ALL, roles: {authenticated}): using `is_org_member(supplier_organization_id)`; check `is_org_member(supplier_organization_id)`
- `supplier_print_methods_read` (SELECT, roles: {authenticated}): using `true`; check `—`

### `supplier_profiles`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `organization_id` | `uuid` | yes | — |
| `national_id` | `text` | no | — |
| `registration_number` | `text` | no | — |
| `capacity_per_day` | `integer` | yes | 0 |
| `lead_time_days` | `integer` | yes | 1 |
| `approval_mode` | `text` | yes | 'AUTO'::text |
| `status` | `text` | yes | 'APPROVED'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `owner_user_id` | `uuid` | no | — |
| `description` | `text` | no | — |
| `logo_file_id` | `uuid` | no | — |

Constraints:
- `supplier_profiles_approval_mode`: `CHECK (approval_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text]))`
- `supplier_profiles_capacity`: `CHECK (capacity_per_day >= 0)`
- `supplier_profiles_lead_time`: `CHECK (lead_time_days > 0)`
- `supplier_profiles_status`: `CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'SUSPENDED'::text]))`
- `supplier_profiles_logo_file_id_fkey`: `FOREIGN KEY (logo_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `supplier_profiles_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `supplier_profiles_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `supplier_profiles_pkey`: `PRIMARY KEY (organization_id)`

Indexes:
- `idx_supplier_profiles_supplier_profiles_logo_file_id_f_08d04a76`: `CREATE INDEX idx_supplier_profiles_supplier_profiles_logo_file_id_f_08d04a76 ON public.supplier_profiles USING btree (logo_file_id)`
- `idx_supplier_profiles_supplier_profiles_owner_user_id__48f90040`: `CREATE INDEX idx_supplier_profiles_supplier_profiles_owner_user_id__48f90040 ON public.supplier_profiles USING btree (owner_user_id)`
- `supplier_profiles_pkey`: `CREATE UNIQUE INDEX supplier_profiles_pkey ON public.supplier_profiles USING btree (organization_id)`

RLS policies:
- `admin_manage_supplier_profiles` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `supplier_profiles_approved_read` (SELECT, roles: {authenticated}): using `((status = 'APPROVED'::text) OR is_org_member(organization_id))`; check `—`
- `supplier_profiles_org_manage` (ALL, roles: {authenticated}): using `is_org_member(organization_id)`; check `is_org_member(organization_id)`

### `supplier_variant_availability_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `supplier_offer_variant_id` | `uuid` | yes | — |
| `from_status` | `text` | no | — |
| `to_status` | `text` | yes | — |
| `changed_by` | `uuid` | no | — |
| `reason` | `text` | no | — |
| `snapshot` | `jsonb` | yes | '{}'::jsonb |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `supplier_variant_availability_events_to_status_check`: `CHECK (to_status = ANY (ARRAY['AVAILABLE'::text, 'LOW_STOCK'::text, 'OUT_OF_STOCK'::text, 'PAUSED'::text]))`
- `supplier_variant_availability_ev_supplier_offer_variant_id_fkey`: `FOREIGN KEY (supplier_offer_variant_id) REFERENCES supplier_offer_variants(id) ON DELETE CASCADE`
- `supplier_variant_availability_events_changed_by_fkey`: `FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL`
- `supplier_variant_availability_events_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_supplier_variant_availability_events_supplier_vari_043b717f`: `CREATE INDEX idx_supplier_variant_availability_events_supplier_vari_043b717f ON public.supplier_variant_availability_events USING btree (changed_by)`
- `idx_supplier_variant_availability_events_supplier_vari_663c0cf6`: `CREATE INDEX idx_supplier_variant_availability_events_supplier_vari_663c0cf6 ON public.supplier_variant_availability_events USING btree (supplier_offer_variant_id)`
- `supplier_variant_availability_events_pkey`: `CREATE UNIQUE INDEX supplier_variant_availability_events_pkey ON public.supplier_variant_availability_events USING btree (id)`

RLS policies:
- `admin_manage_supplier_variant_availability_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `availability_events_supplier_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM (supplier_offer_variants sov      JOIN supplier_offers so ON ((so.id = sov.supplier_offer_id)))   WHERE ((sov.id = supplier_variant_availability_events.supplier_offer_variant_id) AND is_org_member(so.supplier_organization_id))))`; check `—`

### `tags`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `slug` | `text` | yes | — |
| `name` | `text` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `tags_pkey`: `PRIMARY KEY (id)`
- `tags_name_key`: `UNIQUE (name)`
- `tags_slug_key`: `UNIQUE (slug)`

Indexes:
- `tags_name_key`: `CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name)`
- `tags_pkey`: `CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id)`
- `tags_slug_key`: `CREATE UNIQUE INDEX tags_slug_key ON public.tags USING btree (slug)`

RLS policies:
- `admin_manage_tags` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `tags_public_read` (SELECT, roles: {anon,authenticated}): using `true`; check `—`

### `ticket_attachments`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `ticket_id` | `uuid` | yes | — |
| `message_id` | `uuid` | no | — |
| `storage_path` | `text` | yes | — |
| `file_name` | `text` | yes | — |
| `mime_type` | `text` | no | — |
| `size_bytes` | `bigint` | no | — |
| `scan_status` | `text` | yes | 'PENDING'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `file_id` | `uuid` | no | — |

Constraints:
- `ticket_scan_status_check`: `CHECK (scan_status = ANY (ARRAY['PENDING'::text, 'CLEAN'::text, 'REJECTED'::text]))`
- `ticket_attachments_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES storage_files(id) ON DELETE RESTRICT`
- `ticket_attachments_message_id_fkey`: `FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE`
- `ticket_attachments_ticket_id_fkey`: `FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE`
- `ticket_attachments_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_ticket_attachments_ticket_attachments_file_id_fkey_ac0256fc`: `CREATE INDEX idx_ticket_attachments_ticket_attachments_file_id_fkey_ac0256fc ON public.ticket_attachments USING btree (file_id)`
- `idx_ticket_attachments_ticket_attachments_message_id_f_aa7b3d37`: `CREATE INDEX idx_ticket_attachments_ticket_attachments_message_id_f_aa7b3d37 ON public.ticket_attachments USING btree (message_id)`
- `idx_ticket_attachments_ticket_attachments_ticket_id_fk_952d3ec4`: `CREATE INDEX idx_ticket_attachments_ticket_attachments_ticket_id_fk_952d3ec4 ON public.ticket_attachments USING btree (ticket_id)`
- `ticket_attachments_pkey`: `CREATE UNIQUE INDEX ticket_attachments_pkey ON public.ticket_attachments USING btree (id)`

RLS policies:
- `admin_manage_ticket_attachments` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `ticket_attachments_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM tickets t   WHERE ((t.id = ticket_attachments.ticket_id) AND (is_org_member(t.organization_id) OR (t.opened_by_user_id = auth.uid())))))`; check `—`

### `ticket_messages`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `ticket_id` | `uuid` | yes | — |
| `sender_id` | `uuid` | no | — |
| `sender_role` | `text` | yes | — |
| `body` | `text` | yes | — |
| `visibility` | `text` | yes | 'PUBLIC'::text |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `ticket_message_visibility_check`: `CHECK (visibility = ANY (ARRAY['PUBLIC'::text, 'INTERNAL'::text, 'SYSTEM'::text]))`
- `ticket_sender_role_check`: `CHECK (sender_role = ANY (ARRAY['BUYER'::text, 'SELLER'::text, 'SUPPLIER'::text, 'ADMIN'::text, 'SYSTEM'::text]))`
- `ticket_messages_sender_id_fkey`: `FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `ticket_messages_ticket_id_fkey`: `FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE`
- `ticket_messages_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_ticket_messages_ticket_messages_sender_id_fkey_cf5d08fb`: `CREATE INDEX idx_ticket_messages_ticket_messages_sender_id_fkey_cf5d08fb ON public.ticket_messages USING btree (sender_id)`
- `ticket_messages_pkey`: `CREATE UNIQUE INDEX ticket_messages_pkey ON public.ticket_messages USING btree (id)`
- `ticket_messages_thread_idx`: `CREATE INDEX ticket_messages_thread_idx ON public.ticket_messages USING btree (ticket_id, created_at)`

RLS policies:
- `admin_manage_ticket_messages` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `ticket_messages_insert` (INSERT, roles: {authenticated}): using `—`; check `((sender_id = auth.uid()) AND (visibility = 'PUBLIC'::text) AND (EXISTS ( SELECT 1    FROM tickets t   WHERE ((t.id = ticket_messages.ticket_id) AND (is_org_member(t.organization_id) OR (t.opened_by_user_id = auth.uid()))))))`
- `ticket_messages_read` (SELECT, roles: {authenticated}): using `((EXISTS ( SELECT 1    FROM tickets t   WHERE ((t.id = ticket_messages.ticket_id) AND (is_org_member(t.organization_id) OR (t.opened_by_user_id = auth.uid()))))) AND (visibility <> 'INTERNAL'::text))`; check `—`

### `ticket_participants`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `ticket_id` | `uuid` | yes | — |
| `user_id` | `uuid` | no | — |
| `organization_id` | `uuid` | no | — |
| `role` | `text` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `ticket_participant_identity`: `CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)`
- `ticket_participants_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- `ticket_participants_ticket_id_fkey`: `FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE`
- `ticket_participants_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `ticket_participants_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_ticket_participants_ticket_participants_organizati_93426209`: `CREATE INDEX idx_ticket_participants_ticket_participants_organizati_93426209 ON public.ticket_participants USING btree (organization_id)`
- `idx_ticket_participants_ticket_participants_user_id_fk_5c43da46`: `CREATE INDEX idx_ticket_participants_ticket_participants_user_id_fk_5c43da46 ON public.ticket_participants USING btree (user_id)`
- `ticket_participants_org_unique_idx`: `CREATE UNIQUE INDEX ticket_participants_org_unique_idx ON public.ticket_participants USING btree (ticket_id, organization_id) WHERE (organization_id IS NOT NULL)`
- `ticket_participants_pkey`: `CREATE UNIQUE INDEX ticket_participants_pkey ON public.ticket_participants USING btree (id)`
- `ticket_participants_user_unique_idx`: `CREATE UNIQUE INDEX ticket_participants_user_unique_idx ON public.ticket_participants USING btree (ticket_id, user_id) WHERE (user_id IS NOT NULL)`

RLS policies:
- `admin_manage_ticket_participants` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `ticket_participants_read` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM tickets t   WHERE ((t.id = ticket_participants.ticket_id) AND (is_org_member(t.organization_id) OR (t.opened_by_user_id = auth.uid())))))`; check `—`

### `ticket_read_states`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `ticket_id` | `uuid` | yes | — |
| `user_id` | `uuid` | yes | — |
| `last_read_message_id` | `uuid` | no | — |
| `last_read_at` | `timestamp with time zone` | no | — |
| `unread_count` | `integer` | yes | 0 |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `ticket_read_states_last_read_message_id_fkey`: `FOREIGN KEY (last_read_message_id) REFERENCES ticket_messages(id)`
- `ticket_read_states_ticket_id_fkey`: `FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE`
- `ticket_read_states_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `ticket_read_states_pkey`: `PRIMARY KEY (ticket_id, user_id)`

Indexes:
- `idx_ticket_read_states_ticket_read_states_last_read_me_7695f570`: `CREATE INDEX idx_ticket_read_states_ticket_read_states_last_read_me_7695f570 ON public.ticket_read_states USING btree (last_read_message_id)`
- `idx_ticket_read_states_ticket_read_states_user_id_fkey_19f1b5b7`: `CREATE INDEX idx_ticket_read_states_ticket_read_states_user_id_fkey_19f1b5b7 ON public.ticket_read_states USING btree (user_id)`
- `ticket_read_states_pkey`: `CREATE UNIQUE INDEX ticket_read_states_pkey ON public.ticket_read_states USING btree (ticket_id, user_id)`

RLS policies:
- `admin_manage_ticket_read_states` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `ticket_read_states_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `tickets`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `organization_id` | `uuid` | yes | — |
| `opened_by_user_id` | `uuid` | yes | — |
| `subject` | `text` | yes | — |
| `category` | `text` | yes | — |
| `priority` | `text` | yes | 'NORMAL'::text |
| `status` | `ticket_status` | yes | 'OPEN'::ticket_status |
| `reference_type` | `text` | no | — |
| `reference_id` | `text` | no | — |
| `assignee_id` | `uuid` | no | — |
| `last_message_at` | `timestamp with time zone` | yes | now() |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `tickets_assignee_id_fkey`: `FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `tickets_opened_by_user_id_fkey`: `FOREIGN KEY (opened_by_user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- `tickets_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`
- `tickets_pkey`: `PRIMARY KEY (id)`

Indexes:
- `idx_tickets_tickets_assignee_id_fkey_cb82f6f8`: `CREATE INDEX idx_tickets_tickets_assignee_id_fkey_cb82f6f8 ON public.tickets USING btree (assignee_id)`
- `idx_tickets_tickets_opened_by_user_id_fkey_7d70ceef`: `CREATE INDEX idx_tickets_tickets_opened_by_user_id_fkey_7d70ceef ON public.tickets USING btree (opened_by_user_id)`
- `tickets_admin_inbox_idx`: `CREATE INDEX tickets_admin_inbox_idx ON public.tickets USING btree (status, priority, last_message_at)`
- `tickets_org_inbox_idx`: `CREATE INDEX tickets_org_inbox_idx ON public.tickets USING btree (organization_id, status, last_message_at DESC)`
- `tickets_pkey`: `CREATE UNIQUE INDEX tickets_pkey ON public.tickets USING btree (id)`

RLS policies:
- `admin_manage_tickets` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `tickets_org_read` (SELECT, roles: {authenticated}): using `(is_org_member(organization_id) OR (opened_by_user_id = auth.uid()))`; check `—`

### `tracking_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `shipment_id` | `uuid` | yes | — |
| `status` | `text` | yes | — |
| `description` | `text` | no | — |
| `location` | `text` | no | — |
| `provider_event_id` | `text` | no | — |
| `occurred_at` | `timestamp with time zone` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `tracking_events_shipment_id_fkey`: `FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE`
- `tracking_events_pkey`: `PRIMARY KEY (id)`
- `tracking_events_shipment_id_provider_event_id_key`: `UNIQUE (shipment_id, provider_event_id)`

Indexes:
- `tracking_events_pkey`: `CREATE UNIQUE INDEX tracking_events_pkey ON public.tracking_events USING btree (id)`
- `tracking_events_shipment_id_provider_event_id_key`: `CREATE UNIQUE INDEX tracking_events_shipment_id_provider_event_id_key ON public.tracking_events USING btree (shipment_id, provider_event_id)`
- `tracking_events_shipment_idx`: `CREATE INDEX tracking_events_shipment_idx ON public.tracking_events USING btree (shipment_id, occurred_at)`

RLS policies:
- `admin_manage_tracking_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `tracking_events_access` (SELECT, roles: {authenticated}): using `(EXISTS ( SELECT 1    FROM shipments s   WHERE ((s.id = tracking_events.shipment_id) AND can_access_fulfilment(s.fulfilment_id))))`; check `—`

### `tutorial_progress`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `tutorial_id` | `uuid` | yes | — |
| `user_id` | `uuid` | yes | — |
| `completed` | `boolean` | yes | false |
| `progress_percent` | `integer` | yes | 0 |
| `completed_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `tutorial_progress_progress_percent_check`: `CHECK (progress_percent >= 0 AND progress_percent <= 100)`
- `tutorial_progress_tutorial_id_fkey`: `FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE`
- `tutorial_progress_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `tutorial_progress_pkey`: `PRIMARY KEY (tutorial_id, user_id)`

Indexes:
- `idx_tutorial_progress_tutorial_progress_user_id_fkey_004f76cd`: `CREATE INDEX idx_tutorial_progress_tutorial_progress_user_id_fkey_004f76cd ON public.tutorial_progress USING btree (user_id)`
- `tutorial_progress_pkey`: `CREATE UNIQUE INDEX tutorial_progress_pkey ON public.tutorial_progress USING btree (tutorial_id, user_id)`

RLS policies:
- `admin_manage_tutorial_progress` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `tutorial_progress_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

### `tutorials`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `seed_key` | `text` | no | — |
| `title` | `text` | yes | — |
| `description` | `text` | yes | — |
| `video_file_id` | `uuid` | no | — |
| `thumbnail_file_id` | `uuid` | yes | — |
| `attachment_file_id` | `uuid` | no | — |
| `duration_minutes` | `integer` | no | — |
| `sort_order` | `integer` | yes | 0 |
| `status` | `text` | yes | 'PUBLISHED'::text |
| `created_at` | `timestamp with time zone` | yes | now() |
| `updated_at` | `timestamp with time zone` | yes | now() |
| `summary` | `text` | no | — |
| `learning_outcomes` | `ARRAY` | yes | '{}'::text[] |
| `content` | `jsonb` | yes | '[]'::jsonb |
| `difficulty` | `text` | yes | 'BEGINNER'::text |

Constraints:
- `tutorials_content_array_check`: `CHECK (jsonb_typeof(content) = 'array'::text)`
- `tutorials_difficulty_check`: `CHECK (difficulty = ANY (ARRAY['BEGINNER'::text, 'INTERMEDIATE'::text, 'ADVANCED'::text]))`
- `tutorials_duration_minutes_check`: `CHECK (duration_minutes IS NULL OR duration_minutes > 0)`
- `tutorials_status_check`: `CHECK (status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'ARCHIVED'::text]))`
- `tutorials_attachment_file_id_fkey`: `FOREIGN KEY (attachment_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `tutorials_thumbnail_file_id_fkey`: `FOREIGN KEY (thumbnail_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `tutorials_video_file_id_fkey`: `FOREIGN KEY (video_file_id) REFERENCES storage_files(id) ON DELETE SET NULL`
- `tutorials_pkey`: `PRIMARY KEY (id)`
- `tutorials_seed_key_key`: `UNIQUE (seed_key)`

Indexes:
- `idx_tutorials_tutorials_attachment_file_id_fkey_0fa91605`: `CREATE INDEX idx_tutorials_tutorials_attachment_file_id_fkey_0fa91605 ON public.tutorials USING btree (attachment_file_id)`
- `idx_tutorials_tutorials_thumbnail_file_id_fkey_3ccedd1e`: `CREATE INDEX idx_tutorials_tutorials_thumbnail_file_id_fkey_3ccedd1e ON public.tutorials USING btree (thumbnail_file_id)`
- `idx_tutorials_tutorials_video_file_id_fkey_5bf97a8a`: `CREATE INDEX idx_tutorials_tutorials_video_file_id_fkey_5bf97a8a ON public.tutorials USING btree (video_file_id)`
- `tutorials_pkey`: `CREATE UNIQUE INDEX tutorials_pkey ON public.tutorials USING btree (id)`
- `tutorials_published_sort_idx`: `CREATE INDEX tutorials_published_sort_idx ON public.tutorials USING btree (status, sort_order, created_at) WHERE (status = 'PUBLISHED'::text)`
- `tutorials_seed_key_key`: `CREATE UNIQUE INDEX tutorials_seed_key_key ON public.tutorials USING btree (seed_key)`

RLS policies:
- `admin_manage_tutorials` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `tutorials_auth_read` (SELECT, roles: {authenticated}): using `(status = 'PUBLISHED'::text)`; check `—`

### `webhook_events`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `id` | `uuid` | yes | gen_random_uuid() |
| `provider` | `text` | yes | — |
| `provider_event_id` | `text` | yes | — |
| `event_type` | `text` | yes | — |
| `signature_valid` | `boolean` | yes | — |
| `status` | `text` | yes | 'RECEIVED'::text |
| `payload` | `jsonb` | yes | '{}'::jsonb |
| `attempts` | `integer` | yes | 0 |
| `last_error` | `text` | no | — |
| `received_at` | `timestamp with time zone` | yes | now() |
| `processed_at` | `timestamp with time zone` | no | — |
| `updated_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `webhook_events_attempts_check`: `CHECK (attempts >= 0)`
- `webhook_events_status_check`: `CHECK (status = ANY (ARRAY['RECEIVED'::text, 'PROCESSING'::text, 'PROCESSED'::text, 'FAILED'::text, 'IGNORED'::text, 'DEAD_LETTER'::text]))`
- `webhook_events_pkey`: `PRIMARY KEY (id)`
- `webhook_events_provider_provider_event_id_key`: `UNIQUE (provider, provider_event_id)`

Indexes:
- `webhook_events_pkey`: `CREATE UNIQUE INDEX webhook_events_pkey ON public.webhook_events USING btree (id)`
- `webhook_events_provider_provider_event_id_key`: `CREATE UNIQUE INDEX webhook_events_provider_provider_event_id_key ON public.webhook_events USING btree (provider, provider_event_id)`

RLS policies:
- `admin_manage_webhook_events` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`

### `wishlist_items`

| Column | PostgreSQL type | Required | Default |
|---|---|---:|---|
| `user_id` | `uuid` | yes | — |
| `seller_product_id` | `uuid` | yes | — |
| `created_at` | `timestamp with time zone` | yes | now() |

Constraints:
- `wishlist_items_seller_product_id_fkey`: `FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE CASCADE`
- `wishlist_items_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `wishlist_items_pkey`: `PRIMARY KEY (user_id, seller_product_id)`

Indexes:
- `idx_wishlist_items_wishlist_items_seller_product_id_fk_c495291c`: `CREATE INDEX idx_wishlist_items_wishlist_items_seller_product_id_fk_c495291c ON public.wishlist_items USING btree (seller_product_id)`
- `wishlist_items_pkey`: `CREATE UNIQUE INDEX wishlist_items_pkey ON public.wishlist_items USING btree (user_id, seller_product_id)`

RLS policies:
- `admin_manage_wishlist_items` (ALL, roles: {authenticated}): using `is_admin()`; check `is_admin()`
- `wishlist_own` (ALL, roles: {authenticated}): using `(user_id = auth.uid())`; check `(user_id = auth.uid())`

## Database functions

| Function | Arguments | Result | Language | Security definer |
|---|---|---|---|---:|
| `admin_upsert_raw_product` | `p_payload jsonb` | `uuid` | plpgsql | yes |
| `assign_supplier_to_product` | `p_product_id uuid, p_primary_offer_id uuid, p_backup_offer_id uuid` | `uuid` | plpgsql | yes |
| `audit_sensitive_mutation` | `` | `trigger` | plpgsql | yes |
| `bump_record_version` | `` | `trigger` | plpgsql | no |
| `can_access_file` | `p_bucket text, p_path text, p_user_id uuid` | `boolean` | sql | yes |
| `can_access_fulfilment` | `p_fulfilment_id uuid, p_user_id uuid` | `boolean` | sql | yes |
| `can_access_order` | `p_order_id uuid, p_user_id uuid` | `boolean` | sql | yes |
| `can_manage_store` | `p_store_id uuid, p_user_id uuid` | `boolean` | sql | yes |
| `checkout_create_order` | `p_idempotency_key text, p_shipping_address_id uuid, p_items jsonb` | `uuid` | plpgsql | yes |
| `complete_eligible_fulfilments` | `` | `integer` | plpgsql | yes |
| `complete_payout` | `p_payout_request_id uuid, p_receipt_file_id uuid, p_reference text` | `uuid` | plpgsql | yes |
| `consume_ai_credit` | `p_design_id uuid, p_idempotency_key text` | `integer` | plpgsql | yes |
| `consume_user_rate_limit` | `p_action text, p_limit integer, p_window_seconds integer` | `boolean` | plpgsql | yes |
| `create_earnings_when_done` | `` | `trigger` | plpgsql | yes |
| `create_ticket` | `p_organization_id uuid, p_subject text, p_category text, p_priority text, p_body text, p_reference_type text, p_reference_id text` | `uuid` | plpgsql | yes |
| `enforce_exception_rate_limit` | `` | `trigger` | plpgsql | yes |
| `handle_new_auth_user` | `` | `trigger` | plpgsql | yes |
| `is_admin` | `p_user_id uuid` | `boolean` | sql | yes |
| `is_org_member` | `p_organization_id uuid, p_user_id uuid, p_roles text[]` | `boolean` | sql | yes |
| `mark_fulfilment_sent` | `p_fulfilment uuid, p_tracking text, p_actor uuid` | `void` | plpgsql | yes |
| `moderate_product` | `p_product_id uuid, p_decision moderation_state, p_rejection_reason_id uuid, p_custom_message text` | `uuid` | plpgsql | yes |
| `open_dispute` | `p_order_id uuid, p_order_item_id uuid, p_reason text, p_description text, p_idempotency_key text` | `uuid` | plpgsql | yes |
| `provision_seller` | `p_user_id uuid, p_payload jsonb` | `jsonb` | plpgsql | yes |
| `provision_supplier` | `p_user_id uuid, p_payload jsonb` | `jsonb` | plpgsql | yes |
| `queue_exception_notification` | `` | `trigger` | plpgsql | yes |
| `reassign_fulfilment` | `p_fulfilment_id uuid, p_supplier_organization_id uuid, p_facility_id uuid, p_supplier_offer_id uuid, p_reason text, p_idempotency_key text` | `uuid` | plpgsql | yes |
| `recalculate_balance` | `p_organization_id uuid` | `void` | plpgsql | yes |
| `record_payment` | `p_order_id uuid, p_provider text, p_provider_payment_id text, p_idempotency_key text, p_amount bigint, p_provider_response jsonb` | `uuid` | plpgsql | yes |
| `record_supplier_availability_change` | `` | `trigger` | plpgsql | yes |
| `refresh_balance_after_earning` | `` | `trigger` | plpgsql | yes |
| `report_fulfilment_exception` | `p_fulfilment_id uuid, p_exception_type text, p_description text, p_idempotency_key text` | `uuid` | plpgsql | yes |
| `request_order_cancellation` | `p_order_id uuid, p_reason text, p_idempotency_key text` | `uuid` | plpgsql | yes |
| `request_payout` | `p_organization_id uuid, p_bank_account_id uuid, p_idempotency_key text` | `uuid` | plpgsql | yes |
| `request_return` | `p_order_item_id uuid, p_reason text, p_description text, p_idempotency_key text` | `uuid` | plpgsql | yes |
| `resolve_dispute` | `p_dispute_id uuid, p_resolution text, p_reject boolean` | `uuid` | plpgsql | yes |
| `review_fulfilment_exception` | `p_exception_id uuid, p_status text, p_resolution text` | `uuid` | plpgsql | yes |
| `review_order_cancellation` | `p_request_id uuid, p_approve boolean, p_message text` | `uuid` | plpgsql | yes |
| `review_return_request` | `p_request_id uuid, p_approve boolean, p_message text` | `uuid` | plpgsql | yes |
| `save_design_draft` | `p_design_id uuid, p_store_id uuid, p_raw_product_id uuid, p_name text, p_views jsonb, p_variant_ids uuid[]` | `uuid` | plpgsql | yes |
| `save_seller_product` | `p_payload jsonb` | `uuid` | plpgsql | yes |
| `supplier_submit_offer` | `p_organization_id uuid, p_raw_product_id uuid, p_variant_ids uuid[], p_base_cost bigint, p_lead_time_days integer, p_capacity_per_day integer` | `uuid` | plpgsql | yes |
| `sync_buyer_cart` | `p_items jsonb` | `uuid` | plpgsql | yes |
| `touch_updated_at` | `` | `trigger` | plpgsql | no |
| `transition_fulfilment` | `p_fulfilment_id uuid, p_to fulfilment_status, p_tracking_code text, p_idempotency_key text` | `fulfilment_status` | plpgsql | yes |
| `validate_exception_transition` | `` | `trigger` | plpgsql | no |
| `validate_seller_product_variant_relation` | `` | `trigger` | plpgsql | no |
| `validate_supplier_offer_variant_relation` | `` | `trigger` | plpgsql | no |

## Triggers

| Table | Trigger | Timing / event | Action |
|---|---|---|---|
| `admin_profiles` | `admin_profiles_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `ai_credit_accounts` | `ai_credit_accounts_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `bank_accounts` | `bank_accounts_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `buyer_profiles` | `buyer_profiles_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `cart_items` | `cart_items_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `carts` | `carts_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `design_views` | `design_views_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `designs` | `designs_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `designs` | `trg_designs_version` | BEFORE UPDATE | `EXECUTE FUNCTION bump_record_version()` |
| `disputes` | `trg_disputes_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `disputes` | `trg_disputes_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `disputes` | `trg_disputes_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `disputes` | `trg_disputes_notification` | AFTER UPDATE | `EXECUTE FUNCTION queue_exception_notification()` |
| `disputes` | `trg_disputes_notification` | AFTER INSERT | `EXECUTE FUNCTION queue_exception_notification()` |
| `disputes` | `trg_disputes_rate_limit` | BEFORE INSERT | `EXECUTE FUNCTION enforce_exception_rate_limit()` |
| `disputes` | `trg_disputes_transition` | BEFORE UPDATE | `EXECUTE FUNCTION validate_exception_transition()` |
| `disputes` | `trg_disputes_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `earnings` | `earnings_refresh_balance` | AFTER DELETE | `EXECUTE FUNCTION refresh_balance_after_earning()` |
| `earnings` | `earnings_refresh_balance` | AFTER UPDATE | `EXECUTE FUNCTION refresh_balance_after_earning()` |
| `earnings` | `earnings_refresh_balance` | AFTER INSERT | `EXECUTE FUNCTION refresh_balance_after_earning()` |
| `earnings` | `earnings_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `facilities` | `facilities_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `fulfilment_exceptions` | `trg_fulfilment_exceptions_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `fulfilment_exceptions` | `trg_fulfilment_exceptions_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `fulfilment_exceptions` | `trg_fulfilment_exceptions_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `fulfilment_exceptions` | `trg_fulfilment_exceptions_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `fulfilments` | `fulfilments_create_earnings` | AFTER UPDATE | `EXECUTE FUNCTION create_earnings_when_done()` |
| `fulfilments` | `fulfilments_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `graphic_styles` | `graphic_styles_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `homepage_banners` | `homepage_banners_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `notification_outbox` | `notification_outbox_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `notification_preferences` | `trg_notification_preferences_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `order_cancellations` | `trg_order_cancellations_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `order_cancellations` | `trg_order_cancellations_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `order_cancellations` | `trg_order_cancellations_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `order_cancellations` | `trg_order_cancellations_notification` | AFTER UPDATE | `EXECUTE FUNCTION queue_exception_notification()` |
| `order_cancellations` | `trg_order_cancellations_notification` | AFTER INSERT | `EXECUTE FUNCTION queue_exception_notification()` |
| `order_cancellations` | `trg_order_cancellations_rate_limit` | BEFORE INSERT | `EXECUTE FUNCTION enforce_exception_rate_limit()` |
| `order_cancellations` | `trg_order_cancellations_transition` | BEFORE UPDATE | `EXECUTE FUNCTION validate_exception_transition()` |
| `order_cancellations` | `trg_order_cancellations_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `orders` | `orders_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `organizations` | `organizations_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `payment_attempts` | `trg_payment_attempts_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `payments` | `payments_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `print_methods` | `print_methods_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `profiles` | `profiles_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_product_mockup_views` | `raw_product_mockup_views_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_product_mockups` | `raw_product_mockups_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_product_variant_assets` | `raw_product_variant_assets_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_product_variants` | `raw_product_variants_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_product_views` | `raw_product_views_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_products` | `raw_products_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `raw_products` | `trg_raw_products_version` | BEFORE UPDATE | `EXECUTE FUNCTION bump_record_version()` |
| `reel_posts` | `reel_posts_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `refunds` | `trg_refunds_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `refunds` | `trg_refunds_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `refunds` | `trg_refunds_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `refunds` | `trg_refunds_transition` | BEFORE UPDATE | `EXECUTE FUNCTION validate_exception_transition()` |
| `refunds` | `trg_refunds_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `rejection_reasons` | `rejection_reasons_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `reprints` | `trg_reprints_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `reprints` | `trg_reprints_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `reprints` | `trg_reprints_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `reprints` | `trg_reprints_transition` | BEFORE UPDATE | `EXECUTE FUNCTION validate_exception_transition()` |
| `reprints` | `trg_reprints_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `return_requests` | `trg_return_requests_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `return_requests` | `trg_return_requests_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `return_requests` | `trg_return_requests_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `return_requests` | `trg_return_requests_notification` | AFTER INSERT | `EXECUTE FUNCTION queue_exception_notification()` |
| `return_requests` | `trg_return_requests_notification` | AFTER UPDATE | `EXECUTE FUNCTION queue_exception_notification()` |
| `return_requests` | `trg_return_requests_rate_limit` | BEFORE INSERT | `EXECUTE FUNCTION enforce_exception_rate_limit()` |
| `return_requests` | `trg_return_requests_transition` | BEFORE UPDATE | `EXECUTE FUNCTION validate_exception_transition()` |
| `return_requests` | `trg_return_requests_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `reviews` | `reviews_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `seller_product_variants` | `seller_product_variants_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `seller_product_variants` | `trg_seller_product_variant_relation` | BEFORE UPDATE | `EXECUTE FUNCTION validate_seller_product_variant_relation()` |
| `seller_product_variants` | `trg_seller_product_variant_relation` | BEFORE INSERT | `EXECUTE FUNCTION validate_seller_product_variant_relation()` |
| `seller_products` | `seller_products_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `seller_products` | `trg_seller_products_version` | BEFORE UPDATE | `EXECUTE FUNCTION bump_record_version()` |
| `seller_profiles` | `seller_profiles_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `shipments` | `shipments_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `sms_templates` | `sms_templates_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `storage_files` | `storage_files_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `store_domains` | `trg_store_domains_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `stores` | `stores_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `stores` | `trg_stores_version` | BEFORE UPDATE | `EXECUTE FUNCTION bump_record_version()` |
| `supplier_assignment_events` | `trg_supplier_assignment_events_audit` | AFTER UPDATE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `supplier_assignment_events` | `trg_supplier_assignment_events_audit` | AFTER DELETE | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `supplier_assignment_events` | `trg_supplier_assignment_events_audit` | AFTER INSERT | `EXECUTE FUNCTION audit_sensitive_mutation()` |
| `supplier_offer_variants` | `supplier_offer_variants_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `supplier_offer_variants` | `trg_supplier_offer_variant_availability` | AFTER UPDATE | `EXECUTE FUNCTION record_supplier_availability_change()` |
| `supplier_offer_variants` | `trg_supplier_offer_variant_relation` | BEFORE UPDATE | `EXECUTE FUNCTION validate_supplier_offer_variant_relation()` |
| `supplier_offer_variants` | `trg_supplier_offer_variant_relation` | BEFORE INSERT | `EXECUTE FUNCTION validate_supplier_offer_variant_relation()` |
| `supplier_offers` | `supplier_offers_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `supplier_profiles` | `supplier_profiles_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `tickets` | `tickets_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `tutorial_progress` | `tutorial_progress_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `tutorials` | `tutorials_touch` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |
| `webhook_events` | `trg_webhook_events_updated` | BEFORE UPDATE | `EXECUTE FUNCTION touch_updated_at()` |

## Storage buckets

| Bucket | Public | File limit | Allowed MIME types |
|---|---:|---:|---|
| `ai-generated` | no | 20971520 | image/jpeg,image/png,image/webp |
| `design-files` | no | 52428800 | image/jpeg,image/png,image/webp,image/svg+xml,application/pdf |
| `payout-receipts` | no | 10485760 | image/jpeg,image/png,application/pdf |
| `printable-exports` | no | 104857600 | image/png,application/pdf,application/zip |
| `product-images` | yes | 10485760 | image/jpeg,image/png,image/webp,image/avif |
| `raw-product-assets` | no | 20971520 | image/jpeg,image/png,image/webp |
| `ticket-attachments` | no | 10485760 | image/jpeg,image/png,image/webp,application/pdf,application/zip |
| `variant-mockups` | yes | 20971520 | image/jpeg,image/png,image/webp |

Storage object access is enforced by policies on `storage.objects`; file ownership and metadata are recorded in `public.storage_files`.

## Scheduled jobs

| ID | Name | Schedule | Active | Command |
|---:|---|---|---:|---|
| 1 | chapli-complete-sent-fulfilments | `17 * * * *` | yes | `select public.complete_eligible_fulfilments();` |
