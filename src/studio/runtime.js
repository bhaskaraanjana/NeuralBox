// ============================================================
// NeuralBox Studio — Model Runtime
// One engine to run every in-browser model. Lazily loads
// transformers.js, auto-selects WebGPU or WASM (so it runs on
// ANY device), caches pipelines, and normalizes load progress.
// ============================================================

let _libPromise = null;

/** Lazy-load transformers.js once and configure the environment. */
export async function loadLib() {
    if (!_libPromise) {
        _libPromise = import('@huggingface/transformers').then((lib) => {
            // We always fetch from the HF hub and cache in the browser.
            lib.env.allowLocalModels = false;
            lib.env.useBrowserCache = true;
            try {
                const threads = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4)));
                if (lib.env.backends?.onnx?.wasm) {
                    lib.env.backends.onnx.wasm.numThreads = threads;
                }
            } catch (_) { /* best effort */ }
            return lib;
        });
    }
    return _libPromise;
}

// ---- Device selection ---------------------------------------

let _devicePromise = null;

/** True if WebGPU is even nominally present. */
export function hasWebGPU() {
    return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
}

/** Probe for a usable WebGPU adapter; fall back to WASM. Cached. */
export async function pickDevice() {
    if (!_devicePromise) {
        _devicePromise = (async () => {
            if (!hasWebGPU()) return 'wasm';
            try {
                const adapter = await navigator.gpu.requestAdapter();
                return adapter ? 'webgpu' : 'wasm';
            } catch (_) {
                return 'wasm';
            }
        })();
    }
    return _devicePromise;
}

function resolveDevice(spec, device) {
    if (spec.device && spec.device !== 'auto') return spec.device;
    return device;
}

function resolveDtype(dtype, device) {
    if (!dtype) return device === 'webgpu' ? 'fp32' : 'q8';
    if (typeof dtype === 'string') return dtype;
    return dtype[device] || dtype.wasm || 'q8';
}

// ---- Progress aggregation -----------------------------------

// transformers.js fires per-file events; we roll them into one 0-100%.
function makeProgress(onProgress) {
    if (typeof onProgress !== 'function') return undefined;
    const files = new Map();
    let lastPct = 0;
    return (e) => {
        if (e.status === 'progress' && e.file) {
            files.set(e.file, { loaded: e.loaded || 0, total: e.total || 0 });
        } else if (e.status === 'done' && e.file && files.has(e.file)) {
            const f = files.get(e.file);
            files.set(e.file, { loaded: f.total, total: f.total });
        }
        let loaded = 0, total = 0;
        for (const f of files.values()) { loaded += f.loaded; total += f.total; }
        let pct = total > 0 ? Math.round((loaded / total) * 100) : lastPct;
        if (e.status === 'ready') pct = 100;
        pct = Math.max(0, Math.min(100, pct));
        if (pct >= lastPct || e.status === 'ready') lastPct = pct;
        onProgress({ status: e.status, pct: lastPct, file: e.file || '', name: e.name, loaded, total });
    };
}

// ---- Pipeline / model cache ---------------------------------

const _cache = new Map();

/** True if this exact spec is already resident (no download needed). */
export async function isCached(spec) {
    const device = resolveDevice(spec, await pickDevice());
    const dtype = resolveDtype(spec.dtype, device);
    return _cache.has(`pipe:${spec.task}:${spec.model}:${device}:${dtype}`)
        || _cache.has(`auto:${spec.model}:${device}:${dtype}`);
}

/**
 * Load (and cache) a transformers.js pipeline.
 * spec: { task, model, dtype?: string|{webgpu,wasm}, device?: 'auto'|'webgpu'|'wasm', options? }
 * Returns the ready pipeline. Concurrent calls for the same spec share one load.
 */
