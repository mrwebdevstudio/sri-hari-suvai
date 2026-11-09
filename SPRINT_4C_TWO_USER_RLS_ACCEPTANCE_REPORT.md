# Sri Hari Suvai — Sprint 4C Two-User RLS Acceptance

Date: 2026-08-23  
Environment: Supabase DEV/TEST project `ndwjpfinvrbaveuovuwh`  
Verdict: **PARTIAL — Customer A recovery complete; two-user acceptance not started**

## Evidence summary

| Check | Result | Redacted evidence |
|---|---|---|
| Git baseline | PASS | `main`; HEAD `78bbafc…`; existing modified validation SQL and three existing Sprint 4C reports preserved; no pre-existing `.playwright-cli` artifacts reported by Git |
| DEV project/data safety | PASS | Project ref matched and was healthy; before signup: 0 Auth users, profiles, addresses, orders, and admins |
| Auth/profile/RLS contract | PASS (inspection) | `profiles.id = auth.users.id`; signup trigger creates customer profile; profile/address policies use session ownership; profile role is not customer-updatable; admin checks read trusted `profiles.role` server-side |
| Test identities | PARTIAL | Customer A created through `/signup`; Customer B and Admin candidate not created because execution stopped at Customer A confirmation boundary |
| Customer A signup | PASS | Real frontend form submitted; app redirected to the expected confirmation message; Auth user `d8c884db…` exists |
| Customer A confirmation resend | SKIPPED | Pre-resend live check showed Customer A was already confirmed; no additional confirmation email was sent |
| Owner confirmation | COMPLETE | Owner reported clicking the original confirmation link; live Auth state now reports confirmed |
| Confirmation redirect | FAIL | The clicked link displayed the safe invalid/expired confirmation message; no confirmation-time session was established, although subsequent password login passed |
| Customer A profile creation | PASS | Trigger-created profile exists with role `customer` |
| Customer A login | PASS | Real password login succeeded after live confirmation; authenticated session cookie was established without exposing its value |
| Customer A account access | PASS | `/account` and `/account/profile` loaded; the displayed synthetic profile matched Customer A and the email field remained non-editable |
| Customer A logout/re-login | PASS | Logout removed the Auth cookie; unauthenticated `/account` revisit redirected safely to login; one re-login restored authenticated account access |
| Customer B signup/session/profile | NOT RUN | Mandatory stop occurred before Customer B creation |
| Addresses/owned data | NOT RUN | No addresses created; no real addresses or orders created |
| A own-data / B own-data access | NOT RUN | Requires confirmed independent sessions |
| A → B / B → A RLS denial | NOT RUN | Requires both confirmed users and owned records |
| Ownership spoofing | NOT RUN | Requires authenticated user contexts |
| Unauthenticated/customer admin denial | NOT RUN LIVE | Server-side denial seams inspected; live acceptance deferred |
| Admin promotion mechanism | IDENTIFIED | Controlled DEV-only server/SQL update of `public.profiles.role` from `customer` to `admin`; no email whitelist or user-editable metadata |
| Admin positive access | NOT RUN | Admin candidate not created or promoted |
| Direct API authorization | NOT RUN | Deferred until confirmed A/B/Admin sessions exist |
| Session/logout checks | PASS (Customer A) | Auth cookie present after login, absent after logout, and present after the required re-login; no cookie or token value was recorded |
| Defects found/fixed | NONE | No demonstrated defect; no repository code changed |
| Tests added | NONE | No demonstrated gap yet |
| Checks run | PARTIAL | Exact Git baseline; targeted auth/profile/address/admin/RLS inspection; current Supabase status checks; real browser Customer A signup, login, account/profile access, logout denial, and re-login; browser console reported 0 errors |

## Customer A recovery result

Customer A is confirmed and the required login, session, account-access, logout, unauthenticated revisit, and re-login checks passed. The earlier confirmation redirect remains recorded as FAIL because it displayed the invalid/expired message even though Supabase completed email verification. No confirmation link, token, password, cookie, JWT, or session payload was recorded. The isolated Customer A browser context remains intentionally available with its password retained only ephemerally.

## Remaining blockers

Customer B creation, cross-user RLS proof, ownership-spoof testing, customer admin denial, Admin candidate promotion, admin positive checks, direct API checks, targeted gates, and final two-user browser acceptance have not been started. They remain outside this Customer A-only recovery task.

No Razorpay, payment, checkout activation, refund, production deployment, real customer onboarding, or order creation occurred.
