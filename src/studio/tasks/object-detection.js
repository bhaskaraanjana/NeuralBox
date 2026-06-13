// ============================================================
// Object Detection (YOLOS) — the headline "YOLO" studio.
// Reference implementation for vision + canvas-overlay studios.
// ============================================================
import { el, clear, button, field, loader, imageInput, badge, labelColor, toast } from '../ui.js';
import { loadPipeline, toRawImage, startCamera, stopStream, grabFrame } from '../runtime.js';

const MODEL = { task: 'object-detection', model: 'Xenova/yolos-tiny', dtype: { webgpu: 'fp16', wasm: 'q8' } };

export default function mount(host, ctx) {
    let detector = null;
    let currentURL = null;
    let threshold = 0.5;
    let live = false;
    let stream = null;
    let rafId = 0;
    let busy = false;

    // ---- DOM ----
    const stage = el('div', { class: 'sx-stage block' });
    const overlay = el('div', { class: 'sx-overlay' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous' });
    const video = el('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none' } });
    stage.append(img, video, overlay);

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🎯'),
        el('div', {}, 'Pick an image, drop one in, or use your camera'),
    );
    const stageWrap = el('div', {}, placeholder);

    const summary = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');
    const list = el('div', { class: 'sx-stack', style: { marginTop: '12px' } });

    const loaderSlot = el('div');
    const runBtn = button('Detect objects', { variant: 'primary', full: true, onClick: () => runOnce() });
    const liveBtn = button('Live camera', { variant: 'ghost', onClick: () => toggleLive() });

    const thLabel = el('span', {}, '0.50');
    const thresholdSlider = el('input', { type: 'range', class: 'sx-input', min: '0.1', max: '0.95', step: '0.05', value: '0.5' });
    thresholdSlider.addEventListener('input', () => {
        threshold = parseFloat(thresholdSlider.value);
        thLabel.textContent = threshold.toFixed(2);
        if (!live && detector && currentURL) runOnce();
    });

    const picker = imageInput({
        samples: ['street', 'cats', 'football', 'tiger'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📷 Input'),
        picker.el,
        field('Confidence threshold', thresholdSlider, null),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, thLabel, badge('YOLOS-tiny', 'accent')),
        runBtn,
        el('div', { style: { height: '10px' } }),
        liveBtn,
        loaderSlot,
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🟦 Detections'),
        stageWrap,
        summary,
        list,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (detector) return detector;
        const ld = loader('Loading YOLOS detector');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            detector = await loadPipeline(MODEL, (p) => ld.progress(p));
            ld.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return detector;
    }

    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        stopLive();
        currentURL = url;
        video.style.display = 'none';
        img.style.display = '';
        clear(overlay);
        showStage();
        summary.textContent = '';
        clear(list);
        img.onload = () => { if (detector) runOnce(); };
        img.onerror = () => toast('Could not load that image', 'error');
        img.src = url;
    }

    function drawBoxes(detections) {
        clear(overlay);
        for (const d of detections) {
            const { xmin, ymin, xmax, ymax } = d.box; // fractions (percentage:true)
            const color = labelColor(d.label);
            const box = el('div', {
                style: {
                    position: 'absolute',
                    left: `${xmin * 100}%`, top: `${ymin * 100}%`,
                    width: `${(xmax - xmin) * 100}%`, height: `${(ymax - ymin) * 100}%`,
                    border: `2.5px solid ${color}`, borderRadius: '4px',
                    boxShadow: `0 0 0 1px rgba(0,0,0,0.4)`,
                },
            }, el('span', {
                style: {
                    position: 'absolute', left: '-2px', top: '-22px',
                    background: color, color: '#06101e', fontSize: '11px', fontWeight: '700',
                    padding: '2px 6px', borderRadius: '5px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)',
                },
            }, `${d.label} ${Math.round(d.score * 100)}%`));
            overlay.append(box);
        }
    }

    function renderList(detections) {
        clear(list);
        if (!detections.length) { list.append(el('div', { class: 'sx-muted' }, 'No objects above threshold.')); return; }
        const counts = {};
        detections.forEach((d) => { counts[d.label] = (counts[d.label] || 0) + 1; });
        const chips = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([lbl, n]) =>
            el('span', { class: 'sx-badge', style: { borderColor: labelColor(lbl, 0.6), color: labelColor(lbl) } }, n > 1 ? `${lbl} ×${n}` : lbl));
        list.append(el('div', { class: 'sx-row' }, ...chips));
    }

    async function runOnce() {
        if (!currentURL || busy) return;
        busy = true;
        runBtn.disabled = true;
        try {
            await ensureModel();
            const out = await detector(currentURL, { threshold, percentage: true });
            drawBoxes(out);
            renderList(out);
            summary.textContent = `Found ${out.length} object${out.length === 1 ? '' : 's'}.`;
        } catch (err) {
            toast('Detection failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    // ---- Live camera ----
    async function toggleLive() {
        if (live) { stopLive(); return; }
        try {
            await ensureModel();
            live = true;
            liveBtn.replaceWith(liveBtn); // no-op keeps ref
            liveBtn.querySelector('span').textContent = 'Stop camera';
            img.style.display = 'none';
            video.style.display = '';
            showStage();
            stream = await startCamera(video, { facingMode: 'environment' });
            const canvas = el('canvas');
            const loop = async () => {
                if (!live) return;
                if (!busy && video.videoWidth) {
                    busy = true;
                    try {
                        grabFrame(video, canvas);
                        const raw = await toRawImage(canvas);
                        const out = await detector(raw, { threshold, percentage: true });
                        drawBoxes(out);
                        summary.textContent = `Live · ${out.length} object${out.length === 1 ? '' : 's'}`;
                    } catch (_) { /* drop frame */ }
                    finally { busy = false; }
                }
                rafId = requestAnimationFrame(loop);
            };
            rafId = requestAnimationFrame(loop);
        } catch (err) {
            live = false;
            toast('Camera unavailable: ' + (err?.message || err), 'error');
        }
    }

    function stopLive() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (live) { live = false; liveBtn.querySelector('span').textContent = 'Live camera'; }
        if (stream) { stopStream(stream); stream = null; }
        video.style.display = 'none';
    }

    return () => { stopLive(); picker.destroy?.(); };
}
