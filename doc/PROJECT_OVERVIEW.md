# Project Overview

## What NeuralBox Is

NeuralBox is a browser-only AI chat app built with Vite + vanilla JavaScript/CSS.  
It loads an MLC WebLLM model into browser GPU memory and runs inference locally (no app backend).

Core design goals:

- Local-first inference with WebGPU.
- Local conversation persistence in browser storage.
- Optional web augmentation (DuckDuckGo via proxy).
- Optional local speech transcription and browser text-to-speech.
- Model selection based on estimated device VRAM.

## Technology Stack

- Runtime UI: HTML + vanilla JS + CSS
- Build tool: Vite
- LLM runtime: `@mlc-ai/web-llm`
- Speech-to-text: `@huggingface/transformers` Whisper pipeline
- Browser APIs:
  - WebGPU (`navigator.gpu`)
  - `MediaRecorder` / `getUserMedia`
  - `SpeechSynthesis`
  - `localStorage`

## Entry Points

- App shell: `index.html`
- Main app logic: `src/main.js`
- Voice transcription module: `src/whisper.js`
- Styling: `src/style.css`

## Runtime Screens

- Loading screen (`#loading-screen`)
  - Detects WebGPU
  - Detects rough device VRAM tier
  - Lets user pick model
  - Checks model cache status
- Chat screen (`#chat-screen`)
  - Sidebar conversation list
  - Chat messages
  - Input controls (search, think, mic, image, send)
  - Settings side panel
- Voice chat overlay (`#voice-chat-overlay`)
  - Full-screen conversational voice loop

## Startup Sequence (High Level)

1. `init()` runs.
2. WebGPU is checked.
3. Settings are loaded from localStorage.
4. Device capability estimate is computed.
5. Recommended model is selected (or persisted model is reused).
6. Model selectors are rendered (start screen + settings panel).
7. Cache status for selected model is checked.
8. User clicks start -> model loads via `CreateMLCEngine`.
9. App switches to chat screen and loads conversation history.
