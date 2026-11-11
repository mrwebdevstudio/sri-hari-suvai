# Sri Hari Suvai development integration

Verified on 10 November 2026 against [the dedicated development project](https://supabase.com/dashboard/project/uqgnxezgpqacfyaijojk). Project `sri-hari-suvai`, ref `uqgnxezgpqacfyaijojk`, belongs to `mrwebdevstudio's Org` in Mumbai (`ap-south-1`). The organization listed no projects before provisioning. Supabase quoted $0/month on Free and returned active, healthy PostgreSQL 17.11. The historical temporary backend was not accessed.

**Development backend and permanent administrator activated.** The configured server secret authenticated against the dedicated project. Staff browser operations and customer sessions passed. The owner confirmed invitation delivery, private password setup and direct access to `/admin`. Online checkout and order notifications remain disabled.

## Integration inventory

| Subsystem | Discovered state | Development result |
|---|---|---|
| Catalogue and product detail | Existing Supabase reader, bundled preview data, stale local project reference | Embedded query for products, variants and primary media. Cache is scoped to project URL. A configured outage does not substitute preview prices. |
| Catalogue source | Four existing seed migrations and a separate two-page price-list PDF | Compared both PDF pages with the live API. Exactly 10 Instant Mix and 6 Direct Mix products, each with 100, 250, 500 and 1,000 g variants. All 64 prices match. Corrected “Vendhya Kuahambu Podi” while preserving its published slug. |
| Product media and admin | Local images and existing edit forms. Draft creation and uploads were missing. | All 16 original photos are in the private `product-images` bucket and match local source bytes through the application route. Existing admin forms support draft creation with four prices, immutable upload, replacement and removal. Anonymous access requires an active product linked to that object. |
| Auth and account | Supabase SSR signup, login, logout, recovery, callbacks, profile, addresses and orders were present | Email signup enabled and confirmation required. Two disposable confirmed customer fixtures passed real hosted password login, refresh and sign-out. The browser preserved the session through reload. Profile, address, cart and order isolation passed. Real signup confirmation and recovery links subsequently passed browser verification, including updating the password, rejecting the old password and rejecting a replayed token. The email-sending forms returned errors for non-deliverable test addresses. Inbox delivery remains unverified. |
| Cart | Browser local storage only | Guests retain local carts. Signed-in carts use the customer's Supabase session. A per-cart row lock serializes mutations. A unique import receipt makes login reconciliation retry-safe. |
| Checkout and inventory | Server-side price checks, idempotent order creation and stock deduction at capture existed. No pending-order hold. | Finished packs are identified by stable variant UUIDs. SQL rechecks checkout approval, shipping, service area, totals, active packs, prices and quantities. Holds and order snapshots commit together. No stock quantities were seeded. |
| Payments and tracking | Razorpay routes, signed webhooks, refund events, customer order history and guest tracking existed | Existing Next.js routes are the payment boundary. Callback verification also checks provider order, captured state, amount and INR. Database events handle duplicate and delayed messages and refund identity. Guest tracking requires order number and phone, and the confirmation page uses a signed, expiring receipt. |
| Administration | Role-protected dashboard, catalogue, inventory, orders, analytics, audit and store settings existed | Added an authorization check inside privileged read helpers. Product and inventory mutations and the settings API use audited database transactions. Exercised database privileges, admin mutations and actual staff-only Storage upload. A disposable operator opened all seven admin pages and completed a draft product image upload, replacement and removal in the browser. Customer administration beyond the existing order/account views has no existing screen. |
| Operations | Existing optional email webhook, called after a database write | Database triggers enqueue approved order, payment and fulfilment notices transactionally. The hook claims each notice and sends its stable idempotency key. Failed or ambiguous delivery is retained for reconciliation. No messages were sent. |

The stack is Next.js 16.3.7, React 19.2.7, TypeScript, `@supabase/ssr` 0.12.0 and `@supabase/supabase-js` 2.110.2. No CSS or visual redesign was introduced. The source PDF SHA-256 is `337937cdf918556c66dc917847d68e4f37ebb9031a2f296329b3e1de116d5638`.

## Schema and migrations

There are 18 public tables, all with RLS. Catalogue uses `categories`, `products`, `product_variants`, `product_images`. Customers and shopping use `profiles`, `addresses`, `carts`, `cart_items`, plus private `shs_private.cart_imports`. Commerce uses `orders`, `order_items`, `order_status_history`, `payment_events`, `inventory_adjustments`, `inventory_payment_applications` and `inventory_reservations`. Administration and operations use `audit_logs`, `store_settings` and `notification_outbox`.

Order lines snapshot product, slug, weight, price, quantity and line total. Orders snapshot delivery address, subtotal, shipping, tax, discount, total and INR in integer paise. Verified payment and refund history share the payment-event ledger. Shipping rules and the low-stock threshold live in store settings. No storefront feature requires wishlists, coupons or separate customer-preference tables.

The following migration versions were applied. The connector initially assigned execution timestamps. They were aligned to the repository versions after matching the stored SQL text to each local migration. Use these files in order for a new environment.

| Version | Migration |
|---|---|
| 20260710170000 | sprint_2_commerce |
| 20260710230000 | sprint_3_operations |
| 20260805090000 | sprint_4_validation_hardening |
| 20260929100200 | sprint_1_payment_event_safety |
| 20261110161708 | dedicated_dev_backend |
| 20261110161939 | product_media |
| 20261110161942 | customer_cart |
| 20261110161945 | inventory_holds |
| 20261110161948 | order_outbox |
| 20261110163310 | guarded_store_settings |
| 20261110163636 | catalogue_read_policies |
| 20261110164041 | admin_media_staging |
| 20261110164119 | validate_staged_object_owner |
| 20261110164950 | atomic_checkout_rules |
| 20261110171021 | staff_product_image_reads |
| 20261110173321 | single_store_administrator |
| 20261110173820 | complete_owner_password_setup |

## Verification and security

- The hosted anonymous API returned every expected variant. All 16 published photos decoded or matched their original checksums. An unpublished staged photo could not be downloaded anonymously. An anonymous upload was rejected by Storage RLS. The bucket limits objects to 4 MiB and PNG, JPEG or WebP. Staff uploads also check file signatures and receive new object names. Replacements publish the binding before removing the old file. If a network error leaves an unlinked object, reconcile it against current bindings before cleanup.
- Two real customer Auth sessions could access only their own carts. Replaying a guest import did not double quantities. Concurrent cart additions both survived. Browser QA covered guest add, SSR login, merge, reload, protected account page, denied admin page, logout and both catalogue ranges. Confirmed fixtures were provisioned for testing without sending email and were deleted afterward.
- The hosted rollback suite covers role spoofing through editable user metadata, cross-account reads and writes, unauthorized staff RPCs, admin draft/variant operations, image binding replacement, audit records, checkout disabled, stale totals, duplicate checkout, last-pack contention and notice claims. An independent two-session database check showed the second checkout blocked on the same locked variant. No order, payment, reservation, notification, user or stock fixture remained.
- Local automated tests include replaying the complete migration chain in PostgreSQL via PGlite, invalid HMAC, unsigned or mismatched captures, duplicate captures, delayed failures, partial/full refunds, repeated refund IDs and over-refunds. Production build, TypeScript and lint were checked. These tests did not contact Razorpay or execute a live financial transaction.
- Final database advisors reported no database security findings or performance warnings. Informational unused indexes are expected on the empty order tables. The resumed security advisor run reported one Auth warning for disabled leaked-password protection. [Supabase documents this as a Pro feature](https://supabase.com/docs/guides/auth/password-security). The organization stayed on Free. A hosted catalogue query plan returned the expected 40 Instant Mix variant rows. This was a correctness check, not a load test.
- Realtime, new Edge Functions and scheduled jobs were not enabled. Existing server routes own order and provider processing. A reservation has no implicit expiry. Capture consumes its hold once. Failure, cancellation and refund do not automatically return stock. No scheduled dispatcher silently retries notifications with an uncertain delivery outcome.

## Server credential acceptance — 10 November 2026

| Area | Status | Evidence |
|---|---|---|
| Credential and SDK compatibility | PASS | Auth Admin user listing, protected database access and privileged image mutations succeeded with the opaque modern key. The application passes it directly to the SDK and uses an independent server client without persisted sessions. |
| Secret containment | PASS | Next enforces the server-only import boundary and rejects secrets placed in public environment variables. Nested log values are redacted. The configured key and common encodings were absent from the checked workspace, Git index, release static assets, prerendered responses and checked logs. Browser traffic and console samples showed no configured secret. |
| Least privilege | PASS | Customer sessions use cookie-backed RLS for accounts, carts and own-order receipts. Staff catalogue, draft previews, order lists, metrics, inventory and audit reads use the verified staff session where column permissions permit. Private order detail, protected settings, audited staff mutations, signed receipt/tracking access and financial integration retain narrowly scoped server calls. |
| Admin and media | PASS | Customer requests to protected settings and media received 403. Staff uploaded a draft PNG, read back identical bytes, replaced it, and removed it. Invalid image content was rejected. The displaced and deleted objects disappeared from Storage. Three image mutations were audited. |
| Browser Auth | PASS for confirmation, session and password recovery; PARTIAL for mail | Both GoTrue action links and the server-side token-hash callback worked. Confirmed sessions survived reload. A reset accepted the new password, rejected the old one, and rejected reuse of the recovery token. The tests used generated links without collecting customer mail. A controlled test inbox is needed to verify delivery from the public signup and forgot-password forms. |
| Catalogue, stock and carts | PASS | All 16 products and their 64 pack prices matched the PDF. The complete published catalogue, bindings, inventory counts and holds matched before and after. Guest items merged once and persisted after reload. Signed-out cart API access returned 401. |
| Regression and advisors | PASS for regression; PARTIAL for the Auth warning | 41 automated tests passed, including credential redaction and public-env rejection. Lint and the release build with TypeScript passed. The security advisor reported disabled leaked-password protection on Free. |
| Operational scope | PASS | Removed the test draft and temporary objects. Verified 16 published bindings and 16 Storage objects, zero active test users, zero staff roles, zero orders and zero payment events. Checkout stayed off. No production or payment-provider operations were executed. |

Password login reads the signed-in user's profile role. The default destination is `/admin` for the administrator and `/account/profile` for a customer. Browser form tests with isolated Auth and profile fixtures verified both destinations through the storefront account link.

## Sprint 5 commerce checkpoint — 11 November 2026

The dedicated Mumbai development database has 16 published products and 64 variants. Before and after checks matched every variant ID, price, stock count, tracking flag and reserved quantity. Hosted orders, payment events and reservations were all zero. Storefront checkout, policy approval and order notifications are off.

| Area | Classification | Evidence |
|---|---|---|
| Pricing and shipping | Implemented and verified | Dispatch originates in Chennai. The database checks a courier-approved Indian PIN and recomputes the quote under a settings lock. Exactly ₹2,000 incurs the configured fee. ₹2,000.01 qualifies for free shipping. The threshold is 200,000 paise, the fee is unset and the PIN list is empty. Pack prices and all quote components must agree with the submitted review. The order stores INR amounts and the pricing rules used. |
| Tax and discounts | Implemented and verified with fixtures; tax treatment requires a business decision | Discount mode is explicitly `none`. Tax mode and registration fields are unset. Local fixtures exercised an explicitly selected single tax rate in basis points, with shipping optionally taxable, rounded half up once per order to a paise. Inclusive or mixed HSN rates require the applicable rules and further implementation. A legacy total constraint that ignored tax and discount was removed. |
| Finished-pack stock and fulfilment | Implemented and verified | New orders require tracked stock per variant. No starting quantities were entered. Two independent PostgreSQL connections competed for the last pack. Replay, rollback, signed capture, manual release, delayed capture, reconciliation, partial/full refund, cancellation and duplicate fulfilment updates were tested. Release records the actor, reason, order, variants and quantities. |
| Payment provider | Implemented locally; provider verification blocked by external credentials | The gateway adapter uses timeouts and the unique order receipt to recover from interrupted initialization. Callback verification checks the fetched payment ID, order ID, captured state, amount and INR. Signed webhook evidence is validated before state changes. A missing order association returns 503 so the provider can retry. An interrupted initialization alone does not mark a payment failed. The checkout attempt key survives a tab reload. |
| Bulk enquiries | Implemented and verified | The existing contact page uses the two approved WhatsApp numbers, official email and Instagram. Following an enquiry link creates no order, stock movement or price commitment. |

The three applied migrations are `20261111065542_checkout_pricing_controls`, `20261111065545_manual_reservation_reconciliation` and `20261111065712_checkout_admin_rpc_boundaries`. Their recorded SQL matched the repository. The public administration RPCs use invoker privileges and call private functions that check the authenticated UUID and staff profile. The existing administrator can use `configure_checkout_pricing` and `set_store_registrations` while checkout is closed. Enter confirmed GSTIN and FSSAI details only after approval. The production checkout route also requires those fields.

An administrator may explicitly call `release_order_reservations(order_id, reason)` for unpaid holds. A late verified capture after release is recorded as paid, leaves other customers’ stock alone and appears in the audit log as `inventory.capture_review`. For a pending, paid order with available stock and no refunds, `reconcile_captured_inventory(order_id, reason)` allocates once and permits fulfilment. Cancelled or refunded cases require a separate financial decision. No automatic expiry, refund initiation or food restocking is configured.

**Verification.** All 50 automated tests passed with zero skips using a disposable native PostgreSQL cluster for the concurrent checkout test. TypeScript, ESLint, the release build and the staged whitespace check passed. Release HTTP checks returned 503 for disabled checkout, 401 for an invalid webhook signature, 400 for a signed wrong-currency capture and 200 for an ignored signed event. A hosted rollback check rejected all four admin RPCs under an unprivileged authenticated role. The security advisor retained the Free-plan leaked-password warning. The performance advisor returned informational unused-index findings.

To repeat the concurrency test, set `SHS_LOCAL_PG_CONFIG` to a private local JSON connection configuration for a disposable loopback PostgreSQL cluster with database creation privileges. The test creates and drops its own database. Without that fixture, Node explicitly reports the concurrency test as skipped. Provider HTTP tests use an in-process mock. The provider documents the order receipt and its uniqueness requirement in the [Razorpay Orders API](https://razorpay.com/docs/api/orders/create/).

### Decisions and external acceptance

| Decision | Current behaviour and options | Recommendation and blocking effect |
|---|---|---|
| Shipping fee, PIN source and dispatch | Pan-India coverage depends on courier serviceability. A flat fee is missing. An admin-maintained verified list is usable now, with a 500-PIN capacity. A larger courier feed needs an approved carrier and import/integration. Manual booking from Chennai is proposed. Additional weight or zone fees need rules. | Confirm the fee and carrier, verify the first PINs and approve dispatch responsibility. Blocks activation and realistic delivery acceptance. Synthetic shipping tests passed. |
| Registration and tax | GST and FSSAI registrations are pending. No GST is charged by the development store. A professionally confirmed zero-tax decision or a uniform exclusive rate can be configured. Inclusive prices, mixed classifications or different rounding require corresponding calculation and invoice support. Shipping taxability is a separate choice. | Obtain registration details, product HSN/rates, price treatment and shipping tax guidance before entering a policy. Blocks activation and merchant-specific tax acceptance. No discounts or coupons are approved. |
| Stock counts, holds and late payments | Stock is finished packs. The store needs counts per SKU. Manual release retains operator control. Timed expiry or immediate failure/cancellation release returns stock sooner and increases exposure to late capture. A verified late capture is held for allocation or financial review. | Enter counted packs and choose a manual review owner and cadence before defining expiry or automatic release. Blocks stock-backed activation. Local contention testing is complete. |
| Cancellation, refunds and returns | An administrator can record allowed manual transitions. Eligibility, fees, timing and financial resolution are pending. Signed refund events change financial records alone. Automatic restocking could put returned food back on sale. | Approve cancellation/refund eligibility and the returned-food disposition process. Keep refunds and stock adjustments separately authorized. Blocks launch and policy acceptance. |
| Razorpay test acceptance | `COMMERCE_ENVIRONMENT=development` is set locally. The ignored environment lacks `RAZORPAY_KEY_ID` (test mode), `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. An approved reachable sandbox callback is required at `/api/payments/webhook`. | Supply test credentials privately and register the endpoint. Run test order, capture, failure, refund, duplicate and delayed-delivery cases in an isolated fixture. Blocks provider acceptance and activation. |

Before production, address process-local throttling across replicas, aged holds and unresolved receipts, monitoring for webhook 5xx, inventory-review audit events and a reconciliation procedure for events outside provider retry windows. No reconciliation job, external notification delivery or production deployment was enabled.

## Remaining gates

1. **Auth and notifications.** Gmail SMTP delivered the owner invitation. Verify customer signup and recovery emails with an approved test inbox and check their redirect destinations. Configure the approved HTTPS notification endpoint and secret, delivery idempotency, retries and retention before enabling either notification flag.
2. **Production.** Use a separately approved production project and secrets. Verify the signed provider lifecycle and the environment-specific operator permissions before launch. Current request throttling is per application process and must be verified or replaced for a multi-instance production deployment. Validate reporting at production scale, background reconciliation and operational recovery before launch.

Development checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. The rollback acceptance script is `supabase/validation/dev_backend_acceptance.sql`. The media import command is documented at the top of `scripts/import-dev-product-images.mjs` and checks the development project identity. The health endpoint distinguishes database reachability from financial readiness and intentionally returns HTTP 503 while checkout is disabled.
