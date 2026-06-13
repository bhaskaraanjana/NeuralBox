// ============================================================
// Zero-Shot Text Classification (MobileBERT-MNLI).
// Label any text against candidate labels you invent on the spot —
// no training required. Reference-style simple text-in studio.
// ============================================================
import { el, clear, button, field, textarea, textInput, segmented, loader, scoreBars, badge, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

const SPECS = {
    fast: {
        label: 'Fast',
        spec: M.zstMobilebert,
    },
    accurate: {
        label: 'Accurate',
        spec: M.zstDeberta,
    },
};

const DEFAULT_TEXT = 'I just upgraded my phone and the battery life is incredible.';
const DEFAULT_LABELS = 'technology, sports, politics, food, travel, business';

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, accurate: null };
    let quality = 'fast';
    let multiLabel = false;
    let hasRun = false;

    // ---- Controls ----
    const input = textarea('Type or paste any text to classify…', DEFAULT_TEXT, 5);
    const labelsInput = textInput('comma-separated labels', DEFAULT_LABELS);
    const toggle = segmented(
        [{ value: 'single', label: 'Single' }, { value: 'multiple', label: 'Multiple' }],
        'single',
        (v) => { multiLabel = v === 'multiple'; },
    );

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'fast', label: 'Fast' }, { value: 'accurate', label: 'Accurate' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Re-run on the new tier if we already have a classification on screen.
            if (hasRun) run();
        },
    );

    const loaderSlot = el('div');
    const runBtn = button('Classify text', { variant: 'primary', full: true, onClick: run });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Text'),
        field('', input),
        field('Candidate labels', labelsInput, 'Separate with commas — invent any categories.'),
        field('Match mode', toggle, 'Single picks the best label; Multiple scores each independently.'),
        field('Quality', qualityToggle, 'Fast is instant; Accurate trades speed for precision'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
    );

    // ---- Output ----
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🏷️'),
        el('div', {}, 'Results will appear here'),
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📊 Result'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading ${SPECS[quality].label}`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipes[quality] = await loadPipeline(SPECS[quality].spec, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipes[quality];
    }

    function parseLabels() {
        return labelsInput.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Enter some text first', 'info'); return; }
        const labels = parseLabels();
        if (labels.length < 2) { toast('Add at least two candidate labels', 'info'); return; }

        runBtn.disabled = true;
        try {
            const classifier = await ensureModel();
            const out = await classifier(text, labels, { multi_label: multiLabel });
            // out: { sequence, labels:string[], scores:number[] } — parallel, sorted desc.
            const ranked = out.labels.map((label, i) => ({ label, score: out.scores[i] }));
            hasRun = true;
            renderResult(ranked);
        } catch (err) {
            toast('Classification failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }

    function renderResult(ranked) {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');

        const top = ranked[0];
        const head = el('div', { class: 'sx-result-big' },
            el('span', {}, top.label),
            el('span', { class: 'sx-muted', style: { fontSize: '0.9rem', marginLeft: '8px' } },
                `${Math.round(top.score * 100)}% match`),
        );

        const modeBadge = el('div', { class: 'sx-row', style: { marginTop: '6px', marginBottom: '14px' } },
            badge(multiLabel ? 'Multiple labels' : 'Single label', 'accent'),
            el('span', { class: 'sx-muted', style: { fontSize: '0.85rem' } },
                multiLabel ? 'scores are independent' : 'scores sum to 100%'),
        );

        const bars = scoreBars(ranked);
        outBody.append(head, modeBadge, bars);
    }

    // ---- Pipeline hand-off (consume a piped TEXT input, if any) ----
    const _h = ctx.takeHandoff("text");
    if (_h && _h.data) { input.value = _h.data; }

    return () => { /* nothing to tear down */ };
}
