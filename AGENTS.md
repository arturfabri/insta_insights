# CCUK Hub — AGENTS.md

This file defines how Codex Agents must operate in this repository.

## Project Overview

**Insta Insights** is a Vite + React + TypeScript web application with Supabase as the backend. The project combines a modern frontend build setup with a serverless backend for authentication, database, file storage, and edge functions.

## Tech Stack

- **Frontend**: React 18+ with TypeScript
- **Build Tool**: Vite (fast development and production builds)
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL database, Auth, Storage, Edge Functions)
- **Type Safety**: TypeScript throughout

---

# Governance Philosophy

This file prioritises:
1. Security over convenience
2. Explicitness over magic
3. Determinism over cleverness
4. Observability over silent behaviour
5. Simplicity over speculative architecture

# 1. Core Non-Negotiables

## Repository Structure

```
insta_insights/
├── .agents/skills         # Codex Skills
├── src/
│   ├── components/        # Reusable React components
│   ├── pages/            # Page-level components (if using routing)
│   ├── hooks/            # Custom React hooks (especially for Supabase)
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client initialization
│   │   └── ...           # Scoring, pattern extraction, filters, export helpers
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── supabase/             # Supabase configuration
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── docs/                 # Documentation
├── scripts/              # Scripts
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

Agents must respect this structure.

## Development Workflow

### Install Dependencies
```bash
npm install
# or yarn install / pnpm install
```

### Development Server
```bash
npm run dev
# Starts Vite dev server (typically http://localhost:5173)
```

### Build for Production
```bash
npm run build
# Creates optimized production build in dist/
```

### Preview Production Build Locally
```bash
npm run preview
# Serves the dist/ folder locally to test production build
```

### Type Checking
```bash
npx tsc --noEmit
# Check for TypeScript errors without emitting files
```

## Environment Rules

- Never expose secrets in client code.
- Never use service role in the browser.
- All secrets must live in Edge Functions or secure server environments.
- All schema changes require migrations.
- No manual database edits.
- No hidden side effects.

## RBAC Rules

- Permission format: `{resource}.{action}`
- Permissions are seeded via migrations.
- Roles are bundles of permissions.
- Frontend constants are not the source of truth.
- RLS is mandatory for protected tables.
- Only PLATFORM_ADMIN can grant roles.

Approved action verbs:
`view | create | update | delete | manage | export | configure | run`

No new verbs without justification.


## Default Behaviour Rule

If a change does not clearly match a specific trigger:

- architectural-boundary-guardian MUST run.
- code-commenting-quality MUST run.

These two skills are baseline discipline for any code modification.

No code change may proceed without them.

Baseline skills apply in addition to any other triggered skills.
They do not replace architectural review for medium/large features.

## Baseline CI Enforcement Rule

For any non-trivial change:

- `testing-strategy-architect` must verify tests pass.
- `ci-quality-gate-architect` must validate build + typecheck + tests if scripts are affected.

For any non-trivial change, the local core quality gate must pass:
- `npm run test:all` (typecheck + unit tests)

Additionally, if the change affects security, permissions, Supabase policies/RPC, workflow access rules, or external integrations, the security gate must also pass:
- `npm run test:all:security` (includes remote security checks)

Transition note (repository alignment):
- If these two scripts are not yet present in `package.json`, run the equivalent commands directly:
  - `npx tsc --noEmit`
  - `npm run test`
  - `npm run build`
- Then create/track the follow-up to add canonical `test:all` and `test:all:security` scripts.

Any behavioural change (logic, workflow, permissions, side effects) must include corresponding test coverage updates.

## Data Access Owner gate (required for data exposure)

Any change that affects **what data is stored or exposed** (new tables/columns, new RPCs, new RLS policies, directory/search features) requires review by the **Data Access Owner** (or the Engineering Lead acting in that role). No merge without confirming:
- the exposure pattern is RPC/view (not duplication),
- the authorisation rules are explicit,
- and RLS/RPC tests exist for the intended roles.

## Plan Persistence & Resume Contract (MANDATORY)

For any task that produces a Codex App Plan (or any multi-step change), the agent MUST:

1) Create a plan file at: `docs/agent-plans/YYYYMMDD_HHMM_<slug>.md`
2) Persist the plan into that file BEFORE coding.
3) Track progress ONLY in that file:
   - tick checklist items
   - append to Progress Log (newest first)
   - keep Current Status + Next Actions updated
4) At the end of every run (or before context compression):
   - update Next Actions + Context Snapshot so work can resume fast

Resume rule:
- If `docs/agent-plans/YYYYMMDD_HHMM_<slug>.md` exists, read it first and continue from "Next Actions".

---


# 2. Skill Registry

Skills are stored in `.agents/skills/` and identified by their `name:` in SKILL.md frontmatter.

Agents must trigger skills according to the rules below.

---

## Architecture and Code Quality

### design-pattern-advisor
Trigger before medium/large feature work or structural changes.
Forces explicit architectural pattern decisions before coding.
Not mandatory for small changes.

### architectural-boundary-guardian
Mandatory for any code change.
Ensures modularity, separation of concerns, and clean architecture.

### code-commenting-quality
Mandatory for any code change.
Ensures readable, maintainable, high-signal comments.

---

## Supabase and Backend Governance

### supabase-guardian
Trigger when:
- Schema changes
- New entities
- Data model modifications
- Auth changes
- Storage usage
- Edge Function implications
- Performance-sensitive queries

Purpose:
Architectural database, Auth, Storage, and Edge review.

### supabase-rls-rpc-author
Trigger when:
- RLS policies required
- Access control rules change
- Cross-domain data access
- Shared entity visibility (e.g., People)
- RPC functions required

Purpose:
Enforce database-level security and hardened RPC design.

### supabase-performance-optimizer
Trigger when:
- New list pages or feeds
- Search (ILIKE, prefix, typeahead)
- Dashboards or counters
- Joins and domain-scoped queries
- RPC functions on hot paths
- Queries expected to grow with data

Purpose:
Ensure correct query shape, indexing strategy, pagination, and long-term scalability.

### insta-api-guardian
Trigger when:
- Instagram Graph API / Meta endpoint usage changes
- OAuth scope/permission requirements change
- API version / metric deprecations affect integration logic
- Host/login model decisions are required (`graph.instagram.com` vs `graph.facebook.com`)
- Sync logic depends on specific Instagram API fields/parameters

Purpose:
Enforce correct, documented, and up-to-date Instagram/Meta API integration behaviour.

Default scopes for this project:
- `instagram_basic`
- `instagram_manage_insights`

---

## Workflow Integrity

### workflow-state-guardian
Trigger when:
- New or modified status fields
- Step-based processes
- Approvals, rejections, restart cycle logic
- Due dates, renewals, expiry rules
- State-triggered notifications or emails

Purpose:
Define explicit state machines, enforce allowed transitions, and ensure auditability.

---

## Frontend Architecture

### react-architecture-guardian
Trigger when:
- New global state or context
- Domain routing/layout changes
- Large feature UI (notifications, CSV import, admin panels)
- Complex forms or modals
- Heavy list rendering or typeahead
- Data fetching pattern changes

Purpose:
Maintain scalable React architecture, clean boundaries, and rendering performance.

### frontend-design
Triggers: when you want a polished UI design pass, landing pages, dashboards, layout/visual refinement (especially where “not AI-slop” matters)

Notes: it’s design/aesthetic heavy; it should not override architecture/security rules

### mobile-design
Trigger when:
- Responsive layout work
- Header or navigation changes
- Footer layout changes
- Section mobile improvements
- Mobile rendering issues

Do not trigger for backend logic or schema changes.

---

## Quality and Governance

### testing-strategy-architect
Trigger when:
- RBAC or permissions change
- RLS/policies/RPC change
- Database migrations added or modified
- Cross-domain access introduced
- Workflow transitions added or modified
- Edge Functions or side effects introduced
- Behavioural logic changes

Purpose:
Design minimum effective test plan, implement unit/integration/security tests, run them, and fail the task if tests fail.

### audit-observability-guardian
Trigger when:
- Approvals or admin actions introduced
- Workflow state transitions modified
- Emails, notifications, webhooks added
- Edge Functions added or modified
- Bulk operations (CSV import)
- Automation rules added

Purpose:
Ensure audit trails, structured logging, idempotency, retry strategy, and admin-visible failure reporting.

---

## Type Safety & Contract Governance

### typescript-contract-guardian
Trigger when:
- API boundaries (RPC, CSV import, webhooks) are introduced or modified
- Route params or JSON configs are introduced
- Cross-domain payload shaping is required
- Runtime validation is needed

Purpose:
Ensure all external boundaries use runtime validation (Zod),
enforce strict TypeScript contracts, and prevent unsafe payload assumptions.

---

## CI / Delivery Governance

### ci-quality-gate-architect
Trigger when:
- Build config changes
- Test strategy changes
- Migration strategy changes
- Environment variable structure changes
- CI/CD pipeline changes

Purpose:
Ensure the project enforces automated quality gates
(build + typecheck + tests + migration validation).
Prevent “works on my machine” failures.

---

## Accessibility & UX Heuristics

### a11y-ux-guardian
Trigger when:
- New interactive components introduced
- Modals, drawers, dropdowns added
- Navigation modified
- Forms created or changed
- Keyboard/ARIA concerns relevant

Purpose:
Ensure WCAG-compliant accessibility,
keyboard navigation support,
focus management,
ARIA attributes,
and usability heuristics.

---

# 3. Skill Orchestration

This section defines invocation order and escalation rules.

---

## 3.1 Skill Invocation Order (Baseline Discipline)

For any non-trivial code change:

1. design-pattern-advisor (if medium/large scope)
2. architectural-boundary-guardian
3. supabase-guardian (if feature touches data)
4. insta-api-guardian (if feature touches Instagram/Meta API contracts)
5. supabase-rls-rpc-author (if feature touches access control)
6. supabase-performance-optimizer (if feature affects queries/lists/search)
7. workflow-state-guardian (if feature affects lifecycle/state transitions)
8. typescript-contract-guardian (if boundary involved)
9. react-architecture-guardian (if feature affects UI structure/state)
10. frontend-design (only if UI design/aesthetic work is in scope)
11. mobile-design (only if mobile/responsive behaviour is affected)
12. a11y-ux-guardian (if interactive UI involved)
13. testing-strategy-architect (if behaviour or RBAC involved)
14. ci-quality-gate-architect (if build/test/migration pipeline affected)
15. code-commenting-quality (final pass before completion)
16. audit-observability-guardian (if feature affects approvals, side effects, or admin actions)

Non-trivial means any change that:
- Alters user-visible behaviour
- Modifies database schema or queries
- Changes permissions or access control
- Introduces or modifies workflow/state logic
- Introduces new external side effects
- Impacts rendering performance
- Adds or modifies cross-domain data flow
- Changes environment variables, config files, or runtime behaviour flags

Trivial changes (e.g., comment fixes, typo corrections, formatting-only updates)
must still respect architectural-boundary-guardian and code-commenting-quality,
but do not require full orchestration sequence.

No implementation should proceed before required skills are triggered.

When triggering skills, the agent must briefly state:
- Why the skill was triggered
- What risk surface it is addressing

### Skill Precedence Rule

If two skills propose conflicting structural changes:

Priority order:
1. Security (supabase-guardian, supabase-rls-rpc-author)
2. Data integrity (workflow-state-guardian)
3. Architecture (design-pattern-advisor, architectural-boundary-guardian)
4. Performance (supabase-performance-optimizer)
5. Type safety (typescript-contract-guardian)
6. Testing (testing-strategy-architect)
7. Observability (audit-observability-guardian)
8. Accessibility (a11y-ux-guardian)
9. Design refinement (frontend-design, mobile-design)

Lower-priority skills must not override higher-priority constraints.

### Skill Minimalism Clause

Skills that are required by trigger rules may not be skipped.
If a required skill is not triggered, the agent must explicitly justify why.
Silently bypassing required skills is a violation of this governance file.

Only trigger skills that are relevant to the change.

Do not trigger:
- frontend-design for backend-only changes
- mobile-design for non-UI changes
- supabase-performance-optimizer unless query growth or list/search risk exists
- audit-observability-guardian unless governance-relevant behaviour is introduced

Skill invocation must be justified by scope.

---

## 3.2 Skill Escalation Flow

Skills must escalate when scope exceeds their remit.

Escalation means:
Pause implementation, run required skill analysis, then continue.

---

### Escalation Rules by Skill

design-pattern-advisor may escalate to:
- supabase-guardian (data implications)
- supabase-rls-rpc-author (permission implications)
- react-architecture-guardian (UI architecture impact)

architectural-boundary-guardian may escalate to:
- design-pattern-advisor (missing pattern decision)
- supabase-guardian (schema implications)
- supabase-rls-rpc-author (access control impact)

supabase-guardian must escalate to:
- supabase-rls-rpc-author (if RLS/policies/RPC required)
- supabase-performance-optimizer (if query growth risk detected)
- workflow-state-guardian (if lifecycle logic involved)

supabase-rls-rpc-author may escalate to:
- supabase-guardian (schema/index additions required)
- workflow-state-guardian (state transition security implications)

supabase-performance-optimizer may escalate to:
- supabase-guardian (index/schema changes required)
- testing-strategy-architect (performance-critical path tests)

insta-api-guardian may escalate to:
- supabase-guardian (if API integration changes require schema/auth/edge updates)
- typescript-contract-guardian (if API payload contracts or runtime validation are required)
- testing-strategy-architect (if integration behaviour requires regression/security coverage)

workflow-state-guardian may escalate to:
- supabase-guardian (schema support required)
- audit-observability-guardian (audit requirements)
- testing-strategy-architect (transition tests required)

react-architecture-guardian may escalate to:
- design-pattern-advisor (pattern shift required)
- supabase-guardian (new data flow introduced)

frontend-design may escalate to:
- react-architecture-guardian (if the design requires component restructuring or shared UI primitives)
- mobile-design (if responsive layout changes are required)
- a11y-ux-guardian (if interaction patterns introduce focus/keyboard/ARIA requirements)
- design-pattern-advisor (if design work reveals a missing UX pattern or systemic layout decision)

testing-strategy-architect may escalate to:
- supabase-guardian (missing migration)
- supabase-rls-rpc-author (missing RLS coverage)
- workflow-state-guardian (missing transition validation)

audit-observability-guardian may escalate to:
- supabase-guardian (audit schema needed)
- supabase-rls-rpc-author (audit visibility constraints)
- testing-strategy-architect (failure scenario tests needed)

typescript-contract-guardian may escalate to:
- supabase-guardian if schema shape mismatch detected
- supabase-rls-rpc-author if permission mismatch detected
- testing-strategy-architect if unsafe boundary requires regression tests

ci-quality-gate-architect may escalate to:
- testing-strategy-architect if missing tests
- supabase-guardian if migration integrity check required
- design-pattern-advisor if architectural flaw detected

a11y-ux-guardian may escalate to:
- react-architecture-guardian if component structure prevents accessibility
- mobile-design if layout issues block usability
- design-pattern-advisor if systemic UX flaw detected

code-commenting-quality may escalate to:
- architectural-boundary-guardian (if comments reveal unclear boundaries or missing intent separation)
- design-pattern-advisor (if change implies structural pressure/pattern choice)
- testing-strategy-architect (if comment-worthy change implies missing tests)
- a11y-ux-guardian (if comment review reveals accessibility-critical interaction logic)

mobile-design may escalate to:
- frontend-design (if improvements require broader visual hierarchy/aesthetic redesign)
- react-architecture-guardian (if mobile fix requires component boundary/state ownership changes)
- a11y-ux-guardian (if mobile navigation/drawers impact keyboard/focus/ARIA)
- testing-strategy-architect (if mobile regression needs coverage)

---

## 3.3 Escalation Loop Prevention

To prevent infinite loops:

1. Escalations are concern-based, not skill-based.
   Concerns:
    - Security
    - Data integrity / Workflows
    - Architecture
    - Performance
    - Type Safety
    - Testing
    - Observability
    - Accessibility / UX
    - Design / UI

2. Each concern may escalate only once per task.

3. After a skill resolves a concern, mark it resolved and continue.

4. Re-escalation is allowed only if new scope is introduced.

5. Each resolved concern must be explicitly marked in output (e.g., “Concern: Performance — Resolved by index addition + pagination”).

No skill may ping-pong endlessly.

---

# 4. Trigger Matrix (Quick Reference)
Non-exhaustive/additive

## Trigger Matrix Scope Clarification

The trigger matrix below is a quick-reference guide for additional skills that may be required based on change type.

All rows are additive to the baseline mandatory skills defined earlier in this document.

The matrix is not exhaustive. Complex changes may require additional skills beyond those listed if structural, security, state, or cross-boundary concerns are introduced.


| Change Type | Required Skills |
|-------------|-----------------|
| UI styling only | architectural-boundary-guardian, code-commenting-quality (mobile-design only if responsiveness or mobile layout is affected) |
| New feature (no DB change) | design-pattern-advisor, architectural-boundary-guardian, testing-strategy-architect |
| New table/entity | design-pattern-advisor, supabase-guardian, supabase-performance-optimizer, testing-strategy-architect |
| RLS/Permissions | supabase-guardian, supabase-rls-rpc-author, testing-strategy-architect |
| Cross-domain data | supabase-guardian, supabase-rls-rpc-author, supabase-performance-optimizer, testing-strategy-architect |
| Workflow transitions | workflow-state-guardian, testing-strategy-architect, audit-observability-guardian |
| File uploads | supabase-guardian, supabase-performance-optimizer |
| Webhooks/email | supabase-guardian, audit-observability-guardian, testing-strategy-architect |
| Instagram/Meta API integration changes | insta-api-guardian, supabase-guardian, testing-strategy-architect |
| Large list/search | supabase-performance-optimizer, testing-strategy-architect |
| API boundary introduced | typescript-contract-guardian, testing-strategy-architect |
| Runtime validation missing | typescript-contract-guardian |
| CI config change | ci-quality-gate-architect |
| Build pipeline change | ci-quality-gate-architect |
| New modal/form | a11y-ux-guardian |
| Keyboard interaction | a11y-ux-guardian |
| ARIA roles required | a11y-ux-guardian |
| Limited projection of sensitive entity (directory/search/people picker) | supabase-guardian, supabase-rls-rpc-author, typescript-contract-guardian, testing-strategy-architect |

When in doubt, prefer invoking the additional specialist skill rather than omitting it.

## Trigger: Limited projection / directory / people search

If a feature includes any of the following:
- “Search by name”, “directory”, “lookup”, “typeahead”, “people picker”
- Exposing a subset of fields from a sensitive table (e.g., name/email/mobile)
- Cross-team visibility into contact details
- “Public info” or “non-sensitive subset” language

**THEN these skills are mandatory (run before implementation):**
- `supabase-guardian`
- `supabase-rls-rpc-author` (**mandatory**)
- `typescript-contract-guardian` (RPC payload + types)

**And these are recommended (depending on scope):**
- `supabase-performance-optimizer` (typeahead/search/indexing/pagination)
- `audit-observability-guardian` (if access is audited / admin views)

**Explicit disallow:**
- Solutions that add a “directory_*” / “*_public” / “*_mirror” table to bypass RLS are **rejected** unless the Engineering Lead + Data Access Owner explicitly approve a strong justification (rare).


---

# 5. Database Governance

All database changes must:

- Be implemented as migrations.
- Include necessary indexes aligned to query patterns.
- Enable RLS for private tables.
- Include policies or RPC for cross-domain visibility.
- Avoid destructive schema changes unless explicitly approved.

Migration naming format:
`YYYYMMDDHHMMSS_description.sql`

Legacy alignment note:
- Existing bootstrap migrations may retain numeric prefixes with appended timestamp
  (example: `001_core_tables_YYYYMMDDHHMMSS.sql`).
- All new migrations must use the canonical timestamp-first format above.

If a skill introduces or implies schema changes:

- supabase-guardian MUST be triggered.
- testing-strategy-architect MUST validate migration behaviour.
- ci-quality-gate-architect MUST ensure migration integrity in pipeline (if applicable).

## Public directory & limited-field exposure (NO shadow tables)

When the product needs an account/media directory or any **limited projection** of a sensitive entity (e.g., creators/users), the default pattern is:

**MUST**
- Use a **Postgres RPC** (preferred) to expose a minimal set of fields (e.g., `full_name`, `email`, `mobile`) to authorised roles.
- Apply **least privilege**: return only fields required for the UX and only rows the caller is allowed to see.
- Enforce access at the database level using **RLS** and/or **SECURITY DEFINER RPC** with explicit authorisation checks.
- Provide stable filtering/search behaviour (e.g., `q` parameter) and apply pagination limits.

**MUST NOT**
- Create “public”, “directory”, “lookup”, or “mirror” tables (e.g., `public_instagram_accounts`, `instagram_media_directory`, `*_public`) **just to make access easier**.
- Duplicate PII into broader-access tables as a shortcut around RLS complexity.
- Rely on frontend filtering or API-only checks as the enforcement mechanism.

**Reason:** shadow tables quietly become a second source of truth and often weaken access control. If only a subset of fields should be exposed, expose a subset via RPC/view — not via duplication.


---

# 6. Edge Function Governance

Use Edge Functions when:

- Secrets are required.
- Webhooks are involved.
- Idempotency is required.
- Privileged multi-domain logic is required.
- Third-party APIs are called.

Never expose provider keys in client code.

---

# 7. Required Output for Major Changes

For non-trivial features, agents must output:

1. Impact Summary
2. Schema/Migration Plan
3. Access Rules
4. Performance Plan (if relevant)
5. Workflow Model (if relevant)
6. Observability Plan (if relevant)
7. Test Plan
8. Implementation Steps
9. Commands Executed (if tests run)
10. Concern Resolution Summary
    - List all concerns raised
    - Which skill resolved them
    - Final state of each concern

For changes affecting security, permissions, or workflow transitions,
include an explicit “Failure Modes & Abuse Cases” section.

If the change exposes a subset of fields from a sensitive table,
the Implementation Steps must explicitly document:
- Why RPC was chosen
- The authorisation model inside the RPC
- The fields returned (explicit list)

---

# 8. Forbidden Shortcuts

- No skipping migrations.
- No direct service-role usage in client.
- No relying only on UI permission checks.
- No permission strings invented ad hoc.
- No uncontrolled `SELECT *` on hot paths.
- No mixing domain concerns across features.
- No state transitions without explicit validation.
- No silent failures for side effects.
- No expanding scope beyond the original change without explicit justification.
- No architectural rewrites unless triggered by required skills.
- No adding new top-level folders without architectural-boundary-guardian approval.
- No feature may reduce security posture, RBAC strictness, or RLS coverage.
- No change may weaken auditability or observability.
- No change may introduce hidden side effects.

---

This AGENTS.md governs all future development.
All agents must comply before producing code.

Compliance Rule:
If an agent produces code that violates this governance file,
the change is considered invalid and must be reworked.

Versioning Note:
This governance file evolves. Any structural modification to AGENTS.md
must be reviewed using design-pattern-advisor and testing-strategy-architect.
