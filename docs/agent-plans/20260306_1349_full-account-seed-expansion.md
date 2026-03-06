# Full Account Seed Expansion Plan

Date: 2026-03-06 13:49 (Europe/London)
Scope: Expand `scripts/seed-instagram-business-discovery.sql` from business-discovery-only seeding to a full account dataset across all relevant `instagram_*` and account-linked tables.

## Checklist
- [x] Persist plan file before coding
- [x] Expand seed script scope to full account dataset
- [x] Preserve preflight guard for strict `account_id` + `user_id` ownership
- [x] Seed account-level connection state (`instagram_account_tokens`, `instagram_account_fb_tokens`, `instagram_account_capabilities`, `instagram_accounts` sync state)
- [x] Seed media dataset (`instagram_media`, `instagram_media_insights`, `scoring_results`)
- [x] Seed recommendations (`content_recommendations`) with deterministic IDs
- [x] Seed operational telemetry (`sync_logs`, `instagram_metric_facts`, `instagram_account_insights_daily`)
- [x] Preserve and integrate business discovery seed tables (`targets`, `profiles`, `daily`)
- [x] Add expanded verification result sets for all seeded tables
- [x] Update cleanup block to remove all script-managed seeded records
- [x] Run local quality gate (`npm run test:all`)
- [x] Update plan status, next actions, and context snapshot

## Architecture Decision
- Context:
  - User requested one seed script that populates all account-linked tables, not only business discovery.
  - Must remain safe to re-run and scoped to one known account/user.
  - Must not introduce schema or application runtime changes.
- Structural pressures:
  - Data consistency across multiple FK-linked tables.
  - Deterministic idempotency for tables without natural account-level unique keys.
- Decision: **No new pattern (keep it simple)**.
- Rationale:
  - A single SQL script remains the minimal operational boundary.
  - Deterministic IDs + upserts satisfy idempotency without introducing auxiliary scripts/services.
  - Scoped preflight and account-bound filters preserve safety.
- Guardrails:
  - No migrations.
  - No frontend/API/edge-function edits.
  - No changes to `supabase/seed.sql`.

## Current Status
Completed in workspace. Full account seed script expansion implemented and local quality gate passed.

## Next Actions
1. Run `scripts/seed-instagram-business-discovery.sql` in Supabase SQL Editor for the target account.
2. Confirm verification output includes seeded counts for media/insights/scores/recommendations/sync logs/account insights/metric facts/business discovery.
3. Use the script’s cleanup block when you want to remove only script-managed seeded rows.

## Progress Log (Newest First)
- 2026-03-06 13:56: Rewrote `scripts/seed-instagram-business-discovery.sql` into full-dataset idempotent seed covering:
  - account sync/capability/token state,
  - media + insights + scoring,
  - content recommendations,
  - account insights daily + metric facts,
  - business discovery targets/profiles/daily,
  - sync logs, verification queries, and full cleanup block.
- 2026-03-06 13:56: Corrected SQL-string escaping and cleanup-block query scope so the script remains executable and reversible.
- 2026-03-06 13:56: Ran `npm run test:all` successfully (24 test files / 159 tests passed).
- 2026-03-06 13:49: Created expansion plan to convert business-discovery-only seed into full account seed dataset.

## Context Snapshot
- Target user/account:
  - `user_id`: `4d0da5a8-a1c8-4446-9942-398f87295933`
  - `account_id`: `735b3cb9-76c2-4082-8adb-e379ed32e81c`
- Existing script currently seeds:
  - `instagram_accounts` sync state (update only),
  - `instagram_account_tokens` (insert-only fallback; does not overwrite existing encrypted token),
  - `instagram_account_fb_tokens`,
  - `instagram_account_capabilities`,
  - `instagram_media`, `instagram_media_insights`, `scoring_results`,
  - `content_recommendations`,
  - `instagram_account_insights_daily`,
  - `instagram_metric_facts`,
  - `instagram_business_discovery_targets`, `instagram_business_discovery_profiles`, `instagram_business_discovery_daily`,
  - `sync_logs`.
- Seed isolation strategy:
  - media keys use `seed_media_%`,
  - account insight/fact rows use `metric_type`/`timeframe` seed markers (`seed_total_value`, `seed_snapshot`, `seed_day`, `seed_lifetime`),
  - recommendations and sync logs use deterministic UUIDs.
