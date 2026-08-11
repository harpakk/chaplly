# Chapli production-readiness master plan

> Status: planning only — none of the work below has been executed by creating this document.
>
> Goal: finish Chapli as a secure, relational, tested and deployable Persian marketplace connecting Buyers, Sellers, Suppliers and Admins.

## How to use this plan

- Work through the five sections in order; later sections depend on earlier contracts.
- Track every item as `Not started`, `In progress`, `Blocked`, `Verified` or `Deferred`.
- A task is not `Verified` until its automated test, permission test and relevant UI flow pass.
- Database changes must be delivered through idempotent migrations, never dashboard-only edits.
- Production must never use demo credentials, seed accounts, static admin passwords or development secrets.
- Each section ends with an exit gate. Do not continue to production release while a gate is open.

---

## 1. Baseline audit, product contracts and gap closure

### 1.1 Establish the source of truth

- Inventory every route, Server Action, Supabase query, RPC, migration, trigger, scheduled process, Storage bucket and environment variable.
- Reconcile the generated schema documentation with the live Supabase project and migration history.
- Compare the implemented product against the Buyer, Seller, Supplier, Admin, design-editor and support plans.
- Produce a route-to-data matrix showing which page reads and writes which tables, functions and files.
- Identify unused tables, duplicate concepts, obsolete Firebase code, dead components, unreachable routes and hardcoded demo arrays.
- Verify that `.envsecure`, service-account files, private keys, API secrets, database URLs and generated logs are ignored by source control and excluded from build artifacts.

### 1.2 Freeze canonical business terminology

- Define canonical meanings for Product, Raw Product, Raw Product View, Color, Size, Variant, Design, Seller Product, Supplier Offer, Order, Fulfilment, Shipment, Earning and Payout.
- Define authoritative status machines for users, organizations, stores, products, moderation, orders, fulfilments, shipments, tickets and payouts.
- Define who owns each record and who may transition each status.
- Decide whether a Seller Product without a Supplier may enter moderation or publication. Current intended behavior: creation and moderation are allowed, purchasable variants remain `OUT_OF_STOCK` until an approved Supplier is assigned.
- Resolve all launch-critical decisions in `docs/10-open-decisions.md`, especially payment provider, SMS provider, shipping responsibility, return policy, commission rules, taxes and production SLA.

### 1.3 Find missing and inconsistent application behavior

- Audit all dashboards for slow route transitions, stale state after refresh, broken mobile navigation and inconsistent loading/saving overlays.
- Find remaining pages that silently reset form data, navigate backward on validation errors or expose raw database errors.
- Verify UTF-8 Persian text throughout source, database seeds, CSV exports, metadata and runtime responses; repair mojibake.
- Replace remaining fake counts, dates, companies, products, charts and profile images with database-backed values.
- Verify loading, populated, empty, partial, permission-denied and recoverable-error states on every page.
- Ensure seller logos, store branding, raw-product images and private Storage files use correct public or signed URLs.
- Confirm responsive and RTL behavior at mobile, tablet, laptop and wide desktop breakpoints.

### 1.4 Define measurable readiness targets

- Public-page LCP target: under 2.5 seconds at the 75th percentile.
- Dashboard navigation response target: immediate visual transition, useful content or skeleton under 1 second.
- Standard database mutation target: under 2 seconds excluding large file transfer.
- Error-free session target: at least 99.5%.
- Accessibility target: WCAG 2.2 AA for primary Buyer and dashboard workflows.
- Availability target, recovery-time objective and recovery-point objective must be approved before launch.

### Section 1 deliverables

- Current-state inventory.
- Route-to-data and role-to-permission matrices.
- Canonical state-machine document.
- Prioritized gap register with owner, severity and acceptance criteria.
- Approved launch scope and explicit deferred scope.

### Section 1 exit gate

- No unknown production route, data owner, status transition, secret or launch-critical business decision remains.

---

## 2. Database, relations, security, Storage and backend integrity

### 2.1 Schema additions

- Add missing tables for payment attempts, refunds, returns, disputes, reprints, cancellations and their immutable event histories.
- Add inventory/availability history so Supplier capacity and variant availability changes are auditable.
- Add Supplier assignment history rather than relying only on current Supplier IDs.
- Add domain/subdomain verification and certificate-status records for exclusive stores.
- Add notification preferences, delivery attempts and provider response records for SMS/email/push.
- Add analytics event ingestion or a durable analytics outbox with consent-aware user/session identifiers.
- Add webhook inbox/outbox tables with idempotency keys, signatures, retry counts and dead-letter state.
- Add application release/version metadata when needed for safe migration compatibility checks.

