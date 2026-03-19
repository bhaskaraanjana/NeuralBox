# Data And Storage

## In-Memory Runtime State

Owned by `src/main.js`:

- `engine`: active WebLLM engine instance.
- `isGenerating`: assistant generation lock.
- `webSearchEnabled`: search mode toggle.
- `selectedModelId`: currently active model ID.
- `modelSelectionId`: user-selected mode (`Auto` or explicit model).
- `thinkingEnabled`: think mode toggle.
- `pendingImage`: staged image payload before send.
- `conversations[]`: loaded/active conversation list.
- `activeConversationId`: selected conversation.
- `runtimeEvents[]`: bounded runtime debug events.

## Database Layer

- Implementation: `src/db/database.js`
- Primary backend: IndexedDB
  - DB name: `neuralbox_app`
  - Store name: `app_state`
- Fallback backend: localStorage (`db:*` keys) when IndexedDB cannot be used.

## Logical Records

- `settings`
  - `systemPrompt`
  - `temperature`
  - `maxTokens`
  - `webSearch`
  - `verboseVisionLogs`
  - `debugPanelEnabled`
- `conversations`
  - Array of conversation objects:
    - `id`
    - `title`
    - `messages[]`
    - `pinned`
    - `createdAt`
    - `updatedAt`
- `model_selection`
  - string: explicit model ID or `__auto__`

## Legacy Migration

On first DB initialization, the app migrates legacy localStorage keys:

- `neuralbox_settings`
- `neuralbox_conversations`
- `neuralbox_messages` (legacy single-conversation format)
- `neuralbox_model_selection`
- `neuralbox_model`

Migration metadata is stored as `migration_v1_local_storage`.

## Persistence Semantics

- Conversation writes happen after mutations and generation updates.
- Settings writes happen on relevant toggle/slider/input changes.
- Model selection writes happen whenever selection changes.
- All persistence is client-only in browser storage.
- No server database and no backend sync layer.

## Data Privacy Surface

Local by default:

- prompts
- responses
- settings
- model preference and mode
- speech transcription execution

Networked only when features require it:

- initial model/asset downloads
- optional web search requests

