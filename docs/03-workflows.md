# Core Workflows and State Machines

## Canonical catalog and supplier offer

1. Admin creates a canonical blank or supplier proposes one.
2. Catalog team checks duplicates, taxonomy, specifications, variants, imagery, compliance, and print areas.
3. Approved blank becomes adoptable but is not itself a supplier commitment.
4. Supplier chooses facility, variants, stock mode, print methods, costs, lead time, shipping, and capacity.
5. Offer validation checks that print method and print-area rules are compatible.
6. Admin may approve the first offer or high-risk changes.
7. Sellers can compare active offers.

Blank states: `draft → in_review → approved → active → archived`.

Offer states: `draft → submitted → approved → active ↔ paused → retired`; rejection returns to `changes_requested`.

## Seller product creation

1. Select blank and eligible supplier offer.
2. Select variants and print method.
3. Create artwork placements.
4. Validate asset resolution, bounding area, transparency, format, color expectations, and content policy.
5. Generate preview mockups and versioned production files.
6. Enter content, size guide, retail pricing, SEO, and channels.
7. Show cost and margin for every variant and destination assumptions.
8. Optionally order a sample.
9. Submit for marketplace review or publish directly to own storefront under policy rules.

Product states: `draft → validation_failed | ready → in_review → approved → scheduled | published → paused → archived`. A material design/content change creates a version and may require re-review.

## Custom domain

1. Seller enters domain.
2. System provides TXT ownership and CNAME/A/ALIAS routing instructions.
3. Verification worker confirms ownership and correct routing.
4. Platform provisions TLS certificate.
5. Seller selects primary host and redirect behavior.
6. Health checks detect DNS/certificate regressions.

States: `pending_verification → verified → provisioning_tls → active`, with `misconfigured`, `expired`, `revoked`, and `conflict` exception states.

## Buyer purchase and order routing

1. Cart service revalidates products, variants, quantity, offers, addresses, prices, discounts, and availability.
2. Checkout quotes shipping and tax against a frozen cart snapshot.
3. Payment is authorized; order is created idempotently.
4. Items are grouped into supplier/facility fulfilments.
5. Production files and specifications are snapshotted per item.
6. Supplier accepts automatically or manually within SLA.
7. Payment capture policy runs at order acceptance or configured milestone.
8. Supplier produces, performs QC, packs, and ships.
9. Tracking events update each fulfilment and the overall order.
10. Ledger releases seller/supplier earnings after delivery/risk hold.

Order states: `pending_payment → paid → processing → partially_shipped → shipped → partially_delivered → delivered → completed`.

Exception terminal/side states: `payment_failed`, `cancelled`, `partially_cancelled`, `disputed`, `partially_refunded`, `refunded`.

Fulfilment states: `created → offered → accepted → preflight → production → quality_check → packed → shipped → delivered`, with `on_hold`, `rejected`, `cancelled`, `lost`, and `returned`.

## Production preflight

- Resolve exact product, variant, print area, method, and design version.
- Confirm the production artifact checksum.
- Confirm asset dimensions/resolution and supported color/format.
- Confirm offer availability and facility capacity.
- Detect missing fonts/assets and unsafe clipping.
- Produce a human-readable job ticket and machine-ready file.
- Freeze outputs; later edits create a new version and controlled reprint.

## Stockout or supplier rejection

1. Supplier provides a reason and expected recovery time.
2. Routing checks compatible offers, including blank/variant, print method, placement, quality threshold, price tolerance, and destination.
3. If a compatible alternative exists, seller/admin approves any material price or SLA difference.
4. Otherwise buyer receives transparent choices: wait, substitute variant, partial cancellation, or full cancellation.
5. Responsibility and costs are recorded for performance scoring and ledger adjustments.

Automatic rerouting is a later feature; the first release supports assisted rerouting.

## Cancellation

Cancellation eligibility is evaluated per fulfilment. Before production it may be automatic. During/after production it follows seller policy and attributable fault. Cancellation never silently changes financial records; it creates refund and ledger events.

## Return, refund, reprint, and dispute

1. Buyer selects item/reason and submits evidence.
2. Policy engine checks timing, product type, personalization, delivery state, and prior claims.
3. Case is routed to seller, supplier, or platform based on reason.
4. Resolution may be information only, replacement/reprint, return-and-refund, refund without return, partial refund, or denial.
5. If returned, issue authorization/label and track receipt/inspection.
6. Determine responsibility and post separate buyer refund, seller adjustment, supplier adjustment, and platform fee treatment.
7. Allow appeal/escalation and preserve an evidence timeline.

Case states: `opened → awaiting_evidence → under_review → approved | denied → return_in_transit | reprint → resolved → closed`, with `appealed`.

## Payout

1. Ledger entries move from pending to available after configured holds.
2. Reserve and negative balance rules apply.
3. Scheduled batch validates verification, beneficiary, minimum, currency, and risk status.
4. Provider transfer is created idempotently.
5. Webhook confirms paid or failed.
6. Finance reconciles provider settlement with ledger journal.

States: `scheduled → processing → paid` or `failed`; holds are explicit and reasoned.

## Moderation and intellectual-property complaint

- Automated checks can flag but do not make irreversible legal determinations.
- Reporter submits ownership/contact details, URLs, basis, and attestation.
- Content may be temporarily restricted depending on policy/risk.
- Seller is notified and can counter/appeal.
- Moderator records evidence, decision, scope, expiry, and repeat-infringer impact.
- All affected products/design versions are traceable.

## Notifications

Domain events feed a notification service. Each template has audience, channel, locale, urgency, deduplication key, preference category, and deep link. Security, transaction, and legal messages are separated from marketing consent.
