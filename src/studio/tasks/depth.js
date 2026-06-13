// ============================================================
// Depth Map (Depth Anything V2) — monocular depth estimation.
// Reference-style vision studio: image in, colorized depth out.
// ============================================================
import { el, clear, button, field, loader, imageInput, badge, segmented, downloadBlob, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

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

    // ---- DOM ----
    const srcStage = el('div', { class: 'sx-stage block' });
    const srcImg = el('img', { alt: 'input', crossorigin: 'anonymous' });
    srcStage.append(srcImg);

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
            // Re-run on the new tier if we already have an image loaded.
            if (currentURL) runOnce();
        },
    );

    const loaderSlot = el('div');
    const runBtn = button('Estimate depth', { variant: 'primary', full: true, onClick: () => runOnce() });

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger', 'portrait'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Quality', qualityToggle, 'Fast is quick; Detailed uses the larger base model for sharper depth'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        loaderSlot,
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
        currentURL = url;
        srcImg.src = url;
        meta.textContent = '';
        clear(dlSlot);
        lastBlob = null;
        showStages();
        srcImg.onload = () => { if (pipes[quality]) runOnce(); };
    }

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    function colorize(depth) {
        const { width: w, height: h, data } = depth;
        depthCanvas.width = w;
        depthCanvas.height = h;
        const dctx = depthCanvas.getContext('2d');
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
        if (!currentURL || busy) return;
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

    // ---- Pipeline hand-off (consume a piped image input) ----
    const _h = ctx.takeHandoff("image");
    if (_h && _h.data) setImage(_h.data);

    return () => { picker.destroy?.(); };
}
