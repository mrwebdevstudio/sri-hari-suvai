# Sprint 4B: Provider Integration Readiness

Date: 2026-08-05  
Repository: `E:\VPRS\Pathma\Masala\Website\Sri Hari Codex Latest`

## Final verdict

**PARTIAL — PROVIDER-CONNECTED ACCEPTANCE IS BLOCKED.**

The credential-independent implementation, security checks, local failure responses, responsive unauthenticated browser surfaces, and automated gates pass. The requested live Supabase and Razorpay Test Mode evidence could not be produced because the checkout contains no local provider configuration or linked Supabase project metadata. No credentials were printed or written, no database/provider mutation was attempted, and no financial transaction was initiated.

**Sprint 5 may not begin.** The exact exit gate is a rerun of Sprint 4B with direct development-project evidence for migrations, the database validator, three real test identities, two-user RLS isolation, admin operations, Razorpay Test Mode success/failure/webhook/refund paths, exactly-once inventory, fulfilment/tracking, and any enabled email hook.

## Git baseline and files

- Branch: `main`
- Baseline and current commit: `fdc9b47f1099c41cba3663f51532a5db295d4a5d`
- Initial worktree: the four untracked Sprint 4A artifacts supplied in the handoff; no other change was present.
- Historical Sprint 2 and Sprint 3 migrations were not modified.
- No reset, clean, checkout, branch switch, commit, push, deploy, production access, or secret creation occurred.
- Sprint 4B file added: `SPRINT_4B_PROVIDER_INTEGRATION_READINESS_REPORT.md`
- Preserved pre-existing Sprint 4A files:
  - `SPRINT_4_COMMERCE_VALIDATION_REPORT.md`
  - `tests/sprint4.test.mjs`
  - `supabase/validation/sprint_4_commerce_validation.sql`
  - `supabase/migrations/20260805090000_sprint_4_validation_hardening.sql`

## Provider configuration status

Checked `.env*` files plus process, user, and machine environment scopes without displaying values. No `.env.local` exists. Missing names:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_BUSINESS_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `EMAIL_WEBHOOK_URL`
- `EMAIL_WEBHOOK_SECRET`
- `APP_VERSION`

The repository has no Supabase CLI executable, `supabase/config.toml`, or linked-project metadata. The local health endpoint returned HTTP `503`, with provider activation unavailable. The service-role, Razorpay key secret, webhook secret, and email secret remain server-only in the inspected source and are rejected from client-component references by Sprint 4 regression coverage.

## Database activation and validation

| Evidence | Result |
|---|---|
| Required migration filenames sort as Sprint 2, Sprint 3, Sprint 4 hardening | PASS — repository evidence |
| Historical migrations unchanged | PASS |
| Sprint 4 constraint change is additive | PASS |
| Validator starts a read-only transaction and rolls back | PASS — focused test |
| Migrations applied to the development project | BLOCKED — no linked/configured project |
| Read-only validator executed against the development project | BLOCKED |
| Live `schema_migrations` order/version evidence | BLOCKED |

Credential-independent catalogue/database evidence remains:

- Exactly 16 source products and 64 source/seed variants: PASS.
- Source catalogue and migration seed match exactly: PASS.
- Positive integer-paise prices: PASS.
- Seeded product and variant active defaults: PASS — source/seed only.
- Inventory consistency, uniqueness, foreign keys, store-setting row/defaults, and corrected `audit_logs.entity_type` constraint: PASS — schema/source checks only; live rows blocked.
- RLS enabled declarations, column-limited customer profile updates, service-role-only operational RPC grants, and append-only trigger declarations: PASS — schema/source checks only; runtime enforcement blocked.

No row was inserted, edited, or deleted to influence a validation result.

## Authentication, two-user RLS, and admin authorization

Live signup, confirmation, login, logout, forgot/reset password, profile persistence, address CRUD, account pages, and order history are **BLOCKED**. Customer A, Customer B, and an admin account could not be created without the development Supabase configuration.

Consequently, these are not claimed as passing:

