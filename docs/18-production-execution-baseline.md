# Production execution baseline

Updated: 2026-07-30

This document is the Section 1 execution record for
`17-production-readiness-master-plan.md`.

## Verified current state

- Application: Next.js 15 App Router, React 19, RTL Persian UI.
- Backend: Supabase Auth, PostgreSQL, RLS and Supabase Storage.
- Live schema before production hardening: 75 user tables plus the migration
  ledger, 168 RLS policies, 27 public functions and eight Storage buckets.
- RLS is enabled on all 75 user tables.
- The hourly Sent-to-Done scheduled job is active.
- Live verification passed 28 checks covering anonymous, Buyer, Seller,
  Supplier and Admin access, private files, checkout idempotency, payout
  idempotency, moderation, AI credit use and fulfilment transitions.
- All monetary columns inspected use `bigint` IRR values.
- All security-definer functions have a fixed `search_path`.
- TypeScript and lint currently pass; lint has image-optimization warnings only.
- The live raw-product front/back media records and signed URLs were verified.
- Seller Products may be designed without a Supplier. Their variants remain
  `OUT_OF_STOCK` until an approved Supplier offer is assigned.

## Application surfaces and data ownership

| Surface | Primary routes | Main data | Owner / authorization |
| --- | --- | --- | --- |
| Marketplace | `/`, `/search`, `/category/[slug]`, `/subcategory/[slug]`, `/products/[slug]`, `/stores/[slug]` | categories, banners, Stores, Seller Products, variants, reviews, reels | Public reads only published/active records |
| Buyer | `/account/*`, `/cart`, `/checkout`, `/orders/[number]` | Buyer profile/address, cart, wishlist, recent views, orders | Supabase Auth user UUID |
| Seller onboarding | `/seller`, `/seller/login`, `/seller/register` | profile, Seller organization, membership, Store | Auth user + Seller membership |
| Seller dashboard | `/seller/dashboard`, product creation/design/support | Store, designs, Seller Products, earnings, payouts, bank accounts, tickets | Seller organization membership |
| Supplier | `/supplier/*` | Supplier organization/profile, offers, fulfilments, earnings, payouts, tickets | Supplier organization membership |
| Admin | `/admin/*` | catalog, moderation, orders, payouts, settings, tickets | Active Admin profile; temporary dev access still exists |
| Scheduled operations | hourly completion script/cron | fulfilments, events, earnings/balances | PostgreSQL scheduled service |

## Write-path matrix

| Command | Boundary | Transactional database command |
| --- | --- | --- |
| Buyer checkout | Server Action | `checkout_create_order` |
| Payment recording | Server/provider adapter | `record_payment` |
| Seller/Supplier payout request | Server Action | `request_payout` |
| Admin payout completion | Server Action | `complete_payout` |
| Product moderation | Server Action | `moderate_product` |
| Supplier offer | Server Action | `supplier_submit_offer` |
| Design draft | Server Action | `save_design_draft` |
| Seller Product save | Server Action | `save_seller_product` |
| Fulfilment transition | Server/scheduled job | `transition_fulfilment` |
| Sent-to-Done automation | Cron | `complete_eligible_fulfilments` |
| AI lifetime credit | Server Action | `consume_ai_credit` |
| Ticket creation | Server Action | `create_ticket` |
| Raw Product administration | Server-only PostgreSQL | `admin_upsert_raw_product` |

## Canonical domain contracts

- **Raw Product**: platform-owned manufacturable base product.
- **Raw Product View**: front/back design surface with normalized printable area.
- **Raw Product Variant**: valid Raw Product color-size combination.
- **Variant Asset**: per-view background, optional overlay and mockup.
- **Design**: Seller-owned canvas document linked to one Raw Product.
- **Seller Product**: Store listing derived from one Design and Raw Product.
- **Supplier Offer**: approved Supplier capability and commercial terms for one
  Raw Product.
- **Order**: immutable Buyer commercial snapshot.
- **Fulfilment**: production responsibility assigned to one Supplier.
- **Shipment**: carrier/tracking history for a fulfilment.
- **Earning**: immutable financial ledger entry created from completed work.
- **Payout**: explicit request containing locked eligible earning entries.

