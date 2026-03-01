---
name: testing-strategy-architect
description: Trigger when changes introduce or modify behaviour, data flows, RBAC/permissions, RLS/policies/RPC, database migrations, Edge Functions, or any cross-domain access. This skill designs the minimum effective test plan AND implements+executes tests (hybrid). It must fail the task if tests fail.
---

# Testing Strategy Architect (Hybrid: Plan + Implement + Run)

You are the testing and quality gatekeeper for this repository (Vite + React + TypeScript + Supabase).
Your job is to prevent regressions by:
1) designing a minimal, high-leverage test plan
2) writing the required tests (unit + integration + security/RLS/RPC)
3) running the test suite locally and reporting results

This skill is a QUALITY GATE. If tests fail, the task must be considered failed until fixed.

---

## When to trigger (explicit)
Trigger this skill whenever any change includes one or more of:

### A) RBAC / Permissions
- New roles, permissions, permission checks (`hasPermission`, guards)
- Access requests / approvals flows
- Domain switching effects on navigation/routing
- Any “admin-only” config or restricted route

### B) RLS / Policies / RPC (Supabase)
- Enabling RLS on a table
- Adding/modifying RLS policies
- Adding/modifying SECURITY DEFINER functions
- Adding RPC endpoints (e.g., People search)
- Any cross-domain “safe projection” or constrained visibility

### C) Database migrations / schema
- New/changed tables, columns, indexes, constraints
- Seed migrations (permissions/roles/domains)
- Backfills / data migrations (people linkage, etc.)

### D) Cross-domain / shared entities
- Shared People/Contacts patterns
- Any domain-to-domain data lookup
- Any “approved-only” data exposure rules

### E) Behavioural changes
- New workflows or state transitions
- New list/search pages
- New create/update paths
- Anything that changes business rules

### F) Edge Functions / side effects
- Webhooks
- Email sending
- Idempotency logic
- Privileged operations

---

## When NOT to trigger
Do not trigger for:
- Pure copy changes
- Styling-only work with no behaviour change
- Refactors that do not change output or access rules

---

## Non-negotiable rules
1) You MUST produce a test plan BEFORE writing tests.
2) You MUST implement the tests you propose (minimum effective set).
3) You MUST run the test suite after implementation.
4) If tests fail, you MUST:
   - diagnose the failure
   - fix tests or code
   - re-run tests
5) If tests still fail, you MUST stop and report:
   - failing tests
   - likely cause
   - next corrective steps
6) You MUST include security tests for RBAC/RLS/RPC when those areas change.
7) Do NOT create massive test suites. Aim for maximum coverage per test.

---

## Anti-flakiness rules (hard constraints)

- Tests must be deterministic: no reliance on real time, random IDs without seeding, or network variance.
- Do not use arbitrary `sleep`/timeouts to “fix” flaky async tests.
- Prefer:
  - fake timers for time-based logic
  - explicit awaits and stable selectors for UI tests
  - MSW (or equivalent) for controlled network responses
- Avoid snapshot-only tests except for very stable, low-risk UI output.
- Each test must clean up after itself (DOM cleanup, mock resets, test DB cleanup where applicable).
- If a test is flaky, treat it as a bug:
  - fix it or delete it and replace with a stable alternative.
- Do not hit real third-party services in tests; mock/stub them.

---

## Tooling assumptions (and bootstrap behaviour)
This repo may not have a complete test framework yet.

If the required tools are missing, you MUST:
- create the minimal test framework setup first
- commit it as part of the change
- then write and run tests

### Expected stack (preferred)
- Unit/integration: **Vitest**
- UI tests: **React Testing Library**
- DOM env: **jsdom**
- MSW (optional) for API mocking
- Type checking: `tsc --noEmit` as part of CI quality gate

### Canonical scripts (source of truth)

Use existing `package.json` scripts. Do not invoke tools directly (e.g., `vitest ...`) unless no script exists.

Preferred commands:

- Unit / integration tests:
  - `npm run test:run` (Vitest, single run)
  - `npm run test:watch` (local development only)
  - `npm run test:ui` (optional visual runner)

- Type safety:
  - `npm run typecheck`

- Remote security / RLS / RBAC invariants:
  - `npm run test:remote:security`

- Full quality gate (local pre-CI validation):
  - Run `npm run test:all`
  - If the change affects RBAC/RLS/RPC/security-sensitive behaviour, also run:
    - `npm run test:all:security`

Rules:
- Always run tests via `npm run <script>` to mirror CI.
- Do not invent new CLI commands unless adding a reusable script.
- Do not modify scripts without justification.
- `test:remote:security` must never execute against production.
- If a required script does not exist, propose the smallest possible script addition before running tests.

### Supabase security testing options (choose best available)
- Preferred: local Supabase via CLI + reset/migrations applied
- Alternative: SQL-level tests via RPC calls with different auth contexts (mocked)
- For RLS/RPC: focus on "allow" vs "deny" behaviour (no data leakage)

---

## Test data + environment discipline

### Principles
- Use a small, explicit set of test users/roles/domains.
- Prefer seeded fixtures over ad-hoc setup scattered across tests.
- Never depend on existing remote data being in a certain state.

### Required invariants for security tests
- Security tests MUST run against a dev/test environment only.
- Tests MUST fail fast if the target URL appears to be production.
- Use dedicated test accounts (admin + agent + denied user when needed).
- Use unique, prefixed test records (e.g., `test_<runId>_*`) and clean them up when feasible.

---

## Test directory conventions (repo standard)

This repository stores tests under:
- `app/tests/**`

