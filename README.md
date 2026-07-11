# Sri Hari Suvai

Next.js 16 storefront and server-rendered operations portal backed by Supabase PostgreSQL and Razorpay.

## Local verification

Use Node.js 20.9 or newer, copy `.env.example` to `.env.local`, then run `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The public catalogue has a checked-in fallback; authentication, checkout, admin operations and live database checks fail safely until their environment values are configured.

## Deployment

Deploy to a Node.js-compatible Next.js host. Configure `NEXT_PUBLIC_SITE_URL`, the Supabase public URL/key and server-only service-role key, then apply migrations in filename order. Configure Supabase Site URL and auth/reset redirects for the production domain. Create the first user through normal signup and promote only that trusted profile to `admin` directly in Supabase.

Add Razorpay test key ID/secret and webhook secret, point the webhook to `/api/payments/webhook`, and subscribe to payment/order/refund events used by the application. Complete a test payment and duplicate-webhook check before replacing test keys. `EMAIL_WEBHOOK_URL` is optional; enabling email hooks in admin settings does not claim delivery unless this endpoint is configured and succeeds.

The built-in rate limiter is an in-process development and single-instance fallback. Configure durable platform/WAF rate limiting for multi-instance production, especially for authentication, tracking, checkout, payment verification and webhooks. Validate the production CSP against Supabase auth and Razorpay Checkout after environment variables and the final domain are set.
