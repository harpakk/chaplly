# Chapli

Chapli is an RTL Persian multi-tenant marketplace connecting Buyers, Sellers, Suppliers and platform Admins. The application uses Next.js 15, Supabase Auth, PostgreSQL, Row Level Security and Supabase Storage. UI demo content is relational seed data read through the same data-access paths used in production.

## Backend source of truth

- The exact live table/column/constraint/index/RLS/function/trigger/bucket inventory is in [docs/11-supabase-schema.md](docs/11-supabase-schema.md).
- Ordered migrations are in [supabase/migrations](supabase/migrations).
- Generated TypeScript types are in [src/types/database.generated.ts](src/types/database.generated.ts).
- Idempotent relational seed data is in [scripts/seed-supabase.mjs](scripts/seed-supabase.mjs).

The custom migration runner records applied files in `public._chapli_migrations`. Never edit an applied migration; add a later numbered migration.

## Local setup

1. Install Node.js 22+ and run:

   ```bash
   npm install
   ```

2. In Supabase, copy:

   - Project URL and Publishable key from **Settings → API Keys**.
   - Secret key from the same page. This is server-only.
   - Session pooler PostgreSQL URI from **Connect → Direct/Connection string → Session pooler**.

3. Copy `.env.example` to `.envsecure` and fill every Supabase value. Keep `.envsecure` local; it is ignored by Git.

4. Apply the database:

   ```bash
   npm run db:migrate
   npm run db:types
   npm run db:seed
   npm run db:docs
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

## Seed accounts

The default development password is `ChapliDemo!1405`, or the value of `SEED_DEFAULT_PASSWORD`.

| Role | Email |
|---|---|
| Admin | `admin@chapli.dev` |
| Buyer | `buyer@chapli.dev` |
| Second buyer | `buyer2@chapli.dev` |
| Seller | `seller@chapli.dev` |
| Additional sellers | `seller2@chapli.dev`, `seller3@chapli.dev` |
| Supplier | `supplier@chapli.dev` |
| Second supplier | `supplier2@chapli.dev` |

The seed uses stable UUIDs and upserts, so rerunning it does not duplicate records. Remove these users or rotate their passwords before any production launch.

## Storage

Migrations create:

- `product-images`
- `raw-product-assets`
- `variant-mockups`
- `design-files`
- `printable-exports`
- `ai-generated`
- `payout-receipts`
- `ticket-attachments`

Public marketplace assets are public buckets. Designs, print files, receipts and attachments are private and accessed through ownership-aware Storage policies or signed URLs. `public.storage_files` stores ownership, path, type, MIME, size, state and metadata.

## Security and transactional commands

Supabase Auth UUIDs are the identity source. `public.profiles` and role-specific profile/membership tables extend Auth. RLS is enabled across user-accessible public tables and Storage objects.

Sensitive multi-row workflows use `SECURITY DEFINER` PostgreSQL functions that validate the authenticated actor:

- `checkout_create_order`
- `record_payment`
- `transition_fulfilment`
- `request_payout`
- `complete_payout`
- `consume_ai_credit`
- `moderate_product`
- `create_ticket`
- `supplier_submit_offer`
- `admin_upsert_raw_product`
- `save_design_draft`
- `save_seller_product`

Fulfilments marked `SENT` receive an `auto_complete_at` timestamp. `pg_cron` runs `complete_eligible_fulfilments()` hourly and marks eligible records `DONE` after ten days unless their state changed to cancelled, returned or disputed. `npm run fulfilments:complete` is the manual/fallback runner.

## Connected pages

- Buyer marketplace, search/category/store filters, product pages, reels, cart, transactional checkout, order status, account orders, wishlist, recent products, saved reels, addresses, reviews and profile.
- Seller finance, balances, payout requests, bank accounts, store profile, products, CSV export, tutorials, ticketing, raw-product selection, design autosave and product submission.
- Supplier oldest-first active fulfillment queue, downloadable files, tracking submission, auto-completion, finance/payouts, raw-product offers and ticketing.
- Admin live overview, payouts with receipts, raw products, pending moderation, first 100 unfinished orders, rejection reasons and ticket inbox.

Every populated, loading, empty and error state is rendered from Supabase responses. Cart state and harmless UI preferences remain browser-local until checkout; business records do not.

## Production deployment

1. Create a separate production Supabase project.
2. Configure deployment environment variables from `.env.example`; never expose `SUPABASE_SECRET_KEY`, `DATABASE_URL` or `OPENAI_API_KEY` to the browser.
3. Run `npm run db:migrate`, `npm run db:types` and commit the generated type update.
4. Do not run the demo seed in production unless explicitly required.
5. Build with `npm run build`.
6. Confirm the `chapli-complete-sent-fulfilments` cron job is active in the production database.
7. Test RLS using real Buyer, Seller, Supplier and Admin accounts before enabling payment.

## Useful checks

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run db:docs
```

The repository still contains product-planning documents under `docs/`; they describe intended behavior, while migrations and the generated schema inventory are authoritative for the implemented backend.