### 2.2 Schema modifications and normalization

- Review all 76 current tables for correct types, nullability, defaults, unique constraints and delete behavior.
- Confirm all money values use integer rial amounts and never floating-point arithmetic.
- Keep flexible canvas documents in JSONB; normalize searchable and transactional attributes.
- Ensure every child relation has the intended foreign key and an index beginning with its foreign-key columns where useful.
- Make optional-Supplier behavior explicit: nullable Supplier variant relation, `OUT_OF_STOCK` until assignment and no checkout without an eligible Supplier.
- Add effective-date fields where pricing, commission or Supplier costs can change over time.
- Preserve immutable snapshots for customer address, price, tax, commission, Supplier terms and product content at purchase time.
- Add version columns or optimistic-concurrency checks for frequently edited Stores, Raw Products, Designs and Seller Products.
- Confirm unique constraints for slugs, SKUs, order numbers, payout idempotency, payment provider IDs and webhook event IDs.

### 2.3 Data-relation fixes and invariants

- Validate Raw Product → Views → Colors/Sizes → Variants → Variant Assets as a complete graph.
- Require a background for every existing Raw Product View; overlay remains optional; mockup requirements must match front/back configuration.
- Verify Seller Design Views match the selected Raw Product Views and preserve independent front/back canvas documents.
- Ensure Seller Product variants reference only variants selected in their Design.
- Ensure Supplier Offers and Supplier Offer Variants belong to the same Raw Product and supported color/size combinations.
- Prevent Buyer checkout when any selected variant lacks an active eligible Supplier.
- Assign fulfilments transactionally and store both current assignment and historical assignment events.
- Prevent an order, fulfilment, earning or payout from being counted twice.
- Reconcile earnings to completed fulfilment/order items rather than mutable product values.
- Ensure payout completion atomically records receipt/history, locks included earnings and updates available balance.

### 2.4 Functions, triggers and transactional commands

- Review and harden checkout/order creation, Supplier routing, status transition, earning creation, payout request/completion, moderation, AI-credit use and ticket commands.
- Require idempotency keys for checkout, payment confirmation, fulfilment status changes, payout operations and external webhook handling.
- Lock relevant rows using appropriate transaction isolation to prevent overselling and duplicate payout.
- Add database-enforced allowed-transition checks for all state machines.
- Ensure scheduled Sent → Done processing is idempotent, excludes returned/cancelled/disputed fulfilments and records an event.
- Add updated-at triggers consistently and immutable audit triggers for high-risk financial/admin actions.
- Validate all `security definer` functions: fixed `search_path`, minimal grants, explicit authorization and safe dynamic SQL.

### 2.5 Authentication, profiles and RLS

- Use Supabase Auth UUIDs as the only identity source.
- Verify Buyer, Seller, Supplier and Admin profiles and memberships cannot drift from Auth users.
- Replace the static Admin password and 24-hour workaround with real Admin authentication, MFA and role-based authorization before production.
- Enable RLS on every user-accessible table and add explicit policies for SELECT, INSERT, UPDATE and DELETE.
- Test organization isolation: one Seller/Supplier must never read or mutate another organization’s private records.
- Keep service-role operations server-only and ensure its key is never bundled into client JavaScript.
- Add rate limiting and abuse controls for authentication, tickets, reels, likes/saves, AI generation, checkout and public search.
- Add account suspension, session revocation, data export and deletion/anonymization workflows.

### 2.6 Storage and file integrity

- Verify all eight buckets, size limits, MIME allowlists and public/private choices.
- Keep private design files, printable exports, payout receipts, ticket attachments and raw assets behind signed URLs.
- Use public URLs only for intentionally public product/store media.
- Add image optimization, metadata extraction, checksum/deduplication and orphan-file cleanup.
- Add malware scanning/quarantine for attachments and uploaded source files.
- Validate file ownership in both Storage policies and `storage_files`.
- Prevent database metadata from claiming `READY` until upload completion is verified.
- Add lifecycle/retention policies for abandoned design uploads and temporary AI/mockup files.

### 2.7 Migrations, seeds and data repair

- Make every migration forward-only, transactional where possible and safe on staging data.
- Add preflight checks and explicit rollback/roll-forward procedures for destructive changes.
- Regenerate TypeScript database types after every schema change.
- Keep seed execution idempotent and environment-gated; never create demo accounts in production.
- Add data-repair scripts for orphaned Storage metadata, missing variant assets, broken memberships and ledger mismatches.
- Run schema drift detection in CI against a freshly migrated database.

