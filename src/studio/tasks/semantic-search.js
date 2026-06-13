// ============================================================
// Semantic Search (embeddings) — find by meaning, not keywords.
// Embeds a query + a corpus with all-MiniLM-L6-v2, then ranks
// documents by cosine similarity (dot product on L2-normed vecs).
// ============================================================
import { el, clear, button, field, textarea, textInput, loader, scoreBars, chip, badge, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'feature-extraction', model: 'Xenova/all-MiniLM-L6-v2', dtype: { webgpu: 'fp32', wasm: 'q8' } };

const SAMPLE_DOCS = [
    'The Eiffel Tower is a wrought-iron landmark in the heart of Paris.',
    'Photosynthesis lets plants turn sunlight into chemical energy.',
    'A balanced sourdough loaf needs a long, slow fermentation.',
    'Quantum computers exploit superposition to crunch many states at once.',
    'Golden retrievers are gentle, loyal dogs that adore a game of fetch.',
    'The stock market rallied today as tech earnings beat expectations.',
].join('\n');

const SAMPLE_QUERIES = ['a friendly pet', 'how do plants make food?', 'baking bread at home'];

export default function mount(host, ctx) {
    let extractor = null;

    // ---- Controls ----
    const docsInput = textarea('One document per line…', SAMPLE_DOCS, 8);
    const queryInput = textInput('Ask in plain language…', SAMPLE_QUERIES[0]);
    queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

    const loaderSlot = el('div');
    const runBtn = button('Search by meaning', { variant: 'primary', full: true, onClick: run });

    const queryRow = el('div', { class: 'sx-row', style: { marginTop: '10px' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLE_QUERIES.map((q) => chip(q, () => { queryInput.value = q; run(); })),
    );

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📚 Corpus'),
        field('Documents (one per line)', docsInput),
        field('Query', queryInput),
        queryRow,
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
    );

    // ---- Output ----
    const summary = el('div', { class: 'sx-muted', style: { marginBottom: '12px' } }, '');
    const results = el('div', {});
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🔎'),
        el('div', {}, 'Ranked matches will appear here'),
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎯 Ranked matches'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (extractor) return extractor;
        const ld = loader('Loading embedding model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { extractor = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return extractor;
    }

    function dot(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += a[i] * b[i];
        return s;
    }

    function truncate(text, max = 80) {
        const t = text.trim().replace(/\s+/g, ' ');
        return t.length > max ? t.slice(0, max - 1) + '…' : t;
    }

    async function run() {
        const query = queryInput.value.trim();
        const docs = docsInput.value.split('\n').map((d) => d.trim()).filter(Boolean);
        if (!query) { toast('Enter a query first', 'info'); return; }
        if (!docs.length) { toast('Add at least one document', 'info'); return; }

        runBtn.disabled = true;
        try {
            const pipe = await ensureModel();
            // Embed query + corpus together; vectors are L2-normalized,
            // so a plain dot product equals cosine similarity.
            const emb = await pipe([query, ...docs], { pooling: 'mean', normalize: true });
            const vecs = emb.tolist(); // number[][], 384-dim
            const qVec = vecs[0];

            const ranked = docs
                .map((text, i) => ({ text, score: dot(qVec, vecs[i + 1]) }))
                .sort((a, b) => b.score - a.score);

            clear(results);
            results.append(scoreBars(
                ranked.map((r) => ({
                    label: truncate(r.text),
                    score: Math.max(0, Math.min(1, r.score)), // clamp ~[-1,1] -> [0,1]
                })),
            ));

            const best = ranked[0];
            summary.textContent = `Top match: “${truncate(best.text, 60)}” · ${Math.round(Math.max(0, best.score) * 100)}% similar`;

            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            outBody.append(
                el('div', { class: 'sx-row', style: { marginBottom: '4px' } },
                    badge('MiniLM-L6', 'accent'),
                    el('span', { class: 'sx-muted' }, `${docs.length} docs · 384-dim`),
                ),
                summary,
                results,
            );
        } catch (err) {
            toast('Search failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }
}
