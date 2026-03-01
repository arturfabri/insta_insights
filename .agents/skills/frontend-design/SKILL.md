---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---

## When to use this skill

Use this skill when:
- Designing or redesigning UI for pages, sections, components, dashboards, forms, navigation, or layouts
- Improving visual hierarchy, spacing, typography, colour system, or responsiveness
- Building new UI flows that require cohesive interaction design (states, empty/loading/error)
- Creating a distinctive aesthetic direction for a product surface (not just “make it pretty”)

## When NOT to use this skill

Do NOT use this skill when:
- The task is primarily backend, data modelling, migrations, or security logic
- The change is a small copy edit or trivial CSS tweak
- A specialised skill should lead (a11y-ux-guardian for accessibility, mobile-design for mobile layout, react-architecture-guardian for state/architecture)

Default behaviour: if unclear, propose a design plan first instead of generating large UI code changes.

---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

---

## Constraint-first mode

If the user specifies:
- A design system
- Brand guidelines
- A token system
- A framework constraint (e.g. Tailwind-only, no external fonts)

You must prioritise consistency over creative divergence.

Creativity must operate within constraints when they exist.

---

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

Exception: Within the same product or application, maintain internal consistency.
Variation is for different projects or distinct product surfaces—not for unrelated divergence within a single system.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Commit to a distinctive vision and execute it with precision—bold or minimal, but always intentional and production-ready.

---

## Engineering guardrails (non-negotiable)

- **Accessibility**: Must be keyboard navigable, sensible focus states, correct semantic HTML, labelled inputs, and ARIA only when necessary.
- **Responsiveness**: Must work on mobile (360px), tablet, and desktop. Avoid layouts that break below 390px width.
- **Performance**: Avoid heavy animation libraries and expensive effects by default. Prefer CSS animations and lightweight patterns.
- **Maintainability**: Prefer reusable components and consistent tokens over one-off inline styles.
- **No dependency creep**: Do not add new libraries unless explicitly requested or clearly justified with a minimal impact alternative rejected.
- **No functional regressions**: Do not change business logic or data flows unless required for UI correctness; escalate if needed.
- Match implementation complexity to product value.
- Do not introduce elaborate animation systems for simple CRUD interfaces.
- Avoid ornamental complexity that increases maintenance burden without UX benefit.

---

## Definition of Done (Acceptance Criteria)

A UI change is complete only if:

1) A clear aesthetic direction is stated (1–2 sentences).
2) The layout works at:
   - Mobile (360px)
   - Tablet
   - Desktop
3) All relevant states are implemented:
   - Loading
   - Empty
   - Error
   - Disabled (where applicable)
4) Accessibility basics are satisfied:
   - Keyboard navigable
   - Visible focus states
   - Proper semantic structure
   - Labelled inputs
5) No visual token sprawl:
   - Colours, spacing, typography, and radii are consistent and reusable.
6) No unnecessary dependencies were introduced.
7) No business logic was modified unintentionally.

---

## Output format (must follow)

1) Aesthetic Direction (1–2 sentences)
2) Layout Plan (bullets)
3) Component/Section Breakdown (what you will build/change)
4) Key Tokens (palette/typography/spacing/radius/shadow)
5) Implementation (code)
6) Responsive + A11y checklist (what was verified)
7) Notes / Trade-offs (only if non-trivial)

