# Dashboard + Posts Signals Reconnect Plan

Date: 2026-03-06 00:45 (Europe/London)
Scope: Restore missing indicators/signals in `/dashboard` and `/posts/:id` after database contract changes by repairing insights data, hardening sync fallback behaviour, and unifying frontend read contracts.

## Checklist
- [x] Persist implementation plan before coding
- [x] Add migration to repair `instagram_media_insights` consistency and support detail-filtered media RPC
- [x] Harden `instagram-sync` media insights fetch with safe fallback on invalid metric errors
- [x] Align `/posts/:id` data path to `list_media_with_insights` RPC contract
- [x] Add/adjust tests: migration contract, `useMediaDetail` RPC behaviour, sync fallback regression
- [x] Run quality gates: `npm run test:all`, `npm run test:all:security`, `npm run build`
- [x] Update plan status, next actions, and context snapshot

## Current Status
Completed locally — migration, sync fallback hardening, unified RPC detail path, and tests are implemented and validated.

## Next Actions
1. Apply migration `20260306005000_repair_media_insights_and_extend_media_rpc.sql` to the target Supabase project.
2. Deploy updated edge function `instagram-sync`.
3. Run a manual sync from `/connect` to refresh posts that currently have no insights.

## Progress Log (Newest First)
- 2026-03-06 00:50: Completed full quality gates:
  - `npm run test:all`
  - `npm run test:all:security` (live smoke skipped due missing `SECURITY_TEST_*` vars)
  - `npm run build`
- 2026-03-06 00:49: Added regression tests:
  - `src/hooks/useMediaDetail.test.ts` for RPC-based detail loading and parser errors.
  - `supabase/functions/_shared/media-insights-fetch.test.ts` for invalid-metric fallback behaviour.
  - `src/security/policy-contracts.test.ts` updated with migration contract assertions.
- 2026-03-06 00:48: Updated frontend detail hook `src/hooks/useMediaDetail.ts` to call `list_media_with_insights` with `p_media_row_id` and parse using shared Zod schema.
- 2026-03-06 00:48: Hardened `supabase/functions/instagram-sync/index.ts` media insights fetch:
  - Added safe fallback metric set on invalid metric contract errors.
  - Preserved attempted/succeeded/failed metric observability and added fallback warning logs.
- 2026-03-06 00:47: Added shared fallback helper `supabase/functions/_shared/media-insights-fetch.ts`.
- 2026-03-06 00:46: Added migration `supabase/migrations/20260306005000_repair_media_insights_and_extend_media_rpc.sql`:
  - Backfilled mismatched `instagram_media_insights.user_id`.
  - Backfilled missing insights rows from latest `instagram_metric_facts` snapshots.
  - Extended `list_media_with_insights` with optional `p_media_row_id uuid` filter and updated grants.
- 2026-03-06 00:45: Plan file created before coding per governance contract.

## Context Snapshot
- Dashboard and post detail now share one read contract via `list_media_with_insights` + `parseMediaListRpcRows`, removing contract drift between list/detail hooks.
- Sync fallback now retries metric fetch with a safe baseline set (`reach,views,saved,shares,comments`) only when provider returns an invalid metric contract error.
- Data repair migration restores orphaned/mismatched insights ownership and reconstructs missing insights from metric facts where available.
- Locked assumptions honoured: full root-cause fix, migration+backfill allowed, both dashboard and post detail in scope, unrelated dirty files left untouched.
