# NeuralBox Documentation

This folder contains implementation-level documentation for the current NeuralBox codebase.

## Live App

- **Production URL:** [https://neuralbox.infinitemind.space](https://neuralbox.infinitemind.space)
- **Pro Chat:** [https://neuralbox.infinitemind.space/chat.html](https://neuralbox.infinitemind.space/chat.html)

## Screenshots & demo media

Real-app captures used in the root `README.md` are stored under [`../docs/assets/`](../docs/assets/):

- Studio gallery (desktop + mobile)
- Object Detection, Image Captioner, Speech to Text, Sentiment
- Pro Chat (desktop + mobile)
- Short walkthrough clip: [`demo-walkthrough.webm`](../docs/assets/demo-walkthrough.webm)

Regenerate from the live site:

```bash
node scripts/capture-docs-screenshots.mjs
node scripts/capture-docs-video.mjs
```

## Documentation Map

- `PROJECT_OVERVIEW.md` - Product goals, runtime model, and startup sequence.
- `CODEBASE_SCAN_2026-05-04.md` - Fresh repository scan, verified baseline, risk register, and planning candidates.
- `IMPROVEMENT_REPORT_2026-05-04.md` - Detailed record of the improvement sweep and remaining refactor targets.
- `TEST_REPORT_2026-05-04.md` - Feature-oriented validation map and latest test results.
- `NeuralBox_Builder_Club_Presentation.docx` - Visual technical presentation document for Builder Club.
- `FILE_REFERENCE.md` - What every repository file does.
- `ARCHITECTURE_AND_RUNTIME.md` - System architecture and end-to-end execution flows.
- `FEATURE_REFERENCE.md` - Detailed feature behavior (chat, web search, voice, vision, thinking mode).
- `DATA_AND_STORAGE.md` - In-memory state, database records, and storage semantics.
- `UI_REFERENCE.md` - HTML structure, CSS architecture, and responsive behavior.
- `FUNCTION_REFERENCE.md` - Function-by-function reference for `src/main.js` and `src/whisper.js`.
- `CONFIG_AND_DEPENDENCIES.md` - Build/runtime config and dependency inventory.
- `ENVIRONMENT_SETUP.md` - Required runtime versions, setup commands, and validation workflow.
- `CHANGELOG_SUMMARY.md` - Version history summary from `changelog.md`.
- `KNOWN_GAPS.md` - Observed mismatches and implementation caveats.
- `VISION_EMBED_SHAPE_INCIDENT_2026-03-19.md` - Root cause analysis and fix notes for Phi-3.5 vision `embed.shape` mismatch errors.

## Scope

The docs were written from direct code inspection of:

- `index.html`
- `src/main.js`
- `src/whisper.js`
- `src/db/database.js`
- `src/lib/*.js`
- `src/style.css`
- `scripts/*.mjs`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `README.md`
- `changelog.md`
- `.gitignore`

## Quick Start

Use the live app at [https://neuralbox.infinitemind.space](https://neuralbox.infinitemind.space), or run locally:

```bash
npm install
npm run dev
```

Then open the local Vite URL (default config uses port `6969` unless overridden).
