// ============================================================
// Question Answering (DistilBERT/SQuAD) — extractive QA.
// Paste context, ask a question, get the answer span highlighted.
// ============================================================
import { el, clear, button, field, textarea, textInput, loader, chip, badge, toast, escapeHtml } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'question-answering', model: 'Xenova/distilbert-base-cased-distilled-squad', dtype: { webgpu: 'fp16', wasm: 'q8' } };

const SAMPLE_CONTEXT = 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower. Constructed from 1887 to 1889, it was initially criticized by some of France\'s leading artists and intellectuals for its design, but it has become a global cultural icon of France. The tower is 330 metres tall and was the tallest man-made structure in the world until 1930.';
const SAMPLE_QUESTIONS = ['How tall is the Eiffel Tower?', 'Who designed the tower?', 'When was it constructed?'];

export default function mount(host, ctx) {
    let qa = null;

    const context = textarea('Paste the text to search for answers…', SAMPLE_CONTEXT, 8);
    const question = textInput('Ask a question about the text…', SAMPLE_QUESTIONS[0]);
    const loaderSlot = el('div');
    const runBtn = button('Answer', { variant: 'primary', full: true, onClick: run });

    const qChips = el('div', { class: 'sx-row', style: { marginTop: '10px', flexWrap: 'wrap' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLE_QUESTIONS.map((q) => chip(q, () => { question.value = q; run(); })),
    );

    const answerBox = el('div', { class: 'sx-result-big' }, '—');
    const ctxView = el('div', { class: 'sx-result', style: { marginTop: '16px', lineHeight: '1.7' } });
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '❓'),
        el('div', {}, 'The answer will appear here, highlighted in the text'),
    );

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📄 Context'),
        field('', context),
        field('Question', question),
        qChips,
        el('div', { class: 'sx-row', style: { margin: '12px 0' } }, badge('DistilBERT · SQuAD', 'accent')),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '💡 Answer'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureModel() {
        if (qa) return qa;
        const ld = loader('Loading QA model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { qa = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return qa;
    }

    function highlight(ctxText, answer, start, end) {
        // Prefer the model's char offsets; fall back to first occurrence.
        let s = typeof start === 'number' ? start : ctxText.indexOf(answer);
        let e = typeof end === 'number' ? end : (s >= 0 ? s + answer.length : -1);
        if (s < 0 || e <= s) return escapeHtml(ctxText);
        return escapeHtml(ctxText.slice(0, s))
            + `<mark class="qa-hl">${escapeHtml(ctxText.slice(s, e))}</mark>`
            + escapeHtml(ctxText.slice(e));
    }

    async function run() {
        const ctxText = context.value.trim();
        const q = question.value.trim();
        if (!ctxText || !q) { toast('Add both context and a question', 'info'); return; }
        runBtn.disabled = true;
        try {
            await ensureModel();
            const out = await qa(q, ctxText); // { answer, score, start?, end? }
            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            clear(answerBox);
            answerBox.append(
                el('span', {}, out.answer || '(no answer found)'),
                el('span', { class: 'sx-muted', style: { fontSize: '0.85rem', marginLeft: '10px' } }, `${Math.round((out.score || 0) * 100)}% confident`),
            );
            ctxView.innerHTML = highlight(ctxText, out.answer || '', out.start, out.end);
            outBody.append(answerBox, ctxView);
        } catch (err) {
            toast('Answering failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }
}
