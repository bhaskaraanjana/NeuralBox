# PROGRESS

Last Updated: 2026-04-08 (America/St_Johns)

## Session Log

### 2026-04-08 - Browser smoke harness for import/export and send-stop lifecycle
- Continued deep-scan execution by adding browser-level lifecycle verification.
- Added opt-in test API hook in `src/main.js`:
  - New `attachTestApiIfEnabled()` exposes `window.__NB_TEST_API` when `localStorage.neuralbox_test_api=1` or `?nb_test=1`.
  - Provides test-safe accessors for send-button state, cancellation flag, runtime events, and conversation count.
- Added Playwright smoke test:
  - New script: `scripts/browser-lifecycle-smoke.mjs`
  - New npm command: `npm run test:browser:lifecycle`
  - Covers settings open/close, import chats, export chats download naming, and send-stop lifecycle behavior.
  - Uses fake WebGPU adapter + test-mode chat-screen activation in headless runs.
- Updated project checks/docs:
  - Added browser smoke script to `scripts/check-env.mjs` required files.
  - Updated `doc/CONFIG_AND_DEPENDENCIES.md` script listing and test descriptions.
  - Extended stability smoke contract to require `attachTestApiIfEnabled()` presence.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:events` (pass)
  - `npm run test:generation` (pass)
  - `npm run test:composer` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:routing` (pass)
  - `npm run test:device` (pass)
  - `npm run test:rag:web` (pass)
  - `npm run build` (pass)
  - `npm run test:browser:lifecycle` against local preview server on `http://127.0.0.1:4173` (pass)

### 2026-04-08 - Tap event dedupe helper for mobile interaction stability
- Continued deep-scan execution for mobile interaction correctness and duplicate touch/click handling.
- Added shared event utility: `src/lib/events.js`
  - `bindTap()` unifies click + touchend handling and suppresses synthetic click duplication after touch.
- Integrated `bindTap()` in `src/main.js` for:
  - Primary send/stop button interaction.
  - Suggestion chip tap handling.
- Added dedicated regression test:
  - New script: `scripts/events-bindings-test.mjs`
  - New npm command: `npm run test:events`
  - Updated env check + docs references.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:events` (pass)
  - `npm run test:composer` (pass)
  - `npm run test:generation` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:routing` (pass)
  - `npm run test:device` (pass)
  - `npm run test:rag:web` (pass)
  - `npm run build` (pass)

### 2026-04-08 - Generation lifecycle hardening (cancellation + switch fallback)
- Continued deep-scan execution for model-switch fallback and generation cancellation consistency.
- Added new generation helper module: `src/lib/generation.js`
  - `isGenerationInterrupted()` for cancellation/interruption checks.
  - `isGenerationCancelledError()` for catch-path cancellation classification.
  - `buildRouteSwitchFailureReason()` for consistent route reason fallback text.
  - `getRouteSwitchFailureNotice()` for consistent user-facing fallback status text.
- Updated `src/main.js` to consume generation helpers in:
  - Model-switch failure route reason composition.
  - Retry-loop interruption checks.
  - Stream-loop interruption checks.
  - Catch-path cancellation classification.
- Added dedicated generation lifecycle regression test:
  - New script: `scripts/generation-lifecycle-test.mjs`
  - New npm command: `npm run test:generation`
  - Updated env checks/docs and validation references.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:generation` (pass)
  - `npm run test:composer` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:routing` (pass)
  - `npm run test:device` (pass)
  - `npm run test:rag:web` (pass)
  - `npm run build` (pass)

### 2026-04-08 - Composer lifecycle refactor and coverage
- Continued deep-scan execution on send/stop lifecycle robustness.
- Added new shared composer helper module: `src/lib/composer.js`
  - `resolvePrimaryComposerAction()` centralizes send vs stop vs no-op behavior.
  - `shouldDisableSendButton()` centralizes composer button disabled state rules.
- Updated `src/main.js` to use shared composer helpers:
  - `setGeneratingState()` now uses shared disabled-state helper.
  - Added `handleComposerPrimaryAction()` and wired send button click/touch to a single action path.
  - Enter-to-send path now resolves action using shared helper and only sends on `send`.
  - Image attach and image clear paths now use shared disabled-state helper.
- Added dedicated test coverage:
  - New script: `scripts/composer-actions-test.mjs`
  - New npm command: `npm run test:composer`
  - Updated stability smoke contract to assert helper-driven cancellation wiring.
  - Updated env check + docs for new helper/test files.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:composer` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:routing` (pass)
  - `npm run test:device` (pass)
  - `npm run test:rag:web` (pass)
  - `npm run build` (pass)

### 2026-04-08 - UI encoding hardening and ASCII guard
- Continued deep-scan execution on UI corruption risk ("random characters" / mojibake symptoms).
- Replaced non-ASCII separators in runtime UI strings:
  - `src/main.js`: replaced bullet/em-dash separators with ASCII-safe `|` and `-` in workbench and start-screen status text.
  - `src/style.css`: replaced non-ASCII characters in header comment and pinned-label pseudo-content.
