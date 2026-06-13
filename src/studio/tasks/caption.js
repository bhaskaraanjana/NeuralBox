// ============================================================
// Image Captioner — describe any picture, on-device.
// Quick mode: ViT-GPT2 (fast, one sentence).
// Detailed mode: Florence-2 (rich, multi-sentence VLM).
// ============================================================
import { el, clear, button, field, segmented, loader, imageInput, badge, copyButton, toast, spinner } from '../ui.js';
import { loadPipeline, loadLib, pickDevice, aggregateProgress } from '../runtime.js';
import { M } from '../models.js';

const QUICK = M.capVitGpt2;
const FLORENCE = M.capFlorence.model;
const FLORENCE_TASK = M.capFlorence.task;

export default function mount(host, ctx) {
    let mode = 'quick';
    let quickPipe = null;
    let florence = null; // { model, processor, tokenizer, RawImage }
    let currentURL = null;
    let caption = '';
    let busy = false;

    const stage = el('div', { class: 'sx-stage block' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous' });
    stage.append(img);
    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🖼️'),
        el('div', {}, 'Pick an image, drop one in, or use your camera'),
    );
    const stageWrap = el('div', {}, placeholder);

    const loaderSlot = el('div');
    const runBtn = button('Describe image', { variant: 'primary', full: true, onClick: () => runOnce() });

    const modeNote = el('p', { class: 'sx-hint' }, 'Quick: a fast one-liner. Detailed: a rich multi-sentence description (Florence-2, ~340 MB, WebGPU recommended).');
    const modePicker = segmented(
        [{ value: 'quick', label: 'Quick' }, { value: 'detailed', label: 'Detailed' }],
        mode,
        (v) => { mode = v; modelBadge.textContent = v === 'detailed' ? 'Florence-2' : 'ViT-GPT2'; (v === 'detailed' ? ensureFlorence() : ensureQuick()).catch(() => {}); if (currentURL && readyFor(v)) runOnce(); },
    );
    const modelBadge = badge('ViT-GPT2', 'accent');

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger', 'portrait', 'bread'],
        onImage: (url) => setImage(url),
    });

    // --- Batch mode: caption many images at once (additive; single-image mode untouched). ---
    const batchInput = el('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    batchInput.addEventListener('change', () => {
        const files = Array.from(batchInput.files || []);
        batchInput.value = '';
        if (files.length) runBatch(files);
    });
    const batchBtn = button('Batch (multiple images)', { variant: 'ghost', full: true, onClick: () => batchInput.click() });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Detail', modePicker, null),
        modeNote,
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, modelBadge, el('span', { class: 'sx-muted' }, 'Generative — can take a few seconds')),
        runBtn,
        batchBtn,
        batchInput,
        loaderSlot,
    );

    const captionBox = el('div', { class: 'sx-result-big' }, '—');
    const sendBtn = ctx.ui.button('Send to →', { variant: 'ghost', onClick: () => ctx.sendResultTo({ kind: 'text', data: caption, from: 'caption' }) });
    const copyRow = el('div', { class: 'sx-row end', style: { marginTop: '14px', display: 'none' } }, copyButton(() => caption), sendBtn);
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '💬'),
        el('div', {}, 'The caption will appear here'),
    );
    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📝 Caption'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    function readyFor(m) { return m === 'quick' ? !!quickPipe : !!florence; }
    function showStage() { if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); } }

    function setImage(url) {
        currentURL = url;
        showStage();
        caption = '';
        captionBox.textContent = '—';
        copyRow.style.display = 'none';
        img.onload = () => { if (readyFor(mode)) runOnce(); };
        img.onerror = () => toast('Could not load that image', 'error');
        img.src = url;
    }

    async function ensureQuick() {
        if (quickPipe) return quickPipe;
        const ld = loader('Loading ViT-GPT2');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { quickPipe = await loadPipeline(QUICK, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return quickPipe;
    }

    async function ensureFlorence() {
        if (florence) return florence;
        const lib = await loadLib();
        const device = await pickDevice();
        const dtype = device === 'webgpu'
            ? { embed_tokens: 'fp16', vision_encoder: 'fp16', encoder_model: 'fp16', decoder_model_merged: 'q4' }
            : { embed_tokens: 'q8', vision_encoder: 'q4', encoder_model: 'q4', decoder_model_merged: 'q4' };
        const ld = loader('Loading Florence-2');
        clear(loaderSlot); loaderSlot.append(ld.el);
        const pc = aggregateProgress((p) => ld.progress(p));
        try {
            const [model, processor, tokenizer] = await Promise.all([
                lib.Florence2ForConditionalGeneration.from_pretrained(FLORENCE, { dtype, device, progress_callback: pc }),
                lib.AutoProcessor.from_pretrained(FLORENCE, { progress_callback: pc }),
                lib.AutoTokenizer.from_pretrained(FLORENCE, { progress_callback: pc }),
            ]);
            florence = { model, processor, tokenizer, RawImage: lib.RawImage };
            ld.remove();
        } catch (err) { ld.fail(err); throw err; }
        return florence;
    }

    function showThinking() {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        const ld = loader(mode === 'detailed' ? 'Describing in detail' : 'Generating caption');
        ld.status('Reading the image…');
        ld.progress(100);
        outBody.append(ld.el);
        return ld;
    }

    function showCaption() {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        captionBox.textContent = caption;
        copyRow.style.display = '';
        outBody.append(captionBox, copyRow);
    }

    async function captionQuick(url) {
        const pipe = await ensureQuick();
        const out = await pipe(url, { max_new_tokens: 50 });
        return (out?.[0]?.generated_text || '').trim();
    }

    async function captionDetailed(url) {
        const { model, processor, tokenizer, RawImage } = await ensureFlorence();
        const image = await RawImage.fromURL(url);
        const prompts = processor.construct_prompts(FLORENCE_TASK);
        const inputs = await processor(image, prompts);
        const ids = await model.generate({ ...inputs, max_new_tokens: 256, num_beams: 1, do_sample: false });
        const text = tokenizer.batch_decode(ids, { skip_special_tokens: false })[0];
        const result = processor.post_process_generation(text, FLORENCE_TASK, image.size ?? [image.width, image.height]);
        return String(result?.[FLORENCE_TASK] || '').trim();
    }

    async function runOnce() {
        if (!currentURL || busy) return;
        busy = true;
        runBtn.disabled = true;
        const thinking = showThinking();
        try {
            caption = mode === 'detailed' ? await captionDetailed(currentURL) : await captionQuick(currentURL);
            thinking.remove();
            if (!caption) {
                outBody.classList.add('sx-placeholder');
                clear(outBody);
                outBody.append(el('div', { class: 'sx-muted' }, 'No caption produced — try another image.'));
                return;
            }
            showCaption();
            ctx.saveHistory({ studio: 'caption', title: caption.slice(0, 60), text: caption });
        } catch (err) {
            thinking.remove();
            clear(outBody);
            outBody.classList.add('sx-placeholder');
            outBody.append(el('div', { class: 'ph-emoji' }, '⚠️'), el('div', {}, 'Captioning failed'));
            toast('Captioning failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    // Render a results grid in the output pane and caption each picked image in turn.
    // Quick mode is used here to keep the batch fast (one fast model load, then N inferences).
    async function runBatch(files) {
        if (busy) return;
        busy = true;
        runBtn.disabled = true;
        batchBtn.disabled = true;

        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        const status = el('div', { class: 'sx-row', style: { marginBottom: '12px' } },
            spinner(),
            el('strong', {}, `Captioning batch — 0 / ${files.length}`),
        );
        const grid = el('div', {
            class: 'sx-batch-grid',
            style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px' },
        });
        outBody.append(status, grid);

        const statusLabel = status.querySelector('strong');
        const urls = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const url = URL.createObjectURL(files[i]);
                urls.push(url);
                const capText = el('div', { class: 'sx-muted', style: { marginTop: '8px', fontSize: '13px' } }, 'Captioning…');
                const cell = el('div', { class: 'sx-card', style: { padding: '10px' } },
                    el('img', { src: url, alt: files[i].name || 'image', style: { width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', display: 'block' } }),
                    capText,
                );
                grid.append(cell);
                try {
                    const text = await captionQuick(url); // reuse existing Quick inference
                    capText.classList.remove('sx-muted');
                    capText.textContent = text || 'No caption produced.';
                    if (text) ctx.saveHistory({ studio: 'caption', title: text.slice(0, 60), text });
                } catch (err) {
                    capText.classList.remove('sx-muted');
                    capText.textContent = '⚠️ Failed: ' + (err?.message || err);
                }
                statusLabel.textContent = `Captioning batch — ${i + 1} / ${files.length}`;
            }
            clear(status);
            status.append(el('strong', {}, `Done — ${files.length} image${files.length === 1 ? '' : 's'} captioned`));
        } catch (err) {
            toast('Batch failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
            batchBtn.disabled = false;
            // Object URLs back the rendered thumbnails for the session, so they are kept alive intentionally.
            void urls;
        }
    }

    const _h = ctx.takeHandoff("image"); if (_h && _h.data) setImage(_h.data);

    // Warm the default Quick model on mount so the first run is instant.
    // Detailed/Florence is warmed only when the user switches to that mode.
    ensureQuick().catch(() => {});

    return () => { picker.destroy?.(); };
}
