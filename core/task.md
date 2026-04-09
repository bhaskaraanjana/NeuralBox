# Task Checklist

## P0 - Stability And Correctness

- [x] Guard source citation URL parsing against malformed values.
- [x] Escape raw model/user text before markdown-style HTML rendering.
- [x] Replace blocking model-switch/import/export alerts with inline notices.
- [x] Improve VRAM estimation beyond adapter-limits-only detection.
- [x] Extend stability smoke tests to lock in hardening behavior.
- [x] Synchronize key docs with current runtime behavior.
- [x] Run full post-change validation (`build`, `test:stability`, `test:rag:web`).
- [x] Add RAG ingestion guardrails (file-type + file-size + skip reporting).
- [x] Normalize UI separators to ASCII-safe strings and add a non-ASCII regression guard.
- [x] Add browser-level smoke coverage for import/export and send-stop lifecycle.
- [x] Add browser-smoke assertion for model-switch fallback banner messaging.

## P1 - Architecture Refactor

- [x] Extract rendering/safety helpers to `src/lib/rendering.js`.
- [x] Extract shared RAG helpers to `src/lib/rag.js` and reuse in app + test flows.
- [x] Extract shared routing helpers to `src/lib/routing.js` and add routing sanity tests.
- [x] Extract shared device heuristics to `src/lib/device.js` and add device sanity tests.
- [x] Extract trust-layer renderer to `src/lib/trust.js` and add trust metadata sanity tests.
- [x] Extract composer action helpers to `src/lib/composer.js` and add composer lifecycle tests.
- [x] Extract generation lifecycle helpers to `src/lib/generation.js` and add cancellation/fallback tests.
- [x] Extract touch/click dedupe helper to `src/lib/events.js` and add tap binding tests.
- [x] Split remaining `src/main.js` domains into focused modules (routing, RAG, voice, UI events).
- [x] Add pure-function unit test paths for routing/retrieval/render helpers.
- [x] Keep behavior parity with current smoke tests.

## P2 - UX And Performance

- [x] Reduce mobile UI clutter in composer and settings.
- [x] Reduce initial bundle pressure with safer chunking strategy (manual vendor chunks).
- [x] Improve RAG UX clarity with explicit guidance and ingestion limits in settings.
- [x] Replace remaining disruptive UX patterns with inline/status-based feedback.

## P3 - Product Roadmap And UI Rehaul

- [x] Create a feature roadmap document with themes, milestones, and sprint sequencing.
- [x] Execute a complete UI rehaul pass while preserving runtime behavior contracts.
- [x] Revalidate stability/build/browser lifecycle after visual system rewrite.
- [x] Implement Wave 2 manual model-switch UX redesign in settings.
- [x] Add browser smoke coverage for manual model-switch flow.
- [ ] Run focused accessibility pass for settings + RAG controls.
- [ ] Add recovery UX for web-search offline/network failures.

## P4 - RAG Explainability And Controls

- [x] Add citation confidence badges for local RAG snippets.
- [x] Expose RAG confidence telemetry in trust metadata.
- [ ] Add configurable retrieval profile presets (precise, balanced, broad).

## Progress Summary

- Completed this session: added roadmap + full UI rehaul, delivered Wave 2 model-switch UX, and added RAG citation confidence badges with trust-layer confidence telemetry.
- Validation status for this session: `env:check`, `test:rag:helpers`, `test:trust`, `test:stability`, `test:ascii-ui`, `build`, and `test:browser:lifecycle` all passing.
