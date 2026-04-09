# NeuralBox

Local-first AI chat in the browser using WebGPU and WebLLM.

NeuralBox runs models on-device, stores conversations locally, supports optional web lookup, optional document-grounded responses (RAG), optional voice input, and vision input for supported models.

## Current capabilities

- Local chat with streaming responses and perf stats.
- Model selection:
  - Manual model selection.
  - `Auto` mode with per-request routing and hot swap.
- Vision input for supported models (image attach, paste, drag/drop).
- Local document attach for RAG (text/code/log-style files).
- Optional web-enhanced answers (DuckDuckGo via proxy).
- Voice input (Whisper tiny.en via Transformers.js).
- Voice chat overlay mode (listen -> generate -> speak loop).
- Conversation export/import, Markdown export, and share-text copy.
- Runtime debug panel and workbench panel for diagnostics.

## Tech stack

- Vite
- `@mlc-ai/web-llm`
- `@huggingface/transformers` (Whisper ASR)
- Vanilla JavaScript + CSS

## Requirements

- Node.js `>=20 <26`
- A browser with WebGPU support (latest Chrome/Edge recommended)

## Setup

```bash
npm install
npm run env:check
```

## Run

Default dev server (configured in `vite.config.js`):

```bash
npm run dev
```

Override port when needed:

```bash
npm run dev -- --port 5174 --host
```

## Validate

```bash
npm run build
npm run test:stability
npm run test:rendering
npm run test:routing
npm run test:device
npm run test:rag:web
```

## Model catalog

Model definitions live in [src/main.js](C:/DEV/NeuralBox/src/main.js) (`MODEL_CATALOG`) and are split in UI as:

- Curated models (default/recommended path)
- Advanced models (opt-in)

Use the in-app selector for the canonical, current list.

## Privacy and network behavior

- Inference and conversation storage are local to the browser.
- Web-enhanced mode and auto web search send the query to DuckDuckGo endpoints (through allorigins proxy).
- First model load downloads model assets and caches them locally.

## Notes

- Vision support currently includes compatibility workarounds for known WebLLM Phi-3.5 embedding-shape constraints; see `doc/VISION_EMBED_SHAPE_INCIDENT_2026-03-19.md`.
- RAG document ingestion currently enforces a per-file size cap of 5MB for predictable browser performance.
