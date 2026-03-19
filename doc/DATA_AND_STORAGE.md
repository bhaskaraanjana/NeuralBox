# Data And Storage

## In-Memory Runtime State

Owned by `src/main.js`:

- `engine`: active WebLLM engine instance.
- `isGenerating`: assistant generation lock.
- `webSearchEnabled`: search mode toggle.
- `selectedModelId`: currently active model ID.
- `thinkingEnabled`: think mode toggle.
- `pendingImage`: staged image payload before send.
- `conversations[]`: loaded/active conversation list.
- `activeConversationId`: selected conversation.
- Voice/mic state:
  - `isRecording`
  - `mediaRecorder`
  - `audioChunks[]`
  - `recordingTimer`
  - `recordingSeconds`
  - `voiceChatActive`

## localStorage Keys

## `neuralbox_settings`

JSON object with fields:

- `systemPrompt` (string)
- `temperature` (number)
- `maxTokens` (number)
- `webSearch` (boolean) (stored by web-search toggle logic)

## `neuralbox_model`

- string model ID from `MODEL_CATALOG`.

## `neuralbox_conversations`

- JSON array of conversation objects:

```json
[
  {
    "id": "unique_id",
    "title": "Conversation title",
    "messages": [
      { "role": "user", "content": "text" },
      { "role": "assistant", "content": "text" }
    ],
    "createdAt": 1710000000000,
    "updatedAt": 1710000000000
  }
]
```

Possible `messages[].content` shapes:

- Text chat path: string
- Vision path (user): array with multimodal objects:
  - `{ type: "image_url", image_url: { url: "data:..." } }`
  - `{ type: "text", text: "..." }`

## `neuralbox_messages` (legacy)

- Old single-conversation format.
- Migrated once into `neuralbox_conversations` in `loadConversations()`, then removed.

## Persistence Semantics

- Save occurs after important state changes:
  - conversation mutations
  - settings close/save
  - web toggle changes
  - model selection changes
- All persistence is client-only in browser storage.
- No server database and no backend sync layer.

## Data Privacy Surface

Local by default:

- prompts
- responses
- settings
- model preference
- speech transcription pipeline execution

Networked only when features require it:

- initial model/asset downloads
- optional web search requests
