# Sprint 4: Commerce Activation and End-to-End Validation

Date: 2026-08-05  
Repository: `E:\VPRS\Pathma\Masala\Website\Sri Hari Codex Latest`

## Outcome

**PARTIAL — OWNER-BLOCKED FOR LIVE ACTIVATION.**

The checked-in commerce implementation, migrations, security boundaries, catalogue seed, local API failure modes, automated gates, and unauthenticated browser surfaces were validated. One demonstrated Sprint 3 audit-log constraint defect was corrected through a new additive Sprint 4 migration.

Live Supabase authentication/RLS, database contents, admin operations, Razorpay test payments, webhooks, refunds, inventory decrements, and notification delivery were **not run** because no `.env.local` or process-level provider configuration exists. No Supabase project, Razorpay account, production system, or real financial transaction was accessed.

## Git baseline and scope

- Initial branch: `main`
- Initial commit: `fdc9b47f1099c41cba3663f51532a5db295d4a5d`
- Initial state: clean; `main` matched `origin/main`
- No reset, clean, checkout, commit, push, deploy, secret creation, or external mutation was performed.
- Historical Sprint 2 and Sprint 3 migrations were not edited.
- Sprint 4 adds only:
  - `supabase/migrations/20260805090000_sprint_4_validation_hardening.sql`
  - `supabase/validation/sprint_4_commerce_validation.sql`
  - `tests/sprint4.test.mjs`
  - this report

## Environment and configuration status

Current evidence:

- `.env.local`: absent
- All 12 `.env.example` keys in the current process: absent
- `/api/health`: HTTP `503`, `status=degraded`, `supabaseConfigured=false`, `razorpayConfigured=false`
- No credential values were printed, captured, or written.

### Exact environment checklist

| Variable | Purpose and owner source | Exposure | Current status |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Owner-selected development/staging origin, including scheme. It must match the Supabase Auth Site URL/redirect configuration. | Public | Missing |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Owner-approved business WhatsApp number, including country code. | Public | Missing; owner decision |
| `NEXT_PUBLIC_BUSINESS_EMAIL` | Owner-approved public business email address. | Public | Missing; owner decision |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL from the project Connect dialog or **Project Settings → API**. | Public | Missing |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key from the Connect dialog or **Project Settings → API Keys**. | Public; still subject to RLS | Missing |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only Supabase secret/service-role key from **Project Settings → API Keys**. It bypasses RLS and must stay only in the server environment. | Secret, server-only | Missing |
| `RAZORPAY_KEY_ID` | Razorpay **Test Mode** key ID from **Account & Settings → API Keys**. | Returned to Checkout by the server; not a credential secret | Missing |
| `RAZORPAY_KEY_SECRET` | Razorpay **Test Mode** key secret generated with the key ID. Razorpay shows/downloads it at generation time. | Secret, server-only | Missing |
| `RAZORPAY_WEBHOOK_SECRET` | Owner-created secret entered when configuring the Razorpay **Test Mode** webhook. It is separate from the API key secret. | Secret, server-only | Missing |
| `EMAIL_WEBHOOK_URL` | Optional HTTPS endpoint supplied by the owner's email/notification service. | Server configuration | Missing; owner/provider decision |
| `EMAIL_WEBHOOK_SECRET` | Optional bearer secret agreed with the email webhook receiver. | Secret, server-only | Missing |
| `APP_VERSION` | Owner-selected build/version identifier when the hosting platform does not provide `VERCEL_GIT_COMMIT_SHA`. | Server configuration | Missing; optional locally |

Official setup references:

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Razorpay Test and Live modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/)
- [Razorpay API key generation](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/)
- [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/)

### Supabase control-plane checklist

1. Create or select a dedicated **development** Supabase project.
2. Add the three Supabase environment values above to `.env.local`; never prefix the service secret with `NEXT_PUBLIC_`.
3. Set the Supabase Auth Site URL to the exact development origin.
4. Allow the exact development confirmation/reset redirect paths used by the app, including `/auth/confirm`; avoid broad production wildcards.
5. Apply migrations once, in this order:
   1. `20260710170000_sprint_2_commerce.sql`
   2. `20260710230000_sprint_3_operations.sql`
   3. `20260805090000_sprint_4_validation_hardening.sql`
