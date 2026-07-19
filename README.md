<!-- ─────────────────────────── HERO ─────────────────────────── -->
![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=NeuralBox&fontSize=60&fontColor=ffffff&animation=fadeIn)

<div align="center">

### Run any AI model in your browser — private, local, no sign-up.

![Version](https://img.shields.io/badge/version-1.7.6-8b5cf6?style=for-the-badge)
![Privacy](https://img.shields.io/badge/privacy-100%25_on--device-22c55e?style=for-the-badge)
![WebGPU](https://img.shields.io/badge/WebGPU-WASM_fallback-0ea5e9?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-installable-ec4899?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D20%20%3C26-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

<br />

<a href="https://neuralbox.infinitemind.space">
  <img src="https://img.shields.io/badge/▶_Live_Demo-neuralbox.infinitemind.space-8b5cf6?style=for-the-badge" alt="Live Demo"/>
</a>
&nbsp;
<a href="https://neuralbox.infinitemind.space/chat.html">
  <img src="https://img.shields.io/badge/💬_Pro_Chat-Open-ec4899?style=for-the-badge" alt="Pro Chat"/>
</a>
&nbsp;
<a href="#-quick-start">
  <img src="https://img.shields.io/badge/📖_Docs-Quick_Start-0ea5e9?style=for-the-badge" alt="Quick Start"/>
</a>

</div>

NeuralBox is a **local-first** web app for in-browser machine learning and chat. Every model runs **on your device** with **WebGPU** when available, and falls back to **WASM** when it is not. No server for inference. No account. Your data stays in the tab.

> [!TIP]
> Open the live app in Chrome or Edge for the best WebGPU experience. Studios work on WASM too — chat needs a usable GPU adapter.

---

## See it in action

Screenshots from the live app. Full set in [`docs/assets/`](docs/assets/).

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/desktop-studios-home.png" width="100%" alt="NeuralBox studio gallery on desktop"/>
      <br /><em>Studio gallery — 20+ on-device models</em>
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/mobile-studios-home.png" width="55%" alt="NeuralBox studio gallery on mobile"/>
      <br /><em>Mobile-friendly launcher</em>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/desktop-object-detection.png" width="100%" alt="Object Detection studio"/>
      <br /><em>Object Detection (YOLO)</em>
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/desktop-image-captioner.png" width="100%" alt="Image Captioner studio"/>
      <br /><em>Image Captioner</em>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/desktop-speech-to-text.png" width="100%" alt="Speech to Text studio"/>
      <br /><em>Speech to Text (Whisper)</em>
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/desktop-sentiment.png" width="100%" alt="Sentiment studio"/>
      <br /><em>Sentiment analysis</em>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/desktop-pro-chat.png" width="100%" alt="Pro Chat on desktop"/>
      <br /><em>Pro Chat — WebLLM assistant</em>
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/mobile-pro-chat.png" width="55%" alt="Pro Chat on mobile"/>
      <br /><em>Pro Chat on phone</em>
    </td>
  </tr>
</table>

---

## Features

| | Feature | Description |
|--|---------|-------------|
| 🔒 | **100% private** | Inference and storage stay in the browser. Nothing you upload leaves the device. |
| ⚡ | **WebGPU + WASM** | Hardware acceleration when available; honest fallback so studios still run. |
| 🛠️ | **20+ studios** | Vision, audio, language, and chat tasks in one gallery. |
| 🖼️ | **Multimodal** | Drop or paste images for detection, captioning, depth, segmentation, and more. |
| 🎙️ | **Voice & Whisper** | Dictation, podcasts, timestamps, SRT export; fullscreen voice chat in Pro Chat. |
| 📚 | **Local RAG** | Ground answers on your docs (md/txt/csv/json/code) with on-device citations. |
| 🌐 | **Optional web search** | DuckDuckGo lookups when you want current info (Pro Chat only). |
| 🛡️ | **Trust layer** | See routing, context, and RAG confidence instead of a black box. |
| 📱 | **Installable PWA** | Add to home screen; shell works offline after first load. |

---

## Studios

Two shells:

1. **Studios** (`/`) — gallery of specialized models  
2. **Pro Chat** (`/chat.html`) — full WebLLM assistant (RAG, search, voice, vision)

### Vision
- **Object Detection** — YOLO with live camera  
- **Find Anything** — zero-shot detection (OWL-ViT)  
- **Image Labeler** — 1000-class classification  
- **Zero-Shot Vision** — score any labels (CLIP)  
- **Segmentation** — SegFormer  
- **Depth Map** — Depth Anything V2  
- **Background Remover** — transparent PNG export  
- **Image Captioner** — ViT-GPT2 or Florence-2 detail  

### Audio
- **Speech to Text** — Whisper tiers, timestamps, SRT/TXT  
- **Text to Speech** — Kokoro-82M (11 voices)  
- **Sound Classifier** — 500+ AudioSet events  

### Language
Sentiment · Emotion · Zero-Shot Text · Q&A · Summarizer · Translator · Semantic Search · NER · Fill-mask  

### Chat
- **Mini Chat** — small streaming LLMs on any device  
- **Pro Chat** — full model picker + tools  

**Also:** pipelines (“Send result to →”), history, batch runs, quality tiers, favorites/recents, storage panel, deep links.

---

## Built with

<p align="center">
  <img src="https://skillicons.dev/icons?i=vite,js,html,css,nodejs" alt="Tech stack icons"/>
</p>

<p align="center">
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/></a>
  <a href="https://webllm.mlc.ai/"><img src="https://img.shields.io/badge/WebLLM-8b5cf6?style=for-the-badge" alt="WebLLM"/></a>
  <a href="https://huggingface.co/docs/transformers.js"><img src="https://img.shields.io/badge/Transformers.js-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black" alt="Transformers.js"/></a>
  <a href="https://github.com/huggingface/kokoro-js"><img src="https://img.shields.io/badge/Kokoro_TTS-ec4899?style=for-the-badge" alt="Kokoro"/></a>
  <img src="https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS"/>
</p>

---

## Requirements

| | |
|--|--|
| **Node** | `>=20 <26` (local dev / build) |
| **Browser** | Modern Chrome / Edge / Firefox; WebGPU preferred for chat |
| **Android** | Chrome/Edge with a real GPU adapter for chat; otherwise Offline Library Mode |
| **iOS / iPadOS** | Shell, library, settings, PWA install; inference only if WebGPU + adapter exist |
| **Hosting** | Must send `COOP: same-origin` and `COEP: require-corp` (see `vercel.json`) |

> [!IMPORTANT]
> Cross-origin isolation headers are required for SharedArrayBuffer / multi-threaded WASM and solid WebGPU. Production already configures them via `vercel.json`.

---

## Quick start

```bash
git clone https://github.com/bhaskaraanjana/NeuralBox.git
cd NeuralBox
npm install
npm run env:check
npm run dev
```

Vite serves HTTPS (for secure context / WebGPU on LAN). Default port is set in `vite.config.js` (often `6969`).

No `.env` is required for core local inference. Models download from Hugging Face on first use and cache in the browser.

---

## Deployment

**Live app**

| Surface | URL |
|---------|-----|
| Studios | [https://neuralbox.infinitemind.space](https://neuralbox.infinitemind.space) |
| Pro Chat | [https://neuralbox.infinitemind.space/chat.html](https://neuralbox.infinitemind.space/chat.html) |

```bash
npm run build
npm run preview   # local production check
```

Deploy the `dist/` output to any static host that preserves the headers in `vercel.json`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/bhaskaraanjana/NeuralBox)

---

## Testing

```bash
npm run build
npm run test:stability
npm run test:studio
npm run doctor
npm run test:accessibility
```

More suites: `test:browser:lifecycle`, `test:offline:pwa`, `test:android:chat`, `test:ios:compat`, `test:rag:helpers`, and others in `package.json`.  
E2E inference helpers: `scripts/studio-run-check.mjs`, `scripts/pipeline-check.mjs` (via `scripts/e2e-manifest.mjs`).

Refresh README screenshots from the live site:

```bash
npm run docs:shots
```

---

## Architecture (studios)

```
src/studio/
  main.js        bootstrap + router + lifecycle
  runtime.js     transformers.js, WebGPU/WASM, pipeline cache
  models.js      model catalog (single source of truth)
  registry.js    gallery + lazy loaders + pipeline I/O map
  tasks/<id>.js  one studio per task
```

- Chat catalog: `src/lib/models.js`  
- Studio catalog: `src/studio/models.js` (`npm run doctor` verifies Hub ids)  
- Full engineering docs: [`doc/`](doc/)

---

## Privacy

Inference and storage are local. Network use is limited to:

1. Model weight downloads (Hugging Face CDN, cached after first load)  
2. Optional DuckDuckGo web search in Pro Chat only  

Your images, audio, and text never leave the device for inference.

---

<div align="center">

**[▶ Open NeuralBox](https://neuralbox.infinitemind.space)** · [Pro Chat](https://neuralbox.infinitemind.space/chat.html) · [Docs](doc/)

Built with privacy in mind.

</div>

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=120&section=footer)
