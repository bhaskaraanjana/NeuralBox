# NeuralBox media assets

Screenshots and a short walkthrough clip captured from the **live app**:
[https://neuralbox.infinitemind.space](https://neuralbox.infinitemind.space)

## Files

| File | Description |
|------|-------------|
| `desktop-studios-home.png` | Studio gallery / home |
| `desktop-object-detection.png` | Object Detection studio |
| `desktop-image-captioner.png` | Image Captioner studio (model loading) |
| `desktop-speech-to-text.png` | Speech to Text studio (Whisper download) |
| `desktop-sentiment.png` | Sentiment studio with sample text |
| `desktop-pro-chat.png` | Pro Chat shell |
| `mobile-studios-home.png` | Mobile gallery |
| `mobile-pro-chat.png` | Mobile Pro Chat |
| `demo-walkthrough.webm` | Short UI walkthrough video |

## Regenerate

From the repo root (requires Playwright browsers):

```bash
# Still frames
node scripts/capture-docs-screenshots.mjs

# Walkthrough clip
node scripts/capture-docs-video.mjs
```

Optional local target:

```bash
BASE_URL=http://127.0.0.1:4173 node scripts/capture-docs-screenshots.mjs
```
