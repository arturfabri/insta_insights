# Meta Business Login Single Flow

## Current Status
- Completed

## Checklist
- [x] Replace `/connect` with a single Meta Business Login entrypoint and remove Instagram-first copy/links from the active flow.
- [x] Add shared Business Login URL/query validation helpers and update the Facebook callback page to be the sole OAuth callback flow.
- [x] Make the Business Login token the authoritative sync token path and align Meta endpoints/scopes to the v25.0 guidance.
- [x] Update component/unit/edge tests for the one-flow model and run `npm run test:all`, `npm run test:all:security`, and `npm run build`.

## Progress Log (newest first)
- 2026-03-06 13:33: Completed quality gates. `npm run test:all`, `npm run test:all:security`, and `npm run build` all passed; live security smoke remained intentionally skipped because `SECURITY_TEST_*` env vars were not set.
- 2026-03-06 13:31: Replaced the `/connect` page with a single Meta Business Login flow, removed the Instagram-only callback route/page from the active app, normalized navigation/copy, and added focused `/connect` tests.
- 2026-03-06 13:28: Updated `instagram-oauth-facebook`, `instagram-sync`, and `token-refresh` so Business Login writes the primary token table, keeps the FB token table in sync, prefers the Business Login token for account/business-discovery reads, and uses Graph API `v25.0`.
- 2026-03-06 13:24: Added shared Business Login URL/state/query parsing helpers with Zod validation and updated the Facebook callback page to accept both first-time connect and reconnect flows.
- 2026-03-06 13:02: Created implementation tracking file before code changes. Current repo already had dual-login support, a Facebook callback page, split token tables, and callback tests passing for the existing flow.

## Next Actions
1. Deploy updated edge functions: `instagram-oauth-facebook`, `instagram-sync`, and `token-refresh`.
2. Validate the live Meta Business Login flow with a first-time connect and a reconnect of an existing account.
3. Decide whether the deprecated `instagram-oauth` edge function should be deleted after rollout confirmation.

## Context Snapshot
- User wants one connection flow only: Meta Business Login replaces the current `/connect` experience.
- Supporting document requires Business Login with `enable_fb_login=true`, Graph API `v25.0`, and `instagram_business_basic`, `instagram_business_manage_insights`, `pages_show_list`, `pages_read_engagement`.
- `/connect` is now the sole active connection entrypoint, and the old Instagram-only callback route/page has been removed from the app router.
- Business Login now supports first-time account creation as well as reconnects, and writes the long-lived token to both token tables so sync, refresh, and Business Discovery stay aligned without a new migration.
