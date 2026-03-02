# Instagram Regression Hotfix Plan

Date: 2026-03-02 16:28 (Europe/London)
Scope: Diagnose and remediate post-remediation regressions affecting Instagram reconnect and sync (`instagram-sync` 500 + OAuth reconnect failure).

## Checklist
- [x] Capture failure evidence from Supabase logs and browser console export
- [x] Confirm current edge function + migration assumptions in local codebase
- [x] Implement compatibility fallback in edge functions for mixed-schema environments
- [x] Improve server error visibility (structured details without sensitive data)
- [x] Add/adjust tests for compatibility paths and failure messaging
- [x] Run quality gates for changed scope (`typecheck`, `test:unit`, targeted/all tests)
- [x] Update remediation status and operator next actions

## Current Status
Completed in code: edge-function compatibility hotfix + tests merged locally and validated. Pending: deploy updated functions and verify Meta app OAuth platform settings.

## Next Actions
1. Deploy `instagram-sync`, `instagram-oauth`, and `token-refresh` to the affected Supabase project.
2. Ensure migration `20260301224501_move_tokens_to_private_table.sql` is applied in that same project (or keep fallback until applied).
3. Fix Meta app configuration for Instagram OAuth (`Invalid platform app`), then retry reconnect.
4. After successful migration rollout, remove legacy token-column fallback path in a cleanup pass.

## Progress Log (Newest First)
- 2026-03-02 16:33: Implemented compat hotfix in edge functions:
  - `instagram-sync` now falls back to legacy `instagram_accounts.access_token_enc` if token table missing/unavailable.
  - `instagram-oauth` now retries account upsert for legacy NOT NULL token column and falls back if token table relation is absent.
  - `token-refresh` now supports legacy token reads/writes when token table is absent.
- 2026-03-02 16:34: Added `_shared/token-store.ts` + `_shared/token-store.test.ts` for schema-compat error classification and safe legacy token extraction.
- 2026-03-02 16:35: Ran local quality gates successfully: `npm run test:all`, `npm run build`, `npm run lint`.
- 2026-03-02 16:36: Ran `npm run test:all:security` successfully (policy checks passed; live smoke intentionally skipped because `SECURITY_TEST_*` env vars were not set).
- 2026-03-02 16:28: Confirmed two distinct issues: (a) Instagram authorize returns `Invalid platform app` from Meta, (b) sync 500 likely from DB/function schema skew after token-table split.
- 2026-03-02 16:25: Reviewed affected edge functions and migrations; current code requires `instagram_account_tokens` and assumes dropped `instagram_accounts.access_token_enc`.
- 2026-03-02 16:22: Loaded user-provided Firefox console export and Supabase edge log context.

## Context Snapshot
- Browser log shows OAuth redirect fails at Instagram host before callback with `Invalid request: ... Invalid platform app`.
- `instagram-sync` now returns actionable token lookup `details` and supports legacy token fallback for mixed-schema rollout states.
- If migration `20260301224501_move_tokens_to_private_table.sql` was not applied in the target project, both reconnect and sync can fail.
