# PROGRESS

Last Updated: 2026-04-08 (America/St_Johns)

## Session Log

### 2026-04-08 - Stability deepscan execution (P0 start)
- Ran repo-wide deep scan and validated current baseline:
  - `npm run build`
  - `npm run test:stability`
  - `npm run test:rag:web`
- Hardened runtime safety in `src/main.js`:
  - Added safe HTTP URL parsing for source citations (`safeParseHttpUrl`).
  - Replaced citation `innerHTML`/raw URL host parsing path with DOM-safe anchor creation.
  - Escaped raw model/user text before markdown-style formatting in `formatBasicHTML`.
  - Added null-safe handling for markdown formatter input.
- Improved device capability estimation:
  - Added layered VRAM estimation (adapter limits + GPU-name hints + memory fallback).
  - Added `gpuClass` and `vramEstimateSource` metadata to runtime state.
  - Included VRAM estimation source in debug summary and `app_init` event.
- Reduced blocking UI flows:
  - Replaced key `alert()` error paths with inline notices (model switch + import/export actions).
- Strengthened stability checks in `scripts/stability-sprint-smoke.mjs`:
  - Citation URL safety contract.
  - Escaped render-path contract.
  - Non-blocking model-switch guard contract.
- Documentation sync work:
  - Rewrote `README.md` to reflect current features/commands.
  - Rewrote `changelog.md` with current `1.6.0` entry.
  - Updated `doc/KNOWN_GAPS.md`, `doc/CONFIG_AND_DEPENDENCIES.md`, `doc/ENVIRONMENT_SETUP.md`.
  - Bumped version metadata in `package.json` and `package-lock.json` to `1.6.0`.
- Post-change verification:
  - `npm run build` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:rag:web` (pass)
- P1 groundwork completed without behavior drift:
  - Extracted pure rendering/safety helpers into `src/lib/rendering.js`.
  - Updated `src/main.js` to import rendering helpers.
  - Added `npm run test:rendering` (`scripts/rendering-safety-test.mjs`).
  - Updated env checks/docs for new module and test script.
- RAG trust transparency improvement:
  - Trust Layer now includes retrieved local document names (`ragDocNames`).
  - Assistant export metadata now includes `rag_docs` in trust line.
- RAG ingestion guardrail improvement:
  - Added extension/MIME allow-list checks.
  - Added per-file size guard (`RAG_MAX_FILE_BYTES = 5MB`).
  - Added explicit skip reporting (unsupported / too large / empty).
- Build optimization:
  - Added Vite manual chunk split for `@mlc-ai/web-llm` and `@huggingface/transformers`.
  - Result: app shell chunk dropped to ~83KB, heavy runtime libs isolated in dedicated chunks.
- RAG UX clarity:
  - Added `#rag-guidance` UI hint with model recommendation and explicit ingestion limits.
  - Updated RAG docs/playbook references to reflect new guardrails.
- Documentation refresh:
  - Rewrote `doc/UI_REFERENCE.md` to match actual DOM IDs and current settings/RAG controls.
- Shared RAG module extraction:
  - Added `src/lib/rag.js` for normalization, chunking, scoring, and retrieval utilities.
  - Updated `src/main.js` to consume shared RAG utilities.
  - Updated `scripts/rag-web-extensive-test.mjs` to reuse the same shared retrieval logic.
- Re-ran full validation after modular extraction and trust updates:
  - `npm run env:check` (pass)
  - `npm run build` (pass)
  - `npm run test:rendering` (pass)
  - `npm run test:stability` (pass)
  - `npm run test:rag:web` (pass)

## What's Been Verified

- Baseline before edits:
  - Build: pass
  - Stability smoke: pass
  - RAG extensive test: pass
- Post-edit verification:
  - Build: pass (`neuralbox@1.6.0`)
  - Stability smoke: pass
  - RAG extensive test: pass
- Additional verification after P1 groundwork:
  - Env check: pass
  - Rendering safety test: pass
  - Build: pass
  - Stability smoke: pass
  - RAG extensive test: pass
- Verification after RAG guardrail update:
  - Rendering safety test: pass
  - Stability smoke: pass
  - Build: pass
  - RAG extensive test: pass
- Verification after chunk-splitting update:
  - Build: pass
  - Stability smoke: pass
  - Rendering safety test: pass
  - RAG extensive test: pass
- Verification after RAG guidance/UI-doc update:
  - Build: pass
  - Stability smoke: pass
  - Rendering safety test: pass
  - RAG extensive test: pass
- Verification after shared RAG module extraction:
  - Env check: pass
  - Rendering safety test: pass
  - Stability smoke: pass
  - RAG extensive test: pass
  - Build: pass

## Known Issues And Gotchas

- Vision path still depends on upstream WebLLM Phi-3.5 embed-shape constraints.
- Web search quality depends on third-party endpoint availability (allorigins + DuckDuckGo).
- `src/main.js` remains a large orchestration file and should be modularized next.
- Local workspace has a pre-existing modified file not touched by this session:
  - `scripts/rag-web-test-data/node-readme.md`

## What To Work On Next

1. Continue P1 modular split of `src/main.js` (routing and voice flows next).
2. Add targeted tests around routing heuristics and trust metadata.
3. Add defensive tests for model-switch fallback and cancellation paths.
4. Continue UI density cleanup on mobile settings and composer flows.

## File Map

- App shell: `index.html`
- Main runtime/orchestration: `src/main.js`
- Rendering/safety helpers: `src/lib/rendering.js`
- RAG helpers: `src/lib/rag.js`
- Persistence layer: `src/db/database.js`
- Voice transcription module: `src/whisper.js`
- Styling: `src/style.css`
- Validation scripts: `scripts/stability-sprint-smoke.mjs`, `scripts/rendering-safety-test.mjs`, `scripts/rag-web-extensive-test.mjs`
- Docs: `doc/`

## Tech Stack

- Runtime: Vanilla JS + Vite
- Local LLM: `@mlc-ai/web-llm`
- Local ASR: `@huggingface/transformers` (Whisper tiny.en)
- Testing: Node script smoke tests + Playwright dependency available
- Persistence: IndexedDB with localStorage fallback