- Customer A versus Customer B profile, address, order, item, and history isolation.
- Ordinary-user denial of admin data and operations under a real JWT.
- Admin access through the intended `profiles.role = 'admin'` promotion mechanism.
- Browser/client denial of service-role-only RPCs against the live project.
- Direct Supabase API requests with independent authenticated sessions.

Available direct local evidence:

- Unauthenticated `GET /api/admin/store-settings`: HTTP `403`.
- Unauthenticated `PATCH /api/admin/store-settings`: HTTP `403`.
- Unauthenticated `PATCH /api/admin/orders/{id}/status`: HTTP `403`.
- `/account` redirects to `/login?next=%2Faccount`.
- `/admin` and requested admin subroutes redirect to `/login?next=%2Fadmin`.
- Source clients use publishable credentials for user sessions; the service-role client exists only in server modules.

These results prove the local unauthenticated boundary only, not the required provider-connected two-user RLS matrix.

## Admin activation and business settings

First-admin promotion, dashboard, order detail, catalogue operations, inventory adjustment, analytics, live audit logs, and persisted settings are **BLOCKED**.

No business policy was invented. The following remain **OWNER DECISION REQUIRED** before activation:

- checkout enabled
- product ordering enabled
- guest checkout policy
- flat shipping amount
- free-shipping threshold
- serviceable postal codes
- opening stock and tracked-inventory selection
- low-stock threshold
- business email
- business and WhatsApp phone numbers
- maintenance and shipping notices
- policy approval
- order/shipping email-hook toggles

Checkout must remain disabled until these values and the provider acceptance matrix are approved.

## Razorpay Test Mode checkout and payments

A successful test order and Razorpay modal could not be run. All provider-connected checkout/payment rows are **BLOCKED**, including authoritative amount reconciliation, payment capture, customer/admin order visibility, guest tracking of a real order, and retained live snapshots.

Credential-independent evidence:

- Checkout reloads active product/variant prices from the server-side database and ignores client totals.
- Shipping and serviceability are calculated from server-read store settings.
- Provider order amount is created from the persisted database grand total.
- Payment verification checks the Razorpay signature server-side, fetches the payment from Razorpay, and compares provider order ID, integer-paise amount, INR currency, and captured status before applying payment.
- Webhook verification uses the raw request body and server-only webhook secret.
- Order items retain product, variant, price, customer, and address snapshots in the schema/RPC path.
- Invalid local checkout input returned HTTP `400`.
- Incomplete local payment verification returned HTTP `400`.
- An unconfigured webhook returned HTTP `503`.
- Invalid guest tracking input returned HTTP `404` with non-enumerating behavior.

No order/payment identifiers, signatures, customer data, cookies, or authorization headers were captured.

## Idempotency and failure paths

The following guards pass source/regression inspection but remain **BLOCKED for live proof**:

- Unique checkout idempotency key and conflict detection.
- Payment-initialization claim/finalize token.
- Unique provider event IDs and duplicate-webhook no-op behavior.
- Paid-order protection against a second different payment.
- Exactly-once `inventory_payment_applications.order_id` guard.
- Amount/currency mismatch rejection in both route and database function.
- Failed events cannot overwrite paid/refunded state.
- Invalid webhook and payment signatures cannot reach the payment-application RPC.

Duplicate checkout, concurrent payment initialization, duplicate/out-of-order provider webhooks, invalid signatures, unknown provider IDs, amount mismatch, payment failure, modal cancellation, and retry after failure were not provider-executed and are not reported as passing.

## Inventory, refunds, fulfilment, tracking, and audit logs

