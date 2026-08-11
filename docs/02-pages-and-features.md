# Information Architecture and Page Inventory

This is the target-state inventory. The roadmap identifies which pages belong to the first release.

## Shared public and authentication pages

- **Platform home:** role-aware value proposition, featured products, categories, seller/supplier calls to action, trust, FAQ.
- **Seller landing:** workflow, sample economics, storefront/design features, plans, examples, onboarding CTA.
- **Supplier landing:** demand benefits, supported operations, quality expectations, application CTA.
- **Pricing:** seller plans, transaction fees, limits, add-ons, comparison, FAQ.
- **How it works:** separate seller, supplier, and buyer paths.
- **Catalog preview:** browsable blanks, print methods, indicative costs after sign-in.
- **Marketplace:** personalized/curated feeds, categories, filters, sorting, merchandising slots.
- **Search results:** products, shops, suggestions, recent searches, zero-state recovery.
- **Category/collection/campaign:** SEO content, facets, listing grid, related destinations.
- **Public seller shop:** branding, navigation, collections, policies, ratings, contact.
- **Product detail:** gallery/mockups, seller, variants, price, size guide, personalization, production/delivery estimate, reviews, policies, related products.
- **Cart:** seller/supplier grouping, quantity, variants, coupon, estimate, save for later.
- **Checkout:** guest/account path, address, shipping choices per shipment, payment, consent, final totals.
- **Order confirmation:** order summary, split fulfilments, next steps, account creation prompt.
- **Static/legal:** about, contact, help center, terms, privacy, cookies, acceptable use, IP policy, returns.
- **System:** sign in, sign up, role selection, verification, forgot/reset password, MFA, invitation accept, access denied, maintenance, 404/500.

## Buyer account

- **Overview:** active orders, delivery updates, recommendations, saved items.
- **Orders list:** search/filter by state/date/store.
- **Order detail:** items, charges, invoice, supplier-safe tracking, shipment timeline, cancellation eligibility, reorder, support.
- **Return/problem wizard:** affected item, reason/evidence, preferred resolution, status and messages.
- **Wishlist and saved collections.**
- **Addresses:** validation, defaults, delivery notes.
- **Payments:** tokenized methods only; no raw card storage.
- **Reviews:** pending, published, moderation status, edit window.
- **Messages/support:** tickets and order-linked conversations.
- **Profile:** identity, language, currency, notification preferences.
- **Privacy/security:** password, sessions, MFA, data export, consents, account deletion.

## Seller onboarding

- **Welcome and goals:** business type, expected volume, market.
- **Identity/business profile:** legal/contact details and verification state.
- **Store setup:** name, unique slug/subdomain, locale, currency, logo, theme seed.
- **Payout setup:** beneficiary and provider-hosted verification.
- **First product checklist:** select blank, supplier, create design, price, sample, publish.
- **Plan selection:** trial/subscription and limits.
- **Launch checklist:** policies, support contact, domain, payment readiness, test order.

## Seller dashboard

- **Home:** GMV, net sales, estimated profit, orders needing action, product health, conversion, onboarding tasks.
- **Notifications/action center:** approvals, low margin, out-of-stock variants, fulfilment delays, domain problems, payout holds.
- **Blank catalog:** category filters, product comparison, supplier offers, print areas, costs, shipping, sample ratings.
- **Product drafts/list:** status, store/channel, supplier, margin, inventory health, bulk actions.
- **Product create/design editor:**
  - Choose blank, supplier offer, variants, print method, and areas.
  - Upload assets with licensing attestation, organize layers, text, shapes, clipart/templates.
  - Move/scale/rotate/align, safe zones, DPI/color/transparency warnings, undo/redo, autosave.
  - Variant-aware placements, print-area switching, preview zoom, mockup generation.
  - Production-file generation and immutable versioning.
  - Title, description, tags, size guide, SEO, pricing, compare-at price, profit preview.
  - Accessibility alt text and marketplace policy checks.
