# Version 1.7.0

- Bumped app version to 1.7.0 — major minor version bump for PWA milestone.
- Installed `vite-plugin-pwa` and configured full PWA support in `vite.config.js`.
- Generated and added a brand new NeuralBox logo (512×512 and 192×192) to `public/`.
- Added `<link rel="icon">`, `<link rel="apple-touch-icon">`, and `<meta name="theme-color">` to `index.html`.
- Configured Workbox service worker to pre-cache the app shell and all static assets, with smart runtime caching for Google Fonts. ML model files are intentionally excluded from the cache.
- App can now be installed as a native app on desktop and mobile via the browser's "Install" prompt.
