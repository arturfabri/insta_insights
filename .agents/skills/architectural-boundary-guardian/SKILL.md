---
name: architectural-boundary-guardian
description: >
  Enforces a decision-first architectural approach for TypeScript/Node.js code.
  Introduces repositories or other structural patterns only when justified by
  structural pressure, coupling risk, or reuse needs, with strict separation
  of concerns and safety guardrails.
applies_to:
  - TypeScript
  - Node.js
  - Backend
  - Architecture
  - Refactoring
priority: high
---

## Mission

When generating or modifying code, use a **decision-first architecture**:
- Start simple (functions/modules) and introduce patterns only when structural pressure exists.
- Maintain separation between domain/business logic and infrastructure concerns.
- Use repositories **only when they reduce coupling or enable test seams**.
- Use Generic Repository patterns **rarely** and only when they clearly reduce duplication without leaking unsafe CRUD.

---

## When to use this skill

Use this skill when:
- You are introducing a new domain area or service boundary
- Persistence logic is spreading across modules (coupling risk)
- There is repeated access/query logic that needs a stable seam for testing or change
- You need a clear split between application use-cases and infrastructure
- Complexity is growing and refactoring to explicit boundaries will reduce risk

## When NOT to introduce new structural patterns

This skill is always invoked for code changes.

However, for small, local, or time-boxed changes, the expected outcome may be:

- No new pattern
- No new repository
- No new abstraction layer
- A simple, well-named module/function is sufficient

Do NOT introduce repositories or additional layers when:

- You only need 1–2 queries and no reuse is expected
- The abstraction would add more indirection than value
- The project already has a preferred data-access pattern in place (follow it)

The correct outcome in these cases is: **“No structural change required.”**

---

## Architecture Decision (required output before changes)

Before implementing, output:

- Context: what is changing (1–3 bullets)
- Structural pressures: variation, coupling, reuse, test seams, lifecycle, integration boundaries
- Decision (choose ONE):
  - No new pattern (keep it simple)
  - Module boundary only (service/helper module)
  - Repository (entity-specific, not generic)
  - Adapter/Facade (integration boundary)
- Rationale: 2–5 sentences (trade-offs + why simplest)
- Guardrails: what you will NOT introduce

---

## Core Principles

1. **Separation of Concerns**
   - Domain and application layers must never depend on DB drivers, ORMs, or query builders.
   - Persistence logic should not leak into domain/application layers.
   - Use repositories when they reduce coupling or enable stable seams.

2. **Open/Closed Principle**
   - Extend abstractions instead of duplicating or modifying core logic.
   - Shared behaviour belongs in base classes or shared contracts.

3. **Generic Reuse, Not Generic Leakage**
   - Use generics to eliminate duplicated CRUD logic.
   - Never expose generic operations that violate domain rules.

4. **Safety Over Convenience**
   - Do not expose `update`, `delete`, or similar operations unless they are explicitly valid for the entity.

---

## Pattern menu (preferred order)

Choose the simplest that solves the problem:

1) **Clean module boundary** (default)
   - A well-named service/module with pure functions and clear inputs/outputs.

2) **Entity-specific repository** (when needed)
   - Use when persistence logic needs a stable seam or reuse across use cases.

3) **Adapter / Facade** (for integrations)
   - Wrap external SDKs/APIs so domain/application code stays stable.

4) **Generic repository** (rare)
   - Allowed only when:
     - 3+ entities share truly identical CRUD mechanics
     - domain rules do not require intent-specific operations
     - it does NOT leak unsafe operations

---

## Required Architectural Layers

Use logical separation of responsibilities. Formal folders are optional unless the project already uses them.

- **domain/**
  - Entities, value objects, domain rules
  - No persistence or framework code

- **application/**
  - Use cases / application services
  - Orchestrates domain + repositories

- **interfaces/** (or **ports/**)
  - Repository contracts used by the application layer

- **infrastructure/**
  - Repository implementations
  - Database clients, ORM adapters, mappers

Folder names may vary, **responsibilities must not**.

Do not introduce new top-level layer folders unless the repo already follows that structure or the change is large enough to justify it.

---

## Repository Pattern Rules

### 1. Define Repository Contracts First

- Repositories are accessed through interfaces.
- Prefer split contracts when appropriate:
  - Read-only (`find`, `findById`, `list`)
  - Write (`create`, `update`, `delete`)
- Application code depends only on these interfaces.

---

### 2. Generic Base Repository (rare, optional)

A generic base repository is allowed only when it reduces real duplication without leaking unsafe CRUD.

Rules:
- Do not introduce a generic base for a single entity.
- Do not expose `update`/`delete` by default.
- Prefer composition over inheritance where practical.
- If introduced, it must be justified in the Architecture Decision.


---

### 3. Use Entity-Specific Repositories

- Each entity has its own repository class.
- Entity repositories:
  - Extend the base repository
  - Add entity-specific queries or behaviours
- Never put entity-specific logic in the generic base.

---

## Guardrails: When Generic Repositories Must Be Restricted

If an entity has **business constraints** such as:
- Partial immutability
- Restricted updates
- Domain-specific actions (e.g. credit/debit, approve/reject)

Then **do not expose generic CRUD blindly**.

Codex must enforce safety using **one or more** of the following:

1. **Split Interfaces**
   - Implement only `ReadRepository<T>` where writes are forbidden.

2. **Specialised Methods**
   - Replace `update()` with explicit intent methods
     (e.g. `credit()`, `archive()`, `activate()`).

3. **Protected Base Methods**
   - Keep generic CRUD protected.
   - Expose only allowed operations from concrete repositories.

4. **Use-Case Enforcement**
   - Only application use cases can invoke sensitive operations.
   - Repositories never bypass domain rules.

---

## Anti-overengineering stop rules

Do NOT introduce any of the following unless explicitly required and justified:

- Dependency injection containers
- “Framework” base classes for speculative future reuse
- Generic repositories that expose CRUD without intent-specific constraints
- New layer folders that don’t match existing repo structure
- More than one new abstraction level for a small change

If in doubt: choose “No new pattern” and keep the code simple.

---

## Complexity Budget Rule

- A structural change must reduce net cognitive complexity.
- If the abstraction adds more mental overhead than the original problem, reject it.
- Prefer deleting duplication over abstracting duplication prematurely.
- Do not introduce more than one new abstraction level for a small feature.

---

## Mandatory Pre-Generation Checklist

Before finalising code, the agent must verify:

1. Domain rules and invariants are identified
2. Repository boundaries are clearly defined
3. Repository contracts exist and are used by the application layer
4. Generic repositories do not expose unsafe operations
5. Infrastructure code is isolated
6. Business logic is testable with mocked repositories

---

## Code Conventions

- Prefer explicit types and meaningful generics
- Use constructor dependency injection
- Repositories must be stateless
- No global DB access
- Clear, predictable error handling

---

## Definition of Done

A solution is complete only if:

- The Architecture Decision is documented (including “No new pattern” when chosen)
- The chosen structure reduces coupling or improves testability without adding unnecessary indirection
- Persistence/integration details do not leak into domain/application logic
- Any repositories introduced expose only safe, intent-aligned operations
- The code can be unit-tested with mocked boundaries (where boundaries exist)
- The resulting structure is simpler to reason about than before (not just more “correct” architecturally).