- Added regression guard:
  - New script: `scripts/ascii-ui-strings-test.mjs`
  - New npm command: `npm run test:ascii-ui`
  - Updated `scripts/check-env.mjs` to require the ASCII guard file.
  - Updated `doc/CONFIG_AND_DEPENDENCIES.md` with new test command and rationale.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:stability` (pass)
  - `npm run build` (pass)

### 2026-04-08 - Trust metadata module extraction and validation
- Continued deep-scan execution with focused P1 refactor completion:
  - Extracted trust-layer renderer from `src/main.js` into `src/lib/trust.js`.
  - Updated `src/main.js` to import `renderTrustMetaHtml` from shared trust module.
- Added dedicated trust metadata regression test:
  - New script: `scripts/trust-metadata-test.mjs`
  - New npm command: `npm run test:trust`
  - Updated environment guard script to require trust module presence.
- Validation run after trust extraction:
  - `npm run env:check` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:routing` (pass)
  - `npm run test:device` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:rag:web` (pass)
  - `npm run build` (pass)

### 2026-04-08 - Stability deepscan execution (P0 start)
- Ran repo-wide deep scan and validated current baseline:
  - `npm run build`
  - `npm run test:stability`
  - `npm run test:rag:web`
- Hardened runtime safety in `src/main.js`:
  - Added safe HTTP URL parsing for source citations (`safeParseHttpUrl`).
  - Replaced citation `innerHTML`/raw URL host parsing path with DOM-safe anchor creation.
  - Escaped raw model/user text before markdown-style formatting in `formatBasicHTML`.
  - Added null-safe handling for markdown formatter input.
- Improved device capability estimation:
  - Added layered VRAM estimation (adapter limits + GPU-name hints + memory fallback).
  - Added `gpuClass` and `vramEstimateSource` metadata to runtime state.
  - Included VRAM estimation source in debug summary and `app_init` event.
- Reduced blocking UI flows:
  - Replaced key `alert()` error paths with inline notices (model switch + import/export actions).
- Strengthened stability checks in `scripts/stability-sprint-smoke.mjs`:
  - Citation URL safety contract.
  - Escaped render-path contract.
  - Non-blocking model-switch guard contract.
- Documentation sync work:
  - Rewrote `README.md` to reflect current features/commands.
  - Rewrote `changelog.md` with current `1.6.0` entry.
  - Updated `doc/KNOWN_GAPS.md`, `doc/CONFIG_AND_DEPENDENCIES.md`, `doc/ENVIRONMENT_SETUP.md`.
  - Bumped version metadata in `package.json` and `package-lock.json` to `1.6.0`.
- Post-change verification:
  - `npm run build` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:rag:web` (pass)
- P1 groundwork completed without behavior drift:
  - Extracted pure rendering/safety helpers into `src/lib/rendering.js`.
  - Updated `src/main.js` to import rendering helpers.
  - Added `npm run test:rendering` (`scripts/rendering-safety-test.mjs`).
  - Updated env checks/docs for new module and test script.
- RAG trust transparency improvement:
  - Trust Layer now includes retrieved local document names (`ragDocNames`).
  - Assistant export metadata now includes `rag_docs` in trust line.
- RAG ingestion guardrail improvement:
  - Added extension/MIME allow-list checks.
  - Added per-file size guard (`RAG_MAX_FILE_BYTES = 5MB`).
  - Added explicit skip reporting (unsupported / too large / empty).
- Build optimization:
  - Added Vite manual chunk split for `@mlc-ai/web-llm` and `@huggingface/transformers`.
  - Result: app shell chunk dropped to ~83KB, heavy runtime libs isolated in dedicated chunks.
- RAG UX clarity:
  - Added `#rag-guidance` UI hint with model recommendation and explicit ingestion limits.
  - Updated RAG docs/playbook references to reflect new guardrails.
- Documentation refresh:
  - Rewrote `doc/UI_REFERENCE.md` to match actual DOM IDs and current settings/RAG controls.
- Shared RAG module extraction:
  - Added `src/lib/rag.js` for normalization, chunking, scoring, and retrieval utilities.
  - Updated `src/main.js` to consume shared RAG utilities.
  - Updated `scripts/rag-web-extensive-test.mjs` to reuse the same shared retrieval logic.
- Shared routing module extraction:
  - Added `src/lib/routing.js` for task analysis, tier ranking, and model route scoring.
  - Updated `src/main.js` to consume routing helpers.
  - Added `npm run test:routing` (`scripts/routing-sanity-test.mjs`).
- Added regression coverage for RAG guidance UX:
  - Stability smoke now asserts `#rag-guidance` presence and `renderRagGuidance()` implementation.
- Shared device module extraction:
  - Added `src/lib/device.js` for GPU class inference, VRAM estimation, and tier mapping.
  - Updated `src/main.js` to consume device helpers in runtime capability detection.
  - Added `npm run test:device` (`scripts/device-heuristics-test.mjs`).
