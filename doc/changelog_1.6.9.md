# Version 1.6.9

- Bumped app version to 1.6.9 and exposed it in the settings panel.
- Introduced an "Average Joe" vs "Expert" experience mode selector on app startup.
- Added logic in `main.js` to intercept startup and prompt new users for their preferred UI complexity.
- Implemented CSS overrides in `style.css` (`.mode-average-joe`) to elegantly hide advanced options like prompt presets, RAG attachment buttons, workflow selectors, and system debug panels for casual users.
