// ============================================================
// Semantic Segmentation (SegFormer / ADE20K) — paints every
// pixel with the class it belongs to and overlays it on the image.
// ============================================================
import { el, clear, button, field, loader, imageInput, badge, labelColor, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'image-segmentation', model: 'Xenova/segformer-b0-finetuned-ade-512-512', dtype: { webgpu: 'fp32', wasm: 'q8' } };

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
    let segmenter = null;
    let currentURL = null;
    let lastSegments = null;
    let opacity = 0.5;
    let busy = false;

    // ---- DOM ----
    const stage = el('div', { class: 'sx-stage block' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous', style: { display: 'block', width: '100%' } });
    const overlay = el('canvas', { class: 'sx-overlay', style: { width: '100%', height: '100%', imageRendering: 'pixelated' } });
    stage.append(img, overlay);

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🗺️'),
        el('div', {}, 'Pick an image, drop one in, or use your camera'),
    );
    const stageWrap = el('div', {}, placeholder);

    const summary = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');
    const list = el('div', { class: 'sx-stack', style: { marginTop: '12px' } });

    const loaderSlot = el('div');
    const runBtn = button('Segment image', { variant: 'primary', full: true, onClick: () => runOnce() });

    const opLabel = el('span', {}, '50%');
    const opSlider = el('input', { type: 'range', class: 'sx-input', min: '0', max: '1', step: '0.05', value: '0.5' });
    opSlider.addEventListener('input', () => {
        opacity = parseFloat(opSlider.value);
        opLabel.textContent = `${Math.round(opacity * 100)}%`;
        if (lastSegments) paint(lastSegments);
    });

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Overlay opacity', opSlider, null),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, opLabel, badge('SegFormer-B0', 'accent')),
        runBtn,
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
        if (segmenter) return segmenter;
        const ld = loader('Loading SegFormer model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            segmenter = await loadPipeline(MODEL, (p) => ld.progress(p));
            ld.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return segmenter;
    }

    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        currentURL = url;
        lastSegments = null;
        img.src = url;
        showStage();
        summary.textContent = '';
        clear(list);
        clearOverlay();
        img.onload = () => { if (segmenter) runOnce(); };
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
            await ensureModel();
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

    return () => { picker.destroy?.(); };
}