6. Run `supabase/validation/sprint_4_commerce_validation.sql` in the SQL editor and retain its results without secrets or customer PII.
7. Create two ordinary users through normal signup. Create the trusted admin through normal signup, then promote only that known profile to `admin` directly in Supabase after checking its UUID/email.
8. Configure Auth email confirmation and password-reset delivery before testing confirmation/reset links.

## Migration findings

### `20260710170000_sprint_2_commerce.sql`

Source-level result: **PASS for the inspected design; live application not run.**

- Ordering: first migration by timestamp.
- Creates `pgcrypto`, three enums, and nine commerce tables.
- Constraints: UUID primary keys, foreign keys, unique order/payment/idempotency references, integer-paise checks, order-total equality, phone/postal/order-number formats, and line-total equality.
- Indexes: customer addresses, active catalogue, customer orders, phone/status/payment searches, order items/history, and payment events.
- Triggers: updated timestamps, auth-user profile creation, and one-default-address handling.
- RLS: enabled on all nine exposed tables.
- Privileges: customer profile updates are column-limited to `full_name`, `phone`, and `updated_at`; `role` is not customer-writable. Customer/order policies are owner-scoped. Public catalogue/settings reads are explicitly bounded.
- Privileged functions: order creation, payment application, fulfilment, and payment-initialization functions are revoked from `public`, `anon`, and `authenticated`, then granted to `service_role`.
- Seed: exactly 16 products and 64 variants; every database seed weight/price exactly matches `lib/products.ts`; all seeded prices are positive integer paise.
- Initial store setting: checkout disabled and flat shipping unset, which is a safe pre-activation default.

Failure assumptions and risks:

- It is a one-shot migration, not a re-runnable setup script: enum/table/index/trigger creation and seed inserts are intentionally non-idempotent.
- It assumes a clean Supabase schema with `auth.users` and platform roles available.
- A partial manual execution must not be repaired by replaying fragments blindly; use migration history and a clean development project if the initial apply fails.

### `20260710230000_sprint_3_operations.sql`

Source-level result: **PASS with one demonstrated defect fixed additively.**

- Ordering: follows Sprint 2 and depends on its enums/tables/functions.
- Adds packed/out-for-delivery states, catalogue operations, tracked inventory, refund/currency/tracking fields, operational store settings, audit logs, inventory adjustments, and per-order payment-inventory applications.
- Constraints: positive prices, consistent tracked stock, non-negative/refund/discount amounts, INR/Razorpay authority, safe tracking URLs, inventory arithmetic, and bounded operational text.
- Indexes cover catalogue sorting, tracked/low stock, order timestamps/provider IDs, audit searches, and inventory history.
- Append-only triggers reject update/delete on `audit_logs` and `inventory_adjustments`.
- RLS is enabled on all three new tables. Authenticated direct mutations on catalogue, store settings, orders, and history are revoked; operational RPCs remain service-role-only.
- `apply_payment_event` validates amount/currency, deduplicates provider event IDs, locks tracked variants, rejects insufficient stock, decrements stock, records adjustment history, and inserts one `inventory_payment_applications` row per order.
- Partial refunds accumulate in integer paise; only a full refund changes the local payment status to `refunded`.

Demonstrated defect:

- Sprint 3 defined `audit_logs.entity_type` with `check (event_type <> '' and char_length(entity_type) <= 80)`. The wrong column was checked for non-emptiness, so an empty `entity_type` could pass.
- Fixed by `20260805090000_sprint_4_validation_hardening.sql`, which adds `check (char_length(entity_type) between 1 and 80)` without rewriting the historical migration.
- Regression evidence: Sprint 4 test 24 and the read-only database check `audit_entity_type_nonempty`.

Failure assumptions and risks:

