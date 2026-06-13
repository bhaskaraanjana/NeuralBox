// ============================================================
// Fill in the Blank (BERT) — masked language modeling.
// Type a sentence with a [MASK] token; BERT predicts the words
// that best fit the blank. Text-in studio with clickable results.
// ============================================================
import { el, clear, button, field, textInput, loader, scoreBars, chip, badge, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'fill-mask', model: 'Xenova/bert-base-uncased', dtype: { webgpu: 'fp16', wasm: 'q8' } };
const MASK = '[MASK]';

const SAMPLES = [
    'The capital of France is [MASK].',
    'I want to be a [MASK] when I grow up.',
    'She poured herself a hot cup of [MASK].',
    'The opposite of happy is [MASK].',
];

export default function mount(host, ctx) {
    let unmasker = null;

    // ---- Controls ----
    const input = textInput('Write a sentence with [MASK]…', SAMPLES[0]);

    const addMaskBtn = button('Add [MASK]', {
        variant: 'ghost',
        onClick: () => insertMask(),
    });

    const sampleRow = el('div', { class: 'sx-row', style: { marginTop: '10px', flexWrap: 'wrap' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLES.map((s) => chip(s, () => { input.value = s; run(); })),
    );

    const loaderSlot = el('div');
    const runBtn = button('Fill the blank', { variant: 'primary', full: true, onClick: run });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Sentence'),
        field('', input, 'Write the blank exactly as [MASK] — uppercase, in brackets.'),
        el('div', { class: 'sx-row', style: { marginTop: '8px' } }, addMaskBtn, badge('BERT-base', 'accent')),
        sampleRow,
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
    );

    // ---- Output ----
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🧩'),
        el('div', {}, 'Predictions will appear here'),
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🔮 Predictions'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    // ---- Helpers ----
    function insertMask() {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const v = input.value;
        if (typeof start === 'number' && typeof end === 'number') {
            const before = v.slice(0, start);
            const after = v.slice(end);
            // Pad with a space so we never glue [MASK] onto a neighbouring word.
            const pad = before && !/\s$/.test(before) ? ' ' : '';
            const inserted = `${before}${pad}${MASK}${after}`;
            input.value = inserted;
            const caret = (before + pad + MASK).length;
            input.setSelectionRange(caret, caret);
        } else {
            input.value = `${v}${v && !/\s$/.test(v) ? ' ' : ''}${MASK}`;
        }
        input.focus();
    }

    async function ensureModel() {
        if (unmasker) return unmasker;
        const ld = loader('Loading BERT');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { unmasker = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return unmasker;
    }

    // ---- Logic ----
    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Write a sentence first', 'info'); return; }
        if (!text.includes(MASK)) {
            toast('Add a [MASK] token where the blank should go', 'info');
            return;
        }
        // With >1 mask, fill-mask returns a nested array the single-result UI can't read.
        if (text.split(MASK).length - 1 > 1) {
            toast('Use exactly one [MASK] at a time', 'info');
            return;
        }
        runBtn.disabled = true;
        try {
            await ensureModel();
            const out = await unmasker(text, { top_k: 5 });
            // out: [{ token_str, score, sequence }] sorted desc.
            renderResult(out);
        } catch (err) {
            toast('Prediction failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }

    function renderResult(preds) {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');

        if (!preds.length) {
            outBody.append(el('div', { class: 'sx-muted' }, 'No predictions returned.'));
            return;
        }

        const top = preds[0];
        const head = el('div', { class: 'sx-result-big' },
            el('span', { class: 'sx-mono' }, (top.token_str || '').trim() || '∅'),
            el('span', { class: 'sx-muted', style: { fontSize: '0.9rem', marginLeft: '8px' } },
                `${Math.round(top.score * 100)}% likely`),
        );

        const bars = scoreBars(preds.map((p) => ({
            label: (p.token_str || '').trim() || '∅',
            score: p.score,
        })));

        const seqTitle = el('p', { class: 'sx-hint', style: { marginTop: '16px' } },
            'Filled-in sentences — click one to drop it back into the box:');
        const seqs = el('div', { class: 'sx-stack', style: { marginTop: '8px' } },
            ...preds.map((p) => chip(p.sequence, () => { input.value = p.sequence; })),
        );

        outBody.append(head, bars, seqTitle, seqs);
    }

    return () => { /* nothing to tear down */ };
}
