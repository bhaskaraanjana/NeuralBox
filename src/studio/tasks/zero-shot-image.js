// ============================================================
// Zero-Shot Vision (CLIP) — classify any image against labels
// you invent on the fly. No fine-tuning, no fixed categories.
// ============================================================
import { el, clear, button, field, textInput, loader, scoreBars, segmented, imageInput, badge, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

const SPECS = {
    fast: {
        label: 'Fast',
        spec: M.zsiClip32,
    },
    accurate: {
        label: 'Accurate',
        spec: M.zsiClip16,
    },
};

const DEFAULT_LABELS = 'a cat, a dog, a car, a sunset, a city street, food';

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, accurate: null };
    let quality = 'fast';
    let currentURL = null;
    let busy = false;

    // ---- Input stage ----
    const stage = el('div', { class: 'sx-stage block' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous' });
    stage.append(img);
    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🪄'),
        el('div', {}, 'Pick an image, then describe what it might be'),
    );
    const stageWrap = el('div', {}, placeholder);

    // ---- Controls ----
    const labelsInput = textInput('comma, separated, labels', DEFAULT_LABELS);
    const loaderSlot = el('div');
    const runBtn = button('Classify', { variant: 'primary', full: true, onClick: () => run() });

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

    const picker = imageInput({
        samples: ['cats', 'tiger', 'bread', 'street'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🖼️ Input'),
        picker.el,
        field('Candidate labels', labelsInput, 'CLIP scores the image against each phrase — two or more, comma-separated.'),
        field('Quality', qualityToggle, 'Fast is instant; Accurate trades speed for precision'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        loaderSlot,
    );

    // ---- Output ----
    const summary = el('div', { class: 'sx-muted', style: { marginTop: '14px' } }, '');
    const bars = el('div', { style: { marginTop: '8px' } });
    const outBody = el('div', {}, stageWrap, summary, bars);

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎯 Best match'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        currentURL = url;
        img.src = url;
        showStage();
        summary.textContent = '';
        clear(bars);
        img.onload = () => { if (pipes[quality] && !busy) run(); };
    }

    function parseLabels() {
        return labelsInput.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async function ensureModel() {
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading ${SPECS[quality].label} CLIP vision model`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipes[quality] = await loadPipeline(SPECS[quality].spec, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipes[quality];
    }

    async function run() {
        if (!currentURL) { toast('Pick an image first', 'info'); return; }
        const labels = parseLabels();
        if (labels.length < 2) { toast('Add at least 2 candidate labels', 'info'); return; }
        if (busy) return;
        busy = true;
        runBtn.disabled = true;
        try {
            const classifier = await ensureModel();
            // Candidate labels are the SECOND POSITIONAL ARG (string[]).
            const out = await classifier(currentURL, labels); // [{score,label}] desc, softmaxed
            const ranked = out.slice().sort((a, b) => b.score - a.score);
            const top = ranked[0];
            summary.textContent = top
                ? `“${top.label}” — ${Math.round(top.score * 100)}% confident`
                : 'No result.';
            clear(bars);
            bars.append(scoreBars(ranked));
        } catch (err) {
            toast('Classification failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    return () => { picker.destroy?.(); };
}
