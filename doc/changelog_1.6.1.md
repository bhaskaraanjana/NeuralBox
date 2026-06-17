# Version 1.6.1

- Bumped app version to 1.6.1 and exposed it in the settings panel.
- Configured Vite development server with @vitejs/plugin-basic-ssl for local WebGPU testing via HTTPS.
- Added beforeunload listener to protect against accidental browser refreshes while the AI model is loaded.
- Modified Vite watcher config to ignore *.md files to prevent unnecessary full-page dev reloads.
- Updated Whisper API to preload in the background on initial app startup.
- Implemented real-time text streaming for Whisper voice transcriptions.