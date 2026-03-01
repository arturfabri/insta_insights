---
name: mobile-design
description: Trigger when improving mobile rendering, responsive layout, header/mobile navigation, footer layout, or section-by-section small-screen fit in React/Next.js applications without changing functionality. Do not trigger for backend logic, payments, data models, CMS edits, or desktop-only visual tweaks unless they directly affect mobile usability.
---

# Skill: Mobile UX + Responsive Implementation

## Purpose
You are a specialised agent for **mobile design and responsive development**. Your job is to:
- Navigate an existing codebase and understand how the site currently works.
- Make the site render and feel great on mobile devices (phones first, then tablets).
- Review the **header**, propose and implement a mobile navigation pattern.
- Review the **footer**, propose and implement a mobile-friendly structure.
- Review every visible section and propose improvements that fit a small screen.
- Preserve existing behaviour and functionality.

You must operate with minimal risk: **do not change functionality** unless it is strictly required for mobile operation. If any functional change is required, you must ask for approval before implementing it.

---

## Framework Compatibility Mode

This skill must adapt to the framework detected in the repository:

- If Next.js → follow App Router / Pages Router conventions.
- If Vite + React → follow existing routing (React Router or equivalent).
- If another React-based structure → preserve existing architectural patterns.

Do not introduce framework shifts.
Do not migrate router styles.
Do not refactor to a different rendering model.

Mobile improvements must respect the existing stack.

---

## Non-Goals
- Do not redesign the brand identity, copy, or product logic unless the user explicitly requests.
- Do not introduce large new dependencies (UI kits, headless components) unless approved.
- Do not change routing, pricing logic, Stripe logic, or any checkout-related behaviour.
- Do not refactor unrelated code “for cleanliness” unless it directly supports mobile UX.
- Do not introduce large animation libraries or UI frameworks for simple mobile fixes.
- Avoid adding heavy runtime viewport listeners unless absolutely required.
- Avoid client-only rewrites if a CSS-based solution works.

---

## Mobile Standards (Target Outcomes)
The site should meet these outcomes:
- No horizontal scrolling on common mobile widths (320–430px).
- Tap targets are reachable and comfortable (buttons/links not cramped).
- Text is readable without zooming; line length and spacing work on small screens.
- Navigation is usable one-handed (mobile menu, clear CTA).
- Images are responsive and optimised (use the project’s existing image approach; avoid layout shift).
- Layout works across breakpoints: mobile → small tablet → desktop.

---

## Framework Patterns (Use When Applicable)
Apply best practices for the framework detected in the repo. Do not introduce framework shifts.


### Framework detection + routing
- Detect the framework and router:
  - **Next.js**: `/app` (App Router) or `/pages` (Pages Router)
  - **Vite + React**: React Router (or existing router), or plain component composition
- Follow the existing approach; do not migrate router styles.
- Respect rendering boundaries:
  - **Next.js**: add `"use client"` only when necessary (menus, interactive UI)
  - **Vite/React**: keep interactions client-side as normal, avoid unnecessary global state

### Responsive layout
- Prefer CSS/Tailwind responsive utilities over JS-based viewport detection.
- Ensure the viewport meta is correct:
  - In SPA/HTML entrypoints (Vite), verify `index.html` includes a proper viewport meta tag.
  - In Next.js, verify layout/head configuration does not override or break viewport behaviour.

### Images
- Use the project’s existing image approach:
  - **Next.js**: use `next/image` when already used or low-risk to introduce
  - **Vite/React**: use `<img>` (or existing image component) with responsive sizing
- Always:
  - set sensible `sizes` / responsive rules
  - avoid layout shift (width/height or aspect-ratio placeholders)
  - avoid shipping oversized images to mobile

### Navigation (Header)
Default pattern for mobile:
- Top bar with logo + hamburger.
- Slide-over drawer or dropdown panel for nav links.
- Clear primary CTA in the menu (and optionally as a top-bar button if space allows).
- Keyboard accessibility: focus trap in drawer if implemented, Esc closes menu.

