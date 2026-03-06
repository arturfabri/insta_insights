# Seed Account + Token Bootstrap Plan

Date: 2026-03-06 14:07 (Europe/London)
Scope: Update `scripts/seed-instagram-business-discovery.sql` so it can bootstrap account creation and token rows for `user_id=4d0da5a8-a1c8-4446-9942-398f87295933`.

## Checklist
- [x] Persist plan file before finalizing implementation
- [x] Replace account-exists preflight with user-exists + account-ownership guard
- [x] Add idempotent account upsert in seed script
- [x] Ensure token creation path exists for both `instagram_account_tokens` and `instagram_account_fb_tokens`
- [x] Expand verification output to include account identity + token row counts
- [x] Run local quality gate (`npm run test:all`)
- [x] Update plan status, next actions, and context snapshot

## Architecture Decision
- Context:
  - Seed script should work even when the account row is absent.
  - Must remain idempotent and scoped to one user/account pair.
- Decision: **No new pattern (keep operational SQL script only)**.
- Guardrails:
  - No schema migrations.
  - No frontend/API changes.

## Current Status
Completed in workspace. Seed script now bootstraps account + token rows and quality gate is green.

## Next Actions
1. Run `scripts/seed-instagram-business-discovery.sql` in Supabase SQL Editor.
2. Confirm verification output shows account row + both token row counts (`instagram_token_rows=1`, `facebook_token_rows=1`).
3. Continue with full flow validation from the seeded state.

## Progress Log (Newest First)
- 2026-03-06 14:08: Passed local quality gate: `npm run test:all` (24 files / 159 tests).
- 2026-03-06 14:08: Added token cleanup safety in optional cleanup block for placeholder IG token rows.
- 2026-03-06 14:07: Added user-existence preflight, account ownership guard, account upsert, and token/account verification output.

## Context Snapshot
- Target seed principal:
  - `user_id`: `4d0da5a8-a1c8-4446-9942-398f87295933`
  - `account_id`: `735b3cb9-76c2-4082-8adb-e379ed32e81c`
- Account bootstrap identity values:
  - `instagram_user_id`: `seed_ig_user_735b3cb9_76c2_4082_8adb_e379ed32e81c`
  - `username`: `seed_creator_account`
- Verification now includes account identity fields plus token counts for:
  - `public.instagram_account_tokens`
  - `public.instagram_account_fb_tokens`