- **Product detail/edit:** content, design version, variants, pricing, supplier mapping, mockups, channels, history.
- **Publishing center:** validation errors, store/marketplace status, scheduled publication, rejection reasons.
- **Samples:** create sample order, discount eligibility, status, approve/revise product.
- **Collections and navigation:** manual/rule-based collections, menus, featured products.
- **Orders:** list, risk flags, SLA, fulfilment state, search/export, manual order.
- **Order detail:** buyer/order data, payment, fulfilments, production status, tracking, messages, refund/return controls, timeline.
- **Customers:** customer list, profile, consent status, lifetime value, order history, notes/tags, export restrictions.
- **Discounts:** coupon, automatic discount, minimums, usage limits, dates, eligible scope.
- **Storefront customization:** logo, colors, typography, layout sections, preview, draft/publish, version rollback.
- **Pages/blog:** page builder, policies, SEO fields, drafts, scheduling.
- **Domains:** Chapli subdomain, custom domain instructions, verification, SSL, primary redirect, diagnostics.
- **Channels:** Chapli marketplace and future external integrations, sync and error logs.
- **Marketing:** campaigns, links/UTM, abandoned-cart consent settings, pixels, basic email integration.
- **Reviews:** responses, reports, moderation state.
- **Analytics:** acquisition, funnel, products, customers, geography, fulfilment, returns.
- **Finance overview:** gross sales, tax, refunds, fees, supplier costs, realized/estimated profit.
- **Transactions/ledger:** line-item detail and exports.
- **Payouts:** available/pending/reserve balances, schedule, bank account, payout history.
- **Statements/invoices/tax:** downloadable documents and business information.
- **Subscription/billing:** plan, usage, invoices, payment method, limits.
- **Assets:** artwork, fonts, templates, licenses, folders, usage references, storage.
- **Team and permissions:** invites, roles, activity, revoke sessions.
- **Store settings:** contact, locales, currencies, checkout, notifications, policies, order numbering.
- **Support:** knowledge base, tickets, platform status.

## Supplier onboarding

- **Application:** company, contacts, ownership, tax/legal details, regions served.
- **Verification:** identity/business documents, agreements, payout onboarding.
- **Facilities:** addresses, working days, cutoffs, capacity, supported carriers.
- **Capabilities:** print methods, machines, colors/material restrictions, printable dimensions.
- **Offer setup:** adopt catalog products or propose new blank, costs, variants, stock, SLA.
- **Shipping setup:** zones, services, rates, package presets, tracking capability.
- **Quality checklist:** samples/certifications and approval status.
- **Test order/readiness review.**

## Supplier portal

- **Home:** unaccepted jobs, due today, late-risk jobs, capacity, defects, on-time rate, payable balance.
- **Action/exception queue:** file issues, address problems, stockouts, failed labels, reprints, disputes.
- **Facilities:** hours, holidays, contacts, cutoffs, capacity calendars.
- **Print methods/capabilities:** specifications, machines, areas, constraints, certifications.
- **Catalog offers:** adopted blanks, offered variants, costs, tier pricing, lead times, status.
- **Propose blank product:** identity/specifications, variants, media, brand, dimensions, compliance documents; approval tracking.
- **Inventory:** stock by facility/variant, safety stock, bulk import, low-stock alerts, sync/API later.
- **Production jobs:** queue views by priority/method/facility/status, batch selection, barcode/QR workflow.
- **Job detail:** production file, placement/specification, item/variant, due date, packing instructions, issue/reject/reprint actions, audit timeline.
- **Batches:** gang sheets where applicable, pick lists, print sheets, assignment, progress.
- **Quality control:** checklist, photo evidence, defect categories, pass/fail/rework.
- **Shipments:** packing queue, label purchase/upload, manifest, carrier handoff, tracking exceptions.
- **Returns/reprints:** authorization, inspection, disposition, responsibility and evidence.
- **Orders:** supplier-safe commercial view without seller margin or unrelated fulfilments.
- **Capacity:** daily limits, blackout dates, overload warning, temporary pause.
- **Shipping profiles:** zones, services, rates, package sizes, surcharges, delivery estimates.
- **Performance:** acceptance, production time, on-time shipment, defects, cancellations, tracking validity, rating.
- **Finance:** payable, fees, adjustments, reserves, transaction detail, statements, invoices.
- **Payouts:** beneficiary, schedule, status, failures.
- **Team, notifications, API/webhooks, security, support.**

