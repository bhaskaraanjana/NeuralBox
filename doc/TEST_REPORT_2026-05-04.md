# Test Report - 2026-05-04

This report describes the validation strategy and latest execution results for the improvement sweep.

## Automated Validation Status

All automated checks listed below passed during the sweep.

| Command | Coverage | Result |
| --- | --- | --- |
| `npm audit --audit-level=moderate` | Dependency advisories | Pass: 0 vulnerabilities |
| `npm run env:check` | Node range and required files | Pass |
| `npm run test:models` | Model catalog integrity | Pass |
| `npm run test:composer` | Send/stop/no-op composer decisions | Pass |
| `npm run test:generation` | Cancellation and route-switch fallback helpers | Pass |
| `npm run test:events` | Touch/click dedupe helper | Pass |
| `npm run test:voice` | Voice timer/status/orb/transcript helpers | Pass |
| `npm run test:settings` | Settings tab and deterministic seed helpers | Pass |
| `npm run test:rag:helpers` | RAG normalization, chunking, profiles, retrieval | Pass |
| `npm run test:web-search` | Web-search trigger/error/recovery helpers | Pass |
| `npm run test:offline:pwa` | Static offline/PWA shell contracts | Pass |
| `npm run test:browser:offline-shell` | No-WebGPU browser startup smoke | Pass |
| `npm run test:accessibility` | Static accessibility contracts | Pass |
| `npm run test:rendering` | HTML escaping, markdown rendering, URL safety | Pass |
| `npm run test:routing` | Auto-routing task/model scoring helpers | Pass |
| `npm run test:device` | GPU class and VRAM heuristics | Pass |
| `npm run test:trust` | Trust metadata rendering | Pass |
| `npm run test:ascii-ui` | ASCII UI source guard | Pass |
| `npm run test:stability` | Core runtime source contracts | Pass |
| `npm run test:rag:web` | Extensive RAG ingest/retrieval with web docs | Pass |
| `npm run build` | Production bundle generation | Pass |
| `npm run test:browser:lifecycle` | Playwright UI lifecycle smoke against preview | Pass |

## Feature-Oriented Test Coverage

### Startup And Build

Covered by:

- `npm run env:check`
- `npm run build`
- `npm run test:browser:lifecycle`

What is verified:

- required source/test/docs files exist
- Node version is supported
- Vite production build completes
- preview app can open in Playwright smoke flow

### Model Catalog And Routing

Covered by:

- `npm run test:models`
- `npm run test:routing`
- `npm run test:device`
- `npm run test:stability`

What is verified:

- catalog has unique IDs, names, tiers, and VRAM estimates
- catalog includes vision, thinking, and advanced models
- task classification detects coding/reasoning/creative/complex prompts
- model scoring responds to image input, profile mode, and device fit
- model catalog is imported from `src/lib/models.js`

### Composer And Generation Lifecycle

Covered by:

- `npm run test:composer`
- `npm run test:generation`
- `npm run test:browser:lifecycle`

What is verified:

- send button switches between send and stop states
- no-op state is respected without engine/input
- cancellation is detected by flag and generation id
- cancellation errors are classified safely
- route-switch failure messages are stable
- browser smoke validates send-stop UI state transitions

### Rendering And Trust Safety

Covered by:

- `npm run test:rendering`
- `npm run test:trust`
- `npm run test:ascii-ui`

What is verified:

- raw model/user HTML is escaped before formatting
- unsafe URLs are rejected for citations
- think blocks render into expected details UI
- trust metadata escapes unsafe HTML
- UI source strings avoid non-ASCII regressions that previously caused mojibake risk

### Local RAG

Covered by:

- `npm run test:rag:helpers`
- `npm run test:rag:web`
- `npm run test:stability`

What is verified:

- document normalization and chunking
- query tokenization
- lexical scoring and confidence labels
- profile normalization and profile-specific retrieval size
- web-doc ingestion, duplicate handling, char caps, doc caps, and retrieval relevance
- RAG guidance and citation renderer source contracts

### Web Search

Covered by:

- `npm run test:web-search`
- `npm run test:stability`

What is verified:

- auto-search trigger detection for time-sensitive prompts
- stable creative prompts do not auto-search
- timeout/network/rate-limit/endpoint/parse errors classify correctly
- recovery/no-results notices are stable and user-facing

### Offline/PWA Shell

Covered by:

- `npm run test:offline:pwa`
- `npm run test:browser:offline-shell`
- `npm run build`

What is verified:

- WebLLM is lazy-loaded and no longer part of the mandatory app-shell import path.
- No-WebGPU startup enters Offline Library Mode instead of hard-returning.
- Built PWA output includes service worker and app-shell navigation fallback.
- Browser smoke masks `navigator.gpu` and verifies the chat shell opens, send is disabled, the model badge explains Offline Library Mode, and settings remain usable.

### Accessibility

Covered by:

- `npm run test:accessibility`
- `npm run build`

What is verified:

- settings and voice overlays expose dialog semantics
- dynamic status regions use polite live regions
- icon-only controls have accessible names
- RAG dropzone and voice orb expose keyboard/button semantics
- runtime updates key aria states for send/stop, web search, thinking, settings, and voice chat
- keyboard focus-visible styling exists

### Voice

Covered by:

- `npm run test:voice`
- `npm run test:browser:lifecycle` indirectly for UI availability

What is verified:

- timer formatting
- mic status markup
- voice orb UI state mapping
- transcript formatting
- preferred voice selection

Manual still recommended:

- microphone permission prompt
- real Whisper download/cache/transcription
- speech synthesis voice output

### Vision

Covered by:

- `npm run test:stability` source contracts
- existing vision compatibility docs

Manual still recommended:

- real WebGPU vision model load
- image attach/paste/drop with Phi-3.5 vision
- compatibility retry path on target devices

## Known Validation Limits

The automated suite is strong for static contracts, pure helpers, source safety, and browser UI lifecycle. It does not fully prove real local inference quality because that depends on:

- browser WebGPU support
- device GPU/VRAM
- model asset availability and cache state
- upstream WebLLM behavior
- microphone/browser media permissions

For a release demo, run one manual pass on a real WebGPU browser:

1. Load the app on Chrome or Edge.
2. Start with Auto model selection.
3. Send a text prompt.
4. Toggle web search and ask a current-events query.
5. Add RAG docs and try precise/balanced/broad profiles.
6. Use voice input.
7. If GPU supports it, switch to Phi vision and attach an image.
8. Export/import a conversation.
9. Open settings with keyboard only and verify visible focus.
