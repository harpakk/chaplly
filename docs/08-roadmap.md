# Delivery Roadmap

## Delivery strategy

Build vertical slices that complete real outcomes. Avoid implementing four disconnected dashboard shells before a product can be bought and fulfilled.

## Phase 0 — Discovery and foundations (2–4 weeks)

Outcomes:

- Confirm launch country, language/currency, merchant-of-record model, payment/payout, shipping, tax/invoice, and identity requirements.
- Interview representative sellers, suppliers, buyers, and operations staff.
- Validate catalog/offer/design concepts with clickable prototypes.
- Define initial product types and one or two print methods.
- Establish design system, architecture records, threat model, event/state conventions, analytics taxonomy, and operational SLAs.
- Create backlog and acceptance criteria for the first vertical slice.

Exit: commercial/legal model and critical provider choices are decided.

## Phase 1 — Internal pilot vertical slice (10–14 weeks)

Scope:

- Identity, organizations, memberships, MFA for admins.
- Admin: category, blank, variants, print areas/methods, supplier and listing approval.
- Supplier: onboarding, one facility, adopt catalog, offers, basic stock/capacity, job queue, status, shipment/tracking, payout details.
- Seller: onboarding, one store, blank/offer selection, basic editor (image placement), validation, mockups, variant pricing, product publication.
- Buyer: storefront browse, PDP, cart, address, one payment method, checkout, order detail, tracking.
- Core: order splitting, immutable production snapshot, notifications, basic ledger, refunds, audit.
- Manual operations for exceptions and assisted reconciliation.

Constraints:

- One geography/currency.
- Small controlled set of blanks and print methods.
- Chapli subdomains only; custom domains may be piloted behind a flag.
- No marketplace-wide discovery required; direct storefront purchase is enough.

Exit: controlled sellers can create, sell, produce, ship, refund, and settle real orders.

## Phase 2 — Private beta (8–12 weeks)

- Buyer marketplace home/search/categories/wishlist/reviews.
- Custom domains, storefront theme/content/policies, SEO.
- Multiple supplier fulfilments and richer shipping quotes.
- Returns/reprints/dispute cases.
- Seller/supplier finance reports, statements, scheduled payouts.
- Discounts, samples, collections, customer and product analytics.
- Supplier inventory import, batching, QC evidence, capacity calendar.
- Moderation, IP reports, risk queues, support ticketing.
- Subscription plans and entitlement enforcement.
- Better admin operations and reconciliation.

Exit: invited cohort can self-serve with sustainable support workload and measured SLA.

## Phase 3 — Public launch

- Harden scale, security, privacy, accessibility, and incident response.
- Marketplace merchandising, recommendations baseline, search synonyms/facets.
- Provider fallbacks and operational runbooks.
- Seller marketing basics and abandoned-cart flows subject to consent.
- Full domain diagnostics and certificate automation.
- Performance scorecards and enforceable supplier quality policy.
- Public documentation/help center and participant agreements.

Exit: launch scorecard meets conversion, fulfilment, defect, support, reconciliation, and availability thresholds.

## Phase 4 — Growth

- External commerce channel integrations.
- API/webhooks for sellers and suppliers.
- Automated inventory feeds and routing/failover.
- Multi-currency, additional locales and regions.
- Advanced personalization, templates, collaboration, and design assets.
- Enterprise/wholesale, branded packaging, warehouse options.
- Native apps if web evidence supports them.

## Prioritization

Use this order:

1. Transaction and production correctness.
2. Tenant isolation and financial integrity.
3. Fulfilment reliability and operational visibility.
4. Seller time-to-first-published-product.
5. Buyer conversion and trust.
6. Automation and growth.

## MVP epics

1. Identity, tenant membership, and onboarding.
2. Canonical catalog and print specifications.
3. Supplier offers and basic availability.
4. Artwork ingestion and design editor.
5. Seller product/pricing/publication.
6. Storefront browse/product/cart.
7. Checkout/payment/order.
8. Production job and shipment.
9. Tracking/notifications/buyer account.
10. Ledger/refund/payout.
11. Admin operations/moderation/audit.
12. Observability/security/backup.

## Definition of done for a feature

- Product acceptance criteria and permission matrix covered.
- Loading/empty/error/degraded states.
- RTL, responsive, keyboard, and accessibility review.
- Analytics and audit events where applicable.
- Authorization, unit, integration, and relevant end-to-end tests.
- Observability and operational ownership.
- Migration/rollback and documentation.
- Privacy/security review proportional to risk.
