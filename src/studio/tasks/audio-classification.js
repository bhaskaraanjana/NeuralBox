// ============================================================
// Sound Classifier (AST / AudioSet) — what is this sound?
// Records or accepts an audio clip, decodes to 16kHz mono PCM,
// and runs the Audio Spectrogram Transformer over 527 AudioSet
// classes (speech, music, dog, rain, engine, applause…).
// ============================================================
import { el, clear, button, field, loader, scoreBars, dropZone, badge, toast } from '../ui.js';
import { loadPipeline, decodeAudioTo16k } from '../runtime.js';
import { M } from '../models.js';

const MODEL = M.audAst;

export default function mount(host, ctx) {
    let classifier = null;
    let recorder = null;
    let chunks = [];
    let stream = null;
    let recording = false;
    let lastBlob = null;
    let lastURL = null;
    let busy = false;
    let destroyed = false;

    // ---- Controls ----
    const recBtn = button('Record', {
        variant: 'primary', full: true,
        iconPath: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
        onClick: () => toggleRecord(),
    });
    const recHint = el('div', { class: 'sx-muted', style: { marginTop: '8px', textAlign: 'center' } },
        'Tap record, make a sound, tap again to stop.');

    const drop = dropZone({
        accept: 'audio/*',
        title: 'Drop an audio file or click to browse',
        sub: 'WAV · MP3 · M4A · OGG — stays on your device',
        onFiles: (files) => loadFile(files[0]),
    });

    const player = el('audio', { class: 'sx-audio', controls: true, style: { width: '100%', display: 'none', marginTop: '12px' } });

    const loaderSlot = el('div');
    const runBtn = button('Identify sound', { variant: 'primary', full: true, onClick: () => run() });
    runBtn.disabled = true;

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎙️ Audio'),
        recBtn,
        recHint,
        el('div', { class: 'sx-row', style: { margin: '14px 0 12px' } },
            el('span', { class: 'sx-muted' }, 'or'),
        ),
        drop,
        player,
        el('div', { style: { height: '14px' } }),
        runBtn,
        loaderSlot,
        el('p', { class: 'sx-muted', style: { marginTop: '14px', lineHeight: '1.5' } },
            'Heads up — this AST model is large (~120MB on first load) and runs best with WebGPU.'),
    );

    // ---- Output ----
    const bigLabel = el('div', { class: 'sx-result-big' }, '—');
    const bars = el('div', { style: { marginTop: '16px' } });
    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🔊'),
        el('div', {}, 'Record or drop a clip, then identify the sound'),
    );
    const outBody = el('div', {}, placeholder);

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🏷️ What is it?'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    // ---- Model ----
    async function ensureModel() {
        if (classifier) return classifier;
        const ld = loader('Loading AST sound model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { classifier = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return classifier;
    }

    // ---- Audio sources ----
    function setClip(blob) {
        lastBlob = blob;
        if (lastURL) URL.revokeObjectURL(lastURL);
        lastURL = URL.createObjectURL(blob);
        player.src = lastURL;
        player.style.display = '';
        runBtn.disabled = false;
    }

    function loadFile(file) {
        if (!file) return;
        if (recording) stopRecord();
        setClip(file);
    }

    async function toggleRecord() {
        if (recording) { stopRecord(); return; }
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recorder = new MediaRecorder(stream);
            chunks = [];
            recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
            recorder.onstop = () => {
                releaseMic();
                if (destroyed) return;
                if (chunks.length) setClip(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
            };
            recorder.start();
            recording = true;
            recBtn.classList.remove('sx-btn-primary');
            recBtn.classList.add('sx-btn-danger');
            recBtn.querySelector('span:last-of-type').textContent = 'Stop recording';
            recHint.textContent = 'Recording… tap to stop.';
        } catch (err) {
            toast('Microphone unavailable: ' + (err?.message || err), 'error');
        }
    }

    function stopRecord() {
        if (recorder && recording) { try { recorder.stop(); } catch (_) {} }
        recording = false;
        recBtn.classList.remove('sx-btn-danger');
        recBtn.classList.add('sx-btn-primary');
        recBtn.querySelector('span:last-of-type').textContent = 'Record';
        recHint.textContent = 'Tap record, make a sound, tap again to stop.';
    }

    function releaseMic() {
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    }

    // ---- Inference ----
    async function run() {
        if (!lastBlob || busy) { if (!lastBlob) toast('Record or drop an audio clip first', 'info'); return; }
        busy = true;
        runBtn.disabled = true;
        try {
            await ensureModel();
            const pcm = await decodeAudioTo16k(lastBlob);
            if (!pcm.length) throw new Error('Empty or unreadable audio');
            const out = await classifier(pcm, { top_k: 6 }); // [{ label, score }]
            render(out);
        } catch (err) {
            toast('Classification failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    function render(out) {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        const top = out[0] || { label: 'Unknown', score: 0 };
        clear(bigLabel);
        bigLabel.append(
            el('span', { style: { fontSize: '1.6rem', marginRight: '8px' } }, '🔊'),
            el('span', {}, top.label),
            el('span', { class: 'sx-muted', style: { fontSize: '0.9rem', marginLeft: '10px' } },
                `${Math.round(top.score * 100)}% sure`),
        );
        clear(bars);
        bars.append(scoreBars(out));
        outBody.append(
            bigLabel,
            bars,
            el('div', { class: 'sx-row', style: { marginTop: '16px' } },
                badge('AudioSet · 527 classes', 'accent'),
                el('span', { class: 'sx-muted' }, `Top ${out.length} matches`)),
        );
    }

    // ---- Warm the model on mount so the first run is instant ----
    // (the loader surfaces progress/errors; the pipeline cache dedupes a later run)
    ensureModel().catch(() => {});

    // ---- Cleanup ----
    return () => {
        destroyed = true;
        stopRecord();
        releaseMic();
        if (lastURL) URL.revokeObjectURL(lastURL);
    };
}
