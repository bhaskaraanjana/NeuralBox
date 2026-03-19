# Vision Embed Shape Incident (2026-03-19)

## Summary

NeuralBox vision requests could fail with runtime errors like:

- `InternalError: expect embed.shape[0] to be 1921, but got 1933`
- `InternalError: expect embed.shape[0] to be 1921, but got 2509`
- `Cannot read properties of undefined (reading 'startsWith')` (secondary formatting issue around image payload shape)

Root cause was not random UI behavior. It was a model/runtime expectation mismatch tied to image geometry.

## Root Cause

`@mlc-ai/web-llm` (current published runtime line) uses a hardcoded expected Phi-3.5 Vision image embedding token count of `1921`.

For Phi-3.5 Vision, actual image embed length changes with crop layout:

- `1344x1008` (landscape, 3x4 crops) -> `1921`
- `1008x1344` (portrait, 4x3 crops) -> `1933`
- `1344x1344` (square, 4x4 crops) -> `2509`

So if an uploaded image is prepared as portrait or square, WebLLM throws because it still expects `1921`.

## Why Those Exact Numbers Appeared

NeuralBox logs and local validation confirmed:

- `1933` corresponds to portrait-prepared images.
- `2509` corresponds to square-prepared images.

This exactly matched user-reported failures.

## App-Side Fix Applied

To stabilize behavior with current WebLLM runtime:

1. Force all vision images to landscape `4:3` output (`1344x1008`) before send.
2. Normalize stored conversation images (legacy portrait/square) when entering a vision chat.
3. Keep `image_url` payload in object form: `{ type: "image_url", image_url: { url } }`.
4. Add detailed diagnostics for image dimensions, crop shape, and estimated embed size.
5. Keep retry path for vision failures and log the fallback image geometry.

## Dependency Note

`package.json` was updated to `@mlc-ai/web-llm ^0.2.82`.  
However, published runtime still contains fixed-size image embed assumptions for this model path, so app-level normalization remains necessary.

Upstream tracking:

- Dynamic image embed sizing is being worked on in WebLLM PR `#774` (`[VLM] Dynamic image embed size and Gemma 3 Vision support`).

## Verification Checklist

Use this when validating the fix:

1. Load `Phi-3.5-vision-instruct-q4f16_1-MLC`.
2. Upload a portrait image and a square image.
3. Confirm preview image is normalized to `1344x1008`.
4. Confirm console shows:
   - `[Vision] Image prepared ... embedEstimate: 1921`
   - `[Vision] Sending image prompt ... embedEstimate: 1921`
5. Confirm no `embed.shape` mismatch is thrown.

## Logging Added

The following logs were added in `src/main.js`:

- `[Vision] Image prepared`
- `[Vision] Sending image prompt`
- `[Vision] Migrated stored image to landscape 4:3`
- `[Vision] Generation failed, retrying with normalized fallback image`
- `[Vision] Retry image prepared`

These logs are intended to make future vision regressions diagnosable in one run.

