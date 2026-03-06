# Business Discovery Seed Script Plan

Date: 2026-03-06 00:43 (Europe/London)
Scope: Add a one-off, idempotent SQL seed script for `instagram_business_*` tables tied to a specific existing account/user and temporarily enable business discovery capability for development.

## Checklist
- [x] Persist plan file before coding
- [x] Create `scripts/seed-instagram-business-discovery.sql`
- [x] Add preflight guard verifying account ownership (`account_id` + `user_id`)
- [x] Upsert 3 deterministic rows into `instagram_business_discovery_targets`
- [x] Upsert matching profile rows into `instagram_business_discovery_profiles`
- [x] Upsert deterministic 30-day snapshots into `instagram_business_discovery_daily`
- [x] Upsert temporary capability override in `instagram_account_capabilities`
- [x] Add verification result-set queries
- [x] Add commented cleanup SQL block
- [x] Run local quality gate (`npm run test:all`)
- [x] Update plan status, next actions, and context snapshot

## Architecture Decision
- Context:
  - Need temporary data to unblock business-discovery UI and queries while Meta/Facebook connection is unavailable.
  - Must not alter app runtime contracts or migration history.
  - Seed must be safe to rerun without duplicates.
- Structural pressures:
  - Operational seeding concern only (no frontend/backend module pressure).
  - Need deterministic data shape and strict account/user ownership checks.
  - Need low-risk, reversible approach for temporary development support.
- Decision: **No new pattern (keep it simple)**.
- Rationale:
  - A standalone SQL script in `scripts/` is the smallest boundary-respecting solution.
  - It isolates temporary operational behavior from product code and migrations.
  - Idempotent SQL upserts satisfy determinism and rerun safety without introducing new abstractions.
- Guardrails:
  - No schema migration changes.
  - No frontend/API contract changes.
  - No modifications to `supabase/seed.sql`.
  - No new app-layer services/hooks/components.

## Current Status
Completed in workspace. One-off seed SQL artifact is ready and local quality gate passed.

## Next Actions
1. Run `scripts/seed-instagram-business-discovery.sql` in Supabase SQL Editor for the target dev account.
2. Confirm verification output: 3 seeded targets, 90 daily rows, capability row enabled.
3. Optionally run the script a second time to confirm row counts remain stable.

## Progress Log (Newest First)
- 2026-03-06 00:45: Added `scripts/seed-instagram-business-discovery.sql` with:
  - account ownership preflight guard for the specified `user_id` + `account_id`,
  - idempotent target/profile upserts for 3 deterministic usernames,
  - deterministic 30-day daily-snapshot upserts (rolling window maintained),
  - temporary capability override (`seeded_for_dev`),
  - verification result sets and optional cleanup SQL block.
- 2026-03-06 00:45: Ran local quality gate `npm run test:all` successfully (typecheck + 20 test files / 131 tests passed).
- 2026-03-06 00:43: Reviewed schema, constraints, and repository governance; created plan file before code changes.

## Context Snapshot
- Target user/account:
  - `user_id`: `4d0da5a8-a1c8-4446-9942-398f87295933`
  - `account_id`: `735b3cb9-76c2-4082-8adb-e379ed32e81c`
- Seed target is one-off operational SQL (`scripts/`), not migration and not `supabase/seed.sql`.
- Script is idempotent via upsert keys:
  - targets: `(account_id, target_username)`
  - profiles: `(target_id)`
  - daily snapshots: `(target_id, snapshot_date)`
- Capability override is explicit and temporary:
  - `facebook_connected=true`
  - `business_discovery_enabled=true`
  - `status_reason='seeded_for_dev'`
  - `facebook_token_expires_at=now() + interval '30 days'`
- Existing unrelated local modifications remain out of scope:
  - `.gitignore`
  - `scripts/.dev_pids`
