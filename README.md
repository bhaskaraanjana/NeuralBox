<div align="center">
  <div style="font-size: 3em; font-weight: bold; margin-bottom: 0.25em;">NeuralBox</div>
  <p><em>Run a powerful AI chatbot entirely in your browser. No server, no sign-up, no data leaves your device.</em></p>
</div>

<br />

NeuralBox is a local-first web application that runs large language models natively in your browser using **WebGPU** and **WebLLM**. It brings the power of state-of-the-art models straight to your hardware while ensuring 100% privacy—no server, no cloud, no subscriptions.

---

## ✨ Features

- 🔒 **100% Private:** Inference and conversation storage are fully local. Your data never leaves your device.
- ⚡ **WebGPU Accelerated:** Real-time generation powered by hardware acceleration.
- 🖼️ **Multimodal Capabilities:** Drag, drop, or paste images for vision analysis (with supported models).
- 🎙️ **Voice Mode & Whisper ASR:** Enjoy hands-free dictation and a fullscreen Voice Chat mode, powered by localized Transformers.js. Whisper is preloaded and streams text to your screen in real time.
- 📚 **Local RAG (Document Q&A):** Attach `.md`, `.txt`, `.csv`, `.json`, code, or log files to ground the AI's knowledge base securely on-device with smart citations.
- 🌐 **Web-Enhanced Mode:** Optional DuckDuckGo-powered web lookups for up-to-date answers.
- 🛡️ **Trust & Telemetry:** Full visibility into routing decisions, context lengths, and RAG confidence scores via the Trust Layer and Runtime Workbench.

## 🛠️ Technology Stack

- **[Vite](https://vitejs.dev/)** - Lightning fast dev server & build tool
- **[@mlc-ai/web-llm](https://webllm.mlc.ai/)** - In-browser LLM inference via WebGPU
- **[@huggingface/transformers](https://huggingface.co/docs/transformers.js/index)** - Local ASR (Whisper tiny.en)
- **Vanilla JS + CSS** - Zero framework overhead

## 📋 Requirements

- **Node.js**: `>=20 <26`
- **Browser**: A modern browser with WebGPU support enabled (Latest Chrome, Edge, or Firefox) for local AI inference.
- **Android**: Local chat requires Chrome/Edge on Android with a usable WebGPU adapter, not just the `navigator.gpu` API. If Android cannot provide an adapter, NeuralBox opens Offline Library Mode instead of leaving the chat composer in a silent broken state.
- **iOS/iPadOS**: The app shell, local library, settings, import/export, and PWA install path are supported. Local model inference only works if the iOS browser session exposes WebGPU and a compatible adapter; otherwise NeuralBox opens Compatibility/Offline Library Mode.
- **Offline/PWA shell**: Once installed or cached, NeuralBox still opens without internet or WebGPU so you can access settings, local conversations, imports/exports, and the app shell. Model inference still requires WebGPU and a previously available/cached model runtime.
- **Cached offline inference**: After a model and the WebLLM runtime chunks have been loaded once online, the service worker runtime-caches the ML chunks and WebLLM can reuse its cached model assets offline. Uncached models still need internet for first download.

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
npm run env:check
```

### 2. Start the Development Server
```bash
npm run dev
```
> **Note for Local Network Access**: The Vite dev server is configured with `@vitejs/plugin-basic-ssl` to serve HTTPS automatically. This ensures secure contexts (`https://`) are met so that WebGPU features can function perfectly when testing on phones or other computers in your local network.

## 🧪 Testing & Validation

NeuralBox enforces strict reliability and accessibility standards. You can run the test suites locally:
```bash
npm run test:stability
npm run test:offline:pwa
npm run test:android:chat
npm run test:ios:compat
npm run test:browser:mobile
npm run test:browser:offline-shell
npm run test:rendering
npm run test:routing
npm run test:rag:helpers
npm run test:accessibility
```

## 🧠 Model Catalog

Our curated model definitions are maintained within `src/lib/models.js` and intelligently routed via our custom heuristics. We offer both "Curated" models optimized for general use and "Advanced" models for specialized tasks. *Note: Models are cached securely in IndexedDB after their first download.*

---
<div align="center">
  Built with privacy in mind.
</div>
