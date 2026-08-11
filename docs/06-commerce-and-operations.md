# Commerce and Operations

## Pricing model

Keep these components separate:

- Supplier blank/production cost by variant, method, placement, quantity tier, and effective date.
- Shipping and surcharges.
- Seller retail price and compare-at price.
- Seller/platform discount funding.
- Platform commission and fixed fees.
- Payment fee.
- Tax charged and tax on fees.
- Currency conversion and rounding.

The seller editor must show estimated profit per variant. Checkout creates an expiring quote. The order snapshots all applied rules and amounts.

## Ledger example

For a captured order, journal lines may represent:

- Cash/payment-provider receivable.
- Buyer tax liability.
- Supplier payable for production and shipping.
- Seller payable for earnings.
- Platform commission revenue.
- Payment processing expense/payable.

Refunds and chargebacks post compensating journals. Existing entries are never edited or deleted. Manual adjustments require reason codes and approval thresholds.

## Multi-supplier orders

A buyer sees one order, but operations split it into fulfilments by supplier, facility, shipping compatibility, and production constraints. Each fulfilment has its own:

- Acceptance and production SLA.
- Address/packing snapshot.
- Production artifacts.
- Shipment method, cost, tracking, and delivery.
- Cancellation/return responsibility.
- Supplier payable release.

The order derives a customer-friendly aggregate status from fulfilments without losing partial states.

## Routing score

Initially let the seller select a primary offer. Capture enough information to later rank alternatives:

- Total production and shipping cost.
- Destination support and estimated delivery.
- Stock and capacity.
- Print compatibility.
- Quality score and defect rate.
- On-time acceptance/production/shipment.
- Seller preferences and exclusions.
- Sustainability or certification filters.

Never reroute if artwork, technique, color outcome, price, branding, or promised delivery materially changes without the applicable approval.

## Supplier SLA

Measure timestamps independently:

- Time to accept/reject.
- Queue-to-production.
- Production duration.
- Quality/rework duration.
- Label-to-carrier acceptance.
- On-time shipment and delivery.
- Valid tracking rate.
- Cancellation, defect, reprint, and return responsibility rates.

Pause or throttle offers based on clear, appealable policy rather than a single opaque score.

## Shipping

- Validate addresses before payment where provider coverage permits.
- Quote per fulfilment and consolidate only when physically possible.
- Store provider quote/request/response references for support.
- Handle label void/refund, manifests, pickup, tracking normalization, lost shipment, and return labels.
- Display ranges, cutoff assumptions, production time, and transit time separately.
- Never promise a delivery date that ignores supplier working calendars.

## Taxes and invoices

Tax responsibility depends on launch jurisdiction, merchant-of-record structure, seller/supplier contracts, and buyer destination. The platform therefore needs a tax adapter and effective-dated rules. Invoice and credit-note numbering must meet local requirements and remain immutable.

## Marketplace trust

- Supplier verification and capability approval.
- Sample/testing program.
- Seller identity and payout verification.
- Content and IP policy enforcement.
- Verified-purchase reviews with anti-abuse controls.
- Clear shop identity, policies, price, delivery promise, and personalization terms.
- Risk-based payment and payout holds.
- Buyer support escalation when seller/supplier misses SLA.

## Support ownership

- Seller owns product questions and normal customer service.
- Supplier handles production facts through a platform-mediated channel.
- Chapli owns payment, platform, safety, abuse, and escalated transaction issues.
- Buyers should not need to negotiate responsibility between seller and supplier.

All cases have category, priority, owner, SLA, related resources, public messages, internal notes, attachments, and outcome.

## Business continuity

- Supplier pause immediately blocks new routing but preserves active jobs.
- Facility outage produces an exception queue and buyer/seller impact assessment.
- Payment or shipping provider outage triggers degraded modes and queued retries where safe.
- Production files remain retrievable for active jobs under controlled emergency access.
- Reconciliation stops payout release if financial integrity cannot be established.
