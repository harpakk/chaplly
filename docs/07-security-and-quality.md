# Security, Privacy, and Quality

## Security baseline

- MFA required for admins and strongly encouraged/required for organization owners and finance roles.
- Step-up authentication for payout changes, large refunds, API credential changes, ownership transfer, and sensitive exports.
- Short-lived sessions/tokens, rotation, revocation, device/session visibility.
- Passwords hashed with a modern memory-hard algorithm; breached-password checks.
- Secrets stored in managed secret storage and never in source, logs, analytics, or client bundles.
- TLS in transit and encryption at rest.
- Strict authorization at server boundaries; UI hiding is not authorization.
- CSRF, XSS, SSRF, SQL injection, path traversal, unsafe file, and webhook replay defenses.
- Rate limiting and abuse detection by identity, tenant, IP/device signal, and operation.
- Dependency, container, and infrastructure scanning with patch policy.

## Payment and payout safety

- Use provider-hosted/tokenized payment entry to minimize card-data scope.
- Verify webhook signatures and timestamps; store/reject replay identifiers.
- Idempotent capture, refund, and payout operations.
- Payout beneficiary changes trigger step-up auth, notifications, and configurable cooling period.
- Separate operational permissions from ledger adjustment and payout approval.
- Reconcile provider settlements before releasing uncertain funds.

## File safety

- Allowlisted file types verified by content, not extension.
- Malware scan and decompression-bomb limits.
- Pixel, memory, file-size, page-count, and processing-time limits.
- Isolated rendering without network or ambient credentials.
- Sanitize SVG/PDF and metadata; do not execute embedded scripts/fonts.
- Signed, short-lived production-file access with access audit.

## Privacy

- Data inventory maps purpose, owner, legal basis, retention, processor, and region.
- Collect the minimum buyer data required for fulfilment.
- Supplier receives only fulfilment-specific information.
- Separate transactional messaging from marketing consent.
- Support access is role-limited and sensitive fields are masked.
- Provide access/export, correction, consent history, deletion/anonymization, and legal-hold workflows.
- Analytics identifiers and advertising pixels follow consent requirements.
- Vendor contracts and transfer/hosting rules depend on launch geography.

## Threats requiring explicit tests

- Cross-store and cross-organization data leakage.
- Host-header/domain takeover exposing the wrong storefront.
- Price, discount, shipping, tax, or variant tampering.
- Duplicate order/payment/refund/payout from retries.
- Production artifact substitution after approval.
- Supplier downloading unrelated buyer/artwork data.
- Stored XSS in product/CMS/review content.
- Malicious SVG/PDF/font/image upload.
- Fraudulent review, coupon abuse, account takeover, payout redirection.
- Admin/support privilege abuse and unlogged impersonation.

## Reliability targets

Initial proposed targets, to be refined:

- Public browsing monthly availability: 99.9%.
- Checkout/order commands: 99.95% once at scale.
- No acknowledged order without a recoverable payment/order record.
- Recovery point objective: 15 minutes for transactional data.
- Recovery time objective: 4 hours initially.
- Queue-age alerts before operational SLAs are breached.
- All money and order-changing endpoints idempotent.

## Performance targets

- Core Web Vitals in “good” range for representative mobile storefront traffic.
- Cached storefront/marketplace pages respond quickly from target geography.
- Portal list/filter actions provide feedback within two seconds under normal load.
- Editor interaction remains responsive; heavy rendering occurs asynchronously.
- Uploads are resumable for large artwork and tolerate low-bandwidth networks.

## Accessibility and localization

- Target WCAG 2.2 AA.
- Full keyboard operation and visible focus.
- Semantic headings/forms/tables and accessible status announcements.
- Contrast-compliant themes and alt text workflow.
- RTL and LTR are layout directions, not separate applications.
- Externalize strings; support pluralization, localized digits, calendars, date/time, units, addresses, and currencies.
- Never concatenate translated fragments.

## Test strategy

- Unit tests for pricing, state transitions, permissions, and ledger rules.
- Database/integration tests for constraints, transactions, outbox, and idempotency.
- Contract tests for provider adapters and webhooks.
- End-to-end golden paths for every role.
- Cross-tenant authorization test matrix.
- Snapshot/reference tests for production rendering.
- Property-based tests for balanced journals and money rounding.
- Load tests for launches, checkout, jobs, search, uploads, and tracking bursts.
- Accessibility automation plus manual screen-reader/keyboard review.
- Disaster-recovery and reconciliation drills.

## Release gates

No production launch without:

- Threat model and critical findings resolved.
- Restore test and rollback path.
- Balanced ledger/reconciliation tests.
- Tenant isolation tests.
- Payment/refund/payout idempotency tests.
- Production-file integrity test.
- Legal pages, privacy controls, and operational ownership.
- Monitoring, alerts, runbooks, and an incident process.
