// ============================================================
// Image Classification — "Image Labeler".
// Pick an image, get the top-5 labels with confidence bars.
// Canonical example of createTierPicker + the central model catalog.
// ============================================================
import { el, clear, button, badge, scoreBars, imageInput, toast } from '../ui.js';
import { M } from '../models.js';
import { createTierPicker } from '../studio-kit.js';

const TIERS = {
    fast: { label: 'ResNet-50', spec: M.clsResnet50 },
    accurate: { label: 'ViT-base', spec: M.clsVit },
};

export default function mount(host, ctx) {
    let currentURL = null;
    let busy = false;

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

    const loaderSlot = el('div');
    const tiers = createTierPicker(TIERS, loaderSlot, { hint: 'Fast is instant; Accurate trades speed for precision' });
    const modelBadge = badge(TIERS[tiers.key].spec.model, 'accent');
    tiers.onSwitch(() => { modelBadge.textContent = tiers.spec().model; if (currentURL) run(); });

    const runBtn = button('Label image', { variant: 'primary', full: true, onClick: () => run() });
    const picker = imageInput({ samples: ['cats', 'tiger', 'bread', 'portrait'], allowCamera: true, onImage: (url) => setImage(url) });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        tiers.el,
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🏷️ Labels'),
        stageWrap,
        resultBody,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    function showStage() { if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); } }

    function setImage(url) {
        currentURL = url;
        showStage();
        img.onload = () => { if (tiers.loaded()) run(); };
        img.onerror = () => toast('Could not load that image', 'error');
        img.src = url;
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
            const classifier = await tiers.ensure();
            const out = await classifier(currentURL, { topk: 5 });
            if (!out?.length) { toast('No labels returned', 'info'); return; }
            renderResults(out);
        } catch (err) {
            toast('Labeling failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    function prettyLabel(label) {
        const first = String(label).split(',')[0].trim();
        return first.charAt(0).toUpperCase() + first.slice(1);
    }

    const _h = ctx.takeHandoff("image"); if (_h && _h.data) setImage(_h.data);

    return () => { picker.destroy?.(); };
}
