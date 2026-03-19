# NeuralBox Engineering Rules

This document is the default standard for all future work in this repository.

## 1) Core Principles

- Build for reliability first, then features.
- Prefer simple, explicit code over clever shortcuts.
- Keep user data private and local by default.
- Every feature must be observable, testable, and documented.

## 2) Project Environment

- Required runtime: Node `>=20 <26`.
- Run `npm run env:check` before development sessions.
- Run `npm run build` before every commit.
- Run `npm run test:stability` for UI/runtime changes.

## 3) Architecture Rules

- `src/main.js` orchestrates UI and user flow only.
- Persistence logic must live in `src/db/` modules.
- No direct `localStorage` reads/writes in UI orchestration code.
- Add feature-specific helpers in focused modules when complexity grows.
- Keep functions small and purpose-specific.

## 4) Database and Data Rules

- Use the database layer (`src/db/database.js`) for settings, conversations, and model selection.
- All persistence changes must include a migration strategy for existing user data.
- Preserve backward compatibility whenever possible.
- Validate and normalize loaded records before rendering.
- Never silently drop user conversations during migrations or imports.

## 5) Code Quality Rules

- Use clear names and deterministic logic.
- Avoid duplicated logic; extract reusable helpers.
- Handle errors with user-safe messages and actionable logs.
- Prefer immutable transformations when practical.
- Keep comments concise and only where logic is non-obvious.

## 6) UI and UX Rules

- Default behaviors must be predictable and low-surprise.
- Advanced capabilities should be explicitly discoverable and optional.
- Long operations must show progress or status.
- Destructive actions must be intentional and reversible when possible.
- Mobile and desktop interactions must both be verified.

## 7) Testing and Verification Rules

- Every bug fix should add or strengthen a test path.
- For runtime behavior, add smoke coverage in `scripts/`.
- Verify at least:
- Build success.
- Critical flow success.
- Error-path behavior.
- If a test cannot be added, document why in the change notes.

## 8) Documentation Rules

- Update docs in `doc/` when behavior, architecture, or setup changes.
- Keep feature docs aligned with actual UI controls and IDs.
- Record known limitations in `doc/KNOWN_GAPS.md`.
- Add an incident note for high-impact production issues.

## 9) Change Delivery Rules

- Group related changes into coherent commits.
- Do not mix refactors and unrelated feature work in one commit.
- Include a concise summary of what changed, why, and how it was validated.
- If assumptions were made, list them explicitly.

