// ============================================================
// Image Captioner (ViT + GPT-2) — generative image-to-text.
// Describes any picture in a sentence, fully on-device.
// ============================================================
import { el, clear, button, loader, imageInput, badge, copyButton, toast } from '../ui.js';
import { loadPipeline } from '../runtime.js';

const MODEL = { task: 'image-to-text', model: 'Xenova/vit-gpt2-image-captioning', dtype: { webgpu: 'fp16', wasm: 'q8' } };

export default function mount(host, ctx) {
    let captioner = null;
    let currentURL = null;
    let caption = '';
    let busy = false;

    // ---- DOM: input stage ----
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

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger', 'portrait', 'bread'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } },
            badge('ViT-GPT2', 'accent'),
            el('span', { class: 'sx-muted' }, 'Generative — captions can take a few seconds'),
        ),
        runBtn,
        loaderSlot,
    );

    // ---- DOM: output ----
    const captionBox = el('div', { class: 'sx-result-big' }, '—');
    const copyRow = el('div', { class: 'sx-row end', style: { marginTop: '14px', display: 'none' } },
        copyButton(() => caption),
    );
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '💬'),
        el('div', {}, 'The caption will appear here'),
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📝 Caption'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (captioner) return captioner;
        const ld = loader('Loading caption model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            captioner = await loadPipeline(MODEL, (p) => ld.progress(p));
            ld.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return captioner;
    }

    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        currentURL = url;
        img.src = url;
        showStage();
        caption = '';
        captionBox.textContent = '—';
        copyRow.style.display = 'none';
        img.onload = () => { if (captioner) runOnce(); };
    }

    function showThinking() {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        const ld = loader('Generating caption');
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

    async function runOnce() {
        if (!currentURL || busy) return;
        busy = true;
        runBtn.disabled = true;
        const thinking = showThinking();
        try {
            await ensureModel();
            const out = await captioner(currentURL, { max_new_tokens: 50 }); // [{ generated_text }]
            caption = (out?.[0]?.generated_text || '').trim();
            thinking.remove();
            if (!caption) {
                outBody.classList.add('sx-placeholder');
                outBody.append(el('div', { class: 'sx-muted' }, 'No caption produced — try another image.'));
                return;
            }
            showCaption();
        } catch (err) {
            thinking.remove();
            outBody.classList.add('sx-placeholder');
            clear(outBody);
            outBody.append(
                el('div', { class: 'ph-emoji' }, '⚠️'),
                el('div', {}, 'Captioning failed'),
            );
            toast('Captioning failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    return () => { picker.destroy?.(); };
}
