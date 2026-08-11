# Roles and Permissions

## Authorization model

Use role-based access control for broad capabilities and attribute/ownership checks for tenant, facility, store, and resource boundaries. A person may hold multiple memberships, such as seller owner in one store and staff in another.

Every privileged operation should evaluate:

- Actor identity and account state.
- Membership role and tenant/facility/store scope.
- Resource ownership.
- Workflow state.
- Risk or verification restrictions.
- Step-up authentication requirements.

## Platform administration

Suggested roles:

- **Super admin:** platform configuration and emergency access; very limited assignment.
- **Catalog manager:** categories, attributes, blank products, variants, print specifications.
- **Supplier operations:** onboarding, facilities, offers, capacity, fulfilment escalations.
- **Marketplace moderator:** seller stores, products, designs, reviews, reported content.
- **Support agent:** users, orders, tickets, approved compensations; masked sensitive data.
- **Finance operator:** reconciliation, invoices, refunds, reserves, payouts.
- **Risk/compliance analyst:** identity checks, fraud cases, sanctions/restrictions, chargebacks.
- **Analyst:** read-only aggregate reporting.

Sensitive actions such as manual ledger adjustment, large refund, payout release, impersonation, or account suspension require a reason, audit event, and optionally two-person approval.

## Supplier organization

- **Owner:** legal profile, bank/payout settings, staff, facilities, contracts, all reporting.
- **Manager:** offers, capacity, jobs, shipping, returns, operational reports.
- **Catalog specialist:** offer adoption, variants, costs, print methods, stock.
- **Production operator:** assigned jobs, files, status scans, quality checks.
- **Fulfilment operator:** packing, labels, carrier handoff, tracking.
- **Finance:** statements, invoices, balances, payouts; no production-file editing.
- **Support:** order exceptions and messages; restricted financial access.

Suppliers only see buyer data needed to fulfil a job, for the minimum required period.

## Seller organization

- **Owner:** subscriptions, domains, payout settings, staff, stores, all data.
- **Admin:** store and product operations, orders, customers, staff excluding ownership transfer.
- **Designer:** asset library, editor, drafts, mockups; cannot publish unless granted.
- **Catalog manager:** content, variants, pricing, collections, publication.
- **Order manager:** orders, fulfilment, customer contact, returns.
- **Marketer:** promotions, content, pixels/consents, marketplace campaigns, analytics.
- **Finance:** sales, fees, statements, balance, payouts.
- **Support:** customer profiles, tickets, order issues; masked payment information.
- **Analyst:** read-only dashboards.

## Buyer

- Browse publicly without an account.
- Create and manage an account.
- Manage addresses, preferences, privacy choices, wishlist, carts, orders, reviews, support, and returns.
- A verified purchaser badge is required for order-linked reviews.

## Service identities

API clients, background workers, webhook consumers, and support impersonation sessions use separate identity types with narrowly scoped permissions. Impersonation must be time-limited, visibly indicated, read-only by default, and fully audited.

## High-level permission matrix

| Capability | Admin | Supplier | Seller | Buyer |
|---|---:|---:|---:|---:|
| Govern canonical catalog | Yes | Propose | View | View published |
| Manage supplier offers | Review/override | Own offers | Compare/select | No |
| Create artwork/design | Moderate | No | Own designs | No |
| Publish seller product | Govern | No | Own products | No |
| Manage storefront/domain | Support/govern | No | Own stores | Browse |
| Manage production jobs | Observe/escalate | Assigned jobs | Observe own | Track own |
| Refund order | Policy/admin | Propose | Within policy | Request |
| Change ledger | Controlled | No | No | No |
| View payout data | Finance | Own org | Own org | No |
| Review product | Moderate | No | No | Purchased items |

## Account lifecycle

States: invited, email/phone pending, active, restricted, suspended, closed, anonymized. Organization memberships have independent invited, active, revoked states. Closing an account must preserve legally required transactional records while removing or anonymizing optional personal data.
