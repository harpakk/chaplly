# Product Brief

## Vision

Chapli makes it possible for a creator or merchant to launch a branded product business without owning inventory or print equipment. Suppliers receive production-ready jobs and predictable settlement. Buyers receive a trustworthy shopping and delivery experience. Administrators can control quality and economics without manually operating every order.

The product is similar in category to Printify, but it also includes hosted seller storefronts and a buyer-facing marketplace.

## Product surfaces

### Marketplace

A Chapli-owned discovery and shopping destination containing eligible products from many sellers. It includes search, categories, collections, recommendations, social proof, checkout, buyer accounts, and support.

### Seller SaaS

A workspace for designing products, selecting suppliers, pricing, publishing, managing stores and domains, processing orders, communicating with customers, and understanding profit.

### Supplier portal

A production and fulfilment workspace for managing facilities, blank-product offers, print capabilities, capacity, jobs, quality, shipping, returns, and payouts.

### Admin control plane

A governed operations system for catalog data, approvals, users, risk, content, money, fulfilment, support, configuration, and audit.

## Value propositions

### Sellers

- Launch products without inventory.
- Compare suppliers by price, location, quality, capacity, and delivery estimate.
- Design with print-area validation and realistic mockups.
- Sell through a hosted store, custom domain, marketplace, and later external channels.
- See landed cost, fees, tax, expected margin, and realized profit.

### Suppliers

- Receive normalized, production-ready orders.
- Reuse the canonical blank catalog instead of repeatedly entering product data.
- Define variants, stock, print methods, areas, costs, SLAs, and capacity.
- Batch work, print documents, purchase shipping, and receive reconciled payouts.
- Build reputation through measurable quality and on-time delivery.

### Buyers

- Discover distinctive products from independent sellers.
- See clear variants, production times, shipping estimates, and policies.
- Use a unified cart and account even when suppliers differ.
- Track split shipments, request returns, and resolve problems.

### Administrators

- Govern a consistent catalog and marketplace.
- Approve suppliers, products, designs, stores, and claims.
- Observe operational queues and exceptions.
- Reconcile all platform money and enforce risk controls.
- Configure policies without deploying code.

## Business model

Potential revenue streams:

- Commission on each item or order.
- Seller subscription tiers.
- Supplier service/transaction fee.
- Payment processing markup where legally allowed.
- Premium design assets, mockups, storage, analytics, or automation.
- Paid marketplace promotion with clear sponsored labeling.
- Domain, email, and fulfilment add-ons.

The ledger must represent gross merchandise value, discounts, shipping, tax, payment fees, platform fees, supplier payable, seller earnings, refunds, chargebacks, reserves, adjustments, and payouts independently.

## Scope boundaries

### In the initial product

- Four role-specific experiences.
- Canonical blank catalog and supplier offers.
- Browser-based design editor with validation.
- Seller storefronts on subdomains and custom domains.
- Marketplace discovery and checkout.
- Multi-supplier order routing and tracking.
- Basic returns, refunds, disputes, and support.
- Seller and supplier balances and payouts.
- Admin governance, moderation, and audit.

### Later

- Native mobile apps.
- Deep integrations with external commerce channels.
- AI-generated designs and automatic background removal.
- Warehousing for seller-owned inventory.
- International tax nexus automation.
- Dynamic supplier routing and automatic failover.
- Wholesale and enterprise procurement.
- Public developer platform.

## Product principles

1. Show the true landed economics before a seller publishes.
2. Never accept an artwork file that production cannot reliably print.
3. Buyers should know who sold an item, while Chapli remains the trusted transaction layer.
4. Every operational exception must enter a visible queue with an owner and SLA.
5. Every material admin action must be auditable.
6. No role should see another tenant’s private data without an explicit entitlement.
7. Accessibility, RTL, mobile responsiveness, and low-bandwidth behavior are release criteria.

## Glossary

- **Blank product / raw product:** canonical undecorated item, such as a T-shirt model.
- **Supplier offer:** a supplier’s purchasable production capability for specific blank variants, print methods, facilities, prices, stock, and SLAs.
- **Designed product:** a seller-owned product combining an offer, artwork placements, mockups, content, variants, and retail pricing.
- **Storefront:** the seller’s customer-facing branded shop.
- **Marketplace listing:** an approved designed product discoverable on Chapli’s marketplace.
- **Print area:** a bounded surface and technical specification where artwork may be placed.
- **Fulfilment:** supplier-specific production and shipment portion of an order.
- **Production file:** final immutable artwork output used by a supplier for an order item.
