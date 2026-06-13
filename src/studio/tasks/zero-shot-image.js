// ============================================================
// Zero-Shot Vision (CLIP) — classify any image against labels
// you invent on the fly. No fine-tuning, no fixed categories.
// ============================================================
import { el, clear, button, field, textInput, loader, scoreBars, segmented, imageInput, badge, toast } from '../ui.js';
import { loadPipeline, toRawImage, startCamera, stopStream, grabFrame } from '../runtime.js';
import { M } from '../models.js';

const SPECS = {
    fast: {
        label: 'Fast',
        spec: M.zsiClip32,
    },
    accurate: {
        label: 'Accurate',
        spec: M.zsiClip16,
    },
};

const DEFAULT_LABELS = 'a cat, a dog, a car, a sunset, a city street, food';

export default function mount(host, ctx) {
    // One cached pipeline per quality tier (runtime caches the underlying load too).
    const pipes = { fast: null, accurate: null };
    let quality = 'fast';
    let currentURL = null;
    let busy = false;
    let live = false;
    let stream = null;
    let rafId = 0;

    // ---- Input stage ----
    const stage = el('div', { class: 'sx-stage block' });
    const img = el('img', { alt: 'input', crossorigin: 'anonymous' });
    const video = el('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none' } });
    stage.append(img, video);
    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🪄'),
        el('div', {}, 'Pick an image, then describe what it might be'),
    );
    const stageWrap = el('div', {}, placeholder);

    // ---- Controls ----
    const labelsInput = textInput('comma, separated, labels', DEFAULT_LABELS);
    const loaderSlot = el('div');
    const runBtn = button('Classify', { variant: 'primary', full: true, onClick: () => run() });
    const liveBtn = button('Live camera', { variant: 'ghost', onClick: () => toggleLive() });

    const modelBadge = badge(SPECS[quality].label, 'accent');
    const qualityToggle = segmented(
        [{ value: 'fast', label: 'Fast' }, { value: 'accurate', label: 'Accurate' }],
        quality,
        (v) => {
            quality = v;
            modelBadge.textContent = SPECS[quality].label;
            // Warm the newly-selected tier so its first run is instant.
            ensureModel().catch(() => {});
            // Re-run on the new tier if we already have an image to classify.
            if (currentURL) run();
        },
    );

    const picker = imageInput({
        samples: ['cats', 'tiger', 'bread', 'street'],
        onImage: (url) => setImage(url),
    });

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🖼️ Input'),
        picker.el,
        field('Candidate labels', labelsInput, 'CLIP scores the image against each phrase — two or more, comma-separated.'),
        field('Quality', qualityToggle, 'Fast is instant; Accurate trades speed for precision'),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, el('span', { class: 'sx-muted' }, 'Model:'), modelBadge),
        runBtn,
        el('div', { style: { height: '10px' } }),
        liveBtn,
        loaderSlot,
    );

    // ---- Output ----
    const summary = el('div', { class: 'sx-muted', style: { marginTop: '14px' } }, '');
    const bars = el('div', { style: { marginTop: '8px' } });
    const outBody = el('div', {}, stageWrap, summary, bars);

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎯 Best match'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split wide-out' }, controls, output));

    // ---- Logic ----
    function showStage() {
        if (stageWrap.firstChild !== stage) { clear(stageWrap); stageWrap.append(stage); }
    }

    function setImage(url) {
        stopLive();
        currentURL = url;
        video.style.display = 'none';
        img.style.display = '';
        img.src = url;
        showStage();
        summary.textContent = '';
        clear(bars);
        img.onload = () => { if (pipes[quality] && !busy) run(); };
    }

    function parseLabels() {
        return labelsInput.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async function ensureModel() {
        if (pipes[quality]) return pipes[quality];
        const ld = loader(`Loading ${SPECS[quality].label} CLIP vision model`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipes[quality] = await loadPipeline(SPECS[quality].spec, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipes[quality];
    }

    // Shared inference + render: classify a source (URL / RawImage) against
    // the labels and paint the bars. Reused by both still-image and live modes.
    async function classifyAndRender(src, labels, livePrefix) {
        const classifier = await ensureModel();
        // Candidate labels are the SECOND POSITIONAL ARG (string[]).
        const out = await classifier(src, labels); // [{score,label}] desc, softmaxed
        const ranked = out.slice().sort((a, b) => b.score - a.score);
        const top = ranked[0];
        summary.textContent = top
            ? `${livePrefix}“${top.label}” — ${Math.round(top.score * 100)}% confident`
            : 'No result.';
        clear(bars);
        bars.append(scoreBars(ranked));
    }

    async function run() {
        if (!currentURL) { toast('Pick an image first', 'info'); return; }
        const labels = parseLabels();
        if (labels.length < 2) { toast('Add at least 2 candidate labels', 'info'); return; }
        if (busy) return;
        busy = true;
        runBtn.disabled = true;
        try {
            await classifyAndRender(currentURL, labels, '');
        } catch (err) {
            toast('Classification failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    // ---- Live camera ----
    async function toggleLive() {
        if (live) { stopLive(); return; }
        if (parseLabels().length < 2) { toast('Add at least 2 candidate labels', 'info'); return; }
        try {
            await ensureModel();
            live = true;
            liveBtn.querySelector('span').textContent = 'Stop camera';
            img.style.display = 'none';
            video.style.display = '';
            showStage();
            stream = await startCamera(video, { facingMode: 'environment' });
            const canvas = el('canvas');
            const loop = async () => {
                if (!live) return;
                // Frame-drop guard keeps the UI responsive on heavier tiers.
                if (!busy && video.videoWidth) {
                    busy = true;
                    try {
                        // Re-read labels each frame so live edits take effect immediately.
                        const labels = parseLabels();
                        if (labels.length >= 2) {
                            grabFrame(video, canvas);
                            const raw = await toRawImage(canvas);
                            await classifyAndRender(raw, labels, 'Live · ');
                        }
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

    // ---- Pipeline hand-off: consume a piped image input (call ONCE) ----
    const _h = ctx.takeHandoff("image");
    if (_h && _h.data) setImage(_h.data);

    // Warm the currently-selected model on mount so the download runs while the
    // user prepares input — the loader surfaces progress/errors, the run dedupes.
    ensureModel().catch(() => {});

    return () => { stopLive(); picker.destroy?.(); };
}
