# Skills Sanity Audit Plan

Date: 2026-03-01 21:47 (Europe/London)
Scope: Audit all `.agents/skills/*/SKILL.md` files against `AGENTS.md` and current stack in `README.md`, then align governance docs.

## Checklist
- [x] Inventory all local skills
- [x] Extract each skill's declared name/scope/trigger/output
- [x] Compare skills vs AGENTS skill registry and trigger matrix
- [x] Compare skills vs current tech stack and architecture
- [x] Identify concrete mismatches and required changes
- [x] Patch `AGENTS.md` to include `insta_api_guardian`
- [x] Apply any additional minimal alignment edits (if needed)
- [x] Summarize findings and recommended next actions

## Current Status
Audit + alignment complete. Skill docs, AGENTS governance, and OAuth scope usage are now aligned to Insta Insights conventions.

## Next Actions
1. Keep future skills/examples scoped to current project language (account/media/insights) and avoid importing legacy domain terms.
2. If CI introduces remote security harness scripts later, update `ci-quality-gate-architect` and `testing-strategy-architect` with exact script names and execution safeguards.
3. Optionally add a lightweight lint/check script for skill-doc consistency (scopes, script names, and root paths).

## Progress Log (Newest First)
- 2026-03-01 22:11: Patched skill docs for repo-aligned scripts/paths/examples, normalized Instagram permissions to `instagram_basic` + `instagram_manage_insights` (including `insta_api_guardian` references), updated AGENTS scope note, and aligned OAuth scope in `src/pages/ConnectPage.tsx`.
- 2026-03-01 21:50: Completed skills sanity audit and patched AGENTS skill registry/orchestration/trigger matrix for `insta-api-guardian`.
- 2026-03-01 21:47: Created plan and listed all skill directories and SKILL files.

## Context Snapshot
- Existing skills listed in AGENTS include 15 governance skills.
- New skill `insta_api_guardian` exists on disk and is referenced in AGENTS as `insta-api-guardian`.
- Canonical Instagram permissions for this project are now documented and used consistently: `instagram_basic`, `instagram_manage_insights`.
