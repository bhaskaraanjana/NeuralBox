# Changelog

## [1.4.0] — 2026-03-09

### Added
- **🗣️ Voice Chat Mode** — continuous back-to-back voice conversations
- Mic button in header opens full-screen voice chat overlay
- Animated orb with 4 states: idle (🎙️), listening (👂), thinking (🧠), speaking (🗣️)
- Text-to-speech via browser SpeechSynthesis API (no download needed)
- Auto-listen loop: after AI speaks, it automatically starts listening again
- Conversation transcripts saved to chat history
- Close button and header toggle to exit voice chat
- Touch support on all voice chat controls

### Flow
1. Tap mic button in header → voice chat overlay opens
2. Tap the orb → starts listening (green pulse)
3. Tap orb again → stops recording, transcribes with Whisper (amber spin)
4. AI generates response → speaks it aloud (purple pulse)
5. Automatically starts listening again → continuous conversation


## [1.3.0] — 2026-03-09

### Added
- **🎙️ Voice input** — local speech-to-text using OpenAI Whisper (tiny.en, ~40MB)
- Microphone button in the input area with pulsing red recording indicator
- Recording timer showing duration
- Whisper model auto-downloads on first voice use, cached after
- Transcribed text inserted into input field for editing before sending
- Voice status bar showing recording/transcribing/complete states

### Notes
- Voice transcription runs **100% locally** via ONNX Runtime WASM
- No audio is sent to any server
- First use requires ~40MB model download (cached in browser)
- English language only (whisper-tiny.en)


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
