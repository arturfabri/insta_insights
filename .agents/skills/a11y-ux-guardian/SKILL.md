---
name: a11y-ux-guardian
description: Trigger when changes affect navigation, headers, menus, drawers/panes (notifications bell), modals, forms, tables, or any interactive UI. This skill enforces accessibility (keyboard, focus, ARIA) and UX heuristics (clarity, feedback, empty states, error states, responsiveness). It is complementary to mobile-design and focuses on interaction quality and inclusivity.
---

# Accessibility & UX Guardian (A11y + Heuristics)

You are responsible for ensuring the UI is accessible, predictable, and usable as the product grows.

This system includes role-based UI, modals, panes (notification drawer), admin workflows, and high-frequency lists. These are common sources of accessibility regressions.

---

## When to trigger

Trigger this skill when changes include:
- Header, navigation, menus, domain switcher
- Notification bell and notification pane/drawer
- Any modal/dialog
- Any form (create/edit/import)
- Tables/lists with actions
- Search/typeahead/autocomplete
- Any new interactive component
- Any UX flow involving errors, success, retries, confirmations

---

## When NOT to trigger

Do NOT trigger this skill when:
- The change is purely visual (spacing/colour/typography) with no interaction changes
- You are editing static copy only (no new controls, no new flows)
- Backend-only changes with no UI surface impact
- Pure refactors that do not change DOM structure, focus behaviour, or control semantics

If uncertain, run a quick scan: “Did tab order, labels, roles, or interactive states change?” If no, do not trigger.

---

## Non-negotiable rules

1. Everything interactive must be usable by keyboard only.
2. Focus must be managed correctly:
   - focus moves into modal/pane on open
   - focus returns to trigger on close
   - focus is trapped inside modal where appropriate
3. All controls must have accessible names (label/aria-label).
4. Use correct semantics:
   - `button` for actions
   - `a` for navigation
   - headings in order
5. Every flow must have:
   - loading state
   - empty state
   - error state with recovery path
6. Touch targets must be usable on mobile:
   - no tiny icons without padding
7. Avoid “silent failure” UX:
   - show toast/banner or inline validation

---

## Required checks (minimum)

### Keyboard and focus
- Tab order is logical
- No keyboard traps (unless intentional in modal)
- Escape closes modals/panes
- Enter/Space activates buttons
- Focus visible styles are present

### Overlays, portals, and scroll-lock edge cases

- If modals/drawers render in a portal:
  - ensure focus management still targets the correct element
  - ensure `aria-hidden`/`inert` is applied correctly to background where used
- Ensure only ONE scroll container is active:
  - body scroll locked when overlay open
  - overlay content scrolls if needed
- Ensure overlays have correct stacking and dismissal:
  - Esc closes
  - close button is reachable and labelled
  - clicking backdrop closes only if intended (and does not trap focus)
- If a drawer/pane is non-modal (background still usable):
  - do NOT trap focus
  - do provide a clear dismissal path and keep tab order logical

### Screen reader semantics
- Notification button has `aria-label="Notifications"`
- Notification count uses `aria-live` if updated dynamically
- Modals use `role="dialog"` and `aria-modal="true"`
- Modal title wired via `aria-labelledby`
- Form fields have `label` or `aria-label`
- Error messages linked via `aria-describedby`
Accessible name sources (prefer in this order):
1) Visible `<label>` (forms)
2) `aria-labelledby`
3) `aria-label` (icons/buttons with no text)
Avoid placeholder-only labelling.


### UX heuristics
- Clear primary action per screen
- Destructive actions require confirmation
- Inline validation for forms (esp. CSV mapping)
- Bulk operations show progress and outcome summary
- Retry paths for failed email/automation actions
- Aggregated notifications must explain grouping (“3 updates on Volunteer X”)

### Mobile usability
- Tap targets min ~44px equivalent
- Drawer/pane does not block essential navigation
- Scroll locking works correctly with modal/pane
- No horizontal overflow

### Motion & animation
- Respect `prefers-reduced-motion`.
- Avoid essential information being conveyed only via animation.
- Ensure animated drawers/modals remain usable if animations are disabled.


---

## Required workflow (always follow)

### Step 1 — Inventory interactive elements changed
List all components affected (menus, modals, panes, forms, lists).

### Step 2 — A11y acceptance criteria
Define explicit criteria for:
- keyboard
- focus
- ARIA naming
- error messaging

### Step 3 — UX acceptance criteria
Define:
- loading/empty/error states
- confirmations
- success feedback
- recovery actions

### Step 4 — Implementation guidance
Recommend the minimal changes to meet criteria without redesigning the app.

### Step 5 — Tests (where feasible)
At minimum, add component tests for:
- modal opens and focus is placed correctly
- close returns focus to trigger
- notification bell has accessible name
- critical buttons are reachable by keyboard

Run tests using canonical scripts:
- `npm run test:run` for component/unit tests
- Include a focused test file for overlays/forms where modified
- Prefer role-based queries (e.g., `getByRole`) over brittle selectors

If the repo later adds Playwright, expand to E2E a11y checks.

---

## Definition of Done (Acceptance Criteria)

Work is complete only if:

1) All interactive elements are keyboard-usable:
   - Tab/Shift+Tab reachable, Enter/Space activates as expected
2) Focus is predictable:
   - on open: focus moves into modal/drawer/pane
   - on close: focus returns to the trigger
   - focus is trapped only where appropriate (modal/dialog)
3) Accessible naming exists for all controls:
   - label or `aria-label` or `aria-labelledby`
4) Semantics are correct:
   - buttons for actions, links for navigation, headings ordered
5) Dynamic updates are announced appropriately:
   - use `aria-live` only for meaningful updates (not noise)
6) Every interactive flow includes:
   - loading, empty, error + recovery path, and success feedback
7) Mobile interaction does not regress:
   - tap targets ~44px, no overflow, scroll locking works for overlays
8) No “accessibility hacks”:
   - avoid unnecessary ARIA when semantic HTML solves it
9) Changes do not introduce new console warnings related to accessibility or DOM nesting.


---

## Output format (must follow)

1. Inventory of Interactive Changes
2. A11y Requirements (keyboard/focus/ARIA)
3. UX Requirements (states/feedback/recovery)
4. Mobile Interaction Notes
5. Test Recommendations
6. Acceptance Criteria Checklist

---

## Guardrails

- Do not require a full redesign to meet a11y basics.
- Use existing component library patterns where possible.
- Avoid excessive ARIA; prefer correct HTML semantics first.
- Do not block delivery for minor copy issues; block only for real usability/accessibility failures.
- Never add ARIA roles that duplicate native HTML semantics (e.g., role="button" on <button>).

