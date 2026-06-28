// ============================================================
// Sentiment Analysis — reference implementation for text studios.
// ============================================================
import { el, clear, button, field, textarea, loader, scoreBars, chip, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';
import { batchPanel } from '../batch.js';

const MODEL = M.txtSentiment;

const SAMPLES = [
    'I absolutely loved this — best decision I made all year!',
    'The plot dragged and I nearly fell asleep halfway through.',
    'It was fine. Nothing special, but it did the job.',
];

export default function mount(host, ctx) {
    let classifier = null;

    const input = textarea('Type or paste any text to read its mood…', SAMPLES[0], 6);
    const loaderSlot = el('div');
    const runBtn = button('Analyze sentiment', { variant: 'primary', full: true, onClick: run });

    const verdict = el('div', { class: 'sx-result-big' }, '—');
    const bars = el('div', { style: { marginTop: '16px' } });
    const outBody = el('div', { class: 'sx-placeholder' }, el('div', { class: 'ph-emoji' }, '💬'), el('div', {}, 'Results will appear here'));

    const sampleRow = el('div', { class: 'sx-row', style: { marginTop: '10px' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLES.map((s, i) => chip(['😍 Positive', '😴 Negative', '😐 Neutral'][i], () => { input.value = s; run(); })),
    );

    const batch = batchPanel({
        kind: 'text',
        combinedName: 'sentiment',
        process: async (item) => {
            await ensureModel();
            return await classifier(item.text, { top_k: null }); // [{label,score},...]
        },
        renderResult: (all, item) => {
            const pos = all.find((x) => x.label === 'POSITIVE') || { score: 0 };
            const neg = all.find((x) => x.label === 'NEGATIVE') || { score: 0 };
            const isPos = pos.score >= neg.score;
            const text = item.text || '';
            const snippet = text.length > 120 ? text.slice(0, 120) + '…' : text;
            const wrap = el('div', {});
            wrap.append(el('div', { class: 'sx-muted', style: { marginBottom: '10px' } }, snippet));
            wrap.append(el('div', { class: 'sx-result-big', style: { fontSize: '1.1rem', marginBottom: '8px' } },
                el('span', { style: { fontSize: '1.4rem' } }, isPos ? '😄' : '😞'), ' ',
                el('span', { style: { color: isPos ? 'var(--ok)' : 'var(--err)' } }, isPos ? 'Positive' : 'Negative'),
                el('span', { class: 'sx-muted', style: { fontSize: '0.85rem', marginLeft: '8px' } }, `${Math.round(Math.max(pos.score, neg.score) * 100)}% confident`),
            ));
            wrap.append(scoreBars([
                { label: 'Positive', score: pos.score },
                { label: 'Negative', score: neg.score },
            ], { accent: isPos ? 'var(--ok)' : 'var(--err)' }));
            return wrap;
        },
        exportItem: (all, item) => {
            const pos = all.find((x) => x.label === 'POSITIVE') || { score: 0 };
            const neg = all.find((x) => x.label === 'NEGATIVE') || { score: 0 };
            const isPos = pos.score >= neg.score;
            const verdict = `${isPos ? 'Positive' : 'Negative'} (${Math.round(Math.max(pos.score, neg.score) * 100)}% confident)`;
            return { name: (item.name || 'item') + '.txt', data: `${verdict}\n${item.text || ''}` };
        },
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Text'),
        field('', input),
        sampleRow,
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
        batch.el,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📊 Result'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureModel() {
        if (classifier) return classifier;
        const ld = loader('Loading sentiment model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { classifier = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return classifier;
    }

    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Enter some text first', 'info'); return; }
        runBtn.disabled = true;
        try {
            await ensureModel();
            const all = await classifier(text, { top_k: null }); // [{label,score},...]
            const pos = all.find((x) => x.label === 'POSITIVE') || { score: 0 };
            const neg = all.find((x) => x.label === 'NEGATIVE') || { score: 0 };
            const isPos = pos.score >= neg.score;
            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            clear(verdict);
            verdict.append(
                el('span', { style: { fontSize: '2rem' } }, isPos ? '😄' : '😞'), ' ',
                el('span', { style: { color: isPos ? 'var(--ok)' : 'var(--err)' } }, isPos ? 'Positive' : 'Negative'),
                el('span', { class: 'sx-muted', style: { fontSize: '0.9rem', marginLeft: '8px' } }, `${Math.round(Math.max(pos.score, neg.score) * 100)}% confident`),
            );
            clear(bars);
            bars.append(scoreBars([
                { label: 'Positive', score: pos.score },
                { label: 'Negative', score: neg.score },
            ], { accent: isPos ? 'var(--ok)' : 'var(--err)' }));
            outBody.append(verdict, bars);
        } catch (err) {
            toast('Analysis failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }

    const _h = ctx.takeHandoff("text");
    if (_h && _h.data) { input.value = _h.data; }

    // Warm the model on mount so the download runs while the user prepares
    // input and the first Analyze is instant. The pipeline cache dedupes this
    // with a later run; the existing loader surfaces any errors.
    ensureModel().catch(() => {});

    return () => { batch.destroy?.(); };
}