### Section 2 deliverables

- Complete migrations and updated schema documentation.
- Updated generated TypeScript types.
- RLS and Storage policy test suite.
- Database invariant and transaction test suite.
- Idempotent seed and data-repair tooling.

### Section 2 exit gate

- A clean Supabase project can be migrated and seeded from zero, all relational invariants pass, and cross-tenant or unauthorized access tests return no leaks.

---

## 3. Application workflows, integrations and complete user experience

### 3.1 Buyer marketplace

- Complete database-backed homepage banners, categories, subcategories, stores/products, best sellers, graphic styles and reels.
- Add deterministic pagination/cursors and avoid loading unbounded homepage or similar-product lists.
- Finish search, category, subcategory and store filtering with URL-synchronized filters, valid indexes and SEO canonical rules.
- Verify product pages support images, optional videos, front/back mockups, available variants, reviews, details and related-product sections.
- Make cart persistent across anonymous/authenticated sessions and define merge behavior after login.
- Finish checkout validation, addresses, shipping quote/rules, payment handoff and transactional order creation.
- Add payment success, failure, retry, cancellation, refund, return and dispute experiences.
- Ensure order-status pages derive from real event histories and never expose inappropriate customer/Supplier data.
- Complete saved, liked, recent, reels and account privacy controls.

### 3.2 Seller acquisition, onboarding and store

- Verify Seller registration/login, field-level validation, resumable multi-step state and media upload.
- Prevent duplicate stores and ensure failed registration never leaves inconsistent Auth/profile/organization data.
- Complete editable Store profile, logo, banner, colors, description and exclusive-store activation.
- Implement subdomain/domain provisioning, DNS verification, uniqueness, reserved-slug protection and fallback behavior.
- Ensure exclusive storefronts use only that Seller’s published purchasable products.
- Finish shareable store card/modal with safe screenshot behavior and real store data.
- Complete bank-account CRUD, priority ordering, ownership checks and masked financial display.

### 3.3 Seller product lifecycle and design editor

- Allow product design without an existing Supplier, while clearly marking unavailable variants.
- Verify category → Raw Product → design editor → colors/sizes → mockup → details → Supplier selection → moderation workflow.
- Preserve draft progress at every step and resume at the correct step after refresh.
- Finish editor selection, text/image tools, layers, undo/redo, view/color switching, local Persian fonts and export fidelity.
- Validate printable bounds, canvas document versions and front/back exports.
- Implement AI-image credit reservation/use/refund transactionally; never expose the OpenAI key to clients.
- Complete mockup generation for both front and back and store generation inputs/results/audit metadata.
- Allow later Supplier assignment/reassignment and move variants between `OUT_OF_STOCK` and `ACTIVE`.
- Finish product edit, CSV export, moderation state, rejection reason and resubmission behavior.

### 3.4 Supplier workflows

- Verify Supplier registration, company/profile information, facilities and bank accounts.
- Complete Raw Product offer selection with supported variants, cost, lead time, daily capacity and approval history.
- Show only appropriately assigned unfinished fulfilments, oldest first, with downloadable signed printable files.
- Validate “I Sent” tracking-code rules and create Shipment/status events atomically.
- Implement exceptions: cannot supply, damaged print, reprint, cancellation, return and dispute escalation.
- Show Supplier earnings, available/pending balance, payout requests and history from the immutable ledger.
- Add capacity/availability controls so routing does not assign unavailable production.

### 3.5 Admin control plane

- Replace temporary authentication with production Admin Auth and MFA.
- Complete Raw Product CRUD including current image previews, front/back configuration, variants, assets and safe archive confirmation.
- Add Supplier management, offer approval, Seller/Store moderation and assignment repair tools.
- Complete pending-product preview, approval/rejection, database-managed reasons and notification outbox.
- Finish unfinished-order operations, fulfilment reassignment and exception handling.
- Complete payout review, included-order inspection, receipt upload and atomic “Mark as Paid”.
- Add editable tutorials, rejection reasons, SMS templates, banners, categories and operational settings.
- Add audit-event views and require confirmation/re-authentication for high-risk actions.

### 3.6 Tickets, tutorials, content and notifications

