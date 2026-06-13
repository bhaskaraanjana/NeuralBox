// ============================================================
// Translator (Helsinki OPUS-MT) — each direction is its own model,
// so language direction is baked into the chosen model id and we
// pass NO language args to the pipeline.
// ============================================================
import { el, clear, button, field, textarea, select, loader, copyButton, badge, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

// Each direction maps to a separate Xenova opus-mt repo (direction baked in).
const DIRECTIONS = [
    { value: 'en-fr', label: 'English → French', spec: M.transEnFr, model: M.transEnFr.model },
    { value: 'en-es', label: 'English → Spanish', spec: M.transEnEs, model: M.transEnEs.model },
    { value: 'en-de', label: 'English → German', spec: M.transEnDe, model: M.transEnDe.model },
    { value: 'en-zh', label: 'English → Chinese', spec: M.transEnZh, model: M.transEnZh.model },
    { value: 'en-ru', label: 'English → Russian', spec: M.transEnRu, model: M.transEnRu.model },
    { value: 'en-ar', label: 'English → Arabic', spec: M.transEnAr, model: M.transEnAr.model },
    { value: 'fr-en', label: 'French → English', spec: M.transFrEn, model: M.transFrEn.model },
    { value: 'es-en', label: 'Spanish → English', spec: M.transEsEn, model: M.transEsEn.model },
    { value: 'de-en', label: 'German → English', spec: M.transDeEn, model: M.transDeEn.model },
    { value: 'ru-en', label: 'Russian → English', spec: M.transRuEn, model: M.transRuEn.model },
];

const DEFAULT_DIR = 'en-es';
const DEFAULT_TEXT = 'Hello, how are you? It is a beautiful day.';

export default function mount(host, ctx) {
    // Cache one ready pipeline per model id (runtime also caches under the hood).
    const pipes = new Map();
    let busy = false;

    // ---- DOM ----
    const dirSelect = select(DIRECTIONS.map((d) => ({ value: d.value, label: d.label })), DEFAULT_DIR);
    const input = textarea('Type or paste text to translate…', DEFAULT_TEXT, 7);
    const loaderSlot = el('div');
    const runBtn = button('Translate', { variant: 'primary', full: true, onClick: run });

    const result = el('div', { class: 'sx-result-big' }, '—');
    const copyBtn = copyButton(() => result.textContent === '—' ? '' : result.textContent, 'Copy');
    const copyRow = el('div', { class: 'sx-row end', style: { marginTop: '12px', display: 'none' } }, copyBtn);

    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🌍'),
        el('div', {}, 'Your translation will appear here'),
    );

    function currentDir() {
        return DIRECTIONS.find((d) => d.value === dirSelect.value) || DIRECTIONS[0];
    }

    dirSelect.addEventListener('change', () => {
        const [from] = currentDir().value.split('-');
        // Hint the source language without forcing it.
        const LANG = { en: 'English', fr: 'French', es: 'Spanish', de: 'German', ru: 'Russian' };
        input.placeholder = `Type or paste ${LANG[from] || 'source'} text to translate…`;
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🗣️ Source'),
        field('Direction', dirSelect, 'Each direction is a dedicated Helsinki OPUS-MT model.'),
        field('Text', input),
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✨ Translation'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    // ---- Logic ----
    async function ensurePipe(dir) {
        if (pipes.has(dir.model)) return pipes.get(dir.model);
        const ld = loader(`Loading ${dir.label}`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            const t = await loadPipeline(dir.spec, (p) => ld.progress(p));
            pipes.set(dir.model, t);
            ld.remove();
            return t;
        } catch (err) {
            ld.fail(err);
            throw err;
        }
    }

    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Enter some text to translate', 'info'); return; }
        if (busy) return;
        busy = true;
        runBtn.disabled = true;
        const dir = currentDir();
        try {
            const t = await ensurePipe(dir);
            const out = await t(text); // out = [{ translation_text }]
            const translated = out?.[0]?.translation_text ?? '';
            outBody.classList.remove('sx-placeholder');
            clear(outBody);
            clear(result);
            result.textContent = translated || '—';
            outBody.append(
                el('div', { class: 'sx-row', style: { marginBottom: '10px' } }, badge(dir.label, 'accent')),
                result,
                copyRow,
            );
            copyRow.style.display = translated ? '' : 'none';
        } catch (err) {
            toast('Translation failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }
}
