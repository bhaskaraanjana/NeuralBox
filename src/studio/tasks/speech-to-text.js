// ============================================================
// Speech to Text (Whisper) — record or drop audio, get a clean,
// speaker-segmented transcript. Optional on-device speaker ID
// (pyannote diarization) groups speech into per-speaker turns.
// SRT/TXT export.
//
// NOTE on timestamps: `return_timestamps: true` makes the ONNX Whisper
// exports we ship return EMPTY text in transformers.js 3.8.1 (verified).
// So we never request timestamps from Whisper. Instead, when speaker ID is
// on, pyannote gives us the time spans, we slice the audio per speaker turn,
// and transcribe each slice independently — which also yields perfect
// speaker↔text alignment.
// ============================================================
import { el, clear, button, field, segmented, select, loader, dropZone, copyButton, downloadBlob, badge, toast } from '../ui.js';
import { loadPipeline, loadAutoModel, decodeAudioTo16k } from '../runtime.js';
import { M } from '../models.js';

const SAMPLE_RATE = 16000;
// Whisper processes 30s at a time; only enable chunking past this so short
// slices (the common diarization case) skip the chunking overhead.
const CHUNK_THRESHOLD_S = 28;

// Distinct colors for speaker chips (cycles if there are more speakers).
const SPEAKER_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#facc15', '#22d3ee', '#c084fc'];
const speakerLabel = (id) => `Speaker ${id + 1}`;
const speakerColor = (id) => SPEAKER_COLORS[id % SPEAKER_COLORS.length];

/** pyannote emits arbitrary, non-consecutive speaker ids (0, 2, 3…) and in
 *  whatever order they first appear. Remap to 0,1,2… by first-appearance so the
 *  labels read "Speaker 1, 2, 3" in spoken order. */
function remapSpeakers(diar) {
    if (!Array.isArray(diar) || !diar.length) return diar;
    const sorted = [...diar].sort((a, b) => a.start - b.start);
    const map = new Map();
    for (const d of sorted) if (!map.has(d.id)) map.set(d.id, map.size);
    return diar.map((d) => ({ ...d, id: map.get(d.id) }));
}

/** Merge adjacent diarization segments by the same speaker into one turn, so we
 *  transcribe each contiguous speaker span once (fewer, longer ASR calls = more
 *  context = better accuracy). Tiny gaps between same-speaker spans are bridged. */
function mergeTurns(diar, { gap = 0.6 } = {}) {
    const turns = [];
    let cur = null;
    for (const d of diar) {
        if (cur && cur.speaker === d.id && d.start - cur.end <= gap) {
            cur.end = Math.max(cur.end, d.end);
        } else {
            if (cur) turns.push(cur);
            cur = { speaker: d.id, start: d.start, end: d.end };
        }
    }
    if (cur) turns.push(cur);
    return turns;
}

/** Merge consecutive output turns by the same speaker (can happen when an empty
 *  slice was skipped between two of the same speaker's turns). */
function mergeConsecutive(turns) {
    const out = [];
    for (const t of turns) {
        const prev = out[out.length - 1];
        if (prev && prev.speaker === t.speaker) { prev.text += ' ' + t.text; prev.end = t.end; }
        else out.push({ ...t });
    }
    return out;
}

/** Extract the 16kHz audio for [start,end] seconds, with a little context padding. */
function sliceAudio(float32, start, end, pad = 0.1) {
    const s = Math.max(0, Math.floor((start - pad) * SAMPLE_RATE));
    const e = Math.min(float32.length, Math.ceil((end + pad) * SAMPLE_RATE));
    return e > s ? float32.subarray(s, e) : float32.subarray(0, 0);
}

/** Whisper emits bracketed non-speech placeholders for silent / noisy slices
 *  ([BLANK_AUDIO], (applause), [Music], ♪…♪). Strip them so a near-silent turn
 *  doesn't render as a fake line. Returns '' if nothing real is left. */
function cleanTranscript(text) {
    return String(text || '')
        .replace(/[\[(][^\])]*[\])]/g, ' ')   // [BLANK_AUDIO], (beeping), [Music]
        .replace(/♪+[^♪]*♪+/g, ' ')           // ♪ music ♪
        .replace(/\s+/g, ' ')
        .trim();
}

/** Plain-text transcript with speaker labels, for copy / download / handoff. */
function turnsToText(turns, hasSpeakers) {
    return turns.map((t) => {
        const prefix = hasSpeakers && t.speaker != null ? `${speakerLabel(t.speaker)}: ` : '';
        return prefix + t.text;
    }).join('\n\n');
}

