// ============================================================
// Summarizer (DistilBART CNN) — condense long text into a brief.
// Generative + slow, so the spinner stays up through inference.
// ============================================================
import { el, clear, button, field, textarea, segmented, badge, loader, copyButton, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

// One model per style tier; runtime picks device + dtype from the {webgpu,wasm} object.
const STYLES = {
    balanced: {
        label: 'Balanced',
        spec: M.sumCnn126,
    },
    fast: {
        label: 'Fast',
        spec: M.sumCnn66,
    },
    headline: {
        label: 'Headline',
        spec: M.sumXsum126,
    },
};

const SAMPLE = `The city council voted late Tuesday to approve a sweeping plan that will transform the long-neglected riverside district into a mixed-use neighbourhood over the next decade. The proposal, backed by a coalition of local businesses and housing advocates, sets aside nearly forty acres for parks, affordable apartments and small commercial space, while preserving the historic grain warehouses that line the waterfront.

Supporters say the redevelopment could create thousands of construction jobs and finally connect the downtown core to the river, which has been cut off by rail yards for generations. Critics, however, warned that rising rents could push out the very residents the project claims to help, and several speakers urged the council to add stronger tenant protections before any ground is broken.

Under the approved timeline, demolition of the abandoned freight terminal will begin next spring, with the first homes expected to open their doors within three years. City planners pledged to hold quarterly public meetings so neighbours can track progress and raise concerns as the work moves ahead.`;

const countWords = (s) => (s.trim().match(/\S+/g) || []).length;

export default function mount(host, ctx) {
    // One cached pipeline per style tier (runtime caches the underlying load too).
    const pipes = { balanced: null, fast: null, headline: null };
    let style = 'balanced';
    let maxTokens = 130;

    const input = textarea('Paste an article, report or long passage to summarize…', SAMPLE, 12);
    const loaderSlot = el('div');
    const runBtn = button('Summarize', { variant: 'primary', full: true, onClick: run });

    const lengthSeg = segmented([
        { value: 60, label: 'Short' },
        { value: 130, label: 'Medium' },
        { value: 220, label: 'Long' },
    ], maxTokens, (v) => { maxTokens = v; });

    const modelBadge = badge(STYLES[style].label, 'accent');
    const styleSeg = segmented([
        { value: 'balanced', label: 'Balanced' },
        { value: 'fast', label: 'Fast' },
        { value: 'headline', label: 'Headline' },
    ], style, (v) => {
        style = v;
        modelBadge.textContent = STYLES[style].label;
        // Warm the newly-selected style so its model downloads while the user waits.
        ensureModel().catch(() => {});
        // Re-run on the new tier if we already have text to summarize.
        if (input.value.trim()) run();
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📰 Source text'),
        field('', input, 'Runs entirely in your browser — text never leaves your device.'),
        field('Quality', styleSeg, 'Balanced is the default; Fast is quicker, Headline is one terse line.'),
        field('Summary length', lengthSeg),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        loaderSlot,
    );

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🧠'),
        el('div', {}, 'Your summary will appear here'),
    );
    const result = el('div', { class: 'sx-result', style: { display: 'none' } });
    const stat = el('div', { class: 'sx-muted', style: { marginTop: '10px' } }, '');
    const actions = el('div', { class: 'sx-row end', style: { marginTop: '12px', display: 'none' } });

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✨ Summary'),
        placeholder,
        result,
        stat,
        actions,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureModel() {
        if (pipes[style]) return pipes[style];
        const ld = loader(`Loading ${STYLES[style].label}`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipes[style] = await loadPipeline(STYLES[style].spec, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipes[style];
    }

    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Paste some text to summarize first', 'info'); return; }
        if (countWords(text) < 20) { toast('Add a longer passage for a meaningful summary', 'info'); return; }
        runBtn.disabled = true;
        // Show a working state immediately; generation is slow.
        placeholder.style.display = 'none';
        result.style.display = '';
        actions.style.display = 'none';
        clear(result);
        result.append(el('span', { class: 'sx-muted' }, 'Summarizing… this can take a moment.'));
        stat.textContent = '';
        try {
            const summarizer = await ensureModel();
            const out = await summarizer(text, { max_new_tokens: maxTokens });
            const summary = (out?.[0]?.summary_text || '').trim();
            clear(result);
            result.textContent = summary || '(no summary produced)';
            const inWords = countWords(text);
            const outWords = countWords(summary);
            const pct = inWords ? Math.round((1 - outWords / inWords) * 100) : 0;
            stat.textContent = `${inWords} words → ${outWords} words` + (pct > 0 ? ` · ${pct}% shorter` : '');
            clear(actions);
            actions.append(copyButton(() => summary, 'Copy summary'));
            if (summary) {
                ctx.saveHistory({ studio: 'summarize', title: summary.slice(0, 60), text: summary });
                actions.append(button('Send to →', { variant: 'ghost', onClick: () => ctx.sendResultTo({ kind: 'text', data: summary, from: 'summarize' }) }));
            }
            actions.style.display = '';
        } catch (err) {
            clear(result);
            result.style.display = 'none';
            placeholder.style.display = '';
            stat.textContent = '';
            toast('Summarization failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }

    // Pipeline hand-off: prefill the source textarea from a piped text input (don't auto-run).
    const _h = ctx.takeHandoff("text");
    if (_h && _h.data) { input.value = _h.data; }

    // Warm the currently-selected model on mount so the first run is instant.
    // The loader surfaces progress/errors; the pipeline cache dedupes with a later run.
    ensureModel().catch(() => {});
}
