// ============================================================
// Entity Finder (NER) — token-classification studio.
// Merges BERT sub-tokens into clean entity spans, then renders
// colored chips + an inline-highlighted sentence.
// ============================================================
import { el, clear, button, field, textarea, loader, badge, toast, escapeHtml } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'token-classification', model: 'Xenova/bert-base-NER', dtype: { webgpu: 'fp16', wasm: 'q8' } };

const DEFAULT_TEXT = 'Tim Cook is the CEO of Apple, which is headquartered in Cupertino, California.';
const SAMPLES = [
    DEFAULT_TEXT,
    'Angela Merkel met Barack Obama at the United Nations in New York to discuss climate policy.',
    'The Mona Lisa, painted by Leonardo da Vinci, hangs in the Louvre museum in Paris, France.',
];

const TYPE_COLOR = { PER: '#60a5fa', ORG: '#f59e0b', LOC: '#34d399', MISC: '#c084fc' };
const TYPE_LABEL = { PER: 'People', ORG: 'Organizations', LOC: 'Locations', MISC: 'Misc' };
const TYPE_ORDER = ['PER', 'ORG', 'LOC', 'MISC'];

// Merge IOB2 sub-token output into contiguous entity spans.
function mergeSpans(tokens) {
    const spans = [];
    let cur = null;
    for (const t of tokens) {
        const tag = t.entity || '';
        const type = tag.slice(2); // strip "B-"/"I-"
        const isCont = t.word.startsWith('##');
        if (isCont && cur) {
            cur.text += t.word.slice(2);
            cur.scores.push(t.score);
            continue;
        }
        if (tag[0] === 'I' && cur && cur.type === type) {
            cur.text += ' ' + t.word;
            cur.scores.push(t.score);
            continue;
        }
        // B-X, or an I-X with no matching open span, or a continuation with no span.
        if (cur) spans.push(cur);
        cur = { text: t.word, type, scores: [t.score] };
    }
    if (cur) spans.push(cur);
    return spans.map((s) => ({
        text: s.text,
        type: s.type,
        score: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
    }));
}

// Highlight every entity span within the sentence (case-insensitive, longest-first).
// We HTML-escape the whole sentence first and match against escaped phrases, so
// unmatched user text can never be interpreted as markup (no injection / broken render).
function highlightSentence(text, spans) {
    const escaped = escapeHtml(text);
    const seen = new Map(); // escaped+lowercased phrase -> type
    for (const s of spans) {
        const key = escapeHtml(s.text).toLowerCase();
        if (key && !seen.has(key)) seen.set(key, s.type);
    }
    if (!seen.size) return escaped;
    const phrases = [...seen.keys()].sort((a, b) => b.length - a.length).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${phrases.join('|')})`, 'gi');
    return escaped.replace(re, (m) => {
        const type = seen.get(m.toLowerCase());
        const c = TYPE_COLOR[type] || 'var(--accent)';
        return `<span class="nx-hl" style="color:${c};border-color:${c}33;background:${c}1f">${m}</span>`;
    });
}

export default function mount(host, ctx) {
    let pipe = null;

    const input = textarea('Paste a sentence to extract people, places, and organizations…', DEFAULT_TEXT, 6);
    const loaderSlot = el('div');
    const runBtn = button('Find entities', { variant: 'primary', full: true, onClick: run });

    const sampleRow = el('div', { class: 'sx-row', style: { marginTop: '10px' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...['Tech', 'Politics', 'Art'].map((lbl, i) =>
            el('button', { class: 'sx-chip', type: 'button', onClick: () => { input.value = SAMPLES[i]; run(); } }, lbl)),
    );

    const legend = el('div', { class: 'sx-row', style: { marginTop: '12px' } },
        ...TYPE_ORDER.map((t) => el('span', {
            class: 'sx-badge',
            style: { borderColor: `${TYPE_COLOR[t]}66`, color: TYPE_COLOR[t] },
        }, TYPE_LABEL[t])),
    );

    const sentence = el('div', { class: 'sx-result', style: { marginTop: '14px' } });
    const groups = el('div', { class: 'sx-stack', style: { marginTop: '16px' } });
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🔎'),
        el('div', {}, 'Entities will be highlighted here'),
    );

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Text'),
        field('', input),
        sampleRow,
        legend,
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🏷️ Entities'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureModel() {
        if (pipe) return pipe;
        const ld = loader('Loading NER model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipe = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipe;
    }

    function renderGroups(spans) {
        clear(groups);
        const byType = {};
        for (const s of spans) (byType[s.type] ||= []).push(s);
        for (const type of TYPE_ORDER) {
            const items = byType[type];
            if (!items?.length) continue;
            const c = TYPE_COLOR[type];
            const chips = items.map((s) => el('span', {
                class: 'sx-badge',
                title: `${Math.round(s.score * 100)}% confident`,
                style: { borderColor: `${c}66`, color: c, background: `${c}14`, textTransform: 'none' },
            }, s.text));
            groups.append(el('div', {},
                el('div', { class: 'sx-mono sx-muted', style: { marginBottom: '6px' } }, `${TYPE_LABEL[type]} · ${items.length}`),
                el('div', { class: 'sx-row' }, ...chips),
            ));
        }
    }

    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Enter some text first', 'info'); return; }
        runBtn.disabled = true;
        try {
            await ensureModel();
            const out = await pipe(text); // [{entity, score, index, word}] per sub-token, "O" dropped
            const spans = mergeSpans(out);
            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            clear(sentence);
            sentence.innerHTML = highlightSentence(text, spans);
            outBody.append(sentence);
            if (!spans.length) {
                groups.innerHTML = '';
                outBody.append(el('div', { class: 'sx-muted', style: { marginTop: '14px' } }, 'No named entities found in this text.'));
                return;
            }
            renderGroups(spans);
            const total = spans.length;
            outBody.append(
                el('div', { class: 'sx-muted', style: { marginTop: '14px' } }, `Found ${total} entit${total === 1 ? 'y' : 'ies'}.`),
                groups,
            );
        } catch (err) {
            toast('Entity detection failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }
}
