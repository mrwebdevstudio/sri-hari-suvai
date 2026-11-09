# Sri Hari Suvai

Next.js 16 storefront and server-rendered operations portal backed by Supabase PostgreSQL and Razorpay.

## Local verification

Use Node.js 22.19 or newer, copy `.env.example` to `.env.local`, then run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm run typecheck`. A checked-in catalogue supports previews without Supabase configuration. If a configured database fails, the site displays an unavailable notice and preserves the saved cart instead of substituting old catalogue data.

Tests include an ephemeral PGlite PostgreSQL instance that applies the migrations and exercises payment/refund transitions and inventory idempotency. It uses synthetic data, requires no provider credentials, and does not replace hosted Auth/RLS, concurrent-purchase, or Razorpay acceptance.

## Deployment

Deploy to a Node.js-compatible Next.js host. Configure `NEXT_PUBLIC_SITE_URL`, the Supabase public URL/key and server-only service-role key, then apply migrations in filename order. Configure Supabase Site URL and auth/reset redirects for the production domain. Create the first user through normal signup and promote only that trusted profile to `admin` directly in Supabase.

Add Razorpay test key ID/secret and webhook secret, point the webhook to `/api/payments/webhook`, and subscribe to payment/order/refund events used by the application. Complete a test payment and duplicate-webhook check before replacing test keys. `EMAIL_WEBHOOK_URL` is optional; enabling email hooks in admin settings does not claim delivery unless this endpoint is configured and succeeds.

The built-in rate limiter is an in-process development and single-instance fallback. Configure durable platform/WAF rate limiting for multi-instance production, especially for authentication, tracking, checkout, payment verification and webhooks. Validate the production CSP against Supabase auth and Razorpay Checkout after environment variables and the final domain are set.

## Launch Sprint 1 handoff

Apply `20260929100200_sprint_1_payment_event_safety.sql` after the existing migrations during the authorized provider acceptance step. It preserves refunded states when late captures arrive and deduplicates refunds by gateway refund ID. The migration has only been tested locally; it has not been applied to hosted Supabase by this sprint.

Guest order confirmation uses a one-hour HttpOnly receipt cookie scoped to `/order-confirmation`, signed with the server-only Razorpay secret. It reads payment status from the database; URL payment flags are ignored. Expired receipts use the existing authenticated order view or guest tracking flow. The cookie authorizes only the most recently initialized order in that browser.

`/api/health` returns 503 when the database cannot be reached, payment configuration is missing, or checkout/shipping is disabled. It does not execute a gateway payment or prove gateway availability. Email failures are logged with bounded request timeouts; durable retries and delivery acceptance remain pending.

Before enabling real orders: complete hosted Auth/RLS and Razorpay tests; resolve stock reservation/paid-but-unfulfillable orders; approve business contacts, product facts and policies; configure the production domain, delivery rules, email, durable rate limiting, monitoring and backups. Current stock checks do not reserve stock before payment capture.
