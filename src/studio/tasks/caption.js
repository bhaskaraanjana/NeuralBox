// ============================================================
// Image Captioner — describe any picture, on-device.
// Quick mode: ViT-GPT2 (fast, one sentence).
// Detailed mode: Florence-2 (rich, multi-sentence VLM).
// ============================================================
import { el, clear, button, field, segmented, loader, imageInput, badge, copyButton, toast } from '../ui.js';
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
        (v) => { mode = v; modelBadge.textContent = v === 'detailed' ? 'Florence-2' : 'ViT-GPT2'; if (currentURL && readyFor(v)) runOnce(); },
    );
    const modelBadge = badge('ViT-GPT2', 'accent');

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger', 'portrait', 'bread'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Detail', modePicker, null),
        modeNote,
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, modelBadge, el('span', { class: 'sx-muted' }, 'Generative — can take a few seconds')),
        runBtn,
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

    const _h = ctx.takeHandoff("image"); if (_h && _h.data) setImage(_h.data);

    return () => { picker.destroy?.(); };
}
