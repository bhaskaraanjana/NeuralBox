// ============================================================
// Text Emotion — 7-way emotion classification of any text.
// ============================================================
import { el, clear, button, field, textarea, loader, scoreBars, chip, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';
import { M } from '../models.js';

const MODEL = M.txtEmotion;

const EMOJI = { anger: '😠', disgust: '🤢', fear: '😨', joy: '😄', neutral: '😐', sadness: '😢', surprise: '😲' };
const COLOR = { anger: '#f87171', disgust: '#a3e635', fear: '#c084fc', joy: '#fbbf24', neutral: '#94a3b8', sadness: '#60a5fa', surprise: '#f472b6' };

const SAMPLES = [
    'I can\'t believe you did this for me — this is the best surprise ever!',
    'I\'ve been dreading this meeting all week and my stomach is in knots.',
    'Honestly, after everything that happened, I just feel empty.',
];

export default function mount(host, ctx) {
    let classifier = null;

    const input = textarea('Type something with feeling…', SAMPLES[0], 6);
    const loaderSlot = el('div');
    const runBtn = button('Read the emotion', { variant: 'primary', full: true, onClick: run });

    const sampleRow = el('div', { class: 'sx-row', style: { marginTop: '10px' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLES.map((s, i) => chip(['😄 Joy', '😨 Fear', '😢 Sad'][i], () => { input.value = s; run(); })),
    );

    const big = el('div', { class: 'sx-result-big' }, '—');
    const bars = el('div', { style: { marginTop: '16px' } });
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🎭'),
        el('div', {}, 'The emotional tone will appear here'),
    );

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Text'),
        field('', input),
        sampleRow,
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
    );
    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎭 Emotion'),
        outBody,
    );
    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureModel() {
        if (classifier) return classifier;
        const ld = loader('Loading emotion model');
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
            const all = await classifier(text, { top_k: null }); // [{label,score}] all 7
            all.sort((a, b) => b.score - a.score);
            const top = all[0];
            const color = COLOR[top.label] || 'var(--accent)';
            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            clear(big);
            big.append(
                el('span', { style: { fontSize: '2rem' } }, EMOJI[top.label] || '🎭'), ' ',
                el('span', { style: { color, textTransform: 'capitalize' } }, top.label),
                el('span', { class: 'sx-muted', style: { fontSize: '0.85rem', marginLeft: '8px' } }, `${Math.round(top.score * 100)}%`),
            );
            clear(bars);
            bars.append(scoreBars(all.map((e) => ({ label: `${EMOJI[e.label] || ''} ${e.label}`, score: e.score }))));
            outBody.append(big, bars);
        } catch (err) {
            toast('Analysis failed: ' + (err?.message || err), 'error');
        } finally {
            runBtn.disabled = false;
        }
    }
}
