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

// transformers.js fires per-file events; we roll them into one honest
// 0-100% with an explicit lifecycle phase.
//
// The hard truths about the real event stream (verified against the library)
// that dictate this design — and the exact symptoms each caused:
//
//  1. Files arrive in WAVES, not all up front. A model loads tiny config /
//     tokenizer JSON first (done in <1s), and only THEN announces the big
//     multi-hundred-MB weight files. So "every file I've heard about is done"
//     is NOT "the download is finished" — usually it's just the end of the JSON
//     wave. A few KB of JSON reading as 100%/95% (then frozen there while the
//     real weights silently download) is the "stuck at a random number" bug.
//
//  2. The denominator is unknowable up front, so any percentage over a partial
//     file set lies. We therefore only show a real PERCENTAGE once the known
//     bytes are weight-sized (> MEANINGFUL_BYTES). Until then — JSON wave, or a
//     file served without Content-Length — we stay INDETERMINATE and report the
//     bytes downloaded instead of a fake %. This never invents a number it
//     can't back up, and the denominator that does drive the bar is stable
//     (weight files are announced together), so the % only rises.
//
//  3. The library compiles the ONNX session with NO events, in the gap between
//     the last file 'done' and the 'ready' event. We can't measure it, so once
//     every known file is done (and real bytes have arrived) we go indeterminate
//     "Preparing…" rather than freezing the bar. A brief same-state flash during
//     a between-waves gap is harmless; the bar animates instead of looking hung.
//
// Phases: 'connecting' (no file events yet) → 'downloading' (bytes moving) →
//         'preparing' (all known files done; compiling/warming, no events) →
//         'ready' (pipeline resolved — signalled by the library's 'ready').
//
// Weight files are always well over a megabyte; no tokenizer/config bundle here
// is. So this cleanly separates "still fetching tiny metadata" from "fetching
// real weights" without guessing the file list or relying on timers.
const MEANINGFUL_BYTES = 2 * 1024 * 1024;

function makeProgress(onProgress) {
    if (typeof onProgress !== 'function') return undefined;
    const files = new Map(); // file -> { loaded, total, done }
    let sawReady = false;

    const emit = (status, file) => {
        let loaded = 0, total = 0;
        let allDone = files.size > 0;
        for (const f of files.values()) {
            loaded += f.loaded;
            if (f.total > 0) total += f.total;
            if (!f.done) allDone = false;
        }

        // Phase.
        let phase;
        if (sawReady) phase = 'ready';
        else if (files.size === 0) phase = 'connecting';
        else if (allDone && loaded >= MEANINGFUL_BYTES) phase = 'preparing';
        else phase = 'downloading';

        // Percentage + whether it's trustworthy enough to render as a number.
        // Determinate ONLY while a weight-sized payload with a known total is
        // genuinely still in flight (loaded < total). Two reasons for the strict
        // gate, both real bugs we hit:
        //   - loaded === total means the known files just finished a wave; the
        //     next (bigger) wave isn't announced yet, so a "100%" here is false.
        //     Going indeterminate avoids a premature 99 that then sticks.
        //   - No monotonic floor: bytes downloaded only grow, so loaded/total is
        //     already monotonic *within* a denominator. The denominator itself
        //     grows as later files are announced (2.6 → 25 → 76 MB), and a floor
        //     would freeze the bar at the first wave's % for the whole download.
        // The byte readout (loaded/total MB) carries the detail when we're
        // indeterminate, so the user always sees real movement.
        let pct = 0;
        let determinate = false;
        if (phase === 'ready') {
            pct = 100;
        } else if (phase === 'downloading' && total >= MEANINGFUL_BYTES && loaded < total) {
            pct = Math.max(0, Math.min(99, Math.round((loaded / total) * 100)));
            determinate = true;
        }

        onProgress({ status, phase, pct, determinate, loaded, total, file: file || '' });
    };

    return (e) => {
        const status = e.status;
        if (e.file && status !== 'ready') {
            // Register on first sighting (initiate/download) so we leave the
            // 0% "connecting" state the moment real work begins. Re-initiate of
            // an already-seen file keeps its accumulated bytes (a no-op here).
            if (!files.has(e.file)) files.set(e.file, { loaded: 0, total: 0, done: false });
            const f = files.get(e.file);
            if (status === 'progress') {
                if (typeof e.loaded === 'number' && e.loaded > f.loaded) f.loaded = e.loaded;
                if (typeof e.total === 'number' && e.total > 0) f.total = e.total;
            } else if (status === 'done') {
                f.done = true;
                if (f.total > 0) f.loaded = f.total;
            }
        }
        if (status === 'ready') sawReady = true;
        emit(status, e.file);
    };
}

