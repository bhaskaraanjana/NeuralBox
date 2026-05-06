# Feature Reference

## Model Catalog

Defined in `src/main.js` as `MODEL_CATALOG`.

| Model | ID | Approx Size | VRAM Hint (MB) | Flags |
|---|---|---:|---:|---|
| SmolLM2 360M | `SmolLM2-360M-Instruct-q0f16-MLC` | ~200MB | 400 | none |
| Qwen 3 0.6B | `Qwen3-0.6B-q4f16_1-MLC` | ~400MB | 600 | thinking |
| SmolLM2 1.7B | `SmolLM2-1.7B-Instruct-q4f16_1-MLC` | ~1GB | 1200 | none |
| Qwen 3 1.7B | `Qwen3-1.7B-q4f16_1-MLC` | ~1.1GB | 1500 | thinking |
| Llama 3.2 3B | `Llama-3.2-3B-Instruct-q4f16_1-MLC` | ~2GB | 2500 | none |
| Qwen 3 4B | `Qwen3-4B-q4f16_1-MLC` | ~2.5GB | 3500 | thinking |
| Phi 3.5 Mini 3.8B | `Phi-3.5-mini-instruct-q4f16_1-MLC` | ~2.4GB | 3500 | none |
| Phi 3.5 Vision 4.2B | `Phi-3.5-vision-instruct-q4f16_1-MLC` | ~2.7GB | 4000 | vision |
| DeepSeek R1 Distill 7B | `DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC` | ~4.5GB | 5500 | thinking |
| Qwen 3 8B | `Qwen3-8B-q4f16_1-MLC` | ~5GB | 6000 | thinking |

## Core Features

## 1) Local Chat Generation

- Uses `engine.chat.completions.create(..., stream: true)`.
- Streams assistant tokens live to the UI.
- Input send control becomes stop control while generation is active.
- Adds simple generation stats:
  - tokens/sec
  - token count
  - elapsed time

## 2) Multi-Conversation Sidebar

- Conversation schema:
  - `id`, `title`, `messages[]`, `createdAt`, `updatedAt`
- Supports:
  - create
  - switch
  - delete
  - relative updated timestamp
- Auto title generation from first user message.

## 3) Settings Panel

- System prompt text area.
- Temperature slider.
- Max tokens slider.
- Web-enhanced mode toggle.
- Runtime debug panel toggle.
- Model selector and runtime model switch.
- Clear all conversations action.

## 4) Web-Enhanced Mode (Optional)

- Off by default.
- When enabled:
  - input disclaimer changes state
  - query sent to DuckDuckGo via allorigins proxy
  - parsed snippets are injected into system context
  - source links rendered below assistant output

## 5) Voice Input (Mic Button)

- Press once to start recording.
- Press again to stop.
- Audio is transcribed locally via Whisper (`whisper-tiny.en`).
- Transcribed text is inserted into the message composer for manual review/edit.

## 6) Voice Chat Overlay Mode

- Full-screen orb-driven loop:
  - tap orb -> start listening
  - tap orb again -> stop
  - transcribe -> generate -> speak
  - auto listen again after TTS ends

## 7) Vision Image Attachment

- Only shown when selected model has `vision: true`.
- User can attach one image via:
  - file picker
  - clipboard paste
  - drag/drop into input area
- Image is normalized before send to a landscape `4:3` frame (`1344x1008`) to keep Phi-3.5 Vision embed size stable.
- Sent to model as multimodal message with:
  - `type: text`
  - `type: image_url` (`image_url: { url: ... }` object shape)
- Stored multimodal history is normalized when switching to a vision conversation to avoid legacy payload issues.
- If generation fails with vision-format or embed-shape errors, one retry path re-normalizes and resends the image.

## 8) Thinking Mode Toggle

- Visible only for models marked `thinking: true`.
- Toggle affects outbound user text by prepending:
  - `/think` when enabled
  - `/no_think` when disabled
- Assistant output parser can render `<think>...</think>` blocks as collapsible details.

## 9) Offline/PWA And Cache Behavior

- The app shell is registered explicitly through `virtual:pwa-register`.
- WebLLM is lazy-loaded only when model actions need it; the app shell no longer statically imports the large WebLLM chunk.
- Heavy same-origin ML runtime chunks (`webllm`, `transformers`, and runtime WASM) are runtime-cached after first successful use, not precached during install.
- If WebGPU is unavailable, startup enters Offline Library Mode instead of returning early:
  - chat shell opens automatically
  - local conversations/settings/RAG metadata remain accessible
  - import/export and settings continue to work
  - inference, image analysis, and voice-chat generation controls are disabled
- WebGPU availability is based on `navigator.gpu.requestAdapter`, not only `navigator.gpu`, so Android browsers that expose the API but cannot provide a compatible adapter fail into Offline Library Mode with a clear reason.
- Model cache check is only attempted when WebGPU is available and uses `webllm.hasModelInCache`.
- Cached offline inference can work when all prerequisites are true:
  - the app shell/service worker has been installed or cached
  - the WebLLM runtime chunk was loaded at least once online
  - the selected model assets are already cached by WebLLM
  - the browser session exposes WebGPU
- Start button copy changes based on cache state when inference is available:
  - cached model -> start immediately
  - uncached model -> download then start

## 10) Model Selection Modes

- Manual model mode:
  - exact selected model is used every request
- `Auto` mode:
  - request is routed by lightweight heuristics (complexity, coding/reasoning cues, image presence)
  - route can trigger an in-place model hot swap before generation
- Model hot swaps are always enabled and show progress in header status.

## 11) Runtime Debug Panel

- Optional panel under chat header.
- Shows current runtime state snapshot and recent structured runtime events.
- Includes clear action for the in-memory event buffer.

## 12) Mobile and Touch Support

- Click + `touchend` handlers for many interactive controls.
- Sidebar slide-in behavior for smaller viewports.
- Chat composer send-state is centralized so mobile voice/input paths cannot force-enable Send unless a model engine is active.
- If a selected model fails with a memory/GPU compatibility error, startup retries once with the smallest text model before giving up.

## 13) Local RAG Document Attach

- Documents are attached directly from chat/settings (`doc` button and RAG panel).
- Current RAG pipeline is local keyword scoring:
  - text normalization
  - chunking with overlap
  - token-hit score ranking
- Indexed docs are persisted in browser storage.
- Retrieval runs automatically when user query and indexed chunks overlap.
- Ingestion safety guards:
  - extension/MIME allow-list checks
  - per-file size cap (`RAG_MAX_FILE_BYTES`, currently 5MB)
  - clear skip reporting (unsupported / too large / empty)

## 14) Trust Layer Metadata

- Optional per-response trust block in assistant messages.
- Includes:
  - selected model
  - route reason
  - workflow
  - deterministic mode
  - web result count/mode
  - RAG match count
  - retrieved RAG doc names (when present)
