# AGENTS Alignment Plan

Date: 2026-03-01 19:46 (Europe/London)
Scope: Align `AGENTS.md` with current repository reality based on explicit user decisions.

## Checklist
- [x] Capture user-approved decisions for discrepancies
- [x] Patch `AGENTS.md` for `.agents/skills` path and styling stack reality
- [x] Update migration naming policy text to include current migration timestamp handling
- [x] Rename existing migration files to append current timestamp
- [x] Update affected code/docs references after migration rename
- [x] Validate git diff and finalize with step-by-step `package.json` instructions

## Current Status
Completed. AGENTS and migration naming alignment applied; package-script rollout steps prepared.

## Next Actions
1. Optionally apply the provided `package.json` script changes to add `test:all` and `test:all:security`.
2. Keep all future migrations on timestamp-first naming format.

## Progress Log (Newest First)
- 2026-03-01 21:43: Fixed accidental top-level duplicate keys in `package.json`; verified `test:all` and `test:all:security` both pass.
- 2026-03-01 21:42: Added `typecheck`, `test:unit`, `test:all`, and `test:all:security` scripts to `package.json`; validated both `npm run test:all` and `npm run test:all:security` pass.
- 2026-03-01 19:48: Patched AGENTS, renamed existing migrations with timestamp suffix, and updated references.
- 2026-03-01 19:46: Created plan file for AGENTS alignment task.

## Context Snapshot
- User explicitly deferred RBAC and code-audit concerns.
- User requested practical step-by-step for adding required test scripts.
- Structural AGENTS changes must be carefully constrained to approved items.
