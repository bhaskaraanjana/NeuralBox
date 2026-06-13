# NeuralBox

**Run any AI model in your browser. No server. No sign-up. On any device.**

NeuralBox is a one-stop studio for in-browser machine learning. Every model runs
**100% on-device** — object detection, depth, segmentation, speech, translation,
chat and more. Nothing you upload ever leaves the tab. It uses **WebGPU** when your
device has it and transparently falls back to **WASM** when it doesn't, so it works
on phones, laptops, and everything in between.

## Studios

Open the gallery and pick a model. Each studio downloads its (small) model once,
caches it in the browser, and then runs offline.

**Vision**
- 🎯 **Object Detection** — real YOLO (YOLOS-tiny) with a live camera mode.
- 🔭 **Find Anything** — zero-shot detection of any object you name (OWL-ViT).
- 🏷️ **Image Labeler** — 1000-class classification (ResNet-50 / ViT).
- 🔮 **Zero-Shot Vision** — score an image against any labels you type (CLIP).
- 🧩 **Segmentation** — per-pixel scene parsing (SegFormer).
- 🌀 **Depth Map** — turn any photo into a 3D depth map (Depth Anything V2).
- ✂️ **Background Remover** — cut out the subject, export a transparent PNG (RMBG).
- 📝 **Image Captioner** — a quick line (ViT-GPT2) or rich, multi-sentence
  **Florence-2** detail.

**Audio**
- 🎙️ **Speech to Text** — transcribe voice or **whole podcasts** with Whisper
  (base/small/distil tiers + multilingual), timestamps, and SRT/TXT export.
- 🔊 **Text to Speech** — natural neural voices (**Kokoro-82M**, 11 voices,
  adjustable speed, reads long text).
- 👂 **Sound Classifier** — identify 500+ sound events (AST / AudioSet).

**Language**
- 💬 **Sentiment** · 🎭 **Emotion** (7-way) · 🧷 **Zero-Shot Text** · ❓ **Q&A**
  (DistilBERT/SQuAD) · 📚 **Summarizer** · 🌍 **Translator** (OPUS-MT) ·
  🔎 **Semantic Search** (embeddings) · 🔖 **Entity Finder** (NER) · 🧠 **Fill
  in the Blank** (BERT).

**Chat**
- 🤖 **Mini Chat** — a tiny streaming LLM (Qwen2.5 / SmolLM2 / Llama-3.2) that runs
  on any device.
- 💎 **Pro Chat** — the full WebLLM assistant (model picker, RAG, web search, voice,
  vision). Requires WebGPU. Lives at `/chat.html` and is embedded as a studio.

## Niceties

- **Quality tiers** — most studios offer a Fast default plus an **Accurate** (or
  Detailed/Max) tier with a stronger model (e.g. DETR & YOLOS-small detection,
  CLIP ViT-B/16, SegFormer-B2/B5, DeBERTa-v3 zero-shot, RoBERTa-SQuAD2 Q&A,
  BGE/GTE embeddings), so you can trade speed for genuine accuracy.
- **Installable PWA** — add to your home screen; works offline after first load.
- **Pin favorites + recents** — surfaced at the top of the gallery (stored locally).
- **Storage panel** — see and clear cached model weights from the top bar.
- **Search + category filters** in the gallery.

## Tech stack

- **Vite** multi-page build (`index.html` = Studio, `chat.html` = Pro Chat).
- **`@huggingface/transformers`** (transformers.js v3) — every studio model.
- **`kokoro-js`** — natural Text-to-Speech.
- **`@mlc-ai/web-llm`** — Pro Chat.
- Vanilla JavaScript + CSS. No UI framework.

## Architecture

```
src/studio/
  main.js        bootstrap: shell + router + studio lifecycle
  runtime.js     the engine — lazy transformers.js, WebGPU/WASM pick, pipeline cache, media helpers
  registry.js    single source of truth for the gallery (+ lazy module loaders)
  router.js      hash router (#/ = home, #/<id> = studio)
  home.js        the launcher gallery
  ui.js          shared UI toolkit (sx-* components)
  styles/studio.css  design system
  tasks/<id>.js  one self-contained studio per model
```

Each studio module default-exports `mount(host, ctx)` and is dynamically imported
only when its route opens, so the gallery loads instantly and model weights download
on first use.

## Requirements

- Node.js `>=20 <26`
- Any modern browser (WebGPU optional — WASM fallback works everywhere).
- Cross-origin isolation headers (`COOP: same-origin`, `COEP: require-corp`) are set
  in `vite.config.js` for both dev and preview; set the same headers when self-hosting
  so SharedArrayBuffer (multi-threaded WASM) and WebGPU work.

## Setup & run

```bash
npm install
npm run dev        # http://localhost:6969
```

## Validate

```bash
npm run build              # builds both pages + all studio chunks
npm run test:studio        # Playwright smoke: gallery, routing, studio mount, zero console errors
npm run test:browser:lifecycle   # Pro Chat lifecycle smoke
```

## Privacy

Inference and all storage are local to the browser. The only network calls are model
weight downloads from the Hugging Face CDN (cached after first load) and — in Pro Chat
only — optional web search. Your images, audio, and text never leave your device.
