# Changelog

## [1.7.6] - 2026-05-06

### Fixed
- iOS/Safari startup now survives IndexedDB and localStorage failures by falling back to safe storage modes.
- Theme storage and final app initialization are guarded so the shell still opens in restricted storage contexts.
- Background Whisper preload is deferred and skipped on iOS to reduce first-load pressure.

### Improved
- Added iOS-specific WebGPU fallback copy and Apple PWA install metadata.

## [1.7.5] - 2026-05-06

### Fixed
- Android/WebGPU startup now verifies a usable GPU adapter before enabling local inference.
- Chat composer state no longer gets force-enabled on mobile when no model engine is loaded.
- Model startup retries with the smallest text model after compatible GPU/memory load failures.

## [1.6.0] - 2026-04-08

### Fixed
- Hardened source citation rendering to safely handle malformed URLs.
- Added safe HTTP URL parsing path for web-search citations.
- Removed blocking `alert()` UX for common runtime actions and replaced with inline notices.
- Escaped assistant/user text before markdown-style HTML formatting to reduce XSS risk.

### Improved
- GPU/VRAM detection now uses layered heuristics:
  - adapter limits
  - GPU-name hints
  - device-memory fallback
- Runtime debug summary now includes VRAM estimate source metadata.
- Extracted rendering and URL safety helpers into `src/lib/rendering.js`.
- Extracted routing heuristics into `src/lib/routing.js`.
- Extracted device capability heuristics into `src/lib/device.js`.
- Added RAG ingestion guardrails (type checks, 5MB file limit, skip reporting).
- Trust Layer now shows retrieved RAG document names when available.
- Added Vite manual chunk split for large runtime dependencies.

### Quality
- Stability smoke checks expanded for:
  - citation safety path
  - escaped render path
  - non-blocking switch guard
- Added rendering safety test script (`npm run test:rendering`).
- Added routing sanity test script (`npm run test:routing`).
- Added device heuristics test script (`npm run test:device`).

## [1.5.0] - 2026-03-10

### Added
- Multi-model catalog and model selector UX improvements.
- Auto model routing with hot swap progress and runtime diagnostics.
- Regular/Advanced settings separation.

## [1.4.0] - 2026-03-09

### Added
- Voice chat overlay flow (listen -> transcribe -> respond -> speak).

## [1.3.0] - 2026-03-09

### Added
- Whisper local speech-to-text input path.

## [1.2.0] - 2026-03-09

### Added
- Optional web-enhanced mode with citations.

## [1.1.0] - 2026-03-09

### Added
- Multi-conversation sidebar and storage migration.

## [1.0.0] - 2026-03-09

### Added
- Initial local WebLLM browser chat release.
