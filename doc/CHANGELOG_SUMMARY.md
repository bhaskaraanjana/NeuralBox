# Changelog Summary

Source: `changelog.md`

## 1.6.0 (2026-04-08)

- Hardened source citation rendering to avoid malformed-URL runtime crashes.
- Escaped raw text before markdown-style rendering to reduce XSS risk.
- Improved VRAM detection using adapter limits + GPU-name hints + memory fallback.
- Replaced key blocking `alert()` paths with inline notices.
- Expanded stability smoke assertions for render/citation safety.
- Extracted render/URL safety helpers into `src/lib/rendering.js` and added `test:rendering`.
- Extracted routing helpers into `src/lib/routing.js` and added `test:routing`.
- Added RAG ingestion guardrails (type/size checks + skip reporting).
- Added RAG doc provenance in Trust Layer metadata.
- Added Vite manual chunk split for `webllm` and `transformers`.
- Updated docs and package metadata to `1.6.0`.

## 1.5.0 (2026-03-10)

- Added explicit `Auto` model selection mode; manual model selection no longer routes by default.
- Added always-on model hot swap with header progress/status indicator.
- Changed send control to dual-mode send/stop behavior during generation.
- Added optional in-app runtime debug panel with recent lifecycle events.
- Added `npm run test:stability` smoke test for new routing/hot-swap/send-stop contracts.

## 1.4.0 (2026-03-09)

- Added full voice chat mode with orb states.
- Added continuous listen -> transcribe -> respond -> speak loop.

## 1.3.0 (2026-03-09)

- Added local Whisper voice input.
- Added recording UI states and timer.

## 1.2.0 (2026-03-09)

- Added optional web-enhanced mode.
- Added search result grounding and source citations.

## 1.1.0 (2026-03-09)

- Added multi-conversation sidebar.
- Added migration from old single-conversation storage format.

## 1.0.0 (2026-03-09)

- Initial release:
  - browser-local AI chat via WebLLM + WebGPU
  - streaming responses and model download progress
  - settings, history persistence, and responsive UI.
