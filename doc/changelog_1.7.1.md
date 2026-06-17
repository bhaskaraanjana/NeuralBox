# Version 1.7.1

- Bumped app version to 1.7.1 and exposed it in the settings panel.
- Added a new **audio file transcription** button (music note icon) to the chat input toolbar.
- Implemented `processAudioFileTranscription()` in `main.js` with full **live streaming** — partial Whisper tokens are streamed live into the input box character-by-character as the audio is processed.
- Added `#audio-file-btn`, `#audio-file-input`, and `#transcribe-status` elements to `index.html`.
- Accepts all browser-supported audio formats (mp3, wav, m4a, webm, ogg, flac, etc.).
