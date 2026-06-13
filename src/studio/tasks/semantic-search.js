// ============================================================
// Semantic Search (embeddings) — find by meaning, not keywords.
// Embeds a query + a corpus with all-MiniLM-L6-v2, then ranks
// documents by cosine similarity (dot product on L2-normed vecs).
// ============================================================
import { el, clear, button, field, textarea, textInput, loader, scoreBars, chip, segmented, badge, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

// One spec per quality tier. Some embedding models expect an instruction
// prefix on the QUERY only (never the documents) for best retrieval.
const SPECS = {
    bge: {
        label: 'BGE',
        spec: M.embBge,
    },
    gte: {
        label: 'GTE',
        spec: M.embGte,
    },
    mini: {
        label: 'MiniLM',
        spec: M.embMini,
    },
};

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
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { bge: null, gte: null, mini: null };
    let quality = 'bge';

    // ---- Controls ----
    const docsInput = textarea('One document per line…', SAMPLE_DOCS, 8);
    const queryInput = textInput('Ask in plain language…', SAMPLE_QUERIES[0]);
    queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'bge', label: 'BGE' }, { value: 'gte', label: 'GTE' }, { value: 'mini', label: 'MiniLM' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Warm the newly-selected tier so its first run is instant.
            ensureModel().catch(() => {});
            // Re-embed on the new tier if we already have results showing.
            if (!outBody.classList.contains('sx-placeholder')) run();
        },
    );

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
        field('Quality', qualityToggle, 'BGE uses a retrieval prompt on the query; GTE and MiniLM are lighter'),
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
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading ${SPECS[quality].label}`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipes[quality] = await loadPipeline(SPECS[quality].spec, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipes[quality];
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
            // Some models (e.g. BGE) need a retrieval instruction on the QUERY
            // only — never on the documents. Embed query + corpus together;
            // vectors are L2-normalized, so a plain dot product equals cosine similarity.
            const queryText = (SPECS[quality].spec.queryPrefix || '') + query;
            const emb = await pipe([queryText, ...docs], { pooling: 'mean', normalize: true });
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
                    modelBadge,
                    el('span', { class: 'sx-muted' }, `${docs.length} docs · ${qVec.length}-dim`),
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

    // ---- Pipeline hand-off: prefill the QUERY from a piped text input ----
    const _h = ctx.takeHandoff("text");
    if (_h && _h.data) { queryInput.value = _h.data; }

    // Warm the currently-selected model on mount so the first run is instant.
    // The loader surfaces progress/errors; the runtime cache dedupes a later run.
    ensureModel().catch(() => {});
}
