---
name: code-commenting-quality
description: Add or review code comments to improve readability by documenting non-obvious intent, constraints, tradeoffs, bug-fix reasoning, and integration assumptions; remove stale or redundant comments; use when asked to improve comments, maintainability, or explain tricky logic during code edits or reviews.
---

# Mission

Improve code readability with high-signal comments. Explain why/constraints, not line-by-line behavior.

## When to use this skill

Use this skill when:
- Adding or modifying business rules, workflows, permissions, or security-sensitive logic
- Introducing new exported functions/hooks/services used across modules
- Refactoring code in ways that change intent or constraints (not just renaming/moving)
- Fixing bugs where the root cause or prevention rationale must be preserved
- Reviewing complex integrations or infrastructure assumptions

Prefer applying this skill to high-risk areas: auth, permissions, data access, workflow orchestration, concurrency, integrations, and error handling.

---

## When NOT to add or modify comments

This skill is always invoked for code changes.

However, for styling/layout-only work or purely mechanical refactors, the correct outcome is often:

- **No comment changes needed** (verified: no new intent, rules, constraints, or safety boundaries)

Do NOT add or modify comments when:
- Changes are limited to styling, layout, or simple UI composition
- The code is self-explanatory through naming and structure
- The change is purely mechanical (formatting, renaming only, file moves)
- Adding comments would result in narration or duplication of the code

In these cases, explicitly state: **“No comment changes needed (verified: no new intent/rules/boundaries).”**

---

## Workflow

1. Read changed code plus nearby comments.
2. Refactor naming/structure first if clarity can remove comment need.
3. Decide per location:
   - Add comment if reasoning is non-obvious.
   - Update/remove stale or redundant comments.
   - Choose no comment when code is self-explanatory.
4. Verify every kept/added comment matches current behavior.
5. Output a short Commenting Check summary.

---

## Rules (non-negotiable)

- Explain why, risk, constraint, or tradeoff; do not narrate what code does.
- Keep comments short, local, and durable.
- Prefer better names/extracted functions over explanatory prose.
- Never leave stale comments after behavior changes.
- Add source links for copied/derived logic or non-obvious external behavior.
- Use TODO/FIXME only in strict format:
  TODO(<owner|team>): <action> — <why deferred> — Done when: <testable condition>
  FIXME(<owner|team>): <bug> — Impact: <user/system impact> — Done when: <testable condition>
- Never leave vague TODOs.
- Remove TODOs that no longer apply in the same PR.
- For bug fixes, state root cause and why the fix prevents recurrence.

---

## Comment Staleness Rule

If a code change makes an existing comment inaccurate, the comment MUST be updated or removed.
Stale comments are treated as bugs.

---

## Required Comment Coverage

### 1) Public surfaces
Add TSDoc/JSDoc for exported functions/classes/types and entrypoints (API handlers, jobs, consumers) with:
- intent/guarantee
- key assumptions/constraints
- side effects (I/O, DB writes, external calls)
- params/returns only when non-obvious

### 2) Non-obvious decisions
Add a short why-comment for intentional tradeoffs, compatibility constraints, ordering requirements, or schema/infra limits.

### 3) Tricky logic
Comment dense business rules, regex/bitwise/numeric edge cases, concurrency/retry/idempotency/transaction boundaries, and security-sensitive checks (reasoning only, no secrets).

### 4) Integrations/adapters
Document API/SDK assumptions: timeout/retry/error/pagination/idempotency behavior; link reference when behavior is surprising.

### 5) Bug fixes
Document cause and prevention rationale; ensure tests cover the failure mode when appropriate.

### 6) Incomplete implementation
Use contextual TODO format from Rules.

---

## Disallowed / Discouraged

- Comments that restate code (“set x”, “increment i”).
- Boilerplate blocks repeating method names.
- Long narrative comments likely to drift from code.

--- 

## Signal Test (quick check)

- Bad: `// Increment index`
- Good: `// Use <= here to include the sentinel row required by downstream CSV parser.`

- Bad: `// Call API`
- Good: `// Provider returns 200 with partial failures; inspect 'errors' array before committing.`

---

## Definition of Done (Acceptance Criteria)

A change is complete only if:

1) All new exported functions/hooks/services have concise docblocks explaining:
   - intent
   - assumptions/constraints (if any)
   - side effects (if non-obvious)
2) All non-obvious business rules or security boundaries introduced/modified are documented with “why” comments.
3) No narration comments exist (comments that restate what the code already says).
4) No stale comments remain in modified areas.
5) TODO/FIXME entries follow the required strict format or are removed.
6) Comment density remains reasonable:
   - Prefer 1 strong comment over 5 weak ones.
   - Prefer better naming or refactoring over additional comments.

---

## Required Output For Any Code Change

### Commenting Check
Return one of:
- 1–5 bullets listing comments added/updated/removed, or
- `Decision: No comment needed` + one-sentence reason.
