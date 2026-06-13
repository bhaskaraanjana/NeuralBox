// ============================================================
// Image Classification — "Image Labeler".
// Pick an image, get the top-5 labels with confidence bars.
// Two quality tiers: Fast (MobileNetV4) and Accurate (ViT).
// ============================================================
import { el, clear, button, field, loader, scoreBars, segmented, badge, imageInput, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const SPECS = {
    fast: {
        label: 'ResNet-50',
        spec: { task: 'image-classification', model: 'Xenova/resnet-50', dtype: { webgpu: 'fp16', wasm: 'q8' } },
    },
    accurate: {
        label: 'ViT-base',
        spec: { task: 'image-classification', model: 'Xenova/vit-base-patch16-224', dtype: { webgpu: 'fp16', wasm: 'q8' } },
    },
};

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, accurate: null };
    let quality = 'fast';
    let currentURL = null;
    let busy = false;

    // ---- DOM ----
    const stage = el('div', { class: 'sx-stage block' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous' });
    stage.append(img);

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🏷️'),
        el('div', {}, 'Pick an image, drop one in, or use your camera'),
    );
    const stageWrap = el('div', {}, placeholder);

    const topLabel = el('div', { class: 'sx-result-big' }, '—');
    const bars = el('div', { style: { marginTop: '16px' } });
    const resultBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '📊'),
        el('div', {}, 'Labels will appear here'),
    );

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'fast', label: 'Fast' }, { value: 'accurate', label: 'Accurate' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Re-run on the new tier if we already have an image to classify.
            if (currentURL) run();
        },
    );

    const loaderSlot = el('div');
    const runBtn = button('Label image', { variant: 'primary', full: true, onClick: () => run() });

    const picker = imageInput({
        samples: ['cats', 'tiger', 'bread', 'portrait'],
        allowCamera: true,
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Quality', qualityToggle, 'Fast is instant; Accurate trades speed for precision'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🏷️ Labels' ),
        stageWrap,
        resultBody,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        currentURL = url;
        showStage();
        // Attach before src so cached images (which fire load synchronously-ish) still auto-run.
        img.onload = () => { if (pipes[quality]) run(); };
        img.onerror = () => toast('Could not load that image', 'error');
        img.src = url;
    }

    async function ensureModel() {
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading ${SPECS[quality].label}`);
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

    function renderResults(out) {
        clear(resultBody);
        resultBody.classList.remove('sx-placeholder');
        clear(topLabel);
        const top = out[0];
        topLabel.append(
            el('span', {}, prettyLabel(top.label)),
            el('span', { class: 'sx-muted', style: { fontSize: '0.9rem', marginLeft: '10px' } }, `${Math.round(top.score * 100)}%`),
        );
        clear(bars);
        bars.append(scoreBars(out.map((o) => ({ label: prettyLabel(o.label), score: o.score }))));
        resultBody.append(topLabel, bars);
    }

    async function run() {
        if (!currentURL) { toast('Pick an image first', 'info'); return; }
        if (busy) return;
        busy = true;
        runBtn.disabled = true;
        try {
            const classifier = await ensureModel();
            const out = await classifier(currentURL, { topk: 5 }); // [{label,score}] desc
            if (!out?.length) { toast('No labels returned', 'info'); return; }
            renderResults(out);
        } catch (err) {
            toast('Labeling failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    // ImageNet labels are often "tabby, tabby cat" — keep the first, tidy casing.
    function prettyLabel(label) {
        const first = String(label).split(',')[0].trim();
        return first.charAt(0).toUpperCase() + first.slice(1);
    }

    return () => { picker.destroy?.(); };
}
