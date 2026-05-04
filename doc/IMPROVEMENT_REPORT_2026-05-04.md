# Improvement Report - 2026-05-04

This report summarizes the repo-wide improvement sweep performed after the initial codebase scan. The goal was to move NeuralBox from a stabilized prototype toward a more maintainable, safer, and easier-to-present product foundation.

## Commit Stack

- `f5b24d2` - `docs: add codebase scan baseline`
- `4e76a32` - `chore: refresh audited dependencies`
- `02a8dd1` - `feat: harden accessibility contracts`
- `35fb214` - `feat: add web search recovery helpers`
- `cc374c0` - `feat: add rag retrieval profiles`
- `05ed654` - `refactor: extract model catalog module`

## 1) Documentation Baseline

Added `doc/CODEBASE_SCAN_2026-05-04.md` as the shared project map. It records:

- product identity and runtime architecture
- repository shape
- feature inventory
- validation baseline
- risks and gaps
- recommended planning areas

Why it matters: future work now has a source-of-truth starting point instead of relying on memory or scattered notes.

## 2) Dependency And Security Cleanup

Ran `npm audit fix`, which updated vulnerable transitive packages and Vite's resolved lockfile version.

Result:

- `npm audit --audit-level=moderate` reports 0 vulnerabilities.
- Production build still passes after the dependency refresh.

Why it matters: the previous audit had moderate/high/critical advisories, including a direct Vite advisory. This removes a real security and credibility concern before presentation or further development.

## 3) Accessibility Contract Hardening

Added semantic and assistive-technology improvements in `index.html`, runtime aria-state updates in `src/main.js`, and focus-visible styling in `src/style.css`.

Key improvements:

- settings panel and voice overlay now expose dialog semantics
- startup, hot-swap, voice, and RAG status regions use polite live regions
- icon-only buttons now have accessible names
- web search, thinking mode, settings, voice chat, and send/stop controls update aria state
- voice orb supports keyboard activation
- RAG dropzone exposes button semantics
- keyboard focus styling is visible for controls

Added `scripts/accessibility-static-test.mjs` and `npm run test:accessibility` to lock those contracts.

Why it matters: NeuralBox has many icon controls and dynamic states. Without explicit accessibility contracts, future UI polish could easily regress usability.

## 4) Web Search Recovery UX

Extracted web-search decision/recovery helpers to `src/lib/web-search.js`.

Added tested helpers for:

- auto-search trigger detection
- timeout/network/rate-limit/endpoint/parse failure classification
- user-facing recovery notices
- no-result notices

Runtime behavior now:

- captures primary/fallback web-search failures
- surfaces clear inline notices when search fails or returns nothing
- logs failure kind into runtime events and workbench events
- continues locally rather than failing the generation flow

Added `scripts/web-search-helpers-test.mjs` and `npm run test:web-search`.

Why it matters: web search is the least local and least controllable feature. It now degrades more gracefully and tells users what happened.

## 5) RAG Retrieval Profiles

Extended `src/lib/rag.js` with retrieval profile definitions and normalization helpers.

Profiles:

- Precise: fewer, stronger matches
- Balanced: default behavior
- Broad: more context for fuzzy or exploratory questions

Runtime/UI additions:

- settings select for retrieval profile
- persisted `ragRetrievalProfile` setting
- guidance text explains the selected profile
- retrieval route reason includes the profile label
- workbench events include the profile id
- trust metadata includes `ragProfile`
- Markdown export includes `rag_profile`

Tests updated:

- `scripts/rag-helpers-test.mjs`
- `scripts/accessibility-static-test.mjs`
- `scripts/trust-metadata-test.mjs` continues passing

Why it matters: RAG is now a controllable product feature instead of a single hidden retrieval behavior.

## 6) Model Catalog Modularization

Extracted the 177-line model catalog from `src/main.js` into `src/lib/models.js`.

Added:

- `scripts/model-catalog-test.mjs`
- `npm run test:models`
- env-check coverage for the new module
- stability-smoke assertion that the catalog is imported from a shared module

Why it matters: this removes static catalog noise from the orchestration file and makes future model catalog edits safer and easier to review.

## Architecture After Sweep

The main app still uses `src/main.js` as the runtime orchestrator, but the helper boundary improved:

- model definitions: `src/lib/models.js`
- rendering safety: `src/lib/rendering.js`
- RAG retrieval/profile logic: `src/lib/rag.js`
- web search heuristics/recovery: `src/lib/web-search.js`
- routing: `src/lib/routing.js`
- device heuristics: `src/lib/device.js`
- trust metadata: `src/lib/trust.js`
- composer actions: `src/lib/composer.js`
- generation lifecycle: `src/lib/generation.js`
- event binding: `src/lib/events.js`
- voice helpers: `src/lib/voice.js`
- settings helpers: `src/lib/settings.js`

## What Is Still Not Finished

The app is significantly better, but not magically perfect. Remaining material work:

- `src/main.js` is still large and should be split into feature controllers.
- RAG remains lexical, not embedding-based.
- Real WebGPU inference still needs manual/device testing across browsers and GPUs.
- Vision still depends on the upstream WebLLM Phi-3.5 compatibility workaround.
- Bundle size remains dominated by WebLLM and Transformers chunks.
- Accessibility is improved statically, but a manual screen-reader pass is still recommended.

## Recommended Next Refactor Slices

1. Extract settings panel rendering/events into `src/features/settings-controller.js`.
2. Extract conversation/sidebar CRUD into `src/features/conversations-controller.js`.
3. Extract web search runtime fetch/parsing into `src/features/web-search-runtime.js`.
4. Extract voice chat lifecycle into `src/features/voice-chat-controller.js`.
5. Add browser smoke coverage for RAG profile selection and accessibility state checks.
