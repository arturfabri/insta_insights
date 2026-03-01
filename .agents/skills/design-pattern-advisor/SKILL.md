---
name: design-pattern-advisor
description: For medium/large changes or when structural pressure exists (e.g., variation growth, conditional sprawl, integration boundaries), analyse the feature, decide whether a design pattern is warranted, and if so propose and implement a minimal, justified pattern choice; “no pattern” is allowed and often preferred.
---

## Mission

For any feature, refactor, or bugfix that creates or changes code, produce a **Pattern Decision** and then implement the change accordingly.

This skill is not about forcing patterns. It is about:
- recognising when a pattern helps,
- selecting the simplest appropriate pattern,
- and avoiding unnecessary complexity.

---

## When to use this skill

Use this skill when:
- A feature introduces structural complexity (multiple behaviours, branching growth, integration boundaries)
- Repeated conditionals suggest future variation
- Domain logic is leaking into infrastructure code (or vice versa)
- A subsystem needs clear boundaries for testability or extension
- A workflow/lifecycle is becoming state-heavy

---

## When NOT to use this skill

Do NOT use this skill when:
- The change is small and localised
- There is no evidence of variation or future extension
- Simpler refactoring (rename, extract function, split module) solves the issue
- Introducing a pattern would increase indirection without solving a concrete problem

Default bias: **No pattern unless structural pressure exists.**

---

## Non-negotiables

- **“No pattern” is allowed** and is often the correct decision.
- Prefer the **simplest design** that meets requirements.
- If a pattern is used, use **one primary pattern** (and at most one alternative).
- Implement patterns **minimally**: no frameworks, no abstractions without a clear need.

---

## Pattern Decision (required output before code)

Before writing or editing code, output this short section:

### Pattern Decision
- Context: What is changing and why (1–3 bullets).
- Signals: Which forces exist (variation, coupling, complexity, lifecycle, integration, testability).
- Decision: **No pattern** OR **Use <PatternName>**.
- Rationale: 2–5 sentences (include trade-offs).
- Scope: Where it applies (which modules/files).
- Guardrails: What you will NOT do (to prevent overengineering).

If **No pattern**:
- Provide a brief justification (1–2 sentences), and implement with clean, straightforward code.

---

## When a pattern is warranted (selection signals)

Recommend a pattern only when at least one is true:
- You see repeated conditional logic that will grow (“if/else ladder”, “switch explosion”).
- You expect multiple interchangeable strategies/algorithms.
- You need to decouple subsystems that currently know too much about each other.
- You are integrating a third-party API that should not leak into domain/application code.
- You need a stable workflow with variable steps.
- You need durable action encapsulation (queueing, retries, logging, undo/audit).

---

## Anti-pattern detection (stop signals)

Do NOT introduce a pattern if:

- The abstraction has only one implementation and no foreseeable variation.
- The pattern adds more files than real behavioural complexity justifies.
- The change is primarily about readability, not variation.
- The same result can be achieved with:
  - a well-named function,
  - a small extracted module,
  - a clearer data structure.

Patterns must reduce cognitive load, not increase it.

---

## Pattern Reversal Rule

If an existing pattern no longer provides value (e.g., only one strategy remains, variation removed, adapter unused), prefer simplifying or inlining the abstraction.

Removing unnecessary patterns is considered a valid and often superior outcome.

---

## Pattern selection guide (use as a heuristic)

Pick the **closest match** and keep it minimal:

- **Strategy**: interchangeable algorithms/rules (pricing, scoring, validation rulesets).
- **Factory Method / Abstract Factory**: creation varies by config/runtime/environment.
- **Adapter**: wrap external APIs/SDKs so internal code stays stable.
- **Facade**: simplify a complex subsystem behind a small interface.
- **Decorator**: optional behaviours without subclass explosion.
- **Observer (Pub/Sub)**: event-driven reactions without tight coupling.
- **Command**: encapsulate actions for queues, retries, audit, or undo.
- **State**: behaviour varies heavily by lifecycle/state transitions.
- **Template Method**: fixed workflow structure, variable steps.
- **Chain of Responsibility**: pipeline/handlers where order may change.

--- 

## Implementation rules

- Add only the abstractions needed to solve the stated problem.
- Name abstractions by intent (not by pattern), e.g. `PricingStrategy`, `EmailProviderAdapter`.
- Keep construction simple; prefer explicit wiring over magic.
- If you introduce interfaces, ensure at least one clear consumer and one test seam.

### Complexity Budget Rule

- A pattern must reduce net cognitive complexity.
- If introducing the pattern adds more conceptual overhead than the original problem, reject it.
- Prefer deleting code over abstracting code.
- Do not introduce:
  - dependency injection containers,
  - generic repositories,
  - base classes for future speculation,
  - multi-layered indirection without present need.

---

## Definition of Done

A change is complete only if:

1) A **Pattern Decision** is documented (even if “No pattern”).
2) The decision explicitly explains:
   - why this is simpler than alternatives,
   - what future variation it enables (if any),
   - what trade-offs were accepted.
3) If a pattern is introduced:
   - It solves a real structural pressure.
   - It reduces coupling or conditional growth.
   - It introduces the minimum number of abstractions required.
4) No speculative architecture is introduced.
5) The resulting code is easier to reason about than before.


