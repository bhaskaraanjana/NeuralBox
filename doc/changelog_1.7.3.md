# Version 1.7.3

- Bumped app version to 1.7.3.
- Fixed Vercel deployment failure caused by Workbox attempting to pre-cache the 6 MB `webllm` bundle (exceeding the 2 MiB default limit).
- Updated `vite.config.js` Workbox config: tightened `globPatterns` to only capture the app shell, added explicit `globIgnores` for `webllm-*.js` and `transformers-*.js`, and raised `maximumFileSizeToCacheInBytes` to 10 MiB as a safety net.
- Service worker now pre-caches only 950 KB (app shell only), not the 6 MB ML bundle.
- Build verified clean locally before push.
