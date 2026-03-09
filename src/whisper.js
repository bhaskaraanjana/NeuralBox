// ============================================
// NeuralBox — Whisper Voice Transcription
// Runs OpenAI Whisper locally in the browser
// ============================================
import { pipeline } from '@huggingface/transformers';

let transcriber = null;
let isTranscriberLoading = false;

const WHISPER_MODEL = 'onnx-community/whisper-tiny.en';

/**
 * Initialize the Whisper transcription pipeline.
 * Downloads the model on first use (~40MB), cached after.
 */
export async function initWhisper(onProgress) {
    if (transcriber) return transcriber;
    if (isTranscriberLoading) return null;

    isTranscriberLoading = true;

    try {
        transcriber = await pipeline(
            'automatic-speech-recognition',
            WHISPER_MODEL,
            {
                dtype: 'q8',
                device: 'wasm', // WASM is most compatible; WebGPU can be tried later
                progress_callback: (progress) => {
                    if (onProgress && progress.status === 'progress') {
                        onProgress(Math.round(progress.progress || 0));
                    }
                    if (onProgress && progress.status === 'ready') {
                        onProgress(100);
                    }
                },
            }
        );
        isTranscriberLoading = false;
        return transcriber;
    } catch (err) {
        isTranscriberLoading = false;
        console.error('Whisper init failed:', err);
        throw err;
    }
}

/**
 * Transcribe an audio blob using Whisper.
 * @param {Blob} audioBlob - Audio blob (webm, wav, etc.)
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudio(audioBlob) {
    if (!transcriber) {
        throw new Error('Whisper not initialized. Call initWhisper() first.');
    }

    // Convert blob to array buffer then to float32 audio
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
    });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Get mono channel float32 data
    const float32Data = audioBuffer.getChannelData(0);

    // Run Whisper
    const result = await transcriber(float32Data);

    await audioCtx.close();

    return result.text?.trim() || '';
}

/**
 * Check if Whisper is ready
 */
export function isWhisperReady() {
    return transcriber !== null;
}

/**
 * Check if Whisper is currently loading
 */
export function isWhisperLoading() {
    return isTranscriberLoading;
}
