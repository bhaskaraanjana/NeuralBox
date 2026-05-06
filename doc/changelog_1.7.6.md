# Changelog 1.7.6

## Fixed

- iOS/Safari startup no longer depends on persistent storage being available.
- IndexedDB failures now fall back to localStorage, and blocked localStorage falls back to in-memory session storage.
- Theme preference reads/writes are protected from Safari private-mode storage exceptions.
- Startup now has a final compatibility fallback that opens the app shell if initialization throws.
- Background Whisper preload is deferred until after startup and skipped on iOS to avoid first-load memory/network pressure.

## Improved

- Added iOS/iPadOS-specific WebGPU fallback copy.
- Added Apple PWA metadata for Add to Home Screen installs.

## Validation

- Added `npm run test:ios:compat`.
