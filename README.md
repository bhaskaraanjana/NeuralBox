# NeuralBox

**Run AI in your browser. No server. No sign-up. Private by design.**

NeuralBox runs a Qwen 3.5-class AI model entirely in your browser using WebGPU. Your data never leaves your device.

## Features

- 🧠 **Fully Local AI** — Model runs in-browser via WebGPU, zero server dependency
- 🔒 **Private by Design** — No data is ever sent anywhere
- ⚡ **Streaming Responses** — Real-time token generation, ChatGPT-style
- 📴 **Works Offline** — After first model download, works without internet
- 💬 **Conversation History** — Persisted in localStorage
- ⚙️ **Configurable** — System prompt, temperature, max tokens
- 📱 **Responsive** — Works on desktop, tablet, and mobile
- 🎨 **Premium UI** — Dark glassmorphic theme with smooth animations

## Quick Start

```bash
npm install
npm run dev
```

Open the URL shown in terminal (usually `http://localhost:5173`).

## Requirements

- **Browser**: Chrome, Edge, Firefox, or Safari with WebGPU support
- **GPU**: Any discrete or integrated GPU with WebGPU drivers
- **RAM**: 4GB+ available
- **First visit**: ~600MB model download (cached after)

## Tech Stack

- [Vite](https://vitejs.dev/) — Build tool
- [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) — In-browser LLM inference
- WebGPU — Hardware-accelerated GPU compute
- Vanilla JS/CSS — No framework overhead

## License

MIT