- Sprint 3 is additive but not fully re-runnable: new tables/functions/triggers and several constraints are one-shot operations.
- PIN-code shape and primary/WhatsApp phone formats are validated in the server action; the database primarily bounds the PIN array cardinality and text lengths. Configure settings through the audited admin path, not ad hoc client writes.
- Adding the Sprint 4 constraint will correctly fail if a development database already contains empty `entity_type` rows. Inspect and correct those rows explicitly before retrying; do not weaken the constraint.

## Database validation

| Check | Evidence | Result |
|---|---|---|
| 16 products | Source catalogue, migration seed, tests | PASS — local/source |
| 64 variants | Source catalogue, migration seed, tests | PASS — local/source |
| Exact source-to-seed mapping | Parsed all 64 `(slug, weight, paise)` rows and compared to `lib/products.ts` | PASS — local/source |
| Integer paise | Type/check constraints and regression tests | PASS — local/source |
| Active product/variant state | Seed defaults all rows active | PASS — migration seed only |
| Live row counts and active state | Requires migrated development database | BLOCKED |
| Inventory record consistency | DB constraint and read-only validator | SOURCE PASS; live result blocked |
| Store settings row/defaults | Safe seed defaults inspected | PASS — migration seed only |
| Admin profile state | Requires trusted user and explicit promotion | BLOCKED |
| Runtime RLS isolation | Requires user A, user B, and admin sessions | BLOCKED |

The new read-only validator reports catalogue counts, active state, price validity, inventory consistency/history arithmetic, store activation switches, admin presence, RLS coverage, role-column privileges, append-only triggers, audit entity validity, owner settings, inventory summaries, payment decrement applications, and the installed RLS policies. It starts a read-only transaction and rolls back.

## Authentication and RLS findings

Source-level result: **PASS for architecture; runtime matrix blocked.**

- Supabase SSR clients use the public project URL/publishable key and cookie-based sessions.
- The proxy refresh path calls Supabase claims validation and propagates refreshed cookies.
- Server authorization calls `auth.getUser()`; admin authorization also reads `profiles.role` under RLS.
- Signup, login, logout, confirmation, forgot-password, reset-password, profile update, address create/update/delete/default, and account order routes exist.
- Redirect targets are reduced to same-origin paths.
- RLS isolates profiles, addresses, orders, order items, and order history by `auth.uid()`; admin expansion is through `public.is_admin()`.
- The service-role client is created only in server modules. Sprint 4 scans all client components and rejects service-role/Razorpay/email secret references or admin-client creation.
- Public store settings are column-granted; email-hook flags and other operational-only fields are not publicly selected.

Not proven without credentials:

- signup/email confirmation/login/logout
- forgot/reset password email and PKCE session handoff
- profile and address persistence
- customer A versus customer B reads/writes
- ordinary-user denial of admin data
- admin operational access
- browser/client inability to invoke service-only RPCs against the real project

## Store settings status

No business value was invented. Source defaults are safe but not commerce-ready:

| Setting | Source default | Required owner decision |
|---|---:|---|
| Checkout enabled | `false` | Enable only after all shipping/payment checks pass |
| Product ordering enabled | `true` | Confirm |
| Guest checkout enabled | `true` | Confirm policy |
| Flat shipping | `null` | Set integer paise amount, including zero only if intentional |
| Free-shipping threshold | `null` | Set or explicitly leave disabled |
| Serviceable PIN codes | `null` | Provide six-digit PIN list or explicitly accept unrestricted serviceability |
| Low-stock threshold | `null` | Set after inventory policy is chosen |
| Business phones/WhatsApp/address | `null` | Provide approved values |
| Shipping notice | `null` | Provide approved copy or explicitly leave blank |
| Maintenance notice | `null` | Provide current notice or explicitly leave blank |
| Order/shipping email hooks | `false` | Enable only after endpoint delivery is verified |
| Policies approved | `false` | Owner/legal decision; no policy content is generated by the app |

## Checkout and payment findings

Source-level result: **defences present; no live Razorpay PASS claim.**

Verified from source/tests:

