# Full Audit Remediation Plan

Date: 2026-03-01 22:30 (Europe/London)
Scope: Implement P1→P2→P3 remediation plan from full project audit, including migrations, edge-function hardening, frontend contracts, security gates, CI workflow, and accessibility/test-hygiene fixes.

## Checklist
- [x] Phase 0: Persist plan and capture baseline quality gates
- [x] Phase 1: Fix cron/auth mismatch, OAuth log sanitization, generate-brief persistence enforcement, reels metric mapping
- [x] Phase 1: Add shared helpers + helper unit tests + vitest include expansion
- [x] Phase 1 verification: typecheck + unit + all + build
- [x] Phase 2: Add token-split migration with verification SQL
- [x] Phase 2: Add policy/RPC/index migration with verification SQL
- [x] Phase 2: Migrate edge functions to token table
- [x] Phase 2: Frontend projection hardening + RPC migration + Zod contracts
- [x] Phase 2: Implement security gate scripts/tests + package scripts + CI workflow
- [x] Phase 2 verification: typecheck + all + security + build
- [x] Phase 3: Export menu accessibility semantics/focus/keyboard
- [x] Phase 3: Remove OAuth callback act warnings and add/adjust tests
- [x] Final verification: lint + all + security + build
- [x] Update README runbook for security/CI gates
- [x] Finalize plan log/status/context snapshot

## Current Status
Completed: All three phases implemented and verification gates passing locally.

## Next Actions
1. Apply new Supabase migrations to dev/stage and run live smoke checks with SECURITY_TEST credentials.
2. Add GitHub repository secrets required by `.github/workflows/ci.yml` security job.
3. Enforce required CI checks in branch protection.

## Progress Log (Newest First)
- 2026-03-01 22:47: Completed final verification (`lint`, `test:all`, `test:all:security`, `build`) with passing results; local security smoke intentionally skipped due missing SECURITY_TEST env vars.
- 2026-03-01 22:46: Implemented Phase 3 accessibility/test-hygiene fixes: ExportMenu keyboard/focus semantics and OAuth callback async test stabilization.
- 2026-03-01 22:45: Implemented Phase 2 security/data/perf hardening: token split migrations, policy+RPC migration, edge function token-table migration, Zod RPC contracts, security scripts, CI workflow, README runbook updates.
- 2026-03-01 22:38: Implemented Phase 1 remediations: caller auth helper, sanitized provider errors, brief request validation, corrected insights metric mapping, cron header invoke, and edge function updates.
- 2026-03-01 22:34: Captured baseline gates (`test:all`, `build`, `lint`) before modifications.
- 2026-03-01 22:30: Created remediation execution plan file and initialized checklist/status.

## Context Snapshot
- New migrations added:
  - `supabase/migrations/20260301224501_move_tokens_to_private_table.sql`
  - `supabase/migrations/20260301224502_harden_accounts_policies_and_add_media_rpc.sql`
- Edge functions now support cron-safe sync invocation and token reads from `instagram_account_tokens`.
- Frontend media list path now uses `list_media_with_insights` RPC with Zod validation.
- Security gate is now composed of baseline tests + policy-contract test + live RLS smoke script.
- CI workflow now exists at `.github/workflows/ci.yml` with conditional security job.
