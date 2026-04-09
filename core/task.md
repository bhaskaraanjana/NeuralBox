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

## P1 - Architecture Refactor

- [x] Extract rendering/safety helpers to `src/lib/rendering.js`.
- [x] Extract shared RAG helpers to `src/lib/rag.js` and reuse in app + test flows.
- [ ] Split remaining `src/main.js` domains into focused modules (routing, RAG, voice, UI events).
- [ ] Add pure-function unit test paths for routing/retrieval/render helpers.
- [ ] Keep behavior parity with current smoke tests.

## P2 - UX And Performance

- [ ] Reduce mobile UI clutter in composer and settings.
- [x] Reduce initial bundle pressure with safer chunking strategy (manual vendor chunks).
- [x] Improve RAG UX clarity with explicit guidance and ingestion limits in settings.
- [ ] Replace remaining disruptive UX patterns with inline/status-based feedback.

## Progress Summary

- Completed this session: core P0 hardening implementation plus docs/process sync.
- Validation status: env check + build + rendering + stability + RAG web tests all passing.
