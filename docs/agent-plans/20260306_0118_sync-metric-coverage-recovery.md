# Sync Metric Coverage Recovery Plan

Date: 2026-03-06 01:18 (Europe/London)
Scope: Reduce null-heavy sync outputs by introducing capability-aware metric bundles for media/account insights, structured capability-gap logging, and bounded backfill execution support without schema changes.

## Checklist
- [x] Persist implementation plan before coding
- [x] Add capability matrix + metric bundle planner for media/account sync
- [x] Refactor media insights sync to two-phase (core + conditional advanced) with structured capability gaps
- [x] Refactor account insights sync to grouped capability-safe calls with partial success persistence
- [x] Add bounded backfill execution path via sync payload options (idempotent)
- [x] Add/adjust tests for capability planning and bundle classification outcomes
- [x] Run quality gates (`npm run test:all`, `npm run test:all:security`, `npm run build`)
- [x] Update plan status, next actions, and context snapshot
- [x] Add runnable `/scripts` backfill helper for `instagram-sync` (`syncMode='backfill'`)
- [x] Add `/docs` runbook for bounded backfill execution
- [x] Load missing backfill runner env vars from project `.env.local`
- [x] Add sync_logs provider-error persistence columns (text + jsonb) via migration
- [x] Persist provider error diagnostics on sync complete/partial/error paths
- [x] Extend TS sync log contract and policy-contract migration assertions
- [x] Add unit coverage for provider-error diagnostic shaping
- [x] Re-run quality gates

## Current Status
Completed locally — `sync_logs` now persists provider error text/details for complete, partial, and error runs.

## Next Actions
1. Apply migration `20260306105200_add_sync_log_provider_error_fields.sql` to target environment(s).
2. Deploy updated `instagram-sync` edge function.
3. Re-run one sync and verify `provider_error_text` + `provider_error_details` on `sync_logs`.

## Progress Log (Newest First)
- 2026-03-06 11:44: Implemented provider-error persistence:
  - Added migration `20260306105200_add_sync_log_provider_error_fields.sql`.
  - Added shared diagnostic helper + tests:
    - `supabase/functions/_shared/provider-error-diagnostics.ts`
    - `supabase/functions/_shared/provider-error-diagnostics.test.ts`
  - Updated `instagram-sync` to persist `provider_error_text` + `provider_error_details` on complete/partial/error sync-log updates.
  - Extended `SyncLog` TypeScript contract and migration contract tests.
- 2026-03-06 11:44: Quality gates passed:
  - `npm run test:all`
  - `npm run test:all:security` (security smoke skipped locally due missing `SECURITY_TEST_*` vars)
  - `npm run build`
- 2026-03-06 10:52: Started provider-error persistence implementation from approved plan; scoped to migration + edge-function log updates + contract/type/tests.
- 2026-03-06 10:29: Added docs runbook `docs/sync-backfill-runbook.md` with command examples, env contract, and verification SQL.
- 2026-03-06 10:28: Updated `scripts/run-sync-backfill.mjs` to load missing env vars from `.env` and `.env.local` before parsing runtime config.
- 2026-03-06 10:29: Re-validated:
  - `npm run sync:backfill -- --help`
  - `npm run test:all`
  - `npm run build`
- 2026-03-06 10:21: Scoped follow-up requested by user: add docs run instructions and make backfill runner read vars from `.env.local`.
- 2026-03-06 10:13: Added `/scripts` runner `scripts/run-sync-backfill.mjs` and package alias `sync:backfill` with support for:
  - single or multi-account targets (`--account-id`, `--all-accounts`, env fallback IDs)
  - bounded periods (`--backfill-days` => 90/180/360)
  - optional sync scope selection (`--scopes media,account,businessDiscovery`)
  - dry-run target inspection (`--dry-run`)
- 2026-03-06 10:14: Validation completed:
  - `npm run sync:backfill -- --help`
  - `npm run test:all`
  - `npm run build`
- 2026-03-06 10:08: Resumed plan to implement operator-friendly backfill runner script under `/scripts` so bounded recovery runs can be executed without manual inline Node snippets.
- 2026-03-06 01:26: Full gates passed:
  - `npm run test:all`
  - `npm run test:all:security` (live smoke skipped due missing `SECURITY_TEST_*` vars)
  - `npm run build`
- 2026-03-06 01:24: Added shared capability planner:
  - `supabase/functions/_shared/sync-metric-capabilities.ts`
  - `supabase/functions/_shared/sync-metric-capabilities.test.ts`
  Includes sync window resolver (standard/backfill), media/account metric bundles, and returned-metric coverage classifier.
- 2026-03-06 01:24: Refactored `supabase/functions/instagram-sync/index.ts`:
  - Added payload support for `syncMode` + `backfillDays` with bounded validation via `resolveSyncWindow`.
  - Implemented capability matrix-driven media two-phase fetch (core + conditional advanced).
  - Added group-level capability gap logging for unsupported/partial/transient advanced media bundles.
  - Reworked account insights sync to grouped core/advanced bundles with partial-success persistence and explicit missing-metric gap logging.
  - Added response metadata: `syncMode`, `syncWindowSource`, `syncPeriodDays`.
- 2026-03-06 01:18: Plan file created before coding per governance contract.

## Context Snapshot
- Coverage model now distinguishes **core** vs **advanced** metric bundles for both media and account sync paths.
- Unsupported advanced groups no longer block core persistence; they are logged as structured capability gaps (`media:*`, `account:*` group codes).
- Backfill is now a first-class bounded execution path through sync payload options (`syncMode='backfill'`, `backfillDays` in allowed range).
- Locked assumptions implemented: hybrid capability model, NULL for unsupported metrics, bounded backfill included.
