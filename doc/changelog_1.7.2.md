# Version 1.7.2

- Bumped app version to 1.7.2.
- Merged the separate audio-file-transcription button into the existing doc-attach button. The button now accepts all file types: text/code docs (→ RAG) and audio files (→ live-streamed Whisper transcription).
- Added **Web Speech API live interim transcription** to the microphone recording flow — text now appears in the input box word-by-word as you speak in real-time; Whisper still runs on the final recording for maximum accuracy.
- Added `vercel.json` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers required for WebGPU and SharedArrayBuffer, plus SPA rewrite rule.
- Build passes cleanly (`npm run build`).
