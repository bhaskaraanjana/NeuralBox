# File Reference

This section documents every tracked repository file.

## Root Files

- `.gitignore`
  - Ignores `node_modules/`, `dist/`, `.cache/`, and `*.log`.
- `README.md`
  - End-user overview and setup instructions.
- `changelog.md`
  - Release notes from `1.0.0` through `1.5.0`.
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
    - model catalog and selection
    - model loading/reloading
    - message send/stream pipeline
    - conversation CRUD and sidebar rendering
    - optional web search integration
    - app state orchestration and persistence integration
    - mic transcription workflow
    - voice chat loop
    - image attachment behavior for vision models
    - think mode controls
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
