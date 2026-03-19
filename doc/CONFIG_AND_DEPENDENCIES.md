# Config And Dependencies

## package.json

```json
{
  "name": "neuralbox",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## npm Scripts

- `npm run dev`
  - Starts Vite development server.
- `npm run build`
  - Creates production bundle in `dist/`.
- `npm run preview`
  - Serves built assets locally for verification.

## Direct Dependencies

- `@huggingface/transformers` `^3.8.1`
  - Whisper speech transcription pipeline.
- `@mlc-ai/web-llm` `^0.2.81`
  - Browser LLM runtime (WebGPU-backed).
- `vite` `^6.2.2`
  - Build/dev server tooling.

## Lockfile Snapshot (`package-lock.json`)

- `name`: `neuralbox`
- `version`: `1.0.0`
- `lockfileVersion`: `3`
- resolved package entries: `144`

Root dependency entries in lockfile:

- `@huggingface/transformers: ^3.8.1`
- `@mlc-ai/web-llm: ^0.2.81`
- `vite: ^6.2.2`

## Vite Configuration (`vite.config.js`)

### Server Headers

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These headers are commonly required for advanced browser compute/runtime features used by local AI stacks.

### Build Target

- `target: "esnext"`

### Dependency Optimization

- `optimizeDeps.exclude = ["@mlc-ai/web-llm"]`
  - Prevents Vite pre-bundling behavior that can interfere with this package.

## Browser/API Requirements

- WebGPU-capable browser for LLM runtime.
- Microphone permissions for speech input/voice chat.
- `SpeechSynthesis` availability for voice response playback.
