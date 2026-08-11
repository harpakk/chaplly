# Technical Architecture

## Recommended starting architecture

Begin with a modular monolith plus independently scalable workers. This gives transactional consistency and a simpler team topology while preserving boundaries that can later become services.

Suggested implementation baseline:

- TypeScript throughout.
- Next.js for public marketplace, storefront rendering, and portal shells.
- A dedicated server application (for example NestJS/Fastify) for domain APIs and workers.
- Supabase Postgres as the system of record.
- Redis for cache, short-lived locks, rate limits, and job coordination.
- S3-compatible object storage plus CDN for artwork, mockups, and production files.
- Durable queue/event transport for background work.
- Postgres full-text search is sufficient for the first slice; OpenSearch/Elasticsearch can be introduced later if marketplace search outgrows it.
- Provider adapters for payments, payouts, tax, shipping, email/SMS, identity verification, malware scanning, and image processing.

Technology selections are proposals, not final decisions; see open decisions.

## Bounded modules

- Identity and access
- Organizations and memberships
- Catalog
- Supplier offers and capacity
- Design/assets/rendering
- Seller products and publication
- Storefront/CMS/domains
- Pricing/promotions/tax/quotes
- Cart/checkout/payments
- Orders/routing
- Production/quality
- Shipping/tracking
- Returns/disputes/support
- Ledger/payouts/subscriptions
- Reviews/moderation/risk
- Notifications
- Analytics/audit/configuration

Modules own their tables and expose application interfaces/events. Avoid cross-module table writes.

## Application topology

- **Buyer web:** marketplace and account.
- **Storefront web:** host/domain-resolved seller experience with edge caching.
- **Seller portal.**
- **Supplier portal.**
- **Admin portal.**
- **Core API:** transactional commands and queries.
- **Workers:** files, mockups, preflight, email, webhooks, tracking, reconciliation, search indexing, analytics.
- **Rendering service:** isolated, resource-limited conversion of untrusted art into previews and production artifacts.

These may live in one monorepo and deploy as fewer units initially.

## Multi-tenancy

- Resolve storefront tenant from verified host.
- Carry tenant context from authenticated membership, never from an untrusted client field alone.
- Apply organization/store filters at repository boundaries and enforce tenant authorization in the server-side data layer.
- Use tenant-specific object-storage prefixes and signed URLs.
- Include tenant identity in cache keys, jobs, rate limits, logs, and analytics.
- Test cross-tenant access systematically.

## API conventions

- Version public APIs; internal UI APIs may evolve with the application.
- Use idempotency keys for checkout, payment, refund, job acceptance, label, and payout commands.
- Use optimistic concurrency for frequently edited products/designs.
- Return machine-readable error codes and field errors.
- Cursor paginate large datasets.
- Never expose provider secrets, raw internal notes, supplier costs to buyers, or seller margins to suppliers.
- Sign outgoing webhooks; retry with exponential backoff and expose delivery logs.

## Eventing and consistency

Use the transactional outbox pattern so database state and emitted domain events do not diverge. Consumers must be idempotent. Important events include:

- offer activated/paused
- product version submitted/published
- inventory changed
- order paid
- fulfilment created/accepted/state changed
- shipment/tracking updated
- return resolved
- refund completed
- ledger balance available
- payout paid/failed
- domain state changed

Long workflows use explicit persisted sagas/process managers, not chained best-effort callbacks.

## File and rendering pipeline

1. Client requests an upload session.
2. Direct upload goes to quarantine storage.
3. Worker validates MIME by content, scans malware, calculates checksum, extracts dimensions/profile, and strips unsafe metadata.
4. Accepted asset becomes tenant-readable via signed/CDN URL.
5. Editor saves a structured versioned document, not just a flattened image.
6. Render jobs execute in an isolated environment with memory/time limits.
7. Outputs record source version, renderer version, dimensions, color profile, checksum, and validation report.
8. Production artifacts are immutable and access-controlled; supplier links expire.

## Search

Index only active, approved, channel-visible data. Documents include localized text, category ancestry, facets, price range, seller, rating, availability region, production/delivery ranges, and moderation state. Updates come from domain events. Admin can manage synonyms and inspect indexing errors.

## Storefront domains and caching

- Verify ownership before serving a store on a domain.
- Automate certificates and renewal.
- Map host to store at the edge/API and reject ambiguous/unverified hosts.
- Cache public pages by host, locale, currency, route, and publication version.
- Purge cache from publication and price/availability events.
- Preserve canonical URLs and redirects for SEO.

## Observability

- Structured logs with request, actor, tenant, order, fulfilment, job, and trace identifiers where applicable.
- Distributed tracing across API, queue, providers, and rendering.
- Metrics for latency, error rate, queue age, checkout success, webhook lag, rendering failures, fulfilment SLA, reconciliation gaps.
- Actionable alerts tied to runbooks.
- Immutable audit is distinct from operational logs.

## Environments and delivery

- Local, test, staging, and production with separate credentials and data.
- Infrastructure as code, repeatable migrations, seeded demo tenants.
- CI: formatting, types, unit tests, integration tests, authorization tests, migration checks, dependency/security scans.
- CD: preview environments, staged rollout, health checks, rollback, feature flags.
- Backups with periodic restore drills and documented recovery objectives.

## Suggested repository shape

```text
apps/
  marketplace-web/
  seller-portal/
  supplier-portal/
  admin-portal/
  api/
  workers/
packages/
  ui/
  domain/
  database/
  auth/
  contracts/
  observability/
  config/
docs/
infra/
tests/
```
