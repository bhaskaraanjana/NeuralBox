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

## 9) Offline/Cache Behavior

- Model cache check done with `webllm.hasModelInCache`.
- Start button copy changes based on cache state:
  - cached model -> start immediately
  - uncached model -> download then start

## 10) Mobile and Touch Support

- Click + `touchend` handlers for many interactive controls.
- Sidebar slide-in behavior for smaller viewports.
