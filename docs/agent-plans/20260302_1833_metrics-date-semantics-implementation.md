# Metrics Date-Semantics Implementation Plan

Date: 2026-03-02 18:33 (Europe/London)
Scope: Implement daily metric facts with deterministic uniqueness keyed by `metric_date`, source-day semantics for time-series metrics, and partial-sync metric attempt/success/failure observability.

## Checklist
- [x] Persist implementation plan before coding
- [x] Add migration for `instagram_metric_facts` with `metric_date` contract and unique key
- [x] Add migration updates for `sync_logs` metric attempt/success/failure fields and counters
- [x] Extend sync ingestion to upsert media metric facts with daily semantics
- [x] Add shared mapping helpers to enforce `metric_date` rules for time-series vs snapshot metrics
- [x] Update/extend tests for mapping date semantics and migration guardrails
- [x] Run quality gates (`npm run test:all`, `npm run test:all:security`, `npm run build`)
- [x] Update plan status, next actions, and context snapshot
- [ ] Add missing schema sections from full expansion plan:
  - [x] `instagram_account_insights_daily`
  - [x] `instagram_business_discovery_targets`
  - [x] `instagram_business_discovery_profiles`
  - [x] `instagram_business_discovery_daily`
  - [x] `instagram_account_fb_tokens`
- [x] Extend media schema + `list_media_with_insights` RPC for expanded typed metrics
- [x] Add account/business discovery trend RPCs
- [x] Extend `instagram-sync` collectors to persist account daily projection and business discovery snapshots
- [x] Update TypeScript/Zod contracts for expanded tables/RPC payloads
- [x] Re-run quality/security/build gates after missing-scope implementation

## Current Status
Phase 1 + Phase 2 complete in local workspace. Missing-plan sections were implemented and validated with local quality/security/build gates.

## Next Actions
1. Apply migrations `20260302183500_add_metric_facts_and_sync_log_metric_tracking.sql` and `20260302185500_expand_metrics_schema_business_discovery_and_rpcs.sql` in the target project.
2. Deploy updated edge functions: `instagram-sync` and new `instagram-oauth-facebook`.
3. Run one manual sync plus one business discovery sync validation using a stored FB token and active discovery targets.

## Progress Log (Newest First)
- 2026-03-02 21:33: Implemented missing-scope migration `20260302185500_expand_metrics_schema_business_discovery_and_rpcs.sql`:
  - Added `instagram_account_insights_daily`, `instagram_business_discovery_targets`, `instagram_business_discovery_profiles`, `instagram_business_discovery_daily`, and `instagram_account_fb_tokens`.
  - Extended `instagram_media_insights` schema + `sync_logs` observability fields.
  - Added hardened RPCs `list_account_insights_timeseries` and `list_business_discovery_trends`.
  - Replaced `list_media_with_insights` return contract to include new typed insight columns.
- 2026-03-02 21:33: Extended `instagram-sync` to:
  - Persist expanded media metrics into facts + typed insights row.
  - Upsert `instagram_account_insights_daily` projection from account facts.
  - Collect business discovery snapshots for active targets (FB token path), persisting profiles/daily snapshots/facts with fail-soft behavior.
  - Populate new sync log fields (`scope`, `api_host`, `api_version`, `rate_limit_events`, `failure_class`).
- 2026-03-02 21:33: Added new edge function `instagram-oauth-facebook` for encrypted FB token persistence into `instagram_account_fb_tokens`.
- 2026-03-02 21:33: Updated frontend contracts/tests:
  - `src/types/database.ts` expanded schema interfaces.
  - `src/types/schemas/mediaListRpc.ts` + tests updated for new RPC projection.
  - `src/security/policy-contracts.test.ts` expanded migration contract coverage.
- 2026-03-02 21:33: Quality gates passed:
  - `npm run test:all`
  - `npm run test:all:security` (live smoke skipped due missing `SECURITY_TEST_*` vars)
  - `npm run build`
- 2026-03-02 18:50: New execution requested to implement missing sections against original full expansion plan; reopened plan with Phase 2 checklist.
- 2026-03-02 18:40: Completed all local quality gates: `npm run test:all`, `npm run test:all:security`, and `npm run build`.
- 2026-03-02 18:39: Extended `instagram-sync` to:
  - Upsert media snapshot metric facts into `instagram_metric_facts` with daily deterministic keys.
  - Fetch account insights (`total_value` + `time_series`) and map facts so `metric_date` uses API day for time-series values.
  - Persist metric observability in `sync_logs`: attempted/succeeded/failed arrays plus counts.
- 2026-03-02 18:36: Added shared mapper + tests:
  - `supabase/functions/_shared/metric-facts.ts`
  - `supabase/functions/_shared/metric-facts.test.ts`
  validating source-day vs fetch-day semantics.
- 2026-03-02 18:35: Added migration `20260302183500_add_metric_facts_and_sync_log_metric_tracking.sql` creating `instagram_metric_facts`, deterministic unique identity, and `sync_logs` metric tracking columns with verification SQL.
- 2026-03-02 18:33: Created implementation plan file and locked scope to the user-approved date semantics and sync-log guardrail.

## Context Snapshot
- New facts table uses deterministic daily identity with `metric_date` and non-null identity dimensions (`period`, `metric_type`, `timeframe`, `breakdown_type`, `breakdown_value`) defaulting to `''` for stable upserts.
- Time-series mapping rule is enforced in code: if `end_time` exists, `metric_date` is derived from API value day; snapshots use fetch date.
- Partial sync guardrail is implemented through `sync_logs.metrics_attempted|succeeded|failed` and corresponding counts.
- Full expansion schema now exists in migrations, including account daily projection, business discovery model tables, FB token storage, and trend RPCs.
- `instagram-sync` now writes typed account projection rows and business discovery snapshots in addition to metric facts.