// ---- Pipeline / model cache ---------------------------------

/**
 * Wrap a loader callback so raw transformers.js progress events (from
 * library classes like KokoroTTS / Florence2 loaded outside loadPipeline)
 * are aggregated into a normalized { pct, status } stream.
 */
export function aggregateProgress(onProgress) {
    return makeProgress(onProgress);
}

const _cache = new Map();

// Models whose WebGPU load failed (errored or stalled in the silent compile
// step) once this session. We don't retry WebGPU for them — go straight to
// WASM, which is reliable. Keyed by model id. This is the missing half of the
// "works on any device" promise: pickDevice() only probes the ADAPTER, but a
// WebGPU load can still fail AFTER the adapter is acquired, during onnxruntime
// session creation (verified: Whisper hangs/throws on WebGPU here, loads in
// ~6s on WASM). Without this, the loader faithfully reports a backend that
// never finishes — the "stuck at compiling" report.
const _webgpuBlocklist = new Set();

/** True if this exact spec is already resident (no download needed). */
export async function isCached(spec) {
    const probed = await pickDevice();
    const device = _webgpuBlocklist.has(spec.model) ? 'wasm' : resolveDevice(spec, probed);
    const dtype = resolveDtype(spec.dtype, device);
    return _cache.has(`pipe:${spec.task}:${spec.model}:${device}:${dtype}`)
        || _cache.has(`auto:${spec.modelClass || 'AutoModel'}:${spec.model}:${device}:${dtype}`);
}

// How long the silent post-download compile may run on WebGPU before we give up
// and fall back to WASM. The compile fires NO events, so a genuine hang is
// indistinguishable from slow work except by time. WebGPU compiles that succeed
// are fast (sub-10s here); a stall means the session is wedged. WASM is exempt —
// there's nothing to fall back TO, and a slow phone CPU compile is legitimate.
const WEBGPU_COMPILE_BUDGET_MS = 25000;

/**
 * Run one load attempt on a specific device, racing the silent WebGPU compile
 * phase against a stall budget. `start(onProg)` kicks off the underlying load
 * and returns its promise; we watch the normalized progress to know when the
 * download is done and the (event-less) compile has begun.
 * Resolves to the loaded value, or rejects with a tagged error so the caller
 * can decide whether to fall back.
 */
function attemptLoad(device, start, onProgress) {
    let onCompile = null;
    let compileTimer = null;
    const armBudget = () => {
        if (device !== 'webgpu' || compileTimer) return;
        compileTimer = setTimeout(() => {
            const e = new Error('WebGPU compile exceeded budget');
            e.code = 'WEBGPU_STALL';
            onCompile?.(e);
        }, WEBGPU_COMPILE_BUDGET_MS);
        if (typeof compileTimer?.unref === 'function') compileTimer.unref();
    };
    const pc = makeProgress((p) => {
        // 'preparing' = downloads done, compile started → start the stall clock.
        if (p.phase === 'preparing') armBudget();
        onProgress?.(p);
    });
    const loadP = start(pc);
    if (device !== 'webgpu') return loadP;
    // Race the actual load against the compile-stall signal.
    const stallP = new Promise((_, reject) => { onCompile = reject; });
    // If the stall budget wins the race, the underlying WebGPU load promise is
    // abandoned but stays pending — and may later reject (e.g. the wedged
    // session finally throws). Swallow that so it can't surface as an unhandled
    // rejection after we've already fallen back to WASM.
    loadP.catch(() => {});
    return Promise.race([loadP, stallP]).finally(() => { if (compileTimer) clearTimeout(compileTimer); });
}