## Admin control plane

- **Executive dashboard:** GMV, revenue, active participants, conversion, order health, payout exposure, incidents.
- **Operations command center:** ageing queues, SLA breaches, stockouts, routing failures, shipping exceptions.
- **User directory:** buyers and identities, state, risk, sessions, support history.
- **Seller organizations/stores:** onboarding, verification, plans, domains, products, metrics, restrictions.
- **Supplier organizations/facilities:** verification, contracts, capabilities, performance, capacity, holds.
- **Roles and staff access:** admin assignments and permission policy.
- **Category tree:** ordering, localized names, SEO, attributes, filters.
- **Brands/materials/colors/sizes/attributes:** normalized catalog taxonomies.
- **Blank products:** specifications, variants/SKUs, print areas, templates, size charts, media, lifecycle.
- **Supplier proposals:** comparison/deduplication, evidence, approval/revision/rejection.
- **Supplier offers:** price/stock/SLA review, visibility, suspensions.
- **Print methods:** technical rules, resolution, color profiles, file formats, pricing units.
- **Seller products/listings:** approval queues, policy flags, takedowns, version/history.
- **Design/content moderation:** automated flags, manual review, IP reports, evidence, decisions.
- **Marketplace merchandising:** featured slots, collections, campaigns, search synonyms, boosts with disclosure.
- **Orders:** global search, detail/timeline, split fulfilments, edits allowed by state, escalations.
- **Fulfilments/shipments:** SLA queues, rerouting, reprints, carrier/tracking exceptions.
- **Returns/refunds/disputes:** cases, evidence, responsibility, resolution, chargebacks.
- **Support center:** omnichannel ticket queue, macros, assignment, SLA, internal notes.
- **Reviews/reports:** moderation, fraud/spam, appeals.
- **Finance dashboard:** GMV, take rate, fees, tax, liabilities, cash/reconciliation gaps.
- **Ledger and adjustments:** journal drilldown, controlled manual journals, approvals.
- **Payouts:** seller/supplier batches, holds, failures, reconciliation.
- **Payment reconciliation:** gateway settlements, unmatched transactions, chargebacks.
- **Plans/fees:** subscriptions, commissions, supplier costs, promotional overrides, effective dates.
- **Tax/invoices:** rules/providers, document sequences, exports.
- **Risk/compliance:** verification queues, fraud signals, blocked entities, case management.
- **Domains:** verification/SSL errors, abuse, ownership conflicts.
- **CMS:** landing pages, help center, banners, email templates, legal versions.
- **Localization:** languages, translation completeness, currencies, units, date/number formats.
- **Notifications:** templates, channels, routing, delivery logs, opt-outs.
- **Feature flags/configuration:** scoped rollout with change audit.
- **Integrations/webhooks:** providers, credentials references, retries/dead-letter queue.
- **Reports/data exports:** saved reports, scheduled exports, access controls.
- **Audit log:** actor, action, target, before/after, reason, origin.
- **System health/jobs:** queues, failures, provider health, replay controls.

## Cross-cutting UI requirements

- Global role/organization/store switcher.
- Persistent search appropriate to each portal.
- Notification inbox and actionable tasks.
- Empty, loading, permission-denied, degraded, and error states.
- Bulk actions with previews and reversible operations where possible.
- Saved filters and export for operational tables.
- Responsive RTL/LTR layouts, keyboard navigation, clear focus, accessible validation.
- Dates shown in user locale while stored as UTC; money always includes currency.
