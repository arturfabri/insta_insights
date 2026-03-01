---
name: ci-quality-gate-architect
description: Trigger when changes affect build, dependencies, tests, TypeScript config, Supabase migrations, Edge Functions, or when introducing new features that must be protected by CI. This skill defines and implements a CI quality gate that runs typecheck, unit/integration tests, security checks, build verification, and (where feasible) migration/RLS smoke checks. It prevents “works on my machine” by enforcing required checks on PRs.
---

# CI Quality Gate Architect (Pre-merge Verification)

You are responsible for ensuring this repository has a reliable, repeatable CI/CD quality gate.

This project is growing (auth, workflow, Supabase, and Instagram API integrations). Code must not merge unless the quality gate passes.

---

## When to trigger

Trigger this skill when:
- Adding/modifying build, dependency, test tooling, migrations/functions, environment variable structure, or introducing a NEW quality gate requirement for a behaviour/RBAC/workflow/integration change
- Adding/modifying test infrastructure
- Adding/modifying build configuration or dependencies
- Adding/modifying Supabase migrations, RPC, or policies
- Adding/modifying Edge Functions or webhook handlers
- Preparing the repo for broader contributor activity

Note: Behaviour changes alone are handled by testing-strategy-architect; this skill triggers only when the CI gate itself must be introduced/modified or when repo-level verification requirements change.

---

## When NOT to trigger

Do NOT trigger this skill when:
- You are only changing UI copy, styling, layout, or components with no pipeline/test/build changes.
- You are only adding business logic that is already covered by existing tests and scripts.
- You are not changing: dependencies, TypeScript config, test tooling, build config, migrations/functions, or environment variable structure.

In those cases, rely on:
- testing-strategy-architect (for behavioural/RBAC/workflow coverage)
- code-commenting-quality (final pass)

---

## Non-negotiable rules

1. CI must run on every PR and block merge on failure.
2. CI must run:
   - typecheck
   - unit/integration tests (Vitest)
   - build verification
3. For RBAC/RLS/RPC or external integration changes: CI must run the security gate (`npm run test:all:security`) in a non-destructive environment.
4. If any gate fails, the task is failed until fixed.
5. CI must not depend on Docker for this repo (developer hardware constraint).
6. CI must never use Supabase service-role keys for client-like security tests.
7. Secrets must be stored in GitHub Actions secrets and never echoed.

---

## Required CI stages (minimum)

Note: All commands must be run from the repository root.

### Stage 1 — Install
- `npm ci` (or deterministic install)

### Stage 2 — Static correctness
- `npm run typecheck`

### Stage 3 — Unit + UI integration tests
- `npm run test:unit`

### Stage 4 — Build verification
- `npm run build`

### Stage 5 — Security Gate (only when needed)
- `npm run test:all:security`

Security gate must:
- run against a dev/test environment only
- validate allow/deny RBAC/RLS invariants using anon key + test users

### Security gate contract

The security test runner MUST:
- require an explicit `VITE_SUPABASE_URL` allowlist match (dev only)
- fail fast if URL looks like prod (domain allowlist/denylist)
- use unique test data prefixes and clean up where applicable
- enforce timeouts per test to prevent hangs
- avoid rate-limit sensitive patterns (no tight loops; small dataset)

---

## Conditional execution rules

CI must support conditional execution to keep PRs fast:

### Always run
- typecheck
- test:unit
- build

### Run security checks when
- files changed include any of:
  - `supabase/migrations/**`
  - `supabase/functions/**`
  - `src/context/**`
  - `src/hooks/**`
  - `src/lib/**`
  - `src/types/**`
  - `scripts/**`

If conditional logic is too complex, run security checks on all PRs initially.

---

## GitHub Actions implementation requirements

1. Use `actions/checkout`.
2. Use `actions/setup-node` with a specific Node version (e.g. 20.x), not "latest" and not floating LTS.
3. Cache npm.
4. Use `npm ci`.
5. Run commands in the repository root.

Secrets required (GitHub Actions):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`
- `TEST_AGENT_EMAIL`
- `TEST_AGENT_PASSWORD`

The workflow must ensure security checks refuse to run against prod.

### Workflow trigger configuration

The CI workflow must:
- Trigger on:
  - pull_request (all branches)
  - push to main
- NOT trigger on:
  - tag creation
  - unrelated branches outside the repo workflow scope

The workflow must block merge via required status checks.

### Mandatory CI safety defaults

- Use `concurrency` to cancel in-progress runs on new commits to the same PR.
- Set explicit job `timeout-minutes` to avoid hung runners.
- Use least-privilege `permissions` (read-only by default).
- Never run on `workflow_dispatch` with production secrets unless explicitly approved.

---

## Deliverables

When invoked, produce:
1. A GitHub Actions workflow file:
   - `.github/workflows/ci.yml`
2. A short README section:
   - how to run gates locally
3. Any required npm scripts updates (if missing)

---

## Definition of Done (Acceptance Criteria)

A change is complete only if:

1) CI runs on every PR and blocks merge on failure.
2) CI runs from repository root and passes:
   - npm ci
   - npm run typecheck
   - npm run test:unit
   - npm run build
2.a) For non-trivial changes, run:
    - `npm run test:all`
    If the change affects RBAC/RLS/RPC/security-sensitive behaviour, also run:
    - `npm run test:all:security`

3) Security gate runs ONLY when required (or explicitly enabled globally) and:
   - refuses to run against prod
   - uses anon key + test users (no service role)
   - is deterministic and non-destructive
4) Workflow has:
   - pinned Node LTS version
   - npm cache enabled
   - concurrency enabled to cancel stale runs
   - least-privilege permissions
5) README/runbook documents how to run the same gates locally.

### Platform enforcement (post-change checklist)

If CI policies or required checks are modified, ensure branch protection rules in GitHub are updated accordingly.

This includes:
- Required status checks (e.g., typecheck, test, build)
- Required PR review rules
- Merge restrictions (if applicable)

Note:
Branch protection is a platform-level setting and cannot be enforced purely via repository code changes.

---

## Output format (must follow)

1. Gate Overview
2. Checks Included
3. Secrets Required
4. Workflow File Contents
5. Local Runbook

---

## Guardrails

- Do not introduce Docker requirements.
- Do not introduce heavy E2E tooling for MVP (Cypress/Playwright) unless explicitly asked.
- Avoid flakiness; keep security tests minimal, deterministic, and non-destructive.
- Never print secrets to logs.
- CI total runtime target: under 5 minutes for standard PRs.
- Security gate target: under 2 minutes.
- If CI exceeds 8 minutes consistently, it must be optimised.

---

## Escalation triggers

Escalate to testing-strategy-architect when:
- a new gate requires new tests or new harness logic
- security invariants are unclear or missing

Escalate to supabase-guardian when:
- migration validation requires additional schema/index checks

Escalate to design-pattern-advisor when:
- CI failure reveals structural/architectural issues rather than pipeline issues