/** Heuristic: is this a WebGPU-backend failure worth retrying on WASM? */
function isWebgpuFailure(err) {
    if (err?.code === 'WEBGPU_STALL') return true;
    const m = String(err?.message || err || '');
    // onnxruntime/WebGPU session-creation failures: opaque numeric pointers,
    // device-lost, allocation, backend/provider errors.
    return /^\d+$/.test(m.trim())
        || /webgpu|device lost|gpu|adapter|gpubuffer|out of memory|allocation|no available backend|execution provider|session/i.test(m);
}

/**
 * The single place the WebGPU→WASM fallback lives. Returns ONE promise that
 * encapsulates the whole story: try the resolved device, and if a WebGPU load
 * fails or stalls compiling, blocklist the model and retry on WASM. This whole
 * promise is what gets cached — so every awaiter (e.g. a studio that warms the
 * model on mount AND loads it again on Run) shares the SAME rescued result.
 *
 * Putting the fallback in only the first caller's `.catch` was a real bug: the
 * second caller hit the cache, awaited the racing WebGPU promise raw, and threw
 * the opaque onnxruntime error with no fallback (the "loader error: <number>").
 *
 * @param {string} device resolved starting device ('webgpu' | 'wasm')
 * @param {(dev: string, pc: Function) => Promise<any>} make builds the load on a device
 * @param {string} model id (for the session-wide WebGPU blocklist)
 * @param {Function} [onProgress]
 */
function loadWithFallback(device, make, model, onProgress) {
    onProgress?.({ status: 'connecting', phase: 'connecting', pct: 0 });
    const first = attemptLoad(device, (pc) => make(device, pc), onProgress);
    if (device !== 'webgpu') return first;
    return first.catch((err) => {
        if (!isWebgpuFailure(err)) throw err;
        // WebGPU is unreliable for this model on this device — never try it again
        // this session, and rescue the load on WASM (verified reliable).
        _webgpuBlocklist.add(model);
        onProgress?.({ status: 'fallback', phase: 'connecting', pct: 0, fallback: 'wasm' });
        return attemptLoad('wasm', (pc) => make('wasm', pc), onProgress);
    });
}

/**
 * Load (and cache) a transformers.js pipeline.
 * spec: { task, model, dtype?: string|{webgpu,wasm}, device?: 'auto'|'webgpu'|'wasm', options? }
 * Returns the ready pipeline. Concurrent calls for the same spec share one load.
 * Falls back WebGPU→WASM if the WebGPU session fails or stalls compiling.
 *
 * NOTE: some architectures LOAD fine on WebGPU then ABORT during inference with
 * an opaque onnxruntime error (verified: OWL-ViT, SegFormer). That can't be
 * rescued in-page — the abort poisons the shared onnxruntime WASM module, so a
 * later same-page reload on WASM fails too; only a fresh page with WASM-from-the-
 * start works. So those models are pinned to `device: 'wasm'` in the catalog,
 * which routes them here straight to the WASM path. See models.js.
 */
