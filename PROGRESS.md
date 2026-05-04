# PROGRESS

Last Updated: 2026-04-09 (America/St_Johns)

## Session Log

### 2026-05-04 - Version 1.6.4 Updates
- Bumped app version to 1.6.4 and exposed it in the settings panel.
- Rewrote the system prompt in `index.html` to explicitly inform the local model of its web search capabilities.
- Fixed an accidental deletion of the `<!DOCTYPE html>` declaration.

### 2026-05-04 - Version 1.6.3 Updates
- Bumped app version to 1.6.3 and exposed it in the settings panel.
- Implemented a Light Mode theme toggle using an advanced CSS `invert` and `hue-rotate` trick.
- Added a persistence layer (`localStorage`) to remember the user's theme preference across sessions.
- Added a theme toggle button to the main app header.

### 2026-05-04 - Version 1.6.2 Updates
- Bumped app version to 1.6.2 and exposed it in the settings panel.
- Rewrote `README.md` to feature a beautiful, modern layout accurately reflecting the app's latest features (WebGPU, Voice, Trust Layer, Local RAG).

### 2026-05-04 - Version 1.6.1 Updates
- Bumped app version to 1.6.1 and exposed it in the settings panel.
- Configured Vite development server with `@vitejs/plugin-basic-ssl` for local WebGPU testing via HTTPS.
- Added `beforeunload` listener to protect against accidental browser refreshes while the AI model is loaded.
- Modified Vite watcher config to ignore `*.md` files to prevent unnecessary full-page dev reloads.
- Updated Whisper API to preload in the background on initial app startup.
- Implemented real-time text streaming for Whisper voice transcriptions.

### 2026-05-04 - Codebase superiority sweep
- Added documentation baseline and improvement/test reports:
  - `doc/CODEBASE_SCAN_2026-05-04.md`
  - `doc/IMPROVEMENT_REPORT_2026-05-04.md`
  - `doc/TEST_REPORT_2026-05-04.md`
- Cleared dependency audit findings with audited lockfile refresh.
- Added accessibility contract hardening:
  - Dialog semantics for settings and voice overlay.
  - Live regions for startup, hot swap, voice, and RAG status.
  - Accessible names and aria state for icon/dynamic controls.
  - Keyboard activation for voice orb and visible focus styling.
  - New `npm run test:accessibility`.
- Added web-search recovery helpers:
  - `src/lib/web-search.js`
  - Failure classification and inline recovery notices.
  - New `npm run test:web-search`.
- Added configurable RAG retrieval profiles:
  - Precise, Balanced, Broad.
  - Settings UI, persistence, trust metadata, Markdown export, workbench telemetry, and tests.
- Extracted model catalog to `src/lib/models.js` with catalog integrity test:
  - New `npm run test:models`.
- Validation for individual slices passed during implementation; final full-suite validation is recorded in `doc/TEST_REPORT_2026-05-04.md`.

### 2026-04-09 - RAG confidence citation feature add
- Added confidence-aware RAG retrieval output:
  - `src/lib/rag.js` now includes `getRagConfidenceLabel(score, queryTokenCount)` and retrieval output now includes `confidenceLabel`.
- Added user-facing local citation confidence UI:
  - `src/main.js` now renders a `Local docs` citation block under assistant replies when local retrieval is used.
  - Each cited document now shows confidence badge (`high`, `medium`, `low`) and retrieval score.
  - Added RAG confidence summary helper used for telemetry and trust metadata.
- Extended trust metadata for explainability:
  - `src/lib/trust.js` now shows `RAG confidence`, `RAG avg score`, and `RAG confidence mix`.
  - Markdown export trust line now includes `rag_confidence`.
- Added styling and tests:
  - New RAG citation styles in `src/style.css`.
  - Updated `scripts/rag-helpers-test.mjs` with confidence assertions.
  - Updated `scripts/stability-sprint-smoke.mjs` to assert RAG citation renderer/confidence telemetry.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:rag:helpers` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run build` (pass)
  - `npm run test:browser:lifecycle` (pass)

