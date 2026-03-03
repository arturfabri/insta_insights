# Dual Login Progressive Upgrade Plan

## Current Status
- In progress

## Checklist
- [x] Add migration for `instagram_account_capabilities` + `sync_logs.capability_gaps` + backfill + verification SQL
- [x] Update edge functions (`instagram-oauth`, `instagram-oauth-facebook`, `instagram-sync`) for capability lifecycle
- [x] Add frontend route/page for Facebook OAuth callback
- [x] Add capability type + hook and wire Connect page optional Meta upgrade UX
- [x] Add/adjust tests for migration contracts and new UI/auth behavior
- [x] Run quality gates (`npm run test:all`, `npm run test:all:security`, `npm run build`)

## Progress Log (newest first)
- 2026-03-02 22:13: Completed quality gates (`npm run test:all`, `npm run test:all:security`, `npm run build`) with all passing; security smoke intentionally skipped without `SECURITY_TEST_*` env vars.
- 2026-03-02 22:12: Added frontend implementation for progressive Meta upgrade:
  - New callback route/page `OAuthFacebookCallbackPage`
  - New hooks `useInstagramAccounts` and `useAccountCapabilities`
  - Connect page account picker + optional Meta upgrade card/status
  - Feature-gate component `BusinessDiscoveryCapabilityGate` for BD entrypoints
- 2026-03-02 22:11: Updated edge functions:
  - `instagram-oauth` now upserts capability projection while preserving existing FB upgrades
  - `instagram-oauth-facebook` now updates capability projection and returns capability payload
  - `instagram-sync` now reads capability state, falls back to FB token probe, records `capability_gaps`, and marks partial when BD is unavailable
- 2026-03-02 22:10: Added migration `20260302221500_add_account_capabilities_and_sync_capability_gaps.sql` with capability table, sync-log `capability_gaps`, RLS/privileges, backfill, and verification SQL.
- 2026-03-02 22:02: Created implementation tracking plan file before code changes.

## Next Actions
1. Push migration `20260302221500_add_account_capabilities_and_sync_capability_gaps.sql` to target Supabase environments.
2. Deploy updated edge functions (`instagram-oauth`, `instagram-oauth-facebook`, `instagram-sync`).
3. Validate manual OAuth flows for both paths in DEV (Instagram baseline + Meta upgrade).

## Context Snapshot
- Repo currently supports Instagram Login baseline.
- Facebook OAuth frontend flow is wired with a dedicated callback route and account-scoped state.
- Business discovery sync is capability-gated and emits explicit `capability_gaps` diagnostics in `sync_logs`.
