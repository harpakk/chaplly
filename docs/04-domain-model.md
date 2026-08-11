# Domain Model and Data Ownership

## Modeling rules

- Use UUID/ULID-style opaque identifiers.
- Store timestamps in UTC and retain the user’s display timezone separately.
- Store monetary values as integer minor units plus ISO currency; never floating point.
- Snapshot commercial and production facts on orders so later catalog edits do not rewrite history.
- Prefer append-only event/audit/ledger records for consequential changes.
- Soft-delete catalog and operational entities when referenced by transactions.
- Add `version`, `created_by`, and `updated_by` where optimistic concurrency and provenance matter.

## Identity and tenancy

- **User:** login identity, state, locale, security metadata.
- **Organization:** seller, supplier, or platform business entity.
- **Membership:** user-to-organization role and status.
- **Store:** seller tenant/customer-facing brand; one seller organization may eventually own multiple stores.
- **Facility:** supplier production location.
- **Address:** versioned postal/contact address with purpose and ownership.
- **VerificationCase:** business/identity/payout verification and provider references.

Tenant-owned records carry an `organization_id`; storefront-facing records also carry `store_id`. Facility-scoped operations carry `facility_id`.

## Catalog

- **Category:** adjacency/tree relation, localized content, sort/lifecycle.
- **AttributeDefinition / AttributeValue:** e.g. material, fit, color family.
- **BlankProduct:** canonical identity, brand/model, description, specifications, compliance.
- **BlankVariant:** canonical SKU combination (size/color/etc.), weight, dimensions, barcode.
- **ProductMedia:** canonical imagery with rights/provenance.
- **SizeGuide:** structured measurements, units, localized guidance.
- **PrintMethod:** DTG, sublimation, embroidery, etc. with technical rules.
- **PrintArea:** named product surface, dimensions, safe/bleed zones, template.
- **PrintCompatibility:** allowed method/area/product/variant combinations.

## Supply

- **SupplierCapability:** facility, method, equipment/constraints, certification.
- **SupplierOffer:** supplier/facility commitment for a blank and method.
- **OfferVariant:** availability, base production cost, lead time, status.
- **OfferPrintAreaPrice:** incremental placement or technique cost.
- **InventoryRecord:** on-hand/available/safety stock or made-to-order mode.
- **CapacityCalendar:** work units and blackout periods.
- **ShippingProfile / ShippingZone / ShippingService / RateRule.**
- **SupplierPerformanceSnapshot:** versioned metrics, not the sole raw source.

## Design and seller catalog

- **Asset:** seller-owned original, checksum, metadata, license declaration, scan state.
- **Design:** reusable logical design.
- **DesignVersion:** immutable canvas/document representation.
- **Placement:** area, transform, layer ordering, variant scope.
- **ProductionArtifact:** generated file, checksum, technical metadata, generator version.
- **Mockup:** design/product/variant view and generation state.
- **SellerProduct:** seller-owned merchandising concept.
- **SellerProductVersion:** content/design/supplier configuration snapshot.
- **SellerVariant:** retail SKU, linked blank/offer variant, price, compare-at price, state.
- **Listing:** publication of product/version to storefront or marketplace channel.
- **Collection / CollectionRule / NavigationMenu.**

## Commerce

- **CustomerProfile:** store relationship and permitted marketing attributes; linked carefully to user.
- **Cart / CartItem:** mutable pre-order intent.
- **CheckoutSession / Quote:** expiring snapshot of price, tax, shipping, discounts.
- **Order:** buyer-facing aggregate and totals.
- **OrderItem:** immutable seller product, variant, design, pricing, cost snapshots.
- **Fulfilment:** supplier/facility grouping.
- **FulfilmentItem:** link between item quantities and fulfilment.
- **ProductionJob / JobItem / QualityCheck.**
- **Shipment / ShipmentItem / TrackingEvent.**
- **Discount / Promotion / Redemption.**
- **Payment / PaymentAttempt / Refund / Chargeback.**
- **ReturnCase / ReturnItem / Evidence / Resolution.**
- **Review / ReviewVote / ContentReport.**

## Finance

- **LedgerAccount:** platform cash/receivable/revenue/liability, seller payable, supplier payable, tax payable, reserves.
- **Journal:** balanced business event header with idempotency key.
- **LedgerEntry:** debit/credit line in a single currency.
- **BalanceProjection:** rebuildable acceleration view, never source of truth.
- **Payout / PayoutItem / Settlement / ReconciliationMatch.**
- **Invoice / CreditNote / Statement / TaxLine.**
- **Subscription / Plan / Entitlement / UsageRecord.**
- **FeeRule:** versioned and effective-dated.

Every journal must balance. Cross-currency activity requires explicit clearing and exchange-rate records.

## Platform

- **SupportTicket / Message / InternalNote / SLAEvent.**
- **Notification / NotificationDelivery / TemplateVersion / Preference.**
- **Domain / DomainVerification / CertificateState.**
- **ModerationCase / Decision / Appeal.**
- **AuditEvent:** immutable actor/action/target/reason/before-after references.
- **WebhookEndpoint / DeliveryAttempt.**
- **IntegrationConnection / SyncCursor / SyncError.**
- **FeatureFlag / ConfigurationVersion.**
- **ConsentRecord / LegalDocumentVersion / Acceptance.**

## Important relationships

```text
BlankProduct ──< BlankVariant
      │
      ├──< PrintArea ──< PrintCompatibility >── PrintMethod
      │
      └──< SupplierOffer ──< OfferVariant
                               │
Store ──< SellerProduct ──< SellerVariant
              │                 │
              └── DesignVersion │
                                │
Order ──< OrderItem >───────────┘
  │          │
  └──< Fulfilment ──< ProductionJob ──< Shipment

Business events ──> Journal ──< LedgerEntry
```

## Data retention classes

- Authentication/security logs: security-policy retention.
- Orders, invoices, journals, and tax records: jurisdictional legal retention.
- Production files: configurable contractual window, then archive/delete unless retained by seller.
- Supplier-visible buyer data: minimum fulfilment/support window.
- Marketing and analytics identifiers: consent- and purpose-bound.
- Deleted accounts: anonymize non-required PII while retaining legally necessary transaction evidence.