- Finish ticket creation, conversation, attachment, unread state, assignment, priority, internal notes and closure/reopen behavior for all roles.
- Add pagination and real-time or efficient polling without full-dashboard reloads.
- Require tutorial thumbnail, keep video/file optional and store Seller completion progress.
- Load the five comprehensive Seller tutorials from Supabase, not hardcoded components.
- Implement SMS/email providers through an outbox worker with templates, retries and delivery status.
- Connect transactional notifications to registration, moderation, order, shipment, payout, ticket and password-security events.

### 3.7 Cross-cutting UX and frontend quality

- Use immediate route transitions and route-level skeletons; never block navigation while data loads.
- Standardize saving overlays, optimistic updates where safe and specific recoverable error messages.
- Preserve user input on validation/network errors.
- Use `next/image` or an approved loader for stable public images; use signed URLs safely for private media.
- Audit keyboard navigation, focus trapping, reduced motion, contrast, touch target size and screen-reader names.
- Verify Persian number/date/currency formatting and RTL layout without corrupting URLs, IDs, emails or tracking codes.
- Add error boundaries per dashboard section so one failed query does not blank the entire dashboard.

### Section 3 deliverables

- Completed role-based workflows with acceptance criteria.
- Integration adapters for payment, SMS, email, AI, shipping and domain provisioning.
- No production page dependent on component-local mock arrays.
- Complete loading, empty, error and retry states.

### Section 3 exit gate

- A Buyer, Seller, Supplier and Admin can each complete their launch-critical journey against Supabase with correct permissions and persistent data.

---

## 4. Test, debug, security and performance program

### 4.1 Automated test pyramid

- Add unit tests for pricing, commissions, balance calculations, routing scores, validation, status transitions and URL generation.
- Add database tests for constraints, triggers, RPC authorization, idempotency and concurrency.
- Add RLS tests for every role/table/action, including negative cross-tenant cases.
- Add Storage-policy tests for public, private, signed, unauthorized, wrong-owner and invalid-MIME access.
- Add component tests for all multi-step forms, validation retention, dashboards, modals and editor controls.
- Add Playwright end-to-end tests for Buyer, Seller, Supplier and Admin critical paths.
- Run tests against a disposable, freshly migrated and seeded Supabase environment.

### 4.2 Required end-to-end scenarios

- Buyer: discovery → filter → product → variant → cart → checkout → payment result → order tracking.
- Seller: register/login → Store → design front/back → save draft → resume → publish → rejection/resubmit → approval.
- Seller without Supplier: design and create succeeds, variant is unavailable, checkout is blocked, later assignment activates it.
- Supplier: register → offer variants → receive fulfilment → download files → mark sent → automatic Done.
- Admin: login/MFA → edit Raw Product assets → moderate product → handle order exception → complete payout.
- Support: create ticket with attachment → reply across roles → unread/read → close/reopen.
- Finance: concurrent payout requests, duplicate webhook, repeated “Mark as Paid” and ledger reconciliation.

### 4.3 Debug and fault-injection plan

- Simulate Supabase timeout, REST failure, PostgreSQL connection exhaustion, Storage reset and expired signed URLs.
- Simulate interrupted uploads and verify no false success or orphan `READY` metadata.
- Simulate duplicate submits, browser refresh, back navigation and two-tab editing.
- Simulate payment webhook delay, duplication, invalid signature and out-of-order events.
- Simulate Supplier cancellation after assignment and verify reassignment or escalation.
- Simulate cron retries and prove Sent fulfilments are completed only once.
- Capture client/server/RPC correlation IDs so one action can be traced end-to-end without exposing secrets.

### 4.4 Security verification

- Rotate every credential ever shared in chat or committed locally: Firebase service account, Supabase secret, database URL/password and OpenAI API key.
- Run dependency audit and manually triage all high-severity findings without unsafe forced upgrades.
- Run static analysis, secret scanning, authorization review and dependency/license checks in CI.
- Test CSRF assumptions, XSS in product/ticket/store content, SQL injection, IDOR, upload abuse and open redirects.
- Add security headers, CSP, HSTS in production, secure cookies and strict origin/domain configuration.
- Redact secrets, tokens, customer addresses, bank details and file signatures from logs.

### 4.5 Performance and reliability testing

- Profile slow Server Actions and remove unnecessary full-dashboard refreshes.
- Add query budgets and inspect PostgreSQL execution plans for homepage, search, dashboards, orders and finance.
- Verify indexes under production-like cardinality, not only seed data.
- Load test public catalog, authentication, checkout, ticketing and dashboard navigation.
- Test file upload at slow and unstable network speeds; enforce client optimization and resumability where appropriate.
- Add caching/revalidation rules that never leak private or cross-tenant data.
- Test mobile performance and memory behavior of reels and the canvas editor.

