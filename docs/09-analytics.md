# Analytics and Success Metrics

## North-star outcome

Completed, defect-free orders delivered within the promised window, measured alongside sustainable contribution margin. GMV alone can hide poor quality and unprofitable growth.

## Marketplace funnel

- Landing/search/category/PDP views.
- Search success and zero-result rate.
- PDP-to-cart, cart-to-checkout, checkout completion.
- Payment failure by reason/provider.
- Buyer repeat purchase and cohort retention.
- Average order value, items/order, discount rate.
- Delivery promise accuracy, cancellations, returns, disputes, support contacts.

## Seller funnel

- Signup → verified → store created → first design → first publish → first sale → first payout.
- Time to first valid design and first published product.
- Editor validation failure and abandonment reasons.
- Active sellers, products/store, publish approval rate.
- Store conversion, repeat customers, realized margin.
- Subscription conversion/churn and feature-limit friction.

## Supplier funnel and quality

- Application → verified → facility ready → first active offer → first accepted job → first payout.
- Job acceptance, rejection reason, production duration.
- On-time shipment/delivery.
- Invalid tracking, defect, reprint, supplier-attributable cancellation/return.
- Capacity utilization and offer availability.
- Payable ageing and payout failures.

## Platform/finance

- GMV, net revenue, take rate, contribution margin.
- Payment, refund, chargeback, supplier, shipping, support, and promotion costs.
- Seller/supplier payable and reserve ageing.
- Unbalanced journals (must be zero).
- Unreconciled provider transactions and age.
- Refund and manual-adjustment volume by operator/reason.

## Operational health

- Queue age and SLA breach counts by workflow.
- Orders without accepted fulfilment.
- Jobs blocked by file/stock/address/capacity.
- Shipment tracking lag and carrier exceptions.
- Moderation/support case age and reopen rate.
- Domain verification/certificate failures.
- Worker/job retry and dead-letter rate.

## Event design

Each event includes:

- Stable event name and schema version.
- UTC event time and ingestion time.
- Anonymous/session/user identifiers as permitted.
- Organization/store/facility identifiers when applicable.
- Object identifiers (product/order/fulfilment) with access controls.
- Locale, currency, channel, device/referrer attribution.
- Experiment and feature-flag context.
- Consent state and data classification.

Do not send raw addresses, artwork URLs, payment data, internal notes, or unnecessary PII to general analytics.

## Initial product events

- `signup_started`, `signup_completed`, `organization_created`
- `supplier_offer_submitted`, `supplier_offer_activated`
- `design_started`, `asset_uploaded`, `design_validation_failed`, `design_saved`
- `product_submitted`, `product_published`
- `storefront_viewed`, `search_performed`, `product_viewed`
- `cart_item_added`, `checkout_started`, `payment_failed`, `order_placed`
- `fulfilment_accepted`, `production_started`, `quality_failed`, `shipment_created`, `order_delivered`
- `return_opened`, `refund_completed`, `support_ticket_opened`
- `balance_available`, `payout_completed`, `payout_failed`

## Experimentation

- Define hypothesis, primary metric, guardrails, population, duration, and stopping rule before launch.
- Never experiment on security, legal consent, ledger correctness, or misleading delivery information.
- Guardrails include defect rate, refund rate, support contact, fulfilment SLA, and contribution margin.
- Marketplace ranking must identify sponsored influence and be monitored for feedback loops.
