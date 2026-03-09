# Changelog

## [1.2.0] — 2026-03-09

### Added
- **Web-Enhanced mode** — opt-in web search via DuckDuckGo Instant Answer API
- 🌐 Toggle button in the input area to enable/disable web search
- Web search setting with toggle switch in settings panel
- Searching indicator shown while fetching web results
- Search results injected into system prompt for grounded answers
- Source citations displayed below AI responses with clickable links
- Web search preference saved to localStorage

### Notes
- Web search is **off by default** — fully private mode
- When enabled, search queries are sent to DuckDuckGo (they don't log)
- AI still runs locally; only search queries leave the device



## [1.1.0] — 2026-03-09

### Added
- **Multi-conversation sidebar** with conversation list
- Create, switch between, and delete conversations
- Auto-generated conversation titles from first user message
- Relative timestamps (e.g. "5m ago", "2h ago")
- Hamburger menu toggle for sidebar on mobile
- Mobile-responsive sidebar with slide-in animation and overlay
- Migration support for old single-conversation localStorage data
- Sidebar shows "🔒 All stored locally" footer

### Changed
- Chat screen restructured to sidebar + main chat area layout
- New chat button now creates a conversation entry in sidebar
- Clear history in settings now clears all conversations



## [1.0.0] — 2026-03-09

### Added
- Initial release of NeuralBox
- Browser-based AI chat using WebLLM + WebGPU
- Qwen2.5-0.5B model (MLC-compiled) for in-browser inference
- Streaming token generation with performance stats (tok/s)
- Model download with progress bar, cached in IndexedDB
- WebGPU compatibility check with fallback error message
- Conversation history persisted in localStorage
- Settings panel: system prompt, temperature, max tokens
- Suggestion chips for quick prompts
- Premium dark glassmorphic UI with Inter font
- Responsive design: desktop, tablet, mobile
- Touch event support for all interactive elements
- New conversation and clear history functionality

### Architecture
- **Stack**: Vite + Vanilla JS/CSS + @mlc-ai/web-llm
- **Zero backend** — all inference runs in the user's browser
- **Zero data collection** — nothing leaves the device
