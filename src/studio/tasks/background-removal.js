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

    // ---- Batch mode: pick many images, cut out each, show a grid. ----
    const batchInput = el('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    batchInput.addEventListener('change', () => {
        const files = Array.from(batchInput.files || []);
        batchInput.value = '';
        if (files.length) runBatch(files);
    });
    const batchBtn = button('Batch (multiple images)', { variant: 'ghost', full: true, onClick: () => batchInput.click() });

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
        batchBtn,
        batchInput,
        el('div', { style: { height: '10px' } }),
        dlBtn,
        el('div', { style: { height: '10px' } }),
        sendBtn,
        el('p', { class: 'sx-muted', style: { marginTop: '12px' } }, 'First run downloads the model (~44MB), then it is cached for instant reuse.'),
        loaderSlot,
    );

    // Batch grid lives in the output pane; hidden until a batch is run.
    const batchStatus = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');
    const batchGrid = el('div', { class: 'sx-bg-batch-grid' });
    const batchWrap = el('div', { style: { display: 'none', marginTop: '16px' } },
        el('p', { class: 'sx-pane-title' }, '🗂️ Batch results'),
        batchStatus,
        batchGrid,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🪄 Cutout'),
        stageWrap,
        status,
        batchWrap,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // Inject checkerboard + batch-grid styling once.
    if (!document.getElementById('sx-checker-style')) {
        document.head.append(el('style', { id: 'sx-checker-style', html: `
.sx-checker{background-color:#fff;background-image:conic-gradient(#d6dbe3 0 25%,transparent 0 50%,#d6dbe3 0 75%,transparent 0);background-size:22px 22px;background-position:0 0,11px 11px;}
.sx-bg-batch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:10px;}
.sx-bg-batch-cell{border:1px solid var(--border,rgba(255,255,255,.12));border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0;}
.sx-bg-batch-cell .thumb-row{display:flex;align-items:center;gap:8px;}
.sx-bg-batch-cell .thumb-row img{width:46px;height:46px;object-fit:cover;border-radius:6px;flex:none;}
.sx-bg-batch-cell .thumb-name{font-size:.72rem;color:var(--text-3,#9aa6b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sx-bg-batch-cell .cut-canvas{width:100%;height:auto;border-radius:8px;display:block;}
.sx-bg-batch-cell .cell-err{font-size:.78rem;color:#ff8585;}
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

    // Core inference: run the model on `url` and paint the transparent cutout
    // onto `targetCanvas`. Returns { width, height }. Shared by single + batch.
    async function cutout(url, targetCanvas) {
        const { model, processor } = await ensureModel();
        const RawImage = await getRawImageClass();

        const image = await RawImage.fromURL(url);
        const { pixel_values } = await processor(image);
        const { output } = await model({ input: pixel_values });

        // output[0] is a [1,H,W] probability map in [0,1]; scale to an 8-bit
        // alpha mask and stretch it back to the source resolution.
        const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);

        // Composite: paint the original, then overwrite alpha from the mask.
        targetCanvas.width = image.width;
        targetCanvas.height = image.height;
        const cctx = targetCanvas.getContext('2d');
        const bitmap = await RawImage.fromURL(url).then((r) => r.toCanvas());
        cctx.drawImage(bitmap, 0, 0);
        const pixelData = cctx.getImageData(0, 0, image.width, image.height);
        for (let i = 0; i < mask.data.length; i++) {
            pixelData.data[4 * i + 3] = mask.data[i];
        }
        cctx.putImageData(pixelData, 0, 0);
        return { width: image.width, height: image.height };
    }

    async function runOnce() {
        if (!currentURL || busy) return;
        busy = true;
        runBtn.disabled = true;
        batchBtn.disabled = true;
        dlBtn.disabled = true;
        sendBtn.disabled = true;
        status.textContent = 'Working…';
        try {
            const { width, height } = await cutout(currentURL, canvas);
            showStage();
            lastBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
            dlBtn.disabled = !lastBlob;
            sendBtn.disabled = false;
            status.textContent = `Cut out at ${width}×${height}. Background is now transparent.`;
        } catch (err) {
            toast('Background removal failed: ' + (err?.message || err), 'error');
            status.textContent = '';
        } finally {
            busy = false;
            runBtn.disabled = false;
            batchBtn.disabled = false;
        }
    }

    // Process many images sequentially, appending one grid cell per image.
    async function runBatch(files) {
        if (busy) { toast('Busy — wait for the current run to finish', 'info'); return; }
        busy = true;
        runBtn.disabled = true;
        batchBtn.disabled = true;

        clear(batchGrid);
        batchWrap.style.display = '';
        batchStatus.textContent = `0 / ${files.length}`;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const url = URL.createObjectURL(file);

            const cellCanvas = el('canvas', { class: 'cut-canvas sx-checker' });
            const thumb = el('img', { src: url, alt: file.name, width: 120 });
            const dl = button('Download PNG', { variant: 'ghost', full: true });
            dl.disabled = true;

            const cell = el('div', { class: 'sx-bg-batch-cell' },
                el('div', { class: 'thumb-row' },
                    thumb,
                    el('div', { class: 'thumb-name', title: file.name }, file.name),
                ),
                cellCanvas,
                dl,
            );
            batchGrid.append(cell);

            try {
                await cutout(url, cellCanvas);
                const blob = await new Promise((res) => cellCanvas.toBlob(res, 'image/png'));
                if (blob) {
                    dl.disabled = false;
                    const name = (file.name.replace(/\.[^.]+$/, '') || 'image') + '-cutout.png';
                    dl.addEventListener('click', () => downloadBlob(blob, name));
                }
            } catch (err) {
                cellCanvas.remove();
                cell.append(el('div', { class: 'cell-err' }, 'Failed: ' + (err?.message || err)));
            }
            // Keep the object URL alive: the thumbnail <img> still references it.

            batchStatus.textContent = `${i + 1} / ${files.length}`;
        }

        batchStatus.textContent = `Done — ${files.length} image${files.length === 1 ? '' : 's'} processed.`;
        busy = false;
        runBtn.disabled = false;
        batchBtn.disabled = false;
    }

    function doDownload() {
        if (!lastBlob) { toast('Run the cutout first', 'info'); return; }
        downloadBlob(lastBlob, 'neuralbox-cutout.png');
    }

    // ---- Pipeline hand-off: consume a piped-in image (if any). ----
    const _h = ctx.takeHandoff("image");
    if (_h && _h.data) setImage(_h.data);

    // Warm the model on mount so it downloads while the user prepares input;
    // the first run is then instant. The pipeline cache dedupes a later run.
    ensureModel().catch(() => {});

    return () => { picker.destroy?.(); };
}
