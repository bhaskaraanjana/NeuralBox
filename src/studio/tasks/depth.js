// ============================================================
// Depth Map (Depth Anything V2) — monocular depth estimation.
// Reference-style vision studio: image in, colorized depth out.
// ============================================================
import { el, clear, button, field, loader, imageInput, badge, segmented, downloadBlob, toast } from '../ui.js';
import { loadPipeline, toRawImage, startCamera, stopStream, grabFrame } from '../runtime.js';
import { M } from '../models.js';
import { batchPanel } from '../batch.js';

const SPECS = {
    fast: {
        label: 'Fast',
        spec: M.depthSmall,
    },
    detailed: {
        label: 'Detailed',
        spec: M.depthBase,
    },
};

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, detailed: null };
    let quality = 'fast';
    let currentURL = null;
    let busy = false;
    let lastBlob = null;
    let live = false;
    let stream = null;
    let rafId = 0;

    // ---- DOM ----
    const srcStage = el('div', { class: 'sx-stage block' });
    const srcImg = el('img', { alt: 'input', crossorigin: 'anonymous' });
    const video = el('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none' } });
    srcStage.append(srcImg, video);

    const depthStage = el('div', { class: 'sx-stage block' });
    const depthCanvas = el('canvas');
    depthStage.append(depthCanvas);

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🏔️'),
        el('div', {}, 'Pick an image, drop one in, or use your camera'),
    );
    const stageWrap = el('div', {}, placeholder);

    const meta = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');
    const dlSlot = el('div', { class: 'sx-row end', style: { marginTop: '12px' } });

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'fast', label: 'Fast' }, { value: 'detailed', label: 'Detailed' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Warm the newly-selected tier so its first run is instant.
            ensureModel().catch(() => {});
            // Re-run on the new tier if we already have an image loaded.
            if (currentURL) runOnce();
        },
    );

    const loaderSlot = el('div');
    const runBtn = button('Estimate depth', { variant: 'primary', full: true, onClick: () => runOnce() });
    const liveBtn = button('Live camera', { variant: 'ghost', onClick: () => toggleLive() });

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger', 'portrait'],
        onImage: (url) => setImage(url),
    });

    const batch = batchPanel({
        kind: 'image',
        combinedName: 'depth-maps',
        process: async (item) => {
            const estimator = await ensureModel();
            const url = URL.createObjectURL(item.file);
            try {
                const { depth } = await estimator(url);
                // Fresh canvas per item — never reuse the single-view depthCanvas.
                const canvas = el('canvas');
                colorizeTo(canvas, depth);
                // Pre-bake the PNG blob now (exportItem is called synchronously by the runner).
                const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
                return { canvas, blob };
            } finally {
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            }
        },
        renderResult: (result, item) => {
            const wrap = el('div', {});
            const url = URL.createObjectURL(item.file);
            wrap.append(el('img', { src: url, style: { maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' } }));
            result.canvas.style.maxWidth = '100%';
            result.canvas.style.borderRadius = '8px';
            wrap.append(result.canvas);
            return wrap;
        },
        exportItem: (result, item) => ({
            name: item.name.replace(/\.[^.]+$/, '') + '-depth.png',
            data: result.blob,
        }),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Quality', qualityToggle, 'Fast is quick; Detailed uses the larger base model for sharper depth'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        el('div', { style: { height: '10px' } }),
        liveBtn,
        loaderSlot,
        batch.el,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🌈 Depth map'),
        stageWrap,
        meta,
        dlSlot,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading depth model (${SPECS[quality].label})`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            pipes[quality] = await loadPipeline(SPECS[quality].spec, (p) => ld.progress(p));
            ld.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return pipes[quality];
    }

    function showStages() {
        if (stageWrap.firstChild === placeholder) {
            clear(stageWrap);
            stageWrap.append(el('div', { class: 'sx-row', style: { alignItems: 'flex-start' } }, srcStage, depthStage));
        }
    }

    function setImage(url) {
        stopLive();
        currentURL = url;
        video.style.display = 'none';
        srcImg.style.display = '';
        srcImg.src = url;
        meta.textContent = '';
        clear(dlSlot);
        lastBlob = null;
        showStages();
        srcImg.onload = () => { if (pipes[quality]) runOnce(); };
    }

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    function colorizeTo(canvas, depth) {
        const { width: w, height: h, data } = depth;
        canvas.width = w;
        canvas.height = h;
        const dctx = canvas.getContext('2d');
        const img = dctx.createImageData(w, h);
        const out = img.data;
        for (let i = 0; i < w * h; i++) {
            const v = data[i] / 255;
            const r = 255 * clamp01(1.5 - Math.abs(4 * v - 3));
            const g = 255 * clamp01(1.5 - Math.abs(4 * v - 2));
            const b = 255 * clamp01(1.5 - Math.abs(4 * v - 1));
            const o = i * 4;
            out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
        }
        dctx.putImageData(img, 0, 0);
    }

    function colorize(depth) {
        colorizeTo(depthCanvas, depth);
    }

    function offerDownload() {
        depthCanvas.toBlob((blob) => {
            if (!blob) return;
            lastBlob = blob;
            clear(dlSlot);
            dlSlot.append(button('Download depth PNG', {
                variant: 'ghost',
                iconPath: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
                onClick: () => { if (lastBlob) downloadBlob(lastBlob, 'depth-map.png'); },
            }));
        }, 'image/png');
    }

    async function runOnce() {
        if (!currentURL || busy || live) return;
        busy = true;
        runBtn.disabled = true;
        try {
            const estimator = await ensureModel();
            const { predicted_depth, depth } = await estimator(currentURL);
            colorize(depth);
            const dims = predicted_depth?.dims;
            meta.textContent = dims
                ? `Depth resolved at ${depth.width}×${depth.height} (tensor ${dims.join('×')}). Warm = near, cool = far.`
                : `Depth resolved at ${depth.width}×${depth.height}. Warm = near, cool = far.`;
            offerDownload();
        } catch (err) {
            toast('Depth estimation failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    // ---- Live camera ----
    async function toggleLive() {
        if (live) { stopLive(); return; }
        try {
            await ensureModel();
            live = true;
            liveBtn.querySelector('span').textContent = 'Stop camera';
            clear(dlSlot);
            lastBlob = null;
            srcImg.style.display = 'none';
            video.style.display = '';
            showStages();
            stream = await startCamera(video, { facingMode: 'environment' });
            const canvas = el('canvas');
            const loop = async () => {
                if (!live) return;
                if (!busy && video.videoWidth) {
                    busy = true;
                    try {
                        // Use the currently-selected tier (loads lazily if switched mid-stream).
                        const estimator = await ensureModel();
                        grabFrame(video, canvas);
                        const raw = await toRawImage(canvas);
                        const { depth } = await estimator(raw);
                        colorize(depth);
                        meta.textContent = `Live · depth at ${depth.width}×${depth.height}. Warm = near, cool = far.`;
                    } catch (_) { /* drop frame */ }
                    finally { busy = false; }
                }
                rafId = requestAnimationFrame(loop);
            };
            rafId = requestAnimationFrame(loop);
        } catch (err) {
            live = false;
            toast('Camera unavailable: ' + (err?.message || err), 'error');
        }
    }

    function stopLive() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (live) { live = false; liveBtn.querySelector('span').textContent = 'Live camera'; }
        if (stream) { stopStream(stream); stream = null; }
        video.style.display = 'none';
        srcImg.style.display = '';
    }

    // ---- Pipeline hand-off (consume a piped image input) ----
    const _h = ctx.takeHandoff("image");
    if (_h && _h.data) setImage(_h.data);

    // ---- Warm the currently-selected model on mount so the first run is instant. ----
    // The loader surfaces progress/errors; the pipeline cache dedupes a later run.
    ensureModel().catch(() => {});

    return () => { stopLive(); picker.destroy?.(); batch.destroy?.(); };
}