export async function loadPipeline(spec, onProgress) {
    const probed = await pickDevice();
    const forceWasm = _webgpuBlocklist.has(spec.model);
    const device = forceWasm ? 'wasm' : resolveDevice(spec, probed);
    const dtype = resolveDtype(spec.dtype, device);
    const key = `pipe:${spec.task}:${spec.model}:${device}:${dtype}`;
    if (_cache.has(key)) {
        onProgress?.({ status: 'ready', pct: 100, cached: true });
        return _cache.get(key);
    }
    const { pipeline } = await loadLib();
    const make = (dev, pc) => pipeline(spec.task, spec.model, {
        dtype: resolveDtype(spec.dtype, dev), device: dev, progress_callback: pc, ...(spec.options || {}),
    });
    const p = loadWithFallback(device, make, spec.model, onProgress);
    _cache.set(key, p);
    try {
        return await p;
    } catch (err) {
        _cache.delete(key);
        throw err;
    }
}

/**
 * Load a raw model + AutoProcessor pair for tasks that have no standard
 * pipeline (e.g. RMBG background removal, pyannote speaker diarization).
 * Same WebGPU→WASM fallback.
 * spec: { model, processor?, dtype?, device?, modelOptions?, modelClass? }
 *   modelClass — name of the transformers.js class to load with (e.g.
 *     'AutoModelForAudioFrameClassification'); defaults to 'AutoModel'.
 * Returns { model, processor, device }.
 */
export async function loadAutoModel(spec, onProgress) {
    const probed = await pickDevice();
    const forceWasm = _webgpuBlocklist.has(spec.model);
    const device = forceWasm ? 'wasm' : resolveDevice(spec, probed);
    const dtype = resolveDtype(spec.dtype, device);
    const key = `auto:${spec.modelClass || 'AutoModel'}:${spec.model}:${device}:${dtype}`;
    if (_cache.has(key)) {
        onProgress?.({ status: 'ready', pct: 100, cached: true });
        return _cache.get(key);
    }
    const lib = await loadLib();
    const ModelClass = lib[spec.modelClass || 'AutoModel'];
    if (!ModelClass) throw new Error(`Unknown model class: ${spec.modelClass}`);
    const { AutoProcessor } = lib;
    const make = (dev, pc) => (async () => {
        const [model, processor] = await Promise.all([
            ModelClass.from_pretrained(spec.model, { dtype: resolveDtype(spec.dtype, dev), device: dev, progress_callback: pc, ...(spec.modelOptions || {}) }),
            AutoProcessor.from_pretrained(spec.processor || spec.model, { progress_callback: pc }),
        ]);
        return { model, processor, device: dev };
    })();
    const res = loadWithFallback(device, make, spec.model, onProgress);
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

/** Split text into sentence-grouped chunks under ~maxChars, for long-form TTS. */
export function splitForTTS(text, maxChars = 220) {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    if (clean.length <= maxChars) return clean ? [clean] : [];
    // Break into sentences, then greedily pack into chunks.
    const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [clean];
    const chunks = [];
    let cur = '';
    for (let s of sentences) {
        s = s.trim();
        if (!s) continue;
        // A single overlong sentence: hard-split on word boundaries.
        if (s.length > maxChars) {
            if (cur) { chunks.push(cur); cur = ''; }
            const words = s.split(' ');
            let part = '';
            for (const w of words) {
                if ((part + ' ' + w).trim().length > maxChars) { if (part) chunks.push(part); part = w; }
                else part = (part ? part + ' ' : '') + w;
            }
            if (part) cur = part;
            continue;
        }
        if ((cur + ' ' + s).trim().length > maxChars) { chunks.push(cur); cur = s; }
        else cur = (cur ? cur + ' ' : '') + s;
    }
    if (cur) chunks.push(cur);
    return chunks;
}

/** Concatenate Float32 PCM chunks into one (with an optional silent gap between). */
export function concatFloat32(chunks, gapSamples = 0) {
    const list = chunks.filter((c) => c && c.length);
    if (!list.length) return new Float32Array(0);
    const total = list.reduce((n, c) => n + c.length, 0) + gapSamples * (list.length - 1);
    const out = new Float32Array(total);
    let off = 0;
    for (let i = 0; i < list.length; i++) {
        out.set(list[i], off);
        off += list[i].length + (i < list.length - 1 ? gapSamples : 0);
    }
    return out;
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
