# Function Reference

This file documents the functional API of `src/main.js` and `src/whisper.js`.

## `src/main.js`

## Model and capability helpers

- `isVisionModel()`
  - Returns true if selected model has `vision` flag.
- `isThinkingModel()`
  - Returns true if selected model has `thinking` flag.
- `detectDeviceCapabilities()`
  - Estimates GPU name and VRAM tier via WebGPU adapter limits.
- `autoSelectModel(capabilities)`
  - Picks largest model that fits estimated VRAM with margin.
- `getModelById(id)`
  - Resolves model metadata by ID with fallback.

## General helpers

- `generateId()`
  - Timestamp + random string ID generator.
- `formatTime(ts)`
  - Relative time formatter for sidebar entries.
- `generateTitle(messages)`
  - Uses first user message (trimmed) as conversation title.
- `escapeHtml(text)`
  - Safe text escaping helper for sidebar labels.

## Web search

- `toggleWebSearch(enabled)`
  - Updates runtime/UI toggle state and persists setting.
- `webSearch(query)`
  - Primary search strategy via DDG Lite + parser.
- `parseDDGLite(html)`
  - HTML parser for Lite results.
- `webSearchFallback(query)`
  - Fallback to DDG Instant Answer API.
- `buildSearchContext(results)`
  - Converts search snippets into system-prompt context.
- `renderSourceCitations(results, container)`
  - Appends source links under assistant message.

## App startup and model loading

- `init()`
  - Entry point; wires startup flow and event handlers.
- `renderStartModelSelector(capabilities, recommended)`
  - Start-screen model selector renderer + persistence sync.
- `updateStartScreenUi(capabilities, recommended)`
  - Cache-aware start button/status text updates.
- `loadModel()`
  - Initial model load into `engine`.
- `renderModelSelector(capabilities, recommended)`
  - Settings panel model selector and runtime model switch.
- `showChatScreen()`
  - Transition to chat UI and conversation hydration.

## Conversation CRUD and sidebar

- `createConversation()`
  - Creates empty conversation and makes it active.
- `switchToConversation(id)`
  - Switches active conversation and re-renders message list.
- `deleteConversation(id)`
  - Removes one conversation and updates active selection.
- `getActiveConversation()`
  - Returns active conversation object or null.
- `renderSidebar()`
  - Renders list rows and binds item/delete handlers.
- `openSidebar()`
- `closeSidebar()`

## Messaging pipeline and rendering

- `sendMessage(text)`
  - Main text/image send flow, streaming generation, save cycle.
- `addMessageToDOM(role, content, imageUrl)`
  - Renders single message bubble.
- `formatMarkdown(text)`
  - Basic markdown-like formatting + `<think>` block support.
- `formatBasicHTML(text)`
  - Regex-based inline formatting.
- `scrollToBottom()`
- `autoResizeInput()`
- `renderWelcome()`

## Persistence and settings

- `saveConversations()`
- `loadConversations()`
- `clearAllConversations()`
- `loadSettings()`
- `saveSettings()`
- `bindSuggestionChips()`

## Mic transcription mode

- `handleMicClick()`
  - Toggle start/stop recording from mic button.
- `startRecording()`
  - Opens microphone and starts `MediaRecorder`.
- `stopRecording()`
  - Stops recorder and timer.
- `processRecording(audioBlob)`
  - Initializes Whisper, transcribes, and injects text into input.

## Voice chat mode

- `speakText(text)`
  - Speaks assistant output using browser TTS.
- `setVoiceChatState(state)`
  - Updates orb class, icon, and state label text.
- `openVoiceChat()`
- `closeVoiceChat()`
- `voiceChatListen()`
  - Record -> transcribe -> generate -> speak -> loop flow.

## `src/whisper.js`

- `initWhisper(onProgress)`
  - Lazy initialization of ASR pipeline (`whisper-tiny.en`).
  - Uses WASM device mode and optional progress callback.
- `transcribeAudio(audioBlob)`
  - Decodes audio to mono float32 and returns transcript text.
- `isWhisperReady()`
  - Returns whether transcriber is initialized.
- `isWhisperLoading()`
  - Returns whether initialization is currently in progress.
