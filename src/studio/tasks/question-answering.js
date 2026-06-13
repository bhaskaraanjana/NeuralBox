// ============================================================
// Question Answering (extractive QA).
// Paste context, ask a question, get the answer span highlighted.
// Two quality tiers: Fast (DistilBERT/SQuAD) and Accurate (RoBERTa/SQuAD2).
// ============================================================
import { el, clear, button, field, textarea, textInput, loader, chip, badge, segmented, toast, escapeHtml } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

const SPECS = {
    fast: {
        label: 'DistilBERT · SQuAD',
        spec: M.qaDistilbert,
    },
    accurate: {
        label: 'RoBERTa · SQuAD2',
        spec: M.qaRoberta,
    },
};

const SAMPLE_CONTEXT = 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower. Constructed from 1887 to 1889, it was initially criticized by some of France\'s leading artists and intellectuals for its design, but it has become a global cultural icon of France. The tower is 330 metres tall and was the tallest man-made structure in the world until 1930.';
const SAMPLE_QUESTIONS = ['How tall is the Eiffel Tower?', 'Who designed the tower?', 'When was it constructed?'];

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, accurate: null };
    let quality = 'fast';

    const context = textarea('Paste the text to search for answers…', SAMPLE_CONTEXT, 8);
    const question = textInput('Ask a question about the text…', SAMPLE_QUESTIONS[0]);
    const loaderSlot = el('div');
    const runBtn = button('Answer', { variant: 'primary', full: true, onClick: run });

    const qChips = el('div', { class: 'sx-row', style: { marginTop: '10px', flexWrap: 'wrap' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLE_QUESTIONS.map((q) => chip(q, () => { question.value = q; run(); })),
    );

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'fast', label: 'Fast' }, { value: 'accurate', label: 'Accurate' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Re-run on the new tier if we already have a question to answer.
            if (context.value.trim() && question.value.trim()) run();
        },
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
        field('Quality', qualityToggle, 'Fast is instant; Accurate trades speed for precision'),
        el('div', { class: 'sx-row', style: { margin: '12px 0' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '💡 Answer'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

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
            const qa = await ensureModel();
            const out = await qa(q, ctxText); // { answer, score, start?, end? }
            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            clear(answerBox);
            // SQuAD2 (Accurate) can return an empty answer for unanswerable questions.
            const hasAnswer = !!(out.answer && out.answer.trim());
            answerBox.append(
                el('span', {}, hasAnswer ? out.answer : '(no answer found in the text)'),
                el('span', { class: 'sx-muted', style: { fontSize: '0.85rem', marginLeft: '10px' } }, `${Math.round((out.score || 0) * 100)}% confident`),
            );
            // Only highlight when there is an actual span; otherwise show the plain context.
            ctxView.innerHTML = hasAnswer
                ? highlight(ctxText, out.answer, out.start, out.end)
                : escapeHtml(ctxText);
            outBody.append(answerBox, ctxView);
        } catch (err) {
            toast('Answering failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }
}
