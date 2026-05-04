# Config And Dependencies

## package.json snapshot

```json
{
  "name": "neuralbox",
  "version": "1.6.0",
  "type": "module",
  "engines": {
    "node": ">=20 <26"
  },
  "scripts": {
    "env:check": "node scripts/check-env.mjs",
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test:stability": "node scripts/stability-sprint-smoke.mjs",
    "test:models": "node scripts/model-catalog-test.mjs",
    "test:rendering": "node scripts/rendering-safety-test.mjs",
    "test:routing": "node scripts/routing-sanity-test.mjs",
    "test:device": "node scripts/device-heuristics-test.mjs",
    "test:trust": "node scripts/trust-metadata-test.mjs",
    "test:composer": "node scripts/composer-actions-test.mjs",
    "test:generation": "node scripts/generation-lifecycle-test.mjs",
    "test:events": "node scripts/events-bindings-test.mjs",
    "test:voice": "node scripts/voice-helpers-test.mjs",
    "test:settings": "node scripts/settings-helpers-test.mjs",
    "test:rag:helpers": "node scripts/rag-helpers-test.mjs",
    "test:web-search": "node scripts/web-search-helpers-test.mjs",
    "test:accessibility": "node scripts/accessibility-static-test.mjs",
    "test:ascii-ui": "node scripts/ascii-ui-strings-test.mjs",
    "test:rag:web": "node scripts/rag-web-extensive-test.mjs",
    "test:browser:lifecycle": "node scripts/browser-lifecycle-smoke.mjs"
  }
}
```

## npm scripts

- `npm run env:check`
  - Validates Node version and required project files.
- `npm run dev`
  - Starts Vite development server (default port configured in `vite.config.js`).
- `npm run build`
  - Produces production artifacts in `dist/`.
- `npm run preview`
  - Serves built artifacts locally.
- `npm run test:stability`
  - Stability smoke checks for core UI/runtime contracts.
- `npm run test:models`
  - Model catalog integrity checks for IDs, names, tiers, VRAM estimates, and capability coverage.
- `npm run test:rendering`
  - Rendering/URL-safety checks for extracted helper module.
- `npm run test:routing`
  - Routing heuristic sanity checks for extracted routing helper module.
- `npm run test:device`
  - Device/VRAM heuristic checks for extracted device helper module.
- `npm run test:trust`
  - Trust-layer metadata rendering sanity checks.
- `npm run test:composer`
  - Composer send/stop/no-op decision and send-button-disable logic checks.
- `npm run test:generation`
  - Cancellation and model-switch fallback reason checks for generation lifecycle helpers.
- `npm run test:events`
  - Touch/click dedupe behavior checks for shared tap event binding helper.
- `npm run test:voice`
  - Voice helper checks for timer formatting, orb state UI mapping, transcript formatting, and voice selection.
- `npm run test:settings`
  - Settings helper checks for tab normalization, visibility logic, deterministic notices, and seed parsing.
- `npm run test:rag:helpers`
  - Pure RAG helper checks for normalization, chunking, token scoring, retrieval profiles, retrieval, and extension parsing.
- `npm run test:web-search`
  - Web-search trigger detection, recoverable error classification, and user-facing recovery notice checks.
- `npm run test:accessibility`
  - Static accessibility checks for dialog semantics, live regions, accessible names, aria state, and focus-visible styling.
- `npm run test:ascii-ui`
  - Guards UI source strings against non-ASCII regressions that can surface as mojibake.
- `npm run test:rag:web`
  - Extensive RAG ingest/retrieval test with downloaded web docs.
- `npm run test:browser:lifecycle`
  - Playwright browser smoke for import/export and send/stop lifecycle controls (requires running app URL via `BASE_URL` or default `http://127.0.0.1:4173`).

## direct dependencies

- `@mlc-ai/web-llm` `^0.2.82`
- `@huggingface/transformers` `^3.8.1`
- `vite` `^6.2.2`

Resolved lockfile note:

- `vite` currently resolves to `6.4.2`.
- `npm audit --audit-level=moderate` reports 0 vulnerabilities after the 2026-05-04 audit refresh.

## dev dependencies

- `playwright` `^1.58.2`

## vite config

`vite.config.js` currently sets:

- `server.port = 6969`
- `server.host = true`
- COOP/COEP headers for browser runtime compatibility:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- `build.target = "esnext"`
- `build.rollupOptions.output.manualChunks`:
  - `webllm` chunk for `@mlc-ai/web-llm`
  - `transformers` chunk for `@huggingface/transformers`
- `optimizeDeps.exclude = ["@mlc-ai/web-llm"]`
