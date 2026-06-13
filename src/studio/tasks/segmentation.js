// ============================================================
// Semantic Segmentation (SegFormer / ADE20K) — paints every
// pixel with the class it belongs to and overlays it on the image.
// ============================================================
import { el, clear, button, field, loader, segmented, imageInput, badge, labelColor, toast } from '../ui.js';
import { loadPipeline, toRawImage, startCamera, stopStream, grabFrame } from '../runtime.js';
import { M } from '../models.js';

const SPECS = {
    fast: {
        label: 'Fast',
        spec: M.segB0,
    },
    accurate: {
        label: 'Accurate',
        spec: M.segB2,
    },
    max: {
        label: 'Max',
        spec: M.segB5,
    },
};

// Parse an hsla() string from labelColor into [r,g,b] 0..255.
function colorRGB(label) {
    const c = el('canvas', { width: '1', height: '1' });
    const cx = c.getContext('2d');
    cx.fillStyle = labelColor(label);
    cx.fillRect(0, 0, 1, 1);
    const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
}

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, accurate: null, max: null };
    let quality = 'accurate';
    let currentURL = null;
    let lastSegments = null;
    let opacity = 0.5;
    let busy = false;
    let live = false;
    let stream = null;
    let rafId = 0;

    // ---- DOM ----
    const stage = el('div', { class: 'sx-stage block' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous', style: { display: 'block', width: '100%' } });
    const video = el('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none', width: '100%' } });
    const overlay = el('canvas', { class: 'sx-overlay', style: { width: '100%', height: '100%', imageRendering: 'pixelated' } });
    stage.append(img, video, overlay);

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🗺️'),
        el('div', {}, 'Pick an image, drop one in, or use your camera'),
    );
    const stageWrap = el('div', {}, placeholder);

    const summary = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');
    const list = el('div', { class: 'sx-stack', style: { marginTop: '12px' } });

    const loaderSlot = el('div');
    const runBtn = button('Segment image', { variant: 'primary', full: true, onClick: () => runOnce() });
    const liveBtn = button('Live camera', { variant: 'ghost', onClick: () => toggleLive() });

    const opLabel = el('span', {}, '50%');
    const opSlider = el('input', { type: 'range', class: 'sx-input', min: '0', max: '1', step: '0.05', value: '0.5' });
    opSlider.addEventListener('input', () => {
        opacity = parseFloat(opSlider.value);
        opLabel.textContent = `${Math.round(opacity * 100)}%`;
        if (lastSegments) paint(lastSegments);
    });

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'fast', label: 'Fast' }, { value: 'accurate', label: 'Accurate' }, { value: 'max', label: 'Max' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Warm the newly-selected tier so the next run is instant (deduped via cache).
            ensureModel().catch(() => {});
            // Re-run on the new tier if we already have a still image to segment
            // (the live loop picks up the new tier on its own via ensureModel).
            if (!live && currentURL) runOnce();
        },
    );

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Quality', qualityToggle, 'Fast is instant; Accurate and Max trade speed for sharper masks'),
        field('Overlay opacity', opSlider, null),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, opLabel, modelBadge),
        runBtn,
        el('div', { style: { height: '10px' } }),
        liveBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎨 Segments'),
        stageWrap,
        summary,
        list,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading SegFormer (${SPECS[quality].label})`);
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

    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        stopLive();
        currentURL = url;
        lastSegments = null;
        video.style.display = 'none';
        img.style.display = 'block';
        img.src = url;
        showStage();
        summary.textContent = '';
        clear(list);
        clearOverlay();
        img.onload = () => { if (pipes[quality]) runOnce(); };
    }

    function clearOverlay() {
        const cx = overlay.getContext('2d');
        cx.clearRect(0, 0, overlay.width, overlay.height);
    }

    // Build a single-resolution ImageData (mask space) by argmax-style
    // assignment: each pixel takes the segment with the highest occupancy.
    function paint(segments) {
        if (!segments.length) { clearOverlay(); return; }
        const w = segments[0].mask.width;
        const h = segments[0].mask.height;
        overlay.width = w;
        overlay.height = h;
        const cx = overlay.getContext('2d');
        const out = cx.createImageData(w, h);
        const data = out.data;
        const best = new Uint8Array(w * h); // highest occupancy seen per pixel
        const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255);
        for (const seg of segments) {
            const [r, g, b] = seg._rgb || (seg._rgb = colorRGB(seg.label));
            const m = seg.mask.data;
            const n = Math.min(m.length, w * h);
            for (let i = 0; i < n; i++) {
                const v = m[i];
                if (v > 127 && v >= best[i]) {
                    best[i] = v;
                    const j = i * 4;
                    data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = a;
                }
            }
        }
        cx.putImageData(out, 0, 0);
    }

    function renderList(segments) {
        clear(list);
        if (!segments.length) { list.append(el('div', { class: 'sx-muted' }, 'No segments detected.')); return; }
        const sorted = [...segments].sort((a, b) => (b.score || 0) - (a.score || 0));
        const chips = sorted.map((s) => {
            const pct = typeof s.score === 'number' ? ` ${Math.round(s.score * 100)}%` : '';
            return el('span', {
                class: 'sx-badge',
                style: { borderColor: labelColor(s.label, 0.6), color: labelColor(s.label) },
            }, `${s.label}${pct}`);
        });
        list.append(el('div', { class: 'sx-row' }, ...chips));
    }

    async function runOnce() {
        if (!currentURL || busy) return;
        busy = true;
        runBtn.disabled = true;
        try {
            const segmenter = await ensureModel();
            const out = await segmenter(currentURL); // [{score, label, mask:RawImage}]
            lastSegments = out;
            paint(out);
            renderList(out);
            summary.textContent = `Found ${out.length} segment${out.length === 1 ? '' : 's'}.`;
        } catch (err) {
            toast('Segmentation failed: ' + (err?.message || err), 'error');
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
            img.style.display = 'none';
            video.style.display = 'block';
            showStage();
            stream = await startCamera(video, { facingMode: 'environment' });
            const canvas = el('canvas');
            const loop = async () => {
                if (!live) return;
                if (!busy && video.videoWidth) {
                    busy = true;
                    try {
                        // Use the currently-selected tier (loads lazily if switched mid-stream).
                        const segmenter = await ensureModel();
                        grabFrame(video, canvas);
                        const raw = await toRawImage(canvas);
                        const out = await segmenter(raw); // [{score, label, mask:RawImage}]
                        lastSegments = out;
                        paint(out);          // reuse existing mask painter
                        renderList(out);     // reuse existing chip list
                        summary.textContent = `Live · ${out.length} segment${out.length === 1 ? '' : 's'}`;
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
        img.style.display = 'block';
    }

    // ---- Pipeline hand-off: consume a piped image input (if any) ----
    const _h = ctx.takeHandoff("image");
    if (_h && _h.data) setImage(_h.data);

    // Warm the currently-selected model on mount so the first run is instant
    // (the loader surfaces progress/errors; deduped via the runtime cache).
    ensureModel().catch(() => {});

    return () => { stopLive(); picker.destroy?.(); };
}
