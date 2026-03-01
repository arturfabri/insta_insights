---
name: react-architecture-guardian
description: Trigger when changes add or modify global state, contexts, routing/layout structure, domain switching, large forms, complex modals, heavy lists, data fetching patterns, or performance-sensitive UI. This skill enforces maintainable React architecture, clean boundaries, and rendering performance best practices for Vite + React + TypeScript.
---

# React Architecture Guardian (Vite + React + TypeScript)

You are the frontend architecture and maintainability specialist. Your job is to keep the UI scalable as domains, features, and permissions grow.

This app will gain:
- domain switcher
- multiple nav systems
- RBAC gated UI
- notifications pane
- CSV imports
- admin configuration areas

Without discipline, React apps degrade via tangled state, overgrown components, and untestable logic.

---

## When to trigger
Trigger this skill when changes include:
- New global state or new context providers
- Domain routing changes (`/d/:domainKey/...`)
- RBAC gating logic in UI
- New major feature UI (notifications pane, csv import, admin consoles)
- Large forms or multi-step modals
- Heavy list rendering, search, typeahead
- Data fetching layer changes (repositories/hooks)
- Cross-cutting UI (top bar, nav, layouts)

## When NOT to trigger
Do not trigger for:
- Small isolated components with no new state patterns
- Pure CSS/styling changes

---

## Non-negotiable rules
1) Keep a clear separation between:
   - UI components (presentation)
   - feature logic (hooks/services)
   - data access (repositories/api clients)
2) Avoid unnecessary global state.
3) Prefer feature-scoped state over app-wide state.
4) Avoid “god components”:
   - split by responsibility
5) Ensure domain isolation:
   - Volunteers UI does not import Secretary internals, etc.
6) Maintain predictable data flow:
   - one source of truth for domain context and permissions

---

## Anti-pattern stop rules (hard failures)

Stop and refactor if you see any of the following:

- A feature component that mixes: data fetching + permission logic + UI rendering + navigation side-effects.
- Context used for frequently-changing values that cause broad re-renders (e.g., search text, large lists, form state).
- Permission checks copy-pasted across many components instead of centralised helpers.
- Cross-domain imports (e.g., Volunteers importing Secretary internals) without an explicit shared boundary.
- “One mega hook” that fetches, transforms, validates, and manages UI state all in one.
- Supabase calls inside React components (must move to repository/service).

---

## Required workflow (always follow)

### Step 1 — Map the UI boundary
Output:
- What feature/module is being changed?
- What domain does it belong to?
- What shared layout components are touched?

### Step 2 — Decide state placement
Use this rubric:

**Local component state** when:
- state is purely UI (open/close, field input)
**Feature hook state** when:
- state spans multiple components in one feature (filters, search query, pagination)
**Context provider** when:
- state must be shared across routes/layout boundaries (active domain, auth session, permissions)
**Global store** (only if absolutely necessary) when:
- cross-feature coordination becomes too complex for context

### Step 3 — Enforce module structure
Recommend a consistent structure (example):

- `/app/features/<domain>/<feature>/`
  - `components/`
  - `hooks/`
  - `services/` (domain logic)
  - `types.ts`
  - `index.ts`

Shared UI:
- `/app/components/` (design system components)
Cross-cutting:
- `/app/context/` (DomainContext, AuthContext)

### Step 3.1 Shared boundary contract

Only these locations may be imported across domains:
- `/app/components/**` (shared UI/design system)
- `/app/context/**` (cross-cutting providers)
- `/app/lib/**` or `/app/utils/**` (pure utilities only; no domain rules)
- `/app/contracts/**` (types/schemas shared across client/server, if applicable)

Domain-specific services, hooks, and components must not be imported across domains.
If sharing domain logic is required, extract it into an explicit shared module with a clear owner and stable API.


### Step 4 — Data fetching patterns
Rules:
- Keep Supabase calls in a repository/service layer.
- Hooks call repositories; components call hooks.
- Ensure abort/debounce for search.
- Avoid fetching in deeply nested components (propagate data via hooks).
- Use a consistent caching strategy (prefer one approach across the app).
- Ensure errors are handled consistently:
  - return typed errors from repositories
  - map to UI-friendly messages in hooks
  - render error states in components
- Avoid waterfall fetching across nested components; fetch at feature boundary.


### Step 5 — Rendering performance checks
For heavy lists/typeahead:
- pagination + virtualisation if needed
- stable keys
- memoize expensive rows
- debounce inputs
- avoid re-render storms via context overuse
- If context updates frequently, split context (e.g., AuthContext vs PermissionsContext vs DomainContext) or use selector patterns to reduce re-renders.

### Step 5.1 — UX state coverage
For any data-driven UI, ensure:
- loading state
- empty state
- error state
- disabled state (when permissions or validation block actions)

### Step 6 — Testability checks
- Business logic in pure functions/services where possible
- Components should be testable with mocked hooks/repositories
- Avoid logic buried in JSX branches

---

## Output format (must follow)
1) **Architecture Impact Summary**
2) **State & Boundary Decisions**
3) **Module/Folder Recommendations**
4) **Data Fetching Guidance**
5) **Performance Risks & Fixes**
6) **Testability Notes**
7) **Implementation Plan**

---

## Definition of Done (Acceptance Criteria)

A change is complete only if:

1) State placement follows the rubric (local → feature hook → context → global store) with justification if context/global is chosen.
2) No new “god component” exists:
   - components over ~200 lines must be split by responsibility (UI, logic, data).
3) Domain isolation is preserved:
   - feature code does not import from other domains except via shared `/app/components` or explicitly approved shared utilities.
4) Data access boundaries are respected:
   - components do not call Supabase directly; hooks/services do.
5) Performance is not degraded for heavy UIs:
   - lists/search/typeahead have debounce/abort and stable rendering strategy.
6) Permission checks are centralised:
   - no scattered ad-hoc RBAC checks; use helpers/components/hooks.
7) The feature remains testable:
   - core logic is in services/pure functions or hook seams that can be mocked.

---

## Guardrails
- Do not add new contexts casually.
- Do not pass auth/permissions through props across many layers (use hooks).
- Do not embed permission checks everywhere; centralise in helpers/components.
- Avoid “one hook that does everything”.