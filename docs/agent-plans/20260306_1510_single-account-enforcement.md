# Single Account Enforcement

## Current Status
- Completed

## Checklist
- [x] Add a schema migration that enforces `instagram_accounts.user_id` uniqueness with duplicate preflight.
- [x] Update OAuth and sync edge functions to treat one account per user as a hard invariant.
- [x] Simplify frontend hooks and `/connect` so the app no longer models multiple accounts.
- [x] Add or update regression tests for schema contracts, hooks, pages, and the affected edge-function logic.
- [x] Run the local quality gate and record the result.

## Progress Log (newest first)
- 2026-03-06 16:15: Enforced the single-account invariant end-to-end. Added migration `20260306153000_enforce_single_instagram_account_per_user.sql`, rewired both OAuth functions to reject cross-account relinks, removed frontend account-selection storage/UI, added single-account helper/tests, and passed `npm run test:all`, `npm run test:all:security`, and `npm run build`.
- 2026-03-06 15:10: Created tracking file before code changes. Current schema still allows multiple account rows per user, ConnectPage still renders multi-account selectors, and OAuth writes still upsert on `(user_id, instagram_user_id)` instead of `user_id`.

## Next Actions
1. If any deployed environment already contains duplicate `instagram_accounts` rows per user, clean those rows before applying the new migration.
2. Consider deleting the deprecated `instagram-oauth` handler entirely once all environments have fully moved to Meta Business Login.

## Context Snapshot
- `useInstagramAccount()` is now the source of truth and fails closed when duplicate account rows exist.
- `useInstagramAccounts()` is now a compatibility wrapper that returns either `[]` or `[account]`.
- `/connect` no longer keeps any account picker or local selected-account storage; reconnect still passes `accountId` only for callback compatibility.
- `instagram-oauth-facebook`, deprecated `instagram-oauth`, and `instagram-sync` now resolve the user account singularly and reject attempts to link a different Instagram account.
