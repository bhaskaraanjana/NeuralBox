// ============================================================
// Speech to Text (Whisper) — record or drop audio, get a
// timestamped transcript. Quality tiers + long-form chunking for
// podcast-grade transcription, with SRT/TXT export.
// ============================================================
import { el, clear, button, field, segmented, select, loader, dropZone, copyButton, downloadBlob, badge, toast } from '../ui.js';
import { loadPipeline, decodeAudioTo16k } from '../runtime.js';

// Whisper distil models want shorter chunks (15s) than standard whisper (30s).
const SPECS = {
    fast: { label: 'Fast', model: 'onnx-community/whisper-base.en', dtype: { webgpu: 'fp16', wasm: 'q8' }, chunk: 30, stride: 5, multilingual: false, note: 'whisper-base · English · ~145 MB' },
    best: { label: 'Best', model: 'Xenova/whisper-small.en', dtype: { webgpu: 'fp16', wasm: 'q8' }, chunk: 30, stride: 5, multilingual: false, note: 'whisper-small · English · best accuracy · WebGPU recommended' },
    turbo: { label: 'Turbo', model: 'onnx-community/distil-small.en', dtype: { webgpu: 'fp16', wasm: 'q8' }, chunk: 15, stride: 3, multilingual: false, note: 'distil-whisper · English · ~6× faster, near-small quality' },
    multi: { label: 'Multilingual', model: 'onnx-community/whisper-base', dtype: { webgpu: 'fp16', wasm: 'q8' }, chunk: 30, stride: 5, multilingual: true, note: 'whisper-base · 99 languages' },
};

