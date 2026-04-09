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
    "test:rendering": "node scripts/rendering-safety-test.mjs",
    "test:routing": "node scripts/routing-sanity-test.mjs",
    "test:device": "node scripts/device-heuristics-test.mjs",
    "test:trust": "node scripts/trust-metadata-test.mjs",
    "test:composer": "node scripts/composer-actions-test.mjs",
    "test:ascii-ui": "node scripts/ascii-ui-strings-test.mjs",
    "test:rag:web": "node scripts/rag-web-extensive-test.mjs"
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
- `npm run test:ascii-ui`
  - Guards UI source strings against non-ASCII regressions that can surface as mojibake.
- `npm run test:rag:web`
  - Extensive RAG ingest/retrieval test with downloaded web docs.

## direct dependencies

- `@mlc-ai/web-llm` `^0.2.82`
- `@huggingface/transformers` `^3.8.1`
- `vite` `^6.2.2`

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
