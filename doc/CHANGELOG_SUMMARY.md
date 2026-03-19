# Changelog Summary

Source: `changelog.md`

## Unreleased (local workspace)

- Added explicit `Auto` model selection mode; manual model selection no longer routes by default.
- Added always-on model hot swap with header progress/status indicator.
- Changed send control to dual-mode send/stop behavior during generation.
- Added optional in-app runtime debug panel with recent lifecycle events.
- Added `npm run test:stability` smoke test for new routing/hot-swap/send-stop contracts.

## 1.5.0 (2026-03-10)

- Added multi-model selector with VRAM-based recommendation.
- Added GPU info display.
- Added persisted model preference and dynamic header badge updates.

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