### 2026-04-09 - Wave 2 manual model-switch UX + smoke coverage
- Continued roadmap execution after Wave 1 rehaul with focused model-selection UX cleanup.
- Updated `src/main.js` model selection flows:
  - Reworked settings model selector to show clear Active / Current mode / Pending mode summaries.
  - Added explicit pending-state guidance and live status updates for model apply/hot-swap.
  - Kept manual apply model-change behavior, added rollback on switch failure, and removed auto-close confusion from settings.
  - Added explicit startup selector classes and removed legacy inline style variables from the start screen model select.
- Updated `src/style.css` for new model-selector UI components:
  - Added dedicated styles for startup selector and model summary/status rows.
  - Preserved responsive behavior and existing runtime IDs.
- Extended regression coverage:
  - Updated `scripts/browser-lifecycle-smoke.mjs` to validate pending model switch state and apply flow.
  - Updated `scripts/stability-sprint-smoke.mjs` contracts for model selection summary/status helper presence.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run build` (pass)
  - `npm run test:browser:lifecycle` (pass)

### 2026-04-09 - Feature roadmap + complete UI rehaul wave kickoff
- Created product roadmap artifact:
  - Added `doc/FEATURE_ROADMAP.md` with themes, milestones, sprint plan, and success metrics.
- Executed complete UI rehaul pass in `src/style.css`:
  - Rebuilt style system around a single tokenized palette, typography, radius, and elevation model.
  - Reworked loading shell, sidebar, header, message surfaces, composer, settings, RAG controls, and debug panes.
  - Preserved existing runtime IDs/classes to keep `src/main.js` behavior and tests stable.
  - Improved phone layout density and interaction spacing to reduce clutter in core chat/settings flows.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run build` (pass)
  - `npm run test:browser:lifecycle` (pass)

### 2026-04-08 - Voice/settings modularization and mobile/settings UX hardening
- Continued deepscan execution to close remaining architecture + UX checklist gaps.
- Added new helper modules:
  - `src/lib/voice.js`
    - Timer formatting (`formatVoiceTimer`), mic status text/markup mapping, voice-orb UI mapping, transcript formatting, and preferred speech voice selection.
  - `src/lib/settings.js`
    - Settings tab normalization/visibility helpers and deterministic seed parsing/notice helpers.
- Updated `src/main.js` to use new modules:
  - Voice domain now consumes `voice.js` helpers for timer/status/voice-orb/transcript logic.
  - Settings domain now consumes `settings.js` helpers for tab and deterministic controls.
- Added pure helper tests:
  - `scripts/voice-helpers-test.mjs`
  - `scripts/settings-helpers-test.mjs`
  - `scripts/rag-helpers-test.mjs`
- Added npm scripts:
  - `npm run test:voice`
  - `npm run test:settings`
  - `npm run test:rag:helpers`
- Updated environment/doc plumbing:
  - Added new helper modules/tests to `scripts/check-env.mjs`.
  - Updated `doc/CONFIG_AND_DEPENDENCIES.md` for new script commands and descriptions.
  - Extended stability smoke contract to assert voice/settings helper module usage.
- UX hardening updates:
  - Added inline success notices for conversation clear, JSON export, and JSON import flows.
  - Reduced phone clutter in composer/settings via compact responsive rules at `@media (max-width: 640px)` in `src/style.css`.
- Validation run for this batch:
  - `npm run env:check` (pass)
  - `npm run test:voice` (pass)
  - `npm run test:settings` (pass)
  - `npm run test:rag:helpers` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:events` (pass)
  - `npm run test:generation` (pass)
  - `npm run test:composer` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:trust` (pass)
  - `npm run test:routing` (pass)
  - `npm run test:device` (pass)
  - `npm run test:ascii-ui` (pass)
  - `npm run test:rag:web` (pass)
  - `npm run build` (pass)
  - `npm run test:browser:lifecycle` against local preview server (pass)

### 2026-04-08 - Browser smoke harness for import/export and send-stop lifecycle
- Continued deep-scan execution by adding browser-level lifecycle verification.
- Added opt-in test API hook in `src/main.js`:
  - New `attachTestApiIfEnabled()` exposes `window.__NB_TEST_API` when `localStorage.neuralbox_test_api=1` or `?nb_test=1`.
  - Provides test-safe accessors for send-button state, cancellation flag, runtime events, and conversation count.
