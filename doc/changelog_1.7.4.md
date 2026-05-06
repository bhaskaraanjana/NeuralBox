# Version 1.7.4

- Bumped app version to 1.7.4.
- Fixed startup hard-stop when `navigator.gpu` is unavailable.
- Added Offline Library Mode so the app shell still opens without WebGPU:
  - conversations/settings/local metadata remain accessible
  - import/export and settings continue to work
  - model inference controls stay disabled until WebGPU is available
- Lazy-loaded `@mlc-ai/web-llm` instead of statically importing it from the app shell.
- Added explicit PWA service-worker registration via `virtual:pwa-register`.
- Added offline/PWA regression coverage:
  - `npm run test:offline:pwa`
  - `npm run test:browser:offline-shell`
- Verified production PWA build still precaches only the lightweight app shell and excludes large ML chunks.