// `chunk`/`stride` (seconds) drive long-form chunking for turns/audio that
// exceed Whisper's 30s window. distil wants shorter chunks (15s).
const SPECS = {
    fast: { ...M.asrBaseEn, label: 'Fast', chunk: 30, stride: 5, multilingual: false, note: 'whisper-base · English · ~145 MB' },
    best: { ...M.asrSmallEn, label: 'Best', chunk: 30, stride: 5, multilingual: false, note: 'whisper-small · English · best accuracy · WebGPU recommended' },
    turbo: { ...M.asrDistilSmall, label: 'Turbo', chunk: 15, stride: 3, multilingual: false, note: 'distil-whisper · English · ~6× faster, near-small quality' },
    multi: { ...M.asrBaseMulti, label: 'Multi', chunk: 30, stride: 5, multilingual: true, note: 'whisper-base · 99 languages (multilingual)' },
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
function toSRT(turns, hasSpeakers) {
    return turns.map((t, i) => {
        const prefix = hasSpeakers && t.speaker != null ? `[${speakerLabel(t.speaker)}] ` : '';
        return `${i + 1}\n${srtTime(t.start)} --> ${srtTime(t.end == null ? t.start + 2 : t.end)}\n${prefix}${t.text.trim()}\n`;
    }).join('\n');
}

export default function mount(host, ctx) {
    let tier = 'fast';
    let lang = 'auto';
    let identifySpeakers = true;
    const pipes = {};
    let diarizer = null; // lazy-loaded pyannote { model, processor }
    let recorder = null;
    let stream = null;
    let chunks = [];
    let recording = false;
    let busy = false;
    let starting = false;
    let destroyed = false;
    let lastTurns = null;    // grouped speaker turns (what we render)

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
        (v) => { tier = v; tierNote.textContent = SPECS[v].note; langField.style.display = SPECS[v].multilingual ? '' : 'none'; ensureModel().catch(() => {}); },
    );

    const langSelect = select(LANGUAGES.map((l) => ({ value: l, label: l === 'auto' ? 'Auto-detect' : l[0].toUpperCase() + l.slice(1) })), lang);
    langSelect.addEventListener('change', () => { lang = langSelect.value; });
    const langField = field('Language', langSelect);
    langField.style.display = 'none';

    // Speaker identification (diarization) toggle — on by default.
    const speakerToggle = el('input', { type: 'checkbox', class: 'sx-checkbox' });
    speakerToggle.checked = identifySpeakers;
    speakerToggle.addEventListener('change', () => { identifySpeakers = speakerToggle.checked; });
    const speakerField = el('label', { class: 'sx-toggle-row' },
        speakerToggle,
        el('span', {}, 'Identify speakers'),
        el('span', { class: 'sx-hint', style: { margin: '0 0 0 auto' } }, '+~6 MB'),
    );

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
        field('Speakers', speakerField, 'Label who is speaking, grouped into turns'),
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

    async function ensureDiarizer() {
        if (diarizer) return diarizer;
        const ld = loader('Loading speaker model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            diarizer = await loadAutoModel({ ...M.diarPyannote, modelClass: 'AutoModelForAudioFrameClassification' }, (p) => ld.progress(p));
            ld.remove();
        } catch (err) { ld.fail(err); throw err; }
        return diarizer;
    }

    /** Run pyannote diarization → array of { id, start, end }. */
    async function diarize(float32) {
        const { model, processor } = await ensureDiarizer();
        const inputs = await processor(float32);
        const { logits } = await model(inputs);
        const segments = processor.post_process_speaker_diarization(logits, float32.length)?.[0] || [];
        // Normalize: keep only real segments, sorted by start.
        return segments
            .filter((s) => s && isFinite(s.start) && isFinite(s.end) && s.end > s.start)
            .sort((a, b) => a.start - b.start);
    }

    /** Transcribe a 16kHz float32 buffer to plain text (NO timestamps — they
     *  break these ONNX exports). Chunks long audio so >30s turns aren't cut. */
    async function transcribe(asr, audio) {
        const opts = {};
        if (audio.length / SAMPLE_RATE > CHUNK_THRESHOLD_S) {
            opts.chunk_length_s = SPECS[tier].chunk;
            opts.stride_length_s = SPECS[tier].stride;
        }
        if (SPECS[tier].multilingual && lang && lang !== 'auto') { opts.language = lang; opts.task = 'transcribe'; }
        const out = await asr(audio, opts);
        return cleanTranscript(out?.text);
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
            const asr = await ensureModel();
            const secs = Math.round(float32.length / SAMPLE_RATE);
            const longHint = secs > 120 ? ' (long audio — WebGPU is much faster)' : '';

            // Try speaker identification first (best-effort): its time spans drive
            // the segmentation. If it fails or is off, we fall back to a single
            // whole-audio transcription shown as one block.
            let diar = null;
            if (identifySpeakers) {
                status.textContent = 'Identifying speakers…';
                try { diar = remapSpeakers(await diarize(float32)); }
                catch (_) { toast('Speaker ID unavailable — showing transcript only', 'info'); diar = null; }
                if (destroyed) return;
            }

            let turns;
            if (diar && diar.length) {
                // Transcribe each contiguous speaker turn from its own audio slice.
                const merged = mergeTurns(diar);
                turns = [];
                for (let i = 0; i < merged.length; i++) {
                    if (destroyed) return;
                    const m = merged[i];
                    status.textContent = `Transcribing turn ${i + 1} / ${merged.length}…${longHint}`;
                    const text = await transcribe(asr, sliceAudio(float32, m.start, m.end));
                    if (text) turns.push({ speaker: m.speaker, start: m.start, end: m.end, text });
                }
                turns = mergeConsecutive(turns);
            } else {
                // No speakers: one whole-audio transcription as a single block.
                status.textContent = `Transcribing ${secs > 90 ? Math.round(secs / 60) + ' min' : secs + 's'}…${longHint}`;
                const text = await transcribe(asr, float32);
                turns = text ? [{ speaker: null, start: 0, end: secs, text }] : [];
            }
            if (destroyed) return;

            lastTurns = turns;
            renderTranscript(turns, !!(diar && diar.length));
            status.textContent = 'Done.';
        } catch (err) {
            status.textContent = '';
            toast('Transcription failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false; recBtn.disabled = false;
        }
    }

    function renderTranscript(turns, hasSpeakers) {
        clear(outBody);
        outBody.classList.remove('sx-placeholder');
        if (!turns?.length) { outBody.append(el('div', { class: 'sx-muted' }, 'No speech detected.')); return; }
        const text = turns.map((t) => t.text).join(' ').trim();

        const plain = turnsToText(turns, hasSpeakers);
        const actions = el('div', { class: 'sx-row end', style: { marginBottom: '12px', flexWrap: 'wrap' } },
            copyButton(() => plain, 'Copy'),
            button('Download .txt', { variant: 'ghost', onClick: () => downloadBlob(new Blob([plain], { type: 'text/plain' }), 'transcript.txt') }),
            button('Download .srt', { variant: 'ghost', onClick: () => downloadBlob(new Blob([toSRT(turns, hasSpeakers)], { type: 'text/plain' }), 'transcript.srt') }),
            ctx.ui.button('Send to →', { variant: 'ghost', onClick: () => ctx.sendResultTo({ kind: 'text', data: plain, from: 'speech-to-text' }) }),
        );

        ctx.saveHistory({ studio: 'speech-to-text', title: text.slice(0, 60), text: plain });

        // One block per speaker turn: a colored speaker chip + timestamp header,
        // then the spoken text. This is the only output view.
        const speakerCount = hasSpeakers ? new Set(turns.map((t) => t.speaker)).size : 0;
        const rows = turns.map((t) => {
            const head = el('div', { class: 'sx-row', style: { alignItems: 'center', gap: '10px', marginBottom: '4px' } });
            if (hasSpeakers && t.speaker != null) {
                head.append(el('span', {
                    style: {
                        fontSize: '0.78rem', fontWeight: '600', color: '#0b0f16',
                        background: speakerColor(t.speaker), padding: '2px 9px', borderRadius: '999px',
                    },
                }, speakerLabel(t.speaker)));
            }
            head.append(el('span', { class: 'sx-mono', style: { color: 'var(--text-3)', fontSize: '0.78rem' } }, fmtTime(t.start)));
            return el('div', {
                style: hasSpeakers && t.speaker != null
                    ? { borderLeft: `3px solid ${speakerColor(t.speaker)}`, paddingLeft: '12px' }
                    : {},
            },
                head,
                el('div', { style: { color: 'var(--text-1)', lineHeight: '1.6' } }, t.text),
            );
        });

        const title = hasSpeakers
            ? `Transcript · ${speakerCount} speaker${speakerCount === 1 ? '' : 's'} · ${turns.length} turns`
            : `Transcript · ${turns.length} segments`;

        outBody.append(el('div', {}, actions,
            el('p', { class: 'sx-pane-title', style: { margin: '4px 0 14px' } }, title),
            el('div', { class: 'sx-stack' }, ...rows),
        ));
    }

    // Warm the currently-selected model on mount so the first run is instant.
    ensureModel().catch(() => {});

    return () => { destroyed = true; stopRecording(); releaseStream(); };
}