- Added Playwright smoke test:
  - New script: `scripts/browser-lifecycle-smoke.mjs`
  - New npm command: `npm run test:browser:lifecycle`
  - Covers settings open/close, import chats, export chats download naming, and send-stop lifecycle behavior.
  - Extended to assert model-switch fallback banner messaging via `injectRouteSwitchFailureBannerForTest()`.
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

- Verification after RAG confidence citation feature:
  - Env check: pass
  - RAG helpers test: pass
  - Trust metadata test: pass
  - Stability smoke: pass
  - ASCII UI guard test: pass
  - Build: pass
  - Browser lifecycle smoke test: pass
- Verification after Wave 2 model-switch UX pass:
  - Env check: pass
  - Stability smoke: pass
  - ASCII UI guard test: pass
  - Build: pass
  - Browser lifecycle smoke test: pass
- Verification after roadmap + UI rehaul pass:
  - Env check: pass
  - Stability smoke: pass
  - ASCII UI guard test: pass
  - Build: pass
  - Browser lifecycle smoke test: pass
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
- Verification after voice/settings modularization and UX hardening:
  - Env check: pass
  - Voice helpers test: pass
  - Settings helpers test: pass
  - RAG helpers test: pass
  - Stability smoke: pass
  - Events test: pass
  - Generation lifecycle test: pass
  - Composer action test: pass
  - Rendering safety test: pass
  - Trust metadata test: pass
  - Routing sanity test: pass
  - Device heuristics test: pass
  - ASCII UI guard test: pass
  - RAG extensive test: pass
  - Build: pass
  - Browser lifecycle smoke test: pass

## Known Issues And Gotchas

- Vision path still depends on upstream WebLLM Phi-3.5 embed-shape constraints.
- Web search quality depends on third-party endpoint availability (allorigins + DuckDuckGo).
- `src/main.js` remains a large orchestration file and should be modularized next.
- Build emits large-chunk warnings for `webllm` and `transformers` bundles; runtime is functional but bundle pressure remains a performance focus.
- Local workspace has a pre-existing modified file not touched by this session:
  - `scripts/rag-web-test-data/node-readme.md`

## What To Work On Next

1. Run accessibility pass on chat/settings/RAG controls (focus order, keyboard navigation, contrast checks).
2. Add configurable retrieval profile presets (precise, balanced, broad) for local RAG.
3. Add recovery UX for web-search failures (offline/network endpoint errors) with actionable retry guidance.
4. Continue startup performance work: defer heavy optional runtimes and monitor chunk pressure.
5. Monitor upstream WebLLM Phi-3.5 vision embed-size bug and remove compatibility retries when fixed upstream.

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
- Voice helpers: `src/lib/voice.js`
- Settings helpers: `src/lib/settings.js`
- Test harness hook: `attachTestApiIfEnabled()` in `src/main.js` (`window.__NB_TEST_API` in opt-in mode)
- Persistence layer: `src/db/database.js`
- Voice transcription module: `src/whisper.js`
- Styling: `src/style.css`
- Roadmap: `doc/FEATURE_ROADMAP.md`
- Validation scripts: `scripts/stability-sprint-smoke.mjs`, `scripts/rendering-safety-test.mjs`, `scripts/routing-sanity-test.mjs`, `scripts/device-heuristics-test.mjs`, `scripts/trust-metadata-test.mjs`, `scripts/composer-actions-test.mjs`, `scripts/generation-lifecycle-test.mjs`, `scripts/events-bindings-test.mjs`, `scripts/voice-helpers-test.mjs`, `scripts/settings-helpers-test.mjs`, `scripts/rag-helpers-test.mjs`, `scripts/ascii-ui-strings-test.mjs`, `scripts/rag-web-extensive-test.mjs`, `scripts/browser-lifecycle-smoke.mjs`
- Docs: `doc/`

## Tech Stack

- Runtime: Vanilla JS + Vite
- Local LLM: `@mlc-ai/web-llm`
- Local ASR: `@huggingface/transformers` (Whisper tiny.en)
- Testing: Node script smoke tests + Playwright dependency available
- Persistence: IndexedDB with localStorage fallback

