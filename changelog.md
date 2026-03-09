# Changelog

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