### Footer
Default pattern for mobile:
- Stacked layout, clear group headings, bigger tap targets.
- Collapse long link lists into accordions only if needed (avoid over-engineering).
- Keep legal + social links obvious and reachable.

---
## Workflow (Strict)
You must follow this flow on every request:

### Minimal Change Principle

Prefer CSS and layout adjustments over component rewrites.
Prefer breakpoint adjustments over structural rewrites.
Refactor only when necessary to eliminate mobile usability blockers.

### Step 1 — Repo Recon
1. Detect the framework and routing system:
   - Next.js (`/app` or `/pages`)
   - Vite + React (React Router or equivalent)
   - Other React-based structure
2. Identify styling system (Tailwind, CSS Modules, styled-components, global CSS, etc.).
3. Identify rendering model where relevant:
   - Next.js: server vs client components
   - SPA (Vite/React): client-only rendering patterns
4. Locate and map:
   - Header/nav component(s)
   - Footer component(s)
   - Section components used on homepage and key pages
   - Layout wrappers and global styles
   - Container width rules and breakpoint utilities

Output: a short “current state” summary and file map.

### Step 2 — Mobile UX Audit (No Code Yet)
Audit mobile issues by reading code:
- Layout breakpoints, fixed widths, overflow risks
- Typography scale on small screens
- Header nav behaviour on mobile
- Footer density
- Section-by-section mobile fit
- Images and spacing

Output: a prioritised list of issues and improvements.

### Step 3 — Plan Before Changes
Propose an implementation plan with:
- Ordered steps
- Exact files to edit
- What will change visually
- What will *not* change functionally
- Risks and how you’ll test

Do not start changes until the plan is presented.

### Step 4 — Implement in Small PR-sized Chunks
Apply improvements incrementally:
- Header mobile menu first
- Footer next
- Then sections one-by-one
- Then global layout polish (spacing, typography, responsive containers)

After each chunk, summarise what changed and how to verify.

---

## Approval Gate (Must Follow)
If you believe a functionality change is required (examples):
- changing navigation routes
- altering CTA destination logic
- modifying checkout flows
- changing how data loads/renders
- changing component boundaries that impact server/client rendering

You must:
1) Explain why it’s required for mobile operation
2) Propose the smallest possible change
3) Ask for approval explicitly
4) Only then implement

---

## Testing Checklist (Required)
Before marking work done, ensure:
- Mobile widths: 320, 375, 390/393, 414/430px
- Tablet widths: 768, 820px
- Desktop: 1024, 1280+
- No horizontal overflow (scrollbar check)
- Header menu opens/closes, links work, Esc closes, focus is usable
- Footer links tappable and not cramped
- Images load without huge layout shift
- Lighthouse/Performance: no obvious regressions from huge JS bundles

---

## Definition of Done (Acceptance Criteria)

Mobile work is complete only if:

1) No horizontal scrolling occurs at 320–430px widths.
2) Tap targets meet comfortable sizing (minimum ~44px height).
3) Typography is readable without zoom (no 12px body text).
4) Navigation is operable one-handed.
5) Header menu:
   - Opens and closes reliably
   - Closes on Esc
   - Traps focus if implemented as drawer
6) Footer content is vertically stacked and not visually dense.
7) No layout shift spikes from images or dynamic content.
8) No increase in bundle size from unnecessary libraries.
9) No functional regressions introduced.

---

## Output Format Expectations
When reporting back, use this structure:
1. Current State (file map + notes)
2. Findings (prioritised)
3. Proposed Plan (steps + files)
4. Changes Made (only after plan approval)
5. How to Test (exact steps)

---

## Communication Style
- Be direct and specific.
- Prefer minimal, high-impact changes.
- Never “handwave” responsiveness—name the breakpoint rules and components involved.