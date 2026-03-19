# Architecture And Runtime

## Module Boundaries

- `index.html`
  - Defines all UI containers and control IDs.
- `src/main.js`
  - Owns app state, event wiring, orchestration, and rendering.
- `src/whisper.js`
  - Encapsulates speech-to-text initialization/transcription.
- `src/style.css`
  - Encapsulates all visual behavior.

## Core Runtime State (main.js)

- Model and generation:
  - `engine`
  - `isGenerating`
  - `selectedModelId`
  - `thinkingEnabled`
- Feature toggles:
  - `webSearchEnabled`
- Conversation state:
  - `conversations[]`
  - `activeConversationId`
- Voice recording state:
  - `isRecording`
  - `mediaRecorder`
  - `audioChunks[]`
  - `recordingTimer`
  - `recordingSeconds`
  - `voiceChatActive`
- Vision input:
  - `pendingImage`

## Main Control Flows

### 1) Initialization and Model Selection

1. `init()` checks `navigator.gpu`.
2. Loads persisted settings.
3. Calls `detectDeviceCapabilities()`:
   - attempts adapter discovery
   - estimates VRAM from adapter limits
   - falls back to `navigator.deviceMemory` heuristic
4. Calls `autoSelectModel()` to recommend a model from `MODEL_CATALOG`.
5. Restores persisted model (`neuralbox_model`) when valid.
6. Renders:
   - start screen model selector
   - settings panel model selector
7. Calls `updateStartScreenUi()` to check local cache state via `webllm.hasModelInCache`.

### 2) Model Load and Screen Transition

1. User clicks start -> `loadModel()`.
2. `webllm.CreateMLCEngine(selectedModelId, { initProgressCallback })`.
3. Progress text and progress bar update from callback.
4. On success:
   - model badge updated
   - transition to chat screen (`showChatScreen()`).

### 3) Conversation Flow

1. `loadConversations()` hydrates local history.
2. `createConversation()` creates new chat metadata.
3. `sendMessage()`:
   - normalizes user text
   - optionally prepends `/think` or `/no_think`
   - stores user message (multimodal format for image+vision path)
   - builds system prompt (+ optional search context)
   - streams model response via `engine.chat.completions.create(...)`
   - updates UI incrementally and appends performance stats
   - persists conversation state.

### 4) Optional Web Search Flow

1. If enabled, `sendMessage()` calls `webSearch(userText)`.
2. Primary strategy:
   - DuckDuckGo Lite HTML endpoint
   - fetched via allorigins proxy
   - parsed by `parseDDGLite()`
3. Fallback strategy:
   - DuckDuckGo Instant Answer API
   - fetched via allorigins proxy
4. `buildSearchContext()` appends structured context to system prompt.
5. `renderSourceCitations()` adds clickable sources under assistant messages.

### 5) Voice Input Flow (Mic Button)

1. `startRecording()` acquires mic stream and starts `MediaRecorder`.
2. On stop, blob is passed to `processRecording(audioBlob)`.
3. `processRecording()`:
   - initializes Whisper if needed (`initWhisper`)
   - transcribes audio (`transcribeAudio`)
   - inserts result into text input.

### 6) Voice Chat Overlay Flow

1. `openVoiceChat()` shows full-screen voice UI.
2. `voiceChatListen()`:
   - records until orb tapped again
   - transcribes speech
   - appends user message to conversation
   - streams assistant response
   - speaks response via `speakText()`
   - restarts listening loop if still active.

### 7) Vision/Image Flow

1. Available only when selected model has `vision: true`.
2. User attaches image via picker/paste/drag-drop.
3. Image is normalized to landscape `1344x1008` and staged in `pendingImage`.
4. On send:
   - UI shows image in user bubble
   - conversation stores multimodal message (`text` + `image_url` object payload)
   - logs capture prepared dimensions, crop estimate, and embed estimate.
5. When opening vision conversations, stored multimodal entries are normalized (legacy-safe).
6. On specific vision failures (`startsWith` / `embed.shape`), one retry path re-normalizes and resends.

## Rendering Strategy

- Rendering is direct DOM manipulation (no framework virtual DOM).
- Main primitives:
  - `addMessageToDOM`
  - `renderSidebar`
  - `renderWelcome`
  - show/hide classes for overlays/panels

## Persistence Strategy

- Browser-only localStorage persistence:
  - settings
  - conversations
  - selected model
- One migration path exists for legacy `neuralbox_messages` to conversation format.
