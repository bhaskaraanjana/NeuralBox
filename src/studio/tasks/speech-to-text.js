// ============================================================
// Speech to Text (Whisper) — record or drop audio, get a
// timestamped transcript. Reference for audio-in studios.
// ============================================================
import { el, clear, button, loader, dropZone, copyButton, badge, toast } from '../ui.js';
import { loadPipeline, decodeAudioTo16k } from '../runtime.js';

const MODEL = { task: 'automatic-speech-recognition', model: 'onnx-community/whisper-tiny.en', dtype: { webgpu: 'fp16', wasm: 'q8' } };

const fmtTime = (s) => {
    if (s == null || !isFinite(s)) return '··:··';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function mount(host, ctx) {
    let asr = null;
    let recorder = null;
    let stream = null;
    let chunks = [];
    let recording = false;
    let busy = false;
    let starting = false;
    let destroyed = false;

    // ---- Controls ----
    const recDot = el('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: '#f87171', display: 'inline-block', animation: 'nb-pulse 1.2s ease-in-out infinite' } });
    const recLabel = el('span', {}, 'Record audio');
    const recBtn = button('', { variant: 'primary', full: true, onClick: () => toggleRecord() });
    clear(recBtn).append(recLabel);

    const status = el('div', { class: 'sx-muted', style: { marginTop: '10px', minHeight: '20px' } }, '');

    const drop = dropZone({
        accept: 'audio/*',
        title: 'Drop an audio file or click to upload',
        sub: 'WAV · MP3 · M4A · OGG — never leaves your device',
        onFiles: (files) => transcribeBlob(files[0]),
    });

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
        el('div', { class: 'sx-row', style: { marginTop: '14px' } }, badge('Whisper tiny.en', 'accent')),
        loaderSlot,
    );

    // ---- Output ----
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

    // ---- Model ----
    async function ensureModel() {
        if (asr) return asr;
        const ld = loader('Loading Whisper');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { asr = await loadPipeline(MODEL, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return asr;
    }

    // ---- Recording ----
    function setRecordingUI(on) {
        recording = on;
        clear(recBtn);
        if (on) {
            recBtn.classList.remove('sx-btn-primary');
            recBtn.classList.add('sx-btn-danger');
            recBtn.append(recDot, el('span', {}, 'Stop recording'));
        } else {
            recBtn.classList.remove('sx-btn-danger');
            recBtn.classList.add('sx-btn-primary');
            recBtn.append(recLabel);
            recLabel.textContent = 'Record audio';
        }
    }

    async function toggleRecord() {
        if (recording) { stopRecording(); return; }
        if (busy || starting) return;
        starting = true;
        recBtn.disabled = true;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            toast('Microphone access denied: ' + (err?.message || err), 'error');
            return;
        } finally {
            starting = false;
            recBtn.disabled = false;
        }
        if (destroyed) { releaseStream(); return; }
        chunks = [];
        try {
            recorder = new MediaRecorder(stream);
        } catch (err) {
            releaseStream();
            toast('Recording unavailable: ' + (err?.message || err), 'error');
            return;
        }
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
        try { recorder?.stop(); } catch (_) { /* ignore */ }
        setRecordingUI(false);
    }

    function releaseStream() {
        try { stream?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
        stream = null;
        recorder = null;
    }

    // ---- Transcription ----
    async function transcribeBlob(blob) {
        if (busy || destroyed) return;
        if (recording) stopRecording();
        busy = true;
        recBtn.disabled = true;
        status.textContent = 'Decoding audio…';
        try {
            const float32 = await decodeAudioTo16k(blob);
            if (!float32 || !float32.length) throw new Error('Empty or unreadable audio');
            await ensureModel();
            status.textContent = 'Transcribing…';
            const out = await asr(float32, { chunk_length_s: 30, return_timestamps: true });
            renderTranscript(out);
            status.textContent = 'Done.';
        } catch (err) {
            status.textContent = '';
            toast('Transcription failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            recBtn.disabled = false;
        }
    }

    function renderTranscript(out) {
        const text = (out?.text || '').trim();
        const segs = Array.isArray(out?.chunks) ? out.chunks.filter((c) => (c.text || '').trim()) : [];
        clear(outBody);
        outBody.classList.remove('sx-placeholder');

        if (!text) {
            outBody.append(el('div', { class: 'sx-muted' }, 'No speech detected.'));
            return;
        }

        const head = el('div', { class: 'sx-row end', style: { marginBottom: '12px' } },
            copyButton(() => text, 'Copy transcript'));
        const full = el('div', { class: 'sx-result' }, text);

        const rows = segs.map((c) => {
            const start = Array.isArray(c.timestamp) ? c.timestamp[0] : null;
            return el('div', { class: 'sx-row', style: { alignItems: 'flex-start', gap: '12px' } },
                el('span', { class: 'sx-mono', style: { color: 'var(--accent)', flex: '0 0 auto', paddingTop: '2px' } }, fmtTime(start)),
                el('span', { style: { color: 'var(--text-1)', lineHeight: '1.55' } }, (c.text || '').trim()),
            );
        });

        const body = el('div', {}, head, full);
        if (rows.length) {
            body.append(
                el('p', { class: 'sx-pane-title', style: { margin: '20px 0 12px' } }, 'Timeline'),
                el('div', { class: 'sx-stack' }, ...rows),
            );
        }
        outBody.append(body);
    }

    // ---- Cleanup ----
    return () => { destroyed = true; stopRecording(); releaseStream(); };
}
