# Albumcrafter agent rules

These rules apply to the whole repository. Read them before changing code, and preserve the existing product direction unless the user explicitly asks for a redesign.

## Project shape

- This is a React 19 + TypeScript + Vite app with a Cloudflare Worker route.
- Main UI entry points are `src/App.tsx`, `src/styles.css`, `src/content.ts`, and `src/icons.tsx`.
- The product is a local-first photo album studio: editable pages, explicit browser save, PNG/PDF/JSON export, and optional AI-assisted drafts.
- Keep the existing architecture and dependencies. Do not add a dependency for a problem that the current stack or platform can solve.

## Required skills

When available in the agent environment, use these skills for the matching work:

- `production-web-standard` for every website or web-app change; use its Definition of Done and verification guidance.
- `frontend-ui-engineering` for UI components, layouts, interactions, accessibility, and responsive behavior.
- `frontend-design` when creating or materially reshaping visual direction; the existing Albumcrafter direction below remains authoritative.
- `vercel-react-best-practices` for React performance or component-pattern changes.
- `playwright` for browser verification of UI changes and important user journeys.
- `ponytail` to keep changes focused, reuse existing patterns, avoid speculative abstractions, and prefer the smallest complete solution.

If a named skill is unavailable, follow these repository rules and the existing code patterns instead. Do not invent a replacement framework or design system.

## Albumcrafter visual language

The UI is an editorial travel field book: warm paper, quiet ink, expressive serif headlines, compact mono labels, asymmetric composition, thin rules, and restrained clay accents. It should feel considered and tactile, not like a generic dashboard.

Use the existing tokens in `src/styles.css` before introducing new values:

- Ink: `#202720`
- Muted text: `#687168`
- Paper: `#ede9df`
- Rule: `#c8c5ba`
- Clay accent: `#8c5949`
- Moss/hero: `#314038`
- Warm terracotta panel: `#d5b49f`
- Display: `Fraunces`, with the existing `Georgia` fallback
- Body: `DM Sans`, with the existing `Arial` fallback
- Utility/data: `DM Mono`, with the existing monospace fallback

Design rules:

- Preserve the warm neutral, moss, sage, clay, and paper palette. Do not default to purple/indigo, neon gradients, or glossy SaaS styling.
- Preserve the type hierarchy and editorial contrast: serif display type, sans body copy, mono metadata.
- Prefer asymmetry, whitespace with purpose, hairline rules, small labels, and one memorable visual gesture over decoration everywhere.
- Use the existing spacing rhythm, radii, borders, and shadows. Avoid rounded-everything cards, oversized padding, heavy layered shadows, and stock card grids.
- Use real product language and realistic content. No lorem ipsum, vague labels, dead links, fake controls, or placeholder TODO UI.
- Keep motion restrained and meaningful. Always support `prefers-reduced-motion: reduce`.
- Treat album pages as print-like compositions. Do not casually change page dimensions, export behavior, photo cropping, or editable canvas behavior.

## UI quality bar

- Build mobile-first and verify at roughly 320px, 768px, 1024px, and 1440px widths.
- Never introduce unintended horizontal overflow.
- Every interactive control must be a real keyboard-accessible `button`, `a`, or form control with a visible focus state and a clear accessible name.
- Label form fields, provide useful loading/error/empty/success/disabled states, and never rely on color alone to communicate state.
- Keep heading levels semantic and copy in sentence case with active, plain verbs.
- Preserve the skip link, focus-visible styling, alt text, sanitization, photo URL allowlist, and other existing safety/accessibility behavior.
- Prefer existing components, helpers, tokens, and patterns. Keep components focused and avoid abstractions with only one use.

## Change and verification rules

- Inspect the relevant flow and existing callers before editing. Keep the diff to the fewest files that fully solves the request.
- Do not change product scope, storage behavior, export formats, AI contracts, or security headers unless the user asks for it or the change is required to make the requested work function.
- For UI changes, run `npm run build` and use browser verification when available. Check both `/` and `/craft`, the primary interaction changed, console/runtime errors, keyboard access, and responsive layout.
- For logic changes, run the most relevant existing check and add only the smallest useful regression check when the behavior is non-trivial.
- Report exactly what was verified. Do not claim a check passed if it was not run.

