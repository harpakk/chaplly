# Open Decisions, Risks, and Discovery Questions

These decisions materially affect architecture, contracts, pages, and roadmap. Resolve the launch-critical items during Phase 0.

## Launch-critical decisions

| Decision | Why it matters | Recommended starting position |
|---|---|---|
| Launch country/region | Law, payments, tax, shipping, identity, data hosting | One country first |
| Merchant of record | Liability, invoices, refunds, tax, seller relationship | Obtain legal/accounting advice before payment design |
| Currency and settlement currencies | Ledger, rounding, provider support, FX | One transaction/settlement currency in MVP |
| Payment and payout providers | Checkout, verification, reserves, reconciliation | Select providers with webhooks, idempotency, refunds, split/marketplace support |
| Tax/invoicing model | Checkout totals and legal documents | Adapter plus effective-dated rules |
| Shipping/carriers | Quotes, labels, tracking, returns | Start with limited normalized services |
| Product focus | Editor, templates, QC, operations | 1–3 high-demand blanks and 1–2 methods |
| Seller/supplier legal agreements | Responsibility, IP, SLA, returns, data processing | Draft before pilot |
| Buyer returns promise | Pricing, support, supplier responsibility | Simple reason-based policy with exceptions |
| Custom domain approach | DNS UX, TLS, hosting, abuse | Managed verification/certificate service |

## Product questions

- Is Chapli primarily a marketplace, a seller SaaS, or both equally at launch?
- Can sellers choose any supplier, or do admins/seller plans restrict access?
- Can one seller operate multiple storefronts and legal entities?
- Are personalized buyer inputs supported in the first year?
- Who owns the customer relationship and may market to the buyer?
- Do marketplace products require sample approval?
- Can sellers publish immediately to their own store while marketplace review is pending?
- Are supplier brands visible to buyers?
- Which products are non-returnable, and how is that disclosed?
- Will the platform offer design assets/fonts, and what licenses permit commercial printing?

## Financial questions

- When is buyer payment captured?
- When are supplier payable and seller earnings recognized and made available?
- Who funds discounts, refunds, reprints, lost shipments, and chargebacks in each fault case?
- Are shipping/tax included in commission calculations?
- What reserves, negative balance, minimum payout, and cooling-period rules apply?
- Does the platform invoice the buyer, seller, supplier, or a combination?
- Is cash on delivery required? If so, model rejection, remittance, and fraud separately.

## Operational questions

- Does a supplier manually accept each job or auto-accept by default?
- What is the standard preflight, production, QC, and packaging checklist per method?
- How are blank-product identity and supplier substitutions verified?
- Who purchases shipping labels?
- Can fulfilments be rerouted after acceptance or only before production?
- What evidence is required for defects and IP complaints?
- What hours and languages will support cover?
- What are suspension/appeal and repeat-offender policies?

## Major risks and mitigations

| Risk | Mitigation |
|---|---|
| Inconsistent print quality | Narrow initial catalog, technical templates, samples, QC evidence, performance policy |
| Supplier misses delivery | Capacity/SLA visibility, exception queues, seller-facing estimates, assisted rerouting |
| Low seller margin | Variant-level landed-cost preview and warnings before publish |
| Copyright/trademark abuse | Attestation, detection, notice/appeal workflow, version traceability |
| Cross-tenant data leak | Central authorization, scoped repositories, signed URLs, isolation tests |
| Ledger/reconciliation errors | Double-entry ledger, idempotency, immutable journals, reconciliation gates |
| Custom-domain takeover | Proof of ownership, host allowlist, lifecycle monitoring, certificate controls |
| Malicious artwork | Quarantine, scanning, sanitization, isolated rendering, bounded resources |
| Marketplace cold start | Curated supplier/catalog cohort and seller recruitment before public buyer acquisition |
| Four-sided scope overload | Vertical-slice roadmap, manual operations first, explicit deferred features |
| Provider dependency | Adapter contracts, durable webhooks/retries, exports and recovery runbooks |
| Returns erode economics | Clear product-specific policy, fault attribution, evidence, quality measurement |

## Architecture decisions to record

Create ADRs before implementation for:

1. Framework and monorepo tooling.
2. Authentication/session and tenant context.
3. Database tenancy and row-level security.
4. Object storage/CDN and artwork retention.
5. Canvas document format and renderer.
6. Payments, payouts, and merchant-of-record model.
7. Ledger accounting rules.
8. Domain/TLS architecture.
9. Queue/outbox and workflow orchestration.
10. Search engine and indexing contract.
11. Localization/calendar/currency strategy.
12. Analytics and privacy/consent architecture.

## Phase 0 research deliverables

- Service blueprint for one real order from design through payout.
- Product/variant/print-area specification for the initial catalog.
- Supplier job-ticket and QC prototypes tested on the production floor.
- Seller editor usability test with five or more representative users.
- Buyer checkout/delivery-language test.
- Legal/accounting memo on money and participant relationships.
- Provider proof-of-concepts for payment/refund/payout, label/tracking, domain TLS, and production rendering.
- Unit economics model including defect, reprint, return, support, and payment costs.
