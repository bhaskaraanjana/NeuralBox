# UI Reference

## HTML Structure (`index.html`)

Top-level app node:

- `#app`

Primary screens:

- `#loading-screen.screen.active`
- `#chat-screen.screen`
- `#voice-chat-overlay`

### Loading Screen Region

Important IDs:

- `#webgpu-error`
- `#download-section`
- `#status-text`
- `#progress-fill`
- `#progress-percent`
- `#start-btn`
- `#cache-status-note`
- `#start-model-selector-group`

### Chat Screen Region

Sidebar:

- `#sidebar`
- `#conversation-list`
- `#sidebar-new-chat`
- `#sidebar-overlay`

Header:

- `#sidebar-toggle`
- `#model-badge`
- `#hot-swap-status`
- `#new-chat-btn`
- `#voice-chat-btn`
- `#settings-btn`

Debug:

- `#debug-panel`
- `#debug-state`
- `#debug-events`
- `#debug-clear-btn`

Messages:

- `#messages`

Input and controls:

- `#web-search-toggle`
- `#think-toggle`
- `#mic-btn`
- `#image-btn`
- `#image-input`
- `#user-input`
- `#send-btn`
- `#image-preview`
- `#image-preview-img`
- `#image-preview-clear`
- `#voice-status`
- `#input-disclaimer`

Settings panel:

- `#settings-panel`
- `#settings-overlay`
- `#close-settings`
- `#model-selector-group`
- `#system-prompt`
- `#temperature`
- `#temp-value`
- `#max-tokens`
- `#tokens-value`
- `#web-search-setting`
- `#debug-panel-setting`
- `#clear-history-btn`

Voice overlay:

- `#voice-chat-close`
- `#voice-orb`
- `#voice-chat-label`
- `#voice-chat-text`

## CSS Architecture (`src/style.css`)

## 1) Design Tokens (`:root`)

- Color tokens for backgrounds, text, accents, and borders.
- Radius, shadow, motion, and font variables.

## 2) Section Layout

Main sections are clearly separated with comments:

- reset/base
- loading screen
- chat screen and sidebar
- messages and input
- settings panel
- responsive blocks
- feature-specific sections (search, mic, voice mode, image preview, think blocks)

## 3) Reusable UI Patterns

- `.icon-btn` for header actions
- `.btn-primary` and `.btn-danger`
- `.message`, `.message-content`, `.typing-indicator`
- `.web-toggle`
- `.voice-status`

## 4) Feature Visual States

- Web search:
  - `.web-toggle.active`
  - `.input-disclaimer.web-active`
  - `.search-badge`
  - `.search-sources`
- Mic:
  - `.mic-btn.recording`
  - `.mic-btn.loading`
  - `.voice-status.recording`
  - `.voice-status.transcribing`
- Voice chat orb:
  - `.voice-orb.listening`
  - `.voice-orb.thinking`
  - `.voice-orb.speaking`
- Think output:
  - `.think-block`
  - `.think-content`

## 5) Responsive Breakpoints

- `@media (max-width: 768px)`
  - sidebar becomes off-canvas drawer
  - settings panel becomes full-width
  - message typography and spacing tighten
- `@media (max-width: 480px)`
  - tighter header/input spacing
  - smaller avatars/logo

## Animation Inventory

Keyframes:

- `ambientPulse` (loading background)
- `logoGlow`
- `fadeInUp` (welcome)
- `messageIn` (chat entries)
- `typingBounce`
- `fadeIn` (settings overlay)
- `slideIn` (settings panel)
- `spin` (search/voice spinners)
- `pulse-mic`
- `orb-pulse`
- `orb-spin`