- Live opening stock, before/after counts, payment-triggered movement, low-stock presentation, insufficient-stock rejection, and exactly-once decrement: BLOCKED.
- The schema locks tracked variants, rejects insufficient stock, writes arithmetic-constrained inventory adjustments, and uses a per-order payment-application guard: PASS — source only.
- Inventory adjustment history and audit logs are append-only through database triggers: PASS — schema/source only; live enforcement blocked.
- The corrected non-empty `audit_logs.entity_type` constraint is present additively: PASS — source only; applied state blocked.
- Refund creation remains external to the application: confirmed from the current admin surface and route inventory.
- Verified `refund.processed` reconciliation, duplicate refund delivery, and partial/full refund transitions: BLOCKED.
- Partial refunds retain local payment status `paid`; a full refund changes it to `refunded`: PASS — source logic only.
- **Inventory is not restored after refund in the current implementation.** No restoration path exists in the refund branch. This remains a deliberate owner decision; no restoration behavior was added.
- Paid/confirmed → processing → packed → shipped → out for delivery → delivered transitions and cancellation boundaries are encoded in both app and database validation: PASS — source/test only.
- Courier, tracking number, tracking URL, customer-visible note, internal note, shipped timestamp, delivered timestamp, account tracking, guest tracking, and invalid tracking behavior exist: source/local failure evidence only; live fulfilment flow blocked.

## Email hook

`EMAIL_WEBHOOK_URL` and `EMAIL_WEBHOOK_SECRET` are absent. Order-created, payment-confirmed, fulfilment/shipping, failure, timeout/unavailable, and duplicate-delivery behavior are **BLOCKED**. Email absence did not weaken checkout validation, and email-hook toggles were not enabled.

## Browser acceptance

Sprint 4A evidence was reused for `1440×900` and `390×844` because the frontend was unchanged. Sprint 4B added direct `1024×768` coverage for:

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
- `/admin/settings`

Tablet results:

- All requested routes rendered meaningful content or the intended login redirect.
- Horizontal overflow: 0 pixels on every route.
- Broken loaded images: none.
- Browser warnings/errors: none captured.
- One main landmark was present on every route.
- Cart content remained visible across navigation.
- Checkout stayed in the safe “Shipping has not been configured” state and did not expose Razorpay.
- Empty login submission stayed on `/login`, focused the email field, and exposed native required-field validation.
- Responsive menu opened as a dialog; Escape closed it and restored focus to the Menu button.

Authenticated customer/admin rendering, auth transitions, checkout completion, Razorpay Test Mode modal, and real order/tracking states are **BLOCKED**.

## Automated gates

Run sequentially after stopping the browser development server:

1. `npm.cmd run lint` — PASS
2. `npm.cmd test` — PASS, 27/27
3. `npm.cmd run build` — PASS, Next.js 16.2.10, 39 generated pages
4. `npm.cmd run typecheck` — PASS

A focused preflight of `tests/sprint4.test.mjs` also passed 6/6.

## Defects found and fixed

- Sprint 4B found no new reproduced defect that could be safely fixed without provider evidence.
- The Sprint 4A `audit_logs.entity_type` constraint fix remains present and covered.
- No test was added merely to duplicate existing static coverage.

## Blocked checks and remaining production risks

Critical blocked evidence:

- applied migration history and live validator output
- three-account auth lifecycle and first-admin promotion
- two-user RLS isolation and direct authenticated API denial
- live admin pages and audited mutations
- owner-approved settings and opening inventory
- successful Razorpay Test Mode payment
- duplicate, failure, cancellation, retry, invalid-signature, mismatch, unknown-ID, and out-of-order payment cases
- verified webhook delivery through a public HTTPS development endpoint
- exactly-once stock movement and low/insufficient-stock behavior
- partial/full refund reconciliation and duplicate refund webhook
- live fulfilment, customer history, and guest tracking
- optional email-hook delivery/failure/timeout/duplicate behavior
- authenticated desktop/tablet/mobile browser acceptance

Remaining production risks are unchanged: no live RLS evidence, no provider reconciliation evidence, no concurrency evidence, no owner-approved shipping/stock policy, no public webhook delivery evidence, no email reliability evidence, and no multi-instance rate-limit proof. Production activation is not authorized.

## Exact recommendation

**Do not begin Sprint 5.** Supply the missing development-only environment configuration and owner decisions, apply the three migrations in order, run the read-only validator, and rerun this same Sprint 4B matrix. Sprint 5 may begin only after every critical blocked row above has direct, redacted development-project evidence.
