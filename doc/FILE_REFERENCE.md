# File Reference

This section documents every tracked repository file.

## Root Files

- `.gitignore`
  - Ignores `node_modules/`, `dist/`, `.cache/`, and `*.log`.
- `README.md`
  - End-user overview and setup instructions.
- `changelog.md`
  - Release notes from `1.0.0` through `1.6.0`.
- `index.html`
  - Full static UI markup (loading screen, chat UI, settings panel, voice overlay).
- `package.json`
  - Project metadata, scripts, direct dependencies.
- `package-lock.json`
  - npm lockfile (lockfileVersion 3), fully resolved dependency graph.
- `vite.config.js`
  - Vite config, COOP/COEP headers, build target, dependency optimization behavior.
- `rules.md`
  - Engineering standards and delivery rules for ongoing development.

## Source Files

- `src/main.js`
  - Core app runtime:
    - model selection
    - model loading/reloading
    - message send/stream pipeline
    - conversation CRUD and sidebar rendering
    - optional web search integration
    - app state orchestration and persistence integration
    - mic transcription workflow
    - voice chat loop
    - image attachment behavior for vision models
    - think mode controls
- `src/lib/models.js`
  - Shared model catalog definitions used by startup selection, settings selection, routing, and model-fit UI.
- `src/lib/rendering.js`
  - Extracted pure helpers for:
    - safe HTTP URL parsing
    - escaped markdown-like formatting
    - think-block markdown rendering
- `src/lib/rag.js`
  - Shared pure RAG helpers:
    - normalization
    - chunk splitting
    - retrieval scoring
    - retrieval profile definitions
    - file-extension utility
- `src/lib/web-search.js`
  - Shared web-search helpers:
    - auto-search trigger detection
    - recoverable error classification
    - user-facing recovery and no-result notices
- `src/lib/routing.js`
  - Shared routing helpers:
    - task analysis
    - model tier ranking
    - route score calculation
- `src/lib/device.js`
  - Shared device heuristics:
    - GPU class inference
    - VRAM estimate logic
    - device tier mapping
- `src/db/database.js`
  - IndexedDB-first persistence module with localStorage fallback and legacy migration.
- `src/whisper.js`
  - Local Whisper setup and transcription helper functions.
- `src/style.css`
  - Global design tokens, layout, components, animations, responsive rules.

## Utility Scripts

- `scripts/check-env.mjs`
  - Environment validation script (Node version + required project files).
- `scripts/stability-sprint-smoke.mjs`
  - Runtime contract smoke checks.
- `scripts/model-catalog-test.mjs`
  - Model catalog integrity checks.
- `scripts/rendering-safety-test.mjs`
  - Pure rendering + URL safety checks.
- `scripts/routing-sanity-test.mjs`
  - Pure routing-heuristic sanity checks.
- `scripts/device-heuristics-test.mjs`
  - Device/VRAM heuristic sanity checks.
- `scripts/rag-web-extensive-test.mjs`
  - Extensive RAG ingest/retrieval test with downloaded web docs.
- `scripts/web-search-helpers-test.mjs`
  - Web-search trigger/error/recovery helper checks.
- `scripts/accessibility-static-test.mjs`
  - Static accessibility contract checks for dialog semantics, live regions, accessible names, aria state, and focus styling.

## Documentation Files (Added)

- `doc/README.md`
- `doc/PROJECT_OVERVIEW.md`
- `doc/FILE_REFERENCE.md`
- `doc/ARCHITECTURE_AND_RUNTIME.md`
- `doc/FEATURE_REFERENCE.md`
- `doc/DATA_AND_STORAGE.md`
- `doc/UI_REFERENCE.md`
- `doc/FUNCTION_REFERENCE.md`
- `doc/CONFIG_AND_DEPENDENCIES.md`
- `doc/CHANGELOG_SUMMARY.md`
- `doc/KNOWN_GAPS.md`
- `doc/CODEBASE_SCAN_2026-05-04.md`
- `doc/IMPROVEMENT_REPORT_2026-05-04.md`
- `doc/TEST_REPORT_2026-05-04.md`
