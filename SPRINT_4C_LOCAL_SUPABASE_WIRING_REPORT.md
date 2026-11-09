# Sprint 4C — Local Supabase Wiring Report

## Verdict: PASS

The local Next.js application is wired to Supabase DEV/TEST project `ndwjpfinvrbaveuovuwh`. Public/auth routes and read-only catalogue access work without exposing server credentials.

## Acceptance results

- Environment presence: `NEXT_PUBLIC_SUPABASE_URL` PRESENT, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` PRESENT, `SUPABASE_SERVICE_ROLE_KEY` PRESENT. Values were never printed.
- Git ignore: VERIFIED by `.gitignore:12` (`.env*`). `.env.local` is absent from Git status and is not staged.
- App boot: PASS. Next.js 16.2.10 loaded `.env.local` and became ready at `http://localhost:3000`. An initial health request returned a transient 404; one clean dev-server restart resolved it with no source change.
- Health: PASS. `/api/health` returned HTTP 200 and `ready`; Supabase configured = yes, Razorpay configured = no, with no secret-name or stack-trace exposure.
- Browser smoke: PASS. `/`, `/login`, `/signup`, and `/forgot-password` returned HTTP 200. The three auth routes rendered forms; no Supabase-not-configured fallback, runtime/page error, console error, hydration symptom, or unexpected 500 was found. No form was submitted.
- Backend connectivity: PASS. The existing public catalogue query pattern reached the configured project and returned 16 active products with 64 active variants. No service-role operation or mutation was used.
- Client secret boundary: PASS. Targeted source/import checks found no client crossing or `NEXT_PUBLIC_` server-secret name. Twenty-two browser-loaded JavaScript bundles contained none of `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or `EMAIL_WEBHOOK_SECRET`.

## Checks run

- `node --test tests/sprint4.test.mjs` — PASS, 6/6.
- `npm.cmd run typecheck` — PASS.
- Targeted environment, Git-ignore, health, browser, connectivity, source-boundary, and loaded-bundle checks — PASS.

## Files changed

- `.env.local` — owner-updated, ignored local configuration.
- `SPRINT_4C_LOCAL_SUPABASE_WIRING_REPORT.md` — updated acceptance report.

No users, payments, database mutations, Razorpay configuration, deployment, commit, or push were performed. Existing unrelated workspace changes were preserved.

## Recommendation

`Sprint 4C — Test User + Two-User RLS Acceptance`