export async function loadPipeline(spec, onProgress) {
    const device = resolveDevice(spec, await pickDevice());
    const dtype = resolveDtype(spec.dtype, device);
    const key = `pipe:${spec.task}:${spec.model}:${device}:${dtype}`;
    if (_cache.has(key)) {
        onProgress?.({ status: 'ready', pct: 100, cached: true });
        return _cache.get(key);
    }
    const { pipeline } = await loadLib();
    const p = pipeline(spec.task, spec.model, {
        dtype,
        device,
        progress_callback: makeProgress(onProgress),
        ...(spec.options || {}),
    });
    _cache.set(key, p);
    try {
        return await p;
    } catch (err) {
        _cache.delete(key);
        throw err;
    }
}

/**
 * Load a raw AutoModel + AutoProcessor pair for tasks that have no
 * standard pipeline (e.g. RMBG background removal).
 * spec: { model, processor?, dtype?, device?, modelOptions? }
 * Returns { model, processor, device }.
 */
export async function loadAutoModel(spec, onProgress) {
    const device = resolveDevice(spec, await pickDevice());
    const dtype = resolveDtype(spec.dtype, device);
    const key = `auto:${spec.model}:${device}:${dtype}`;
    if (_cache.has(key)) {
        onProgress?.({ status: 'ready', pct: 100, cached: true });
        return _cache.get(key);
    }
    const { AutoModel, AutoProcessor } = await loadLib();
    const pc = makeProgress(onProgress);
    const res = (async () => {
        const [model, processor] = await Promise.all([
            AutoModel.from_pretrained(spec.model, { dtype, device, progress_callback: pc, ...(spec.modelOptions || {}) }),
            AutoProcessor.from_pretrained(spec.processor || spec.model, { progress_callback: pc }),
        ]);
        return { model, processor, device };
    })();
    _cache.set(key, res);
    try {
        return await res;
    } catch (err) {
        _cache.delete(key);
        throw err;
    }
}

export function clearModelCache() {
    _cache.clear();
}

// ---- Media helpers ------------------------------------------

/** Convert a URL / Blob / File / HTMLCanvasElement / HTMLImageElement to a transformers.js RawImage. */
export async function toRawImage(src) {
    const { RawImage } = await loadLib();
    if (src instanceof RawImage) return src;
    if (typeof src === 'string') return RawImage.fromURL(src);
    if (typeof Blob !== 'undefined' && src instanceof Blob) return RawImage.fromBlob(src);
    if (src instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && src instanceof OffscreenCanvas)) {
        return RawImage.fromCanvas(src);
    }
    if (src instanceof HTMLImageElement) {
        const c = document.createElement('canvas');
        c.width = src.naturalWidth || src.width;
        c.height = src.naturalHeight || src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        return RawImage.fromCanvas(c);
    }
    throw new Error('Unsupported image source');
}

/** Re-export RawImage for studios that need direct construction. */
export async function getRawImageClass() {
    const { RawImage } = await loadLib();
    return RawImage;
}

/** Start the webcam into a <video> element. Returns the MediaStream. */
export async function startCamera(videoEl, { facingMode = 'environment' } = {}) {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play().catch(() => {});
    return stream;
}

export function stopStream(stream) {
    try { stream?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
}

/** Draw the current video frame to a canvas (creating one if needed). Returns the canvas. */
export function grabFrame(videoEl, canvas) {
    const c = canvas || document.createElement('canvas');
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(videoEl, 0, 0, w, h);
    return c;
}

/** Decode an audio Blob to mono Float32 PCM at 16kHz (Whisper-ready). */
export async function decodeAudioTo16k(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: 16000 });
    try {
        const buf = await ctx.decodeAudioData(arrayBuffer);
        if (buf.numberOfChannels === 1) return buf.getChannelData(0);
        // Mixdown to mono.
        const a = buf.getChannelData(0);
        const b = buf.getChannelData(1);
        const out = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
        return out;
    } finally {
        await ctx.close();
    }
}

/** Play raw Float32 PCM through WebAudio. Returns a stop() fn. */
export function playPCM(float32, sampleRate = 16000) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    source.onended = () => ctx.close().catch(() => {});
    return () => { try { source.stop(); } catch (_) {} };
}

/** Encode Float32 PCM to a WAV Blob (for download / <audio>). */
export function pcmToWavBlob(float32, sampleRate = 16000) {
    const numSamples = float32.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    let off = 44;
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
}