const LANGUAGES = ['auto', 'english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'dutch', 'russian', 'chinese', 'japanese', 'korean', 'arabic', 'hindi'];

const pad = (n) => String(n).padStart(2, '0');
function fmtTime(s) {
    if (s == null || !isFinite(s)) return '··:··';
    return `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
}
function srtTime(t) {
    t = Math.max(0, t || 0);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    const ms = Math.round((t - Math.floor(t)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
}
function toSRT(chunks) {
    return chunks.map((c, i) => {
        const [s, e] = Array.isArray(c.timestamp) ? c.timestamp : [0, 0];
        return `${i + 1}\n${srtTime(s)} --> ${srtTime(e == null ? s + 2 : e)}\n${(c.text || '').trim()}\n`;
    }).join('\n');
}

export default function mount(host, ctx) {
    let tier = 'fast';
    let lang = 'auto';
    const pipes = {};
    let recorder = null;
    let stream = null;
    let chunks = [];
    let recording = false;
    let busy = false;
    let starting = false;
    let destroyed = false;
    let lastResult = null;

    const recDot = el('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: '#f87171', display: 'inline-block', animation: 'nb-pulse 1.2s ease-in-out infinite' } });
    const recLabel = el('span', {}, 'Record audio');
    const recBtn = button('', { variant: 'primary', full: true, onClick: () => toggleRecord() });
    clear(recBtn).append(recLabel);

    const status = el('div', { class: 'sx-muted', style: { marginTop: '10px', minHeight: '20px' } }, '');

    const drop = dropZone({
        accept: 'audio/*',
        title: 'Drop an audio file or click to upload',
        sub: 'WAV · MP3 · M4A · OGG — full podcasts welcome, never leaves your device',
        onFiles: (files) => transcribeBlob(files[0]),
    });

    const tierNote = el('p', { class: 'sx-hint' }, SPECS[tier].note);
    const tierPicker = segmented(
        Object.entries(SPECS).map(([k, v]) => ({ value: k, label: v.label })),
        tier,
        (v) => { tier = v; tierNote.textContent = SPECS[v].note; langField.style.display = SPECS[v].multilingual ? '' : 'none'; },
    );

    const langSelect = select(LANGUAGES.map((l) => ({ value: l, label: l === 'auto' ? 'Auto-detect' : l[0].toUpperCase() + l.slice(1) })), lang);
    langSelect.addEventListener('change', () => { lang = langSelect.value; });
    const langField = field('Language', langSelect);
    langField.style.display = 'none';

    const loaderSlot = el('div');

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🎙️ Audio'),
        recBtn,
        status,
        el('div', { class: 'sx-row', style: { margin: '14px 0' } },
            el('span', { class: 'sx-muted' }, 'or'),
            el('div', { style: { flex: '1', height: '1px', background: 'var(--line-1)' } }),
        ),
        drop,
        field('Model', tierPicker, null),
        tierNote,
        langField,
        loaderSlot,
    );

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '📝'),
        el('div', {}, 'Record or drop audio to get a transcript'),
    );
    const outBody = el('div', {}, placeholder);

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '📄 Transcript'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureModel() {
        const spec = SPECS[tier];
        if (pipes[tier]) return pipes[tier];
        const ld = loader(`Loading ${spec.label} model`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { pipes[tier] = await loadPipeline({ task: 'automatic-speech-recognition', model: spec.model, dtype: spec.dtype }, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return pipes[tier];
    }

    // ---- Recording ----
    function setRecordingUI(on) {
        recording = on;
        clear(recBtn);
        if (on) {
            recBtn.classList.remove('sx-btn-primary'); recBtn.classList.add('sx-btn-danger');
            recBtn.append(recDot, el('span', {}, 'Stop recording'));
        } else {
            recBtn.classList.remove('sx-btn-danger'); recBtn.classList.add('sx-btn-primary');
            recBtn.append(recLabel); recLabel.textContent = 'Record audio';
        }
    }

    async function toggleRecord() {
        if (recording) { stopRecording(); return; }
        if (busy || starting) return;
        starting = true; recBtn.disabled = true;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            toast('Microphone access denied: ' + (err?.message || err), 'error');
            return;
        } finally {
            starting = false; recBtn.disabled = false;
        }
        if (destroyed) { releaseStream(); return; }
        chunks = [];
        try { recorder = new MediaRecorder(stream); }
        catch (err) { releaseStream(); toast('Recording unavailable: ' + (err?.message || err), 'error'); return; }
        recorder.addEventListener('dataavailable', (e) => { if (e.data && e.data.size) chunks.push(e.data); });
        recorder.addEventListener('stop', () => {
            const type = recorder?.mimeType || (chunks[0]?.type) || 'audio/webm';
            const blob = new Blob(chunks, { type });
            releaseStream();
            if (destroyed) return;
            if (blob.size) transcribeBlob(blob);
        });
        recorder.start();
        setRecordingUI(true);
        status.textContent = 'Listening… speak now, then stop.';
    }

    function stopRecording() {
        try { recorder?.stop(); } catch (_) {}
        setRecordingUI(false);
    }
    function releaseStream() {
        try { stream?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
        stream = null; recorder = null;
    }

    // ---- Transcription ----
    async function transcribeBlob(blob) {
        if (busy || destroyed) return;
        if (recording) stopRecording();
        busy = true; recBtn.disabled = true;
        status.textContent = 'Decoding audio…';
        try {
            const float32 = await decodeAudioTo16k(blob);
            if (!float32 || !float32.length) throw new Error('Empty or unreadable audio');
            const spec = SPECS[tier];
            const asr = await ensureModel();
            const secs = Math.round(float32.length / 16000);
            status.textContent = `Transcribing ${secs > 90 ? Math.round(secs / 60) + ' min' : secs + 's'}… ${secs > 120 ? '(long audio — WebGPU is much faster)' : ''}`;
            const opts = { chunk_length_s: spec.chunk, stride_length_s: spec.stride, return_timestamps: true };
            if (spec.multilingual && lang && lang !== 'auto') { opts.language = lang; opts.task = 'transcribe'; }
            const out = await asr(float32, opts);
            lastResult = out;
            renderTranscript(out);
            status.textContent = 'Done.';
        } catch (err) {
            status.textContent = '';
            toast('Transcription failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false; recBtn.disabled = false;
        }
    }

    function renderTranscript(out) {
        const text = (out?.text || '').trim();
        const segs = Array.isArray(out?.chunks) ? out.chunks.filter((c) => (c.text || '').trim()) : [];
        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        if (!text) { outBody.append(el('div', { class: 'sx-muted' }, 'No speech detected.')); return; }

        const actions = el('div', { class: 'sx-row end', style: { marginBottom: '12px', flexWrap: 'wrap' } },
            copyButton(() => text, 'Copy'),
            button('Download .txt', { variant: 'ghost', onClick: () => downloadBlob(new Blob([text], { type: 'text/plain' }), 'transcript.txt') }),
            segs.length ? button('Download .srt', { variant: 'ghost', onClick: () => downloadBlob(new Blob([toSRT(segs)], { type: 'text/plain' }), 'transcript.srt') }) : null,
        );
        const full = el('div', { class: 'sx-result' }, text);

        const rows = segs.map((c) => {
            const start = Array.isArray(c.timestamp) ? c.timestamp[0] : null;
            return el('div', { class: 'sx-row', style: { alignItems: 'flex-start', gap: '12px' } },
                el('span', { class: 'sx-mono', style: { color: 'var(--accent)', flex: '0 0 auto', paddingTop: '2px' } }, fmtTime(start)),
                el('span', { style: { color: 'var(--text-1)', lineHeight: '1.55' } }, (c.text || '').trim()),
            );
        });

        const body = el('div', {}, actions, full);
        if (rows.length) {
            body.append(
                el('p', { class: 'sx-pane-title', style: { margin: '20px 0 12px' } }, `Timeline · ${rows.length} segments`),
                el('div', { class: 'sx-stack' }, ...rows),
            );
        }
        outBody.append(body);
    }

    return () => { destroyed = true; stopRecording(); releaseStream(); };
}
