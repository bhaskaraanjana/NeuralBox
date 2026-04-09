# NeuralBox Feature Roadmap

Last updated: 2026-04-09

## Product goals

1. Best local-first chat UX in-browser (fast, clear, and trustworthy).
2. Strong multimodal reliability (text, image, voice, and local docs).
3. Operational confidence via automated regression coverage.

## Roadmap themes

### Theme A: UI and UX Rehaul

Status: In progress (Wave 1 complete, Wave 2 model-switch UX complete)

Goals:
- Remove visual clutter across desktop and mobile.
- Improve information hierarchy (conversation, model state, actions).
- Make advanced capabilities discoverable without overwhelming default flow.

Milestones:
- [x] Wave 1: Complete visual re-skin with a single coherent design system.
- [x] Wave 1: Mobile density reduction for composer and settings.
- [x] Wave 1: Preserve all existing runtime IDs and behavior contracts.
- [x] Wave 2: Manual model-switch flow redesign in settings with clearer state and confirmation.
- [ ] Wave 2: Accessibility pass (focus order, keyboard affordances, contrast audit).

### Theme B: Reliability and Runtime Safety

Status: In progress

Goals:
- Keep cancellations, hot-swap fallback, and import/export paths predictable.
- Detect regressions early with pure helper tests and browser smoke checks.

Milestones:
- [x] Cancellation and switch fallback helper extraction with tests.
- [x] Browser lifecycle smoke (import/export + send/stop + switch fallback banner).
- [x] Add browser smoke for manual model-switch button flow.
- [ ] Add recovery UX for network/offline web-search failure modes.

### Theme C: RAG and Retrieval Quality

Status: In progress

Goals:
- Make local document workflows simple and explainable.
- Improve result quality while maintaining local performance.

Milestones:
- [x] RAG ingestion guardrails and guidance text.
- [x] Pure RAG helper tests (normalization, chunking, scoring, retrieval).
- [x] Add citation confidence badges for local RAG snippets.
- [ ] Add configurable retrieval profile presets (precise, balanced, broad).

### Theme D: Voice and Multimodal Experience

Status: In progress

Goals:
- Keep voice interactions responsive and transparent.
- Reduce ambiguity in voice state transitions.

Milestones:
- [x] Voice helper module extraction and tests.
- [ ] Add low-latency incremental voice transcription preview mode.
- [ ] Add explicit retry controls when voice transcription fails.

## Execution plan

### Sprint 1 (current)

Delivered:
- UI rehaul Wave 1 (complete style rewrite with mobile-first cleanup).
- New helper modules (`voice`, `settings`) and helper test lanes.
- Inline success notices for conversation clear/export/import actions.

### Sprint 2 (next)

Planned:
- Accessibility pass for settings and RAG controls.
- Recovery UX for network/offline web-search failure modes.

### Sprint 3

Planned:
- Retrieval profile presets and local citation confidence indicators.
- Voice retry UX and optional streaming transcript preview.

## Success metrics

- Regression suite stays green across all helper tests, smoke tests, and build.
- Mobile usage: fewer taps for core flows (send, attach, settings changes).
- Reduced user confusion around routing/model switching and RAG behavior.
