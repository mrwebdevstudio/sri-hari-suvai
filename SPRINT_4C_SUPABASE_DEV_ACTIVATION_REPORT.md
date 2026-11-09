# Sprint 4C — Supabase DEV/TEST Activation Report

## Verdict: PARTIAL

**Supabase MCP:** authenticated and used successfully. Connected project: `ndwjpfinvrbaveuovuwh` (`sriramvenkat.vp@gmail.com's Project`, active/healthy, created 2026-08-19). The ref matches the owner-confirmed temporary target; its generic default name should be renamed in the dashboard for clarity.

## DEV/TEST safety

- **Classification:** SAFE FOR TEMPORARY DEV/TEST USE.
- **Backend status:** TEMPORARY DEV/TEST BACKEND — ACTIVATED (schema), with owner-controlled activation and live-user acceptance pending.
- Before migration: no public application tables and no migration-history entries; therefore no customer, order, payment, or unrelated application data existed.
- No secrets, Auth records, customer data, or payment-provider data were accessed.

## Migration history and application

All three were clearly **NOT APPLIED** before work and then applied once, in order, through the history-preserving Supabase MCP migration capability:

1. `20260710170000_sprint_2_commerce.sql` — APPLIED
2. `20260710230000_sprint_3_operations.sql` — APPLIED
3. `20260805090000_sprint_4_validation_hardening.sql` — APPLIED

The remote history now contains all three migration names in that order. Local review confirmed Sprint 2's seed/RLS/functions, Sprint 3's additive operational hardening, and Sprint 4's additive correction of `audit_logs_entity_type_check`; no destructive data operation was found.

## Remote database verification

- Catalogue: **16 products**, **64 variants**, all active, positive integer-paise pricing, product/variant foreign keys, and unique slugs confirmed.
- Inventory: 64 valid untracked inventory records; 0 inconsistent quantities; 0 adjustments/history rows (expected for a new DEV/TEST database). Low-stock configuration exists but is unset.
- Commerce structures: profiles, addresses, orders, order items/history, payment events, store settings, and guest-capable order structure confirmed.
- Operations structures: audit logs, inventory adjustments/payment applications, product/variant administration, fulfilment/tracking, store settings, serviceable-postal-code support, and analytics-supporting fields confirmed.
- Constraints: primary keys, foreign keys, uniqueness, stock/price checks, and corrected `audit_logs.entity_type` constraint (`1..80`) confirmed.
- Functions/triggers: 16 intended functions and 9 triggers confirmed, including append-only audit/inventory triggers and privileged service-role operation functions.

## RLS and privilege status

**STRUCTURALLY VERIFIED — LIVE USER TEST PENDING.** All 12 intended public tables have RLS enabled; 17 policies were found. Customer records use ownership predicates, product/settings read access is constrained as designed, role escalation is not customer-writable, admin mutations are service-role-only, and privileged functions are not granted to anonymous/authenticated callers. No Customer A/B accounts were created.

## Validator

`supabase/validation/sprint_4_commerce_validation.sql` was confirmed read-only and executed through MCP. One validator defect was fixed: its active-product check counted joined variant rows; it now counts distinct products. The corrected slice passes catalogue counts/active state, paise pricing, inventory consistency/history arithmetic, audit hardening, settings-row integrity, RLS, privilege boundary, and append-only trigger checks.

Two checks remain intentionally unmet on this pristine DEV/TEST database:

- `commerce_activation_switches`: checkout remains disabled and no flat shipping value is set.
- `trusted_admin_present`: no admin profile exists because no test users were created.

No rows were changed to force these checks to pass.

## Auth readiness

Auth configuration read access is not exposed by the available MCP tools without entering credential-sensitive surfaces. Owner must verify in the Supabase dashboard: email/password enabled, development site URL, allowed redirect URLs, email-confirmation setting, and password-reset redirect URL. No Auth settings or users were changed.

## Files changed

- `supabase/validation/sprint_4_commerce_validation.sql`
- `SPRINT_4C_SUPABASE_DEV_ACTIVATION_REPORT.md`

## Checks run

- Supabase MCP: project identity, table metadata, migration history, read-only validator, and structural SQL verification.
- `npm.cmd run lint` — PASS
- `npm.cmd test` — PASS (27/27)
- `npm.cmd run build` — started; tool output did not provide a completion status.
- `npm.cmd run typecheck` — PASS

## Owner actions and next task

Use only test users/orders, never real customers or business/customer data. Do not connect Razorpay Live Mode. Test inventory may be manipulated. Before public launch, create a fresh production Supabase project and replay these migrations cleanly.

After the owner completes the safe development Auth/URL configuration and creates approved test accounts, run **Sprint 4C — Test User + Two-User RLS Acceptance**. Do not start it automatically.
