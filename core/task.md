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
- [ ] Split remaining `src/main.js` domains into focused modules (routing, RAG, voice, UI events).
- [ ] Add pure-function unit test paths for routing/retrieval/render helpers.
- [ ] Keep behavior parity with current smoke tests.

## P2 - UX And Performance

- [ ] Reduce mobile UI clutter in composer and settings.
- [x] Reduce initial bundle pressure with safer chunking strategy (manual vendor chunks).
- [x] Improve RAG UX clarity with explicit guidance and ingestion limits in settings.
- [ ] Replace remaining disruptive UX patterns with inline/status-based feedback.

## Progress Summary

- Completed this session: extended browser lifecycle smoke with model-switch fallback banner assertion via test API.
- Validation status: build + browser lifecycle smoke passing after fallback-banner coverage extension.