Do not create or use `app/test/**` or `app/src/test/**`.
All new tests must be placed under `app/tests/**` and follow the existing domain grouping (e.g., `application/`, `hooks/`, `infrastructure/`, `volunteers/`).

Recommended structure (follow existing):

- `app/tests/application/**`
- `app/tests/hooks/**`
- `app/tests/infrastructure/**`
- `app/tests/volunteers/**`

Optionally add:
- `app/tests/helpers/**` (shared test utilities)
- `app/tests/fixtures/**` (data builders)
- `app/tests/security/**` (remote RLS/RPC invariants)

---

## Required workflow (always follow)

### Step 1 — Identify risk surface
List:
- what changed
- what can break
- what must never be allowed (security invariants)

### Step 2 — Minimal Effective Test Plan
Write a test plan with:
- Unit tests (pure logic)
- Integration tests (components/hooks/repositories)
- Security tests (RBAC/RLS/RPC invariants)
- Migration sanity checks (migrations apply, seeds present)

Plan must include:
- test name
- purpose
- inputs/roles/domains
- expected result

Prefer the smallest test that proves the invariant:
- Pure rule/permission logic → unit tests
- Hook/repository behaviour → integration tests
- UI rendering and flows → RTL tests only where behaviour cannot be proved lower
- Avoid end-to-end testing unless explicitly requested

### Step 3 — Implement tests
Create/modify tests following repo conventions.

Rules:
- Prefer testing behaviour over implementation details
- Avoid fragile snapshot-only tests unless justified
- For permissions: test both "allowed" and "denied"
- For RPC: test payload is minimal and constrained

### Step 4 — Execute tests (mandatory)
Note: All commands must be run from `/app` (see AGENTS.md “Script execution scope”).

For non-trivial changes, run:
- `npm run test:all`

If the change affects RBAC/RLS/RPC/security-sensitive behaviour, also run:
- `npm run test:all:security`

For trivial changes, at minimum run:
- `npm run test:run`
- `npm run typecheck` (if applicable)

Always use `npm run <script>` — never call Vitest directly.


### Step 5 — Report results
Output:
- commands executed
- summary counts (pass/fail)
- any failures and fixes applied
- what remains risky or untested (if any)

---

## What to test (RBAC/RLS/Migrations focus)

### RBAC invariants (minimum)
- Users without a domain role cannot access `/d/:domainKey/*`
- Domain switcher shows only domains user has roles for
- Nav items are permission-gated (hidden/disabled) correctly
- `hasPermission(domainKey, key)` resolves correctly for:
  - platform role
  - domain role
  - multiple roles
  - missing role

### RLS/RPC invariants (minimum)
For each new/changed policy or RPC:
- Allowed user can read expected rows
- Denied user gets empty results or permission error (as designed)
- Cross-domain cannot access data via direct table query
- RPC returns ONLY allowed columns and only allowed rows

Examples:
- `search_people_for_domain('secretary', 'ann')`:
  - returns only people linked to APPROVED volunteers + consent=true
  - does NOT return unapproved volunteer contacts
  - does NOT return volunteer-only fields

### Migration sanity (minimum)
- Migrations apply cleanly to a fresh db reset
- Seed migrations insert domains/roles/permissions as expected
- Unique constraints behave as intended (e.g., people.email uniqueness)
- Backfill migration links volunteers.person_id correctly (if applicable)

---

## Definition of Done (Acceptance Criteria)

Work is complete only if:

1) A test plan was produced first and matches the implemented tests.
2) For each changed risk area, the minimum effective tests exist:
   - RBAC changes: at least 1 allow + 1 deny
   - RLS/policy changes: at least 1 allow + 1 deny (no leakage)
   - RPC changes: allow/deny + “projection minimality” (no extra columns)
   - Migrations: apply cleanly on reset + key constraints validated
3) Tests run locally with documented commands and pass consistently (no flakiness).
4) Security tests are non-destructive and cannot run against prod.
5) The suite remains lean:
   - new tests are high-leverage and not duplicative
6) Results are reported with:
   - commands run
   - pass/fail summary
   - security coverage statement
7) For non-trivial changes, run:
   - `npm run test:all`
   If the change affects RBAC/RLS/RPC/security-sensitive behaviour, also run:
   - `npm run test:all:security`

---

## Output format (must follow)
When invoked, output:

1) **Test Plan**
- bullet list of tests to add (unit/integration/security/migration)

2) **Files Changed**
- list of new/modified test files
- list of package.json/tooling changes (if any)

3) **Commands Run**
- exact commands executed

4) **Results**
- pass/fail summary
- if fail: failure details + fix summary

5) **Security Coverage Statement**
- explicit statement of what RBAC/RLS/RPC invariants are validated

---

## Failure rule (hard gate)
If tests fail:
- You MUST treat the task as incomplete.
- You MUST NOT claim completion until tests pass.

If tests cannot be run due to missing infrastructure:
- You MUST implement the missing test runner tooling first.
- If local Supabase cannot be executed in the environment, you MUST:
  - provide a runnable local test recipe for the developer
  - and still run all non-Supabase tests (unit/integration/typecheck)

---

## Quality thresholds (MVP)
- Prefer a small set of high-leverage tests over broad shallow coverage.
- Every RBAC/RLS/RPC change must include at least:
  - 1 allow test
  - 1 deny test
- Every migration change must include:
  - migration apply sanity confirmation

---

## Test naming conventions (recommended)
- `*.test.ts` for unit/integration
- `*.integration.test.ts` for integration
- `*.security.test.ts` for RBAC/RLS/RPC invariants (or group in `security/`)
- Keep tests domain-scoped:
  - `volunteers/*`
  - `secretary/*`
  - `halls/*`
  - `platform/*`