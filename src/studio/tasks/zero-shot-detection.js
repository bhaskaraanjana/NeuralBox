// ============================================================
// Zero-Shot Object Detection (OWL-ViT) — find ANY object you
// can name, no training. Image in, boxes out for your prompts.
// ============================================================
import { el, clear, button, field, textInput, loader, badge, labelColor, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'zero-shot-object-detection', model: 'Xenova/owlvit-base-patch32', dtype: { webgpu: 'q4f16', wasm: 'q8' } };

export default function mount(host, ctx) {
    let detector = null;
    let currentURL = null;
    let busy = false;

    const stage = el('div', { class: 'sx-stage block' });
    const overlay = el('div', { class: 'sx-overlay' });
    const img = el('img', { alt: 'input' });
    stage.append(img, overlay);
    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🔭'),
        el('div', {}, 'Pick an image and name what to find'),
    );
    const stageWrap = el('div', {}, placeholder);
    const summary = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');

    const labelsInput = textInput('Comma-separated things to find…', 'a cat, a dog, a person, a car, a traffic light');
    const loaderSlot = el('div');
    const runBtn = button('Find them', { variant: 'primary', full: true, onClick: () => run() });

    const samples = ['street', 'cats', 'football', 'tiger'];
    const sampleRow = el('div', { class: 'sx-samples' },
        el('span', { class: 'sx-samples-label' }, 'Try:'),
        ...samples.map((key) => el('button', {
            class: 'sx-sample', type: 'button', title: key,
            style: { backgroundImage: `url(/samples/${key}.jpg)` },
            onClick: () => setImage(`/samples/${key}.jpg`),
        })),
    );

    const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', () => { if (fileInput.files?.length) setImage(URL.createObjectURL(fileInput.files[0])); fileInput.value = ''; });
    const uploadBtn = button('Upload image', { variant: 'ghost', onClick: () => fileInput.click() });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        sampleRow,
        el('div', { style: { height: '10px' } }),
        uploadBtn, fileInput,
        field('What should I look for?', labelsInput, 'Separate prompts with commas — e.g. "a red car, a bicycle, sunglasses".'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, badge('OWL-ViT', 'accent'), el('span', { class: 'sx-muted' }, 'first run ~150 MB')),
        runBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🟦 Matches'),
        stageWrap,
        summary,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    function showStage() { if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); } }

    function setImage(url) {
        currentURL = url;
        clear(overlay);
        summary.textContent = '';
        showStage();
        img.onload = () => { if (detector) run(); };
        img.onerror = () => toast('Could not load that image', 'error');
        img.src = url;
    }

    async function ensureModel() {
        if (detector) return detector;
        const ld = loader('Loading OWL-ViT');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { detector = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return detector;
    }

    function draw(dets) {
        clear(overlay);
        const w = img.naturalWidth || 1;
        const h = img.naturalHeight || 1;
        for (const d of dets) {
            const { xmin, ymin, xmax, ymax } = d.box; // PIXELS in original image space
            const color = labelColor(d.label);
            overlay.append(el('div', {
                style: {
                    position: 'absolute',
                    left: `${(xmin / w) * 100}%`, top: `${(ymin / h) * 100}%`,
                    width: `${((xmax - xmin) / w) * 100}%`, height: `${((ymax - ymin) / h) * 100}%`,
                    border: `2.5px solid ${color}`, borderRadius: '4px', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                },
            }, el('span', {
                style: {
                    position: 'absolute', left: '-2px', top: '-22px', background: color, color: '#06101e',
                    fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '5px',
                    whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)',
                },
            }, `${d.label} ${Math.round(d.score * 100)}%`)));
        }
    }

    async function run() {
        if (!currentURL) { toast('Pick or upload an image first', 'info'); return; }
        const labels = labelsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (!labels.length) { toast('Name at least one thing to find', 'info'); return; }
        if (busy) return;
        busy = true; runBtn.disabled = true;
        summary.textContent = 'Searching…';
        try {
            await ensureModel();
            const out = await detector(currentURL, labels, { topk: 12, threshold: 0.1 });
            draw(out);
            summary.textContent = out.length ? `Found ${out.length} match${out.length === 1 ? '' : 'es'}.` : 'No matches — try different or simpler prompts.';
        } catch (err) {
            summary.textContent = '';
            toast('Detection failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false; runBtn.disabled = false;
        }
    }
}