- Cart items are normalized and reloaded from the database by slug/weight.
- Product and variant active state, tracked stock, subtotal, shipping, free-shipping threshold, serviceable PINs, and grand total are server-authoritative.
- Client totals are not trusted.
- The checkout idempotency key is a UUID with a unique database constraint.
- Payment initialization uses a database claim/finalize token to block concurrent initialization.
- Checkout signature verification uses exact timing-safe HMAC comparison.
- The server fetches the Razorpay payment and verifies provider order ID, amount, currency, and captured state before marking paid.
- Webhooks verify the raw-body signature before parsing/processing.
- Provider event IDs are unique; duplicate webhook delivery returns a duplicate result without repeating inventory effects.
- Amount/currency mismatches are rejected in both the route and database function.
- Failed payment cannot overwrite paid/refunded state.
- Refund events accumulate and cannot exceed the paid grand total.

Local failure-mode HTTP evidence:

- `/api/checkout` with an invalid body: HTTP `400`
- `/api/orders/track` with invalid identifiers: HTTP `404` with non-enumerating copy
- `/api/payments/verify` with incomplete details: HTTP `400`
- `/api/payments/webhook` without configuration: HTTP `503`

Live test matrix status:

| Scenario | Status |
|---|---|
| Successful Razorpay test checkout | BLOCKED |
| Checkout signature verification | BLOCKED; source/test only |
| Razorpay/local order reconciliation | BLOCKED |
| Inventory decrement exactly once | BLOCKED; DB logic present |
| Duplicate payment initialization | BLOCKED; claim/finalize logic present |
| Duplicate webhook delivery | BLOCKED; provider-event idempotency present |
| Invalid webhook signature | BLOCKED; rejection logic present |
| Amount mismatch | BLOCKED; rejection logic present |
| Failed/cancelled payment | BLOCKED |
| Refund webhook reconciliation | BLOCKED |
| Customer order history after payment | BLOCKED |
| Guest tracking after payment | BLOCKED |
| Admin fulfilment/tracking updates | BLOCKED |

## Inventory findings

- No owner-provided opening stock exists. Sprint 3 defaults every variant to `track_inventory=false` and `stock_quantity=null`; this does not prove inventory readiness.
- Tracked inventory requires a non-negative integer quantity.
- Payment processing locks tracked variants before checking/decrementing stock.
- `inventory_payment_applications.order_id` is the per-order exactly-once guard.
- Every payment decrement records before, delta, after, order, and payment-event linkage.
- Manual admin adjustments require a non-zero integer delta and reason, reject negative stock, and write both adjustment and audit records.
- `inventory_adjustments` is append-only through a trigger; arithmetic is constrained.
- Live opening quantities, low-stock behavior, concurrent checkout stock contention, and exactly-once history remain blocked.

## Audit log findings

- Admin order, product, variant, inventory, and store-setting operations write structured audit rows through service-role-only functions.
- Audit and inventory adjustment tables have update/delete rejection triggers.
- No client write privileges are granted to the audit/inventory history tables.
- The Sprint 3 empty-`entity_type` defect is fixed additively in Sprint 4.
- Append-only triggers are an application/database guard, not protection from a database owner who can deliberately alter or disable schema objects.
- Live accuracy and completeness against real operational changes remain blocked.

## Browser findings

Browser: built Next.js production server on localhost; temporary server stopped after verification.

Viewports:

- Desktop: `1440 × 900`
- Mobile: `390 × 844`

Routes checked at both widths:

- `/`
- `/shop`
- `/products/sambar-podi`
- `/cart`
- `/checkout`
- `/login`
- `/signup`
- `/account`
- `/track-order`
- `/admin`
- `/admin/orders`
- `/admin/products`
- `/admin/inventory`

Evidence:

- All routes produced meaningful rendered content with one main landmark.
- No Next.js error overlay and no horizontal overflow on any requested route at either width.
- Browser console warnings/errors: none captured.
- Broken images on the inspected shop page: none.
- Cart page rendered a persisted line item and secure-checkout link.
- Checkout rendered the safe `Shipping has not been configured` state; it did not expose or open Razorpay.
- Login, signup, and tracking forms rendered.
- `/account` redirected to `/login?next=%2Faccount`.
- `/admin` and the three requested admin subroutes redirected to `/login?next=%2Fadmin`.
- Mobile menu opened as an accessible dialog; Escape closed it and returned focus to the Menu button.

