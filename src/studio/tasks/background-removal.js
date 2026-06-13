// ============================================================
// Background Remover (RMBG-1.4) — NON-STANDARD AutoModel studio.
// Runs a salient-object segmentation model, then composites the
// predicted mask into the image's alpha channel to cut out the
// subject. Result is shown on a checkerboard so transparency reads.
// ============================================================
import { el, clear, button, field, loader, imageInput, badge, downloadBlob, toast } from '../ui.js';
import { loadAutoModel, getRawImageClass } from '../runtime.js';
import { M } from '../models.js';

const SPEC = M.bgRmbg;

export default function mount(host, ctx) {
    let net = null;            // { model, processor }
    let currentURL = null;
    let lastBlob = null;       // transparent PNG of the latest cutout
    let busy = false;

    // ---- DOM ----
    const stage = el('div', { class: 'sx-stage block sx-checker' });
    const canvas = el('canvas');
    stage.append(canvas);

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '✂️'),
        el('div', {}, 'Pick an image to lift the subject off its background'),
    );
    const stageWrap = el('div', {}, placeholder);

    const status = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');

    const loaderSlot = el('div');
    const runBtn = button('Remove background', { variant: 'primary', full: true, onClick: () => runOnce() });
    const dlBtn = button('Download PNG', { variant: 'ghost', full: true, onClick: () => doDownload() });
    dlBtn.disabled = true;

    const sendBtn = button('Send to →', { variant: 'ghost', full: true, onClick: () => ctx.sendResultTo({ kind: 'image', data: canvas.toDataURL('image/png'), from: 'background-removal' }) });
    sendBtn.disabled = true;

    const picker = imageInput({
        samples: ['portrait', 'tiger', 'cats', 'bread'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🖼️ Input'),
        picker.el,
        el('div', { class: 'sx-row', style: { margin: '12px 0' } }, badge('RMBG-1.4', 'accent')),
        runBtn,
        el('div', { style: { height: '10px' } }),
        dlBtn,
        el('div', { style: { height: '10px' } }),
        sendBtn,
        el('p', { class: 'sx-muted', style: { marginTop: '12px' } }, 'First run downloads the model (~44MB), then it is cached for instant reuse.'),
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🪄 Cutout'),
        stageWrap,
        status,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // Inject checkerboard styling once so transparency is visible.
    if (!document.getElementById('sx-checker-style')) {
        document.head.append(el('style', { id: 'sx-checker-style', html: `
.sx-checker{background-color:#fff;background-image:conic-gradient(#d6dbe3 0 25%,transparent 0 50%,#d6dbe3 0 75%,transparent 0);background-size:22px 22px;background-position:0 0,11px 11px;}
` }));
    }

    // ---- Logic ----
    async function ensureModel() {
        if (net) return net;
        const ld = loader('Loading RMBG-1.4');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            net = await loadAutoModel(SPEC, (p) => ld.progress(p));
            ld.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return net;
    }

    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        currentURL = url;
        lastBlob = null;
        dlBtn.disabled = true;
        sendBtn.disabled = true;
        status.textContent = '';
        clear(stageWrap);
        stageWrap.append(placeholder);
        if (net) runOnce();
    }

    async function runOnce() {
        if (!currentURL || busy) return;
        busy = true;
        runBtn.disabled = true;
        dlBtn.disabled = true;
        sendBtn.disabled = true;
        status.textContent = 'Working…';
        try {
            const { model, processor } = await ensureModel();
            const RawImage = await getRawImageClass();

            const image = await RawImage.fromURL(currentURL);
            const { pixel_values } = await processor(image);
            const { output } = await model({ input: pixel_values });

            // output[0] is a [1,H,W] probability map in [0,1]; scale to an 8-bit
            // alpha mask and stretch it back to the source resolution.
            const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);

            // Composite: paint the original, then overwrite alpha from the mask.
            canvas.width = image.width;
            canvas.height = image.height;
            const cctx = canvas.getContext('2d');
            const bitmap = await RawImage.fromURL(currentURL).then((r) => r.toCanvas());
            cctx.drawImage(bitmap, 0, 0);
            const pixelData = cctx.getImageData(0, 0, image.width, image.height);
            for (let i = 0; i < mask.data.length; i++) {
                pixelData.data[4 * i + 3] = mask.data[i];
            }
            cctx.putImageData(pixelData, 0, 0);

            showStage();
            lastBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
            dlBtn.disabled = !lastBlob;
            sendBtn.disabled = false;
            status.textContent = `Cut out at ${image.width}×${image.height}. Background is now transparent.`;
        } catch (err) {
            toast('Background removal failed: ' + (err?.message || err), 'error');
            status.textContent = '';
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    function doDownload() {
        if (!lastBlob) { toast('Run the cutout first', 'info'); return; }
        downloadBlob(lastBlob, 'neuralbox-cutout.png');
    }

    // ---- Pipeline hand-off: consume a piped-in image (if any). ----
    const _h = ctx.takeHandoff("image");
    if (_h && _h.data) setImage(_h.data);

    return () => { picker.destroy?.(); };
}
