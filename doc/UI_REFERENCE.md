# UI Reference

## Layout overview

- `#loading-screen`
  - WebGPU checks, model preselect, cache/download status, start button.
- `#chat-screen`
  - Sidebar, chat header, debug/workbench panels, message list, input composer.
- `#voice-chat-overlay`
  - Full-screen voice loop interaction mode.

## Key UI regions

## Loading screen

- `#start-model-selector-group`
- `#status-text`
- `#progress-fill`
- `#progress-percent`
- `#start-btn`
- `#cache-status-note`

## Sidebar

- `#sidebar`
- `#conversation-search`
- `#conversation-list`
- `#sidebar-new-chat`

## Chat header and diagnostics

- `#model-badge`
- `#hot-swap-status`
- `#new-chat-btn`
- `#voice-chat-btn`
- `#settings-btn`
- `#debug-panel`, `#debug-state`, `#debug-events`
- `#workbench-panel`, `#workbench-body`

## Composer controls

- `#web-search-toggle`
- `#think-toggle`
- `#mic-btn`
- `#image-btn`, `#image-input`, `#image-preview`, `#image-preview-clear`
- `#doc-btn`, `#doc-input`, `#doc-preview`, `#doc-preview-clear`
- `#user-input`
- `#send-btn` (send/stop dual-state)
- `#voice-status`
- `#input-disclaimer`

## Settings panel

- Tabs:
  - `#settings-tab-regular`
  - `#settings-tab-advanced`
- Model and generation:
  - `#model-selector-group`
  - `#system-prompt`
  - `#temperature`
  - `#max-tokens`
- Toggles:
  - `#web-search-setting`
  - `#auto-web-search-setting`
  - `#trust-layer-setting`
  - `#deterministic-setting`
  - `#vision-verbose-setting`
  - `#debug-panel-setting`
  - `#workbench-setting`
- RAG controls:
  - `#rag-dropzone`
  - `#rag-add-btn`
  - `#rag-clear-btn`
  - `#rag-file-input`
  - `#rag-status`
  - `#rag-guidance`
  - `#rag-search-input`
  - `#rag-doc-list`
- Backup/export:
  - `#export-chats-btn`
  - `#import-chats-btn`
  - `#export-md-btn`
  - `#copy-share-btn`

## Styling notes (`src/style.css`)

- Theme and tokens in `:root`.
- Layered overrides are used for current Jan-inspired visual direction.
- Responsive behavior has breakpoints at:
  - `980px`
  - `768px`
  - `640px`
  - `480px`

## Interaction notes

- Most controls bind both click and touch paths.
- RAG and image controls support drag/drop.
- Runtime events feed both debug panel and workbench views.
