# Changelog 1.7.5

## Fixed

- Android/WebGPU startup now requires a real adapter from `navigator.gpu.requestAdapter`, not just the presence of `navigator.gpu`.
- Android/browser sessions that expose WebGPU but cannot provide a compatible adapter now enter Offline Library Mode with a clear explanation.
- Chat composer state now stays locked when no model engine is active, including mobile voice transcription and image attach paths.
- Model startup now retries with the smallest text model when a larger selected model fails with a GPU/memory compatibility error.

## Validation

- Added `npm run test:android:chat`.
- Re-ran Android compatibility, composer, offline PWA, stability, browser offline-shell, and production build checks.