Limitations:

- Authenticated account pages were not rendered with a real user.
- Admin dashboard/orders/products/inventory content was not rendered with a real admin.
- Razorpay Checkout iframe, payment modal, success/failure states, and final confirmation pages were not exercised.

## Automated gate results

Final sequence after the Sprint 4 migration/test additions:

1. `npm.cmd run lint` — **PASS**
2. `npm.cmd test` — **PASS, 27/27**
3. `npm.cmd run build` — **PASS**, Next.js 16.2.10 production build, 39 generated pages
4. `npm.cmd run typecheck` — **PASS**

The build kept public catalogue routes static/revalidated while account, admin, checkout, auth callbacks, and API routes remained dynamic.

## Defects fixed

1. **Audit entity-type constraint** — empty `audit_logs.entity_type` values could pass because Sprint 3 checked the wrong column. Fixed through `20260805090000_sprint_4_validation_hardening.sql`; historical migrations remain untouched.
2. **Validation-test false positive** — the initial read-only-script test treated the word `UPDATE` inside a privilege-inspection expression as an executable mutation. The assertion was narrowed to statement starts. This was a test-harness issue, not an application defect.

No other migration or application defect was changed without direct evidence.

## Owner-blocked tasks

1. Supply the development Supabase project URL, publishable key, and server-only secret/service-role key.
2. Apply all three migrations once and run the read-only validator.
3. Supply and confirm owner business settings, shipping amounts, PIN policy, opening stock, low-stock threshold, contact fields, notices, policy approval, and guest-checkout policy.
4. Create two ordinary users and one trusted admin; configure auth email delivery and redirect URLs.
5. Supply Razorpay **Test Mode** API keys and a separate webhook secret.
6. Provide a public HTTPS test/staging webhook URL and subscribe to `payment.captured`, `order.paid`, `payment.failed`, and `refund.processed` as used by the current route.
7. Execute the complete live authentication, RLS, payment, webhook, refund, inventory, audit, customer-history, guest-tracking, and admin-fulfilment matrix.
8. Supply and verify the optional email webhook endpoint before enabling email-hook settings.

## Remaining risks

- The SQL migrations and validator were statically inspected but not executed against PostgreSQL/Supabase in this run.
- Runtime RLS has not been proven with independent authenticated JWT sessions.
- Supabase server secrets bypass RLS; a leak would expose the development database. Keep them out of browser bundles, screenshots, logs, and source control.
- Opening stock and serviceability policy are unknown; checkout must remain disabled.
- Razorpay webhooks require a reachable public HTTPS endpoint; localhost cannot receive direct provider deliveries.
- Webhook processing and optional email-hook latency have not been measured. Provider retries should be expected; database idempotency must be confirmed live.
- The in-process rate limiter remains a single-instance fallback and is not a multi-instance production control.
- Payment event ordering, late provider events, partial refunds, and concurrent stock contention are source-covered but not provider/database-tested.
- Authenticated admin layouts and operational mutations have not received browser validation.
- No production readiness or compliance claim is made.

## Exact next recommended sprint

**Sprint 4B — Provider-Connected Acceptance and Activation**

Do not start feature expansion or production launch work yet. Sprint 4B should contain only:

1. Development Supabase configuration and ordered migration application.
2. Read-only database validator execution with retained non-sensitive evidence.
3. Two-user plus one-admin authentication/RLS matrix.
4. Owner-approved store, shipping, inventory, contact, notice, policy, and email-hook settings.
5. Razorpay Test Mode success/failure/duplicate/signature/amount/refund matrix.
6. Exactly-once inventory and append-only audit reconciliation.
7. Authenticated customer/admin desktop and mobile browser acceptance.

Exit gate: every owner-blocked row in this report must have direct development-project evidence. Only after that should the project proceed to **Sprint 5 — Controlled Staging Launch and Production Readiness**.