## Canonical state rules

- Seller Product: `DRAFT → PENDING → PUBLISHED`; rejection returns it to
  `REJECTED`; archive is terminal for discovery.
- Seller Product Variant: `OUT_OF_STOCK` without an eligible Supplier,
  `ACTIVE` after assignment and `INACTIVE` only by an authorized catalog
  action.
- Fulfilment: `ASSIGNED → ACCEPTED/IN_PRODUCTION → SENT → DONE`; cancellation,
  return and dispute are explicit exception states. `SENT → DONE` is automatic
  after ten eligible days and is idempotent.
- Payment: `PENDING → AUTHORIZED/CAPTURED` or `FAILED/CANCELLED/REFUNDED`.
- Earning: `PENDING → AVAILABLE → RESERVED → PAID`; released/reversed entries
  require an immutable adjustment.
- Payout: `REQUESTED → PROCESSING → PAID` or `REJECTED/CANCELLED`.
- Ticket: `OPEN → IN_PROGRESS → WAITING_* → RESOLVED → CLOSED`, with controlled
  reopen.
- Raw Product assets are platform-private and rendered through signed URLs.

## Security and secret findings

- `.envsecure`, Firebase credential filename patterns, logs and generated build
  files are ignored from source-control and Docker contexts.
- Service-role and database credentials are server-only.
- Credentials shared during development must be rotated before production:
  Supabase secret, database password/URL, OpenAI key and old Firebase service
  accounts.
- The static Admin access-code flow is development-only technical debt and
  cannot be enabled in production.
- Private Storage access is policy-controlled; signed URLs are used for browser
  rendering.

## Prioritized gap register

| Priority | Gap | Acceptance criterion | Status |
| --- | --- | --- | --- |
| P0 | No production payment provider selected | Signed webhook integration passes idempotency and reconciliation tests | Blocked by provider decision/credentials |
| P0 | Development credentials were exposed | All listed credentials rotated and old credentials revoked | Blocked by external control-plane access |
| P0 | Temporary Admin access code | Production uses Admin profile authentication and MFA; dev bypass is impossible in production | In progress |
| P0 | Missing refund/return/dispute/reprint models | Migrated tables, RLS, event histories and tested commands exist | In progress |
| P0 | No staging/production environment separation | Isolated Supabase projects and deployment secrets exist | Blocked by infrastructure authority |
| P1 | Incomplete automatic backend invariant audit | CI fails on orphaned relations, missing RLS/policies/jobs/indexes | In progress |
| P1 | No automated unit/E2E suite | Unit, DB and browser smoke suites run in CI | In progress |
| P1 | Notification provider not connected | Durable outbox worker records provider delivery/retry state | Blocked by provider decision/credentials |
| P1 | DNS/custom-domain provisioning is local only | DNS verification/certificate state and deployment routing are tested | Partially implementable |
| P1 | Remaining public `<img>` warnings | Stable media uses approved optimization strategy | Not started |
| P1 | No production monitoring provider | Structured health endpoint, operational queries and runbooks exist; hosted alerts configured | Partially implementable |
| P2 | Search is database filtering rather than dedicated search | Indexed query meets performance target at launch cardinality | Not started |

## Launch scope

Included:

- Buyer marketplace, cart and order creation.
- Seller onboarding, Store management, design and moderated products.
- Supplier offers, assigned fulfilments, shipment and earnings.
- Admin catalog, moderation, order, payout and support operations.
- Ticketing, tutorials, reels and exclusive Store storefronts.

Externally blocked until configured:

- Real payment capture/refund.
- SMS/email delivery.
- Production DNS/custom certificates.
- Production/staging Supabase provisioning and hosted alert destinations.
- Credential rotation and backup restore drill in the owner’s cloud accounts.

Deferred from the first controlled deployment:

- Advanced recommendation engine.
- Full inventory reservation across external Supplier ERPs.
- Automated tax invoicing beyond immutable IRR snapshots.
- Native mobile applications.

## Section 1 exit decision

The repository and live backend are inventoried. Unknowns are now explicit
external blockers rather than hidden implementation gaps. Repository-controlled
work may proceed through Sections 2–5.
