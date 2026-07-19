# Environment Setup

## Live App

Production deployment:

- **Studios:** [https://neuralbox.infinitemind.space](https://neuralbox.infinitemind.space)
- **Pro Chat:** [https://neuralbox.infinitemind.space/chat.html](https://neuralbox.infinitemind.space/chat.html)

Use the live URL for demos and browser checks when you do not need a local build. Local setup below is for development and test scripts.

## Runtime Requirements

- Node.js `>=20 <26`
- npm (bundled with Node)
- A WebGPU-capable browser for full local inference testing
- The app shell can still open without WebGPU in Offline Library Mode for local data, settings, import/export, and PWA availability checks

## First-Time Setup

```bash
npm install
npm run env:check
```

## Development Workflow

```bash
npm run dev
```

Default dev port is `6969` (from `vite.config.js`).
Override when needed:

```bash
npm run dev -- --port 5174 --host
```

Open the Vite URL in a browser with WebGPU enabled.

If WebGPU is unavailable, NeuralBox should no longer stop on the startup screen. It should enter Offline Library Mode and open the chat shell with inference controls disabled.

## Validation Workflow

```bash
npm run env:check
npm run build
npm run test:stability
npm run test:rendering
npm run test:routing
npm run test:device
npm run test:offline:pwa
npm run test:rag:web
```

## Notes

- The app is local-first and uses browser storage.
- Persistence is managed through `src/db/database.js` (IndexedDB-first with safe fallback).
- Legacy localStorage data is migrated automatically into the database layer on startup.

