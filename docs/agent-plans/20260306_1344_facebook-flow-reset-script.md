# Facebook Flow Reset Script Plan

Date: 2026-03-06 13:44 (Europe/London)
Scope: Add an idempotent SQL reset script that clears account-linked data so the Facebook connection and downstream sync flow can be tested end-to-end from a clean state.

## Checklist
- [x] Persist plan file before coding
- [x] Create reset SQL script for the target account/user
- [x] Add preflight guard validating account ownership
- [x] Delete business-discovery datasets for the account
- [x] Delete account insights / metric facts / sync logs for the account
- [x] Delete recommendations + media datasets for the account
- [x] Remove Facebook token row and reset capability row to `instagram_only`
- [x] Reset instagram account sync state (`pending`, no last sync/error)
- [x] Add verification result sets
- [x] Run local quality gate (`npm run test:all`)
- [x] Update plan status, next actions, and context snapshot

## Architecture Decision
- Context:
  - Need a deterministic cleanup script to restart Facebook onboarding + sync flow tests.
  - Must avoid schema changes and keep cleanup scoped to a single account/user.
  - Must be safe to rerun.
- Structural pressures:
  - Operational SQL concern only.
  - Requires strict ownership checks and predictable delete order.
- Decision: **No new pattern (keep it simple)**.
- Rationale:
  - A standalone SQL script is the lowest-risk operational boundary.
  - Scoped deletes + explicit capability reset keep behavior deterministic without touching app code.
- Guardrails:
  - No migration changes.
  - No frontend/API changes.
  - No edits to unrelated local files.

## Current Status
Completed in workspace. Account reset SQL script added and local quality gate passed.

## Next Actions
1. Run `supabase/reset-facebook-flow-account.sql` in Supabase SQL Editor for the target account.
2. Confirm verification result set shows zero remaining rows in cleaned tables and capability reset to `instagram_only`.
3. Reconnect Facebook and run a full sync to validate the end-to-end path from clean state.

## Progress Log (Newest First)
- 2026-03-06 13:46: Added `supabase/reset-facebook-flow-account.sql` with:
  - strict account ownership preflight guard,
  - account-scoped cleanup for recommendations, sync logs, metric facts, account insights, business discovery rows, and media,
  - Facebook token deletion + capability baseline reset (`instagram_only`),
  - account sync-state reset (`pending`, cleared sync timestamps/errors),
  - verification result sets and optional hard-reset block.
- 2026-03-06 13:46: Ran `npm run test:all` successfully (24 test files / 159 tests passed).
- 2026-03-06 13:44: Created plan file and locked cleanup scope to account-owned data reset for fresh Facebook flow testing.

## Context Snapshot
- Target user/account:
  - `user_id`: `4d0da5a8-a1c8-4446-9942-398f87295933`
  - `account_id`: `735b3cb9-76c2-4082-8adb-e379ed32e81c`
- Reset script preserves `instagram_accounts` row and Instagram token storage while removing derived data + Facebook token state.
- Post-reset expected state:
  - `instagram_account_fb_tokens`: 0 rows for the account
  - `instagram_business_discovery_*`: 0 rows for the account
  - `instagram_account_insights_daily`: 0 rows for the account
  - `instagram_metric_facts`: 0 rows for the account
  - `instagram_media`: 0 rows for the account (cascades insights/scoring)
  - `instagram_account_capabilities`: `facebook_connected=false`, `business_discovery_enabled=false`, `status_reason='instagram_only'`
  - `instagram_accounts`: `sync_status='pending'`, `last_synced_at=null`, `sync_error=null`
