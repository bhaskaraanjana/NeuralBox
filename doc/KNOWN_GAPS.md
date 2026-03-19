# Known Gaps And Caveats

This file records implementation observations from the current source snapshot.

## 1) Docs/metadata mismatch

- `package.json` still reports version `1.0.0`, while `changelog.md` includes entries up to `1.5.0`.
- `README.md` model list and branding text may not fully match current `MODEL_CATALOG` in `src/main.js`.

## 2) Upstream WebLLM vision embed-size limitation

- Phi-3.5 vision path in current published WebLLM runtime still assumes a fixed image embed size (`1921`) in core checks.
- Actual embed size varies with image crop layout; mismatches can throw runtime errors.
- NeuralBox now applies an app-side workaround by normalizing images to landscape `1344x1008` (3x4 crop path), but this remains a compatibility layer over upstream behavior.
- Incident details are documented in `VISION_EMBED_SHAPE_INCIDENT_2026-03-19.md`.

## 3) Limited markdown sanitation

- Assistant content is converted with regex-based formatting in `formatBasicHTML()`.
- It is not a full markdown parser and does not include robust sanitization layers.

## 4) Browser support constraints

- App hard depends on WebGPU for model runtime.
- Voice features depend on microphone permissions and browser media support.
- Text-to-speech quality and voice availability depend on platform/browser voice packs.

## 5) External dependency surface for web search

- Web-enhanced mode routes requests through allorigins + DuckDuckGo endpoints.
- If either endpoint rate-limits, changes format, or is blocked, search enrichment can degrade.

## 6) Runtime debug panel persistence model

- Debug events are intentionally in-memory only and capped (current max: 100 events).
- Events are cleared on page reload; only panel enabled/disabled preference is persisted.