- Re-ran full validation after modular extraction and trust updates:
  - `npm run env:check` (pass)
  - `npm run build` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:rag:web` (pass)

## What's Been Verified

- Baseline before edits:
  - Build: pass
  - Stability smoke: pass
  - RAG extensive test: pass
- Post-edit verification:
  - Build: pass (`neuralbox@1.6.0`)
  - Stability smoke: pass
  - RAG extensive test: pass
- Additional verification after P1 groundwork:
  - Env check: pass
  - Rendering safety test: pass
  - Build: pass
  - Stability smoke: pass
  - RAG extensive test: pass
- Verification after RAG guardrail update:
  - Rendering safety test: pass
  - Stability smoke: pass
  - Build: pass
  - RAG extensive test: pass
- Verification after chunk-splitting update:
  - Build: pass
  - Stability smoke: pass
  - Rendering safety test: pass
  - RAG extensive test: pass
- Verification after RAG guidance/UI-doc update:
  - Build: pass
  - Stability smoke: pass
  - Rendering safety test: pass
  - RAG extensive test: pass
- Verification after shared RAG module extraction:
  - Env check: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after routing module extraction:
  - Env check: pass
  - Routing sanity test: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after device module extraction:
  - Env check: pass
  - Device heuristics test: pass
  - Routing sanity test: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after trust module extraction:
  - Env check: pass
  - Trust metadata test: pass
  - Rendering safety test: pass
  - Routing sanity test: pass
  - Device heuristics test: pass
  - Stability smoke: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after UI encoding hardening:
  - Env check: pass
  - ASCII UI guard test: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - Build: pass
- Verification after composer lifecycle refactor:
  - Env check: pass
  - Composer action test: pass
  - ASCII UI guard test: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - Trust metadata test: pass
  - Routing sanity test: pass
  - Device heuristics test: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after generation lifecycle hardening:
  - Env check: pass
  - Generation lifecycle test: pass
  - Composer action test: pass
  - ASCII UI guard test: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - Trust metadata test: pass
  - Routing sanity test: pass
  - Device heuristics test: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after tap-event dedupe helper integration:
  - Env check: pass
  - Event binding tap test: pass
  - Composer action test: pass
  - Generation lifecycle test: pass
  - Stability smoke: pass
  - ASCII UI guard test: pass
  - Rendering safety test: pass
  - Trust metadata test: pass
  - Routing sanity test: pass
  - Device heuristics test: pass
  - RAG extensive test: pass
  - Build: pass
- Verification after browser lifecycle smoke harness:
  - Env check: pass
  - Stability smoke: pass
  - Events test: pass
  - Generation lifecycle test: pass
  - Composer action test: pass
  - ASCII UI guard test: pass
  - Rendering safety test: pass
  - Trust metadata test: pass
  - Routing sanity test: pass
  - Device heuristics test: pass
  - RAG extensive test: pass
  - Build: pass
  - Browser lifecycle smoke test: pass

## Known Issues And Gotchas

- Vision path still depends on upstream WebLLM Phi-3.5 embed-shape constraints.
- Web search quality depends on third-party endpoint availability (allorigins + DuckDuckGo).
- `src/main.js` remains a large orchestration file and should be modularized next.
- Local workspace has a pre-existing modified file not touched by this session:
  - `scripts/rag-web-test-data/node-readme.md`

## What To Work On Next

1. Continue P1 modular split of `src/main.js` (voice and settings event flows next).
2. Add targeted browser smoke for model-switch fallback messaging path.
3. Continue extracting voice and settings orchestration from `src/main.js`.
4. Continue UI density cleanup on mobile settings and composer flows.

## File Map

- App shell: `index.html`
- Main runtime/orchestration: `src/main.js`
- Rendering/safety helpers: `src/lib/rendering.js`
- RAG helpers: `src/lib/rag.js`
- Routing helpers: `src/lib/routing.js`
- Device helpers: `src/lib/device.js`
- Trust-layer helpers: `src/lib/trust.js`
- Composer helpers: `src/lib/composer.js`
- Generation lifecycle helpers: `src/lib/generation.js`
- Event binding helpers: `src/lib/events.js`
- Test harness hook: `attachTestApiIfEnabled()` in `src/main.js` (`window.__NB_TEST_API` in opt-in mode)
- Persistence layer: `src/db/database.js`
- Voice transcription module: `src/whisper.js`
- Styling: `src/style.css`
- Validation scripts: `scripts/stability-sprint-smoke.mjs`, `scripts/rendering-safety-test.mjs`, `scripts/routing-sanity-test.mjs`, `scripts/device-heuristics-test.mjs`, `scripts/trust-metadata-test.mjs`, `scripts/composer-actions-test.mjs`, `scripts/generation-lifecycle-test.mjs`, `scripts/events-bindings-test.mjs`, `scripts/ascii-ui-strings-test.mjs`, `scripts/rag-web-extensive-test.mjs`, `scripts/browser-lifecycle-smoke.mjs`
- Docs: `doc/`

## Tech Stack

- Runtime: Vanilla JS + Vite
- Local LLM: `@mlc-ai/web-llm`
- Local ASR: `@huggingface/transformers` (Whisper tiny.en)
- Testing: Node script smoke tests + Playwright dependency available
- Persistence: IndexedDB with localStorage fallback