### 4.6 Observability and reconciliation

- Add structured server logs, request/action IDs and environment/release identifiers.
- Add error monitoring, performance traces, uptime checks and alerting.
- Add dashboards for checkout failure, webhook backlog, notification failures, unassigned fulfilments, overdue shipments and payout anomalies.
- Add scheduled reconciliation for orders/payments, fulfilments/earnings and payouts/ledger totals.
- Create runbooks for authentication outage, Supabase outage, Storage outage, payment mismatch and leaked credential.

### Section 4 deliverables

- CI test suites and reports.
- Security review and credential-rotation record.
- Performance baseline and resolved critical bottlenecks.
- Monitoring dashboards, alerts and incident runbooks.

### Section 4 exit gate

- All critical E2E, RLS, transaction, security and recovery tests pass; no unresolved critical/high launch defect remains.

---

## 5. Deployment, operations and launch readiness

### 5.1 Environment separation

- Create isolated local, test, staging and production Supabase projects.
- Create separate Auth settings, OAuth providers, redirect URLs, Storage buckets, secrets and third-party credentials per environment.
- Configure only public variables with `NEXT_PUBLIC_`; keep all privileged keys server-side.
- Validate Authorized Domains, Site URL, redirect allowlist, SMTP, password recovery and session settings.
- Establish production DNS, SSL, exclusive-store subdomain wildcard and custom-domain process.

### 5.2 CI/CD pipeline

- On every pull request run install, generated-type drift check, TypeScript, lint, unit tests, database tests and production build.
- On protected deployment run migration preflight, backup verification, migrations, smoke tests and release health checks.
- Require approval for production database migrations and secret changes.
- Deploy immutable build artifacts and record commit, migration version and release identifier.
- Support roll-forward and application rollback; never rely on destructive database rollback as the primary recovery method.

### 5.3 Production data and infrastructure safety

- Enable automated database backups and perform a real restore drill.
- Define Storage backup/retention requirements for printable designs, receipts and support attachments.
- Configure connection pooling, statement timeouts, database resource alerts and plan capacity.
- Disable seed/demo execution in production and remove demo login accounts.
- Configure cron/Edge Function scheduling with authentication, retries, monitoring and dead-letter handling.
- Add retention/anonymization jobs and legal/audit retention rules.

### 5.4 Pre-launch checklist

- Rotate all exposed/development secrets and revoke old credentials.
- Replace static Admin access with production authentication and MFA.
- Connect and verify production payment, SMS/email, shipping and AI providers.
- Verify Terms, Privacy, Support contact, refund/return rules and Seller/Supplier agreements.
- Validate SEO metadata, sitemap, robots rules, structured data, canonical URLs and social previews.
- Verify analytics consent, production events and funnel dashboards.
- Test production-domain Auth, private files, uploads, webhooks, cron, email/SMS and custom storefront routing.
- Complete accessibility, responsive, browser and device matrix.
- Freeze launch migrations and run the full staging dress rehearsal from backup through deployment.

### 5.5 Launch and post-launch operation

- Use a controlled soft launch with internal accounts and a limited Seller/Supplier cohort.
- Monitor errors, latency, checkout, fulfilment assignment, notification queues and balances continuously during launch.
- Define rollback/feature-disable criteria and an on-call owner for each subsystem.
- Reconcile all first-day orders, fulfilments, earnings and payout eligibility manually against database records.
- Review incidents and user feedback daily during the stabilization window.
- Only widen access after reliability, conversion and operational-support targets hold.

### Final production definition of done

- Fresh infrastructure can be provisioned from documented configuration and migrations.
- No secret or privileged credential is present in client bundles, repository history or logs.
- All four roles complete their critical workflows with database-enforced authorization.
- Payment, fulfilment, earning and payout records reconcile exactly.
- Private files require valid authorization or signed URLs.
- Every page has tested loading, empty, error and permission states.
- Monitoring detects failures before users must report them.
- Backup restoration, application rollback and incident runbooks have been exercised.
- Production smoke tests pass on the real domain after deployment.
- The release owner signs off the database, security, operations, product and support gates.

## Recommended execution order

1. Section 1 audit and launch decisions.
2. Section 2 schema/security corrections and regenerated types.
3. Section 3 workflow completion against the corrected backend.
4. Section 4 automated tests, fault injection and remediation.
5. Section 5 staging rehearsal, credential rotation and controlled production launch.

