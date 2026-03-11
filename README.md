# NeuralBox

**Run AI in your browser. No server. No sign-up. Private by design.**

NeuralBox runs powerful LLMs entirely in your browser using WebGPU. Your data never leaves your device.

![NeuralBox Banner](app-screenshot-placeholder.png) 


## ✨ Features

- 🧠 **Fully Local AI** — AI runs entirely in-browser via WebGPU, with zero server dependency.
- 🔒 **Private by Design** — No data is ever sent anywhere. Conversations are stored locally.
- ⚡ **Real-Time Generation** — Streaming token generation with performance stats (tok/s).
- 📴 **Offline Capable** — After the first model download, the app works entirely without internet connection.
- 🎙️ **Voice Chat Mode** — Continuous hands-free voice conversations using a local Whisper model for Speech-to-Text and browser Text-to-Speech APIs.
- 🌐 **Web-Enhanced Mode** — (Optional) Inject real-time knowledge via DuckDuckGo Instant Answers. 
- 🎛️ **Hardware-Optimized Models** — Auto-detects your GPU VRAM and recommends the best model. Choose from 6 different models (from 0.5B to 7B parameters) based on your device limits.
- 💬 **Conversation Management** — Multi-conversation sidebar to easily manage, switch, and delete chats.
- 📱 **Responsive & Premium UI** — Dark glassmorphic theme with smooth animations, optimized for desktop, tablet, and mobile. Touch-friendly interface.

## 🚀 Quick Start

### Prerequisites
- **Browser**: Chrome, Edge, Firefox, or Safari with **WebGPU support** enabled.
- **GPU**: Any discrete or integrated GPU with WebGPU drivers.
- **RAM**: 4GB+ available. 

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bhaskaraanjana/NeuralBox.git
   cd NeuralBox
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open in Browser:**
   Navigate to the URL shown in your terminal (usually `http://localhost:5173`).

*Note: The first time you load a model or use Voice Chat, the application will download the necessary model files (~350MB to ~4.5GB depending on the model, ~40MB for Whisper). These files are cached in your browser's IndexedDB for instant offline loading on subsequent visits.*

## 🧩 Tech Stack

- **[Vite](https://vitejs.dev/)** — Lightning-fast build tool.
- **[@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm)** — High-performance in-browser LLM inference utilizing ONNX WASM & WebGPU.
- **Transformers.js / Whisper** — In-browser local speech-to-text.
- **Vanilla JS/CSS** — Zero framework overhead for pure performance.

## 🗃️ Available Models

NeuralBox allows you to choose the LLM that best fits your hardware directly from the settings menu:

- **Qwen 2.5 — 0.5B** (Lite, ~350MB, ~1GB VRAM) - *Fastest, great for constrained devices*
- **Qwen 2.5 — 1.5B** (Standard, ~1GB, ~1.5GB VRAM)
- **Qwen 2.5 — 3B** (Performance, ~2GB, ~3GB VRAM)
- **Llama 3.2 — 3B** (Performance, ~2GB, ~3GB VRAM)
- **Phi 3.5 Mini — 3.8B** (Performance, ~2.4GB, ~3.5GB VRAM)
- **Qwen 2.5 — 7B** (Premium, ~4.5GB, ~6GB+ VRAM) - *Highest quality reasoning*

## 🛡️ Privacy

NeuralBox is designed for absolute privacy. All AI inference runs locally on your device. Your conversation history is stored entirely in your browser's `localStorage`. Unless you explicitly enable the "Web-Enhanced Mode" (which pings DuckDuckGo for search results), zero network requests are made after the initial model download.

## 📜 License

This project is licensed under the MIT License.
