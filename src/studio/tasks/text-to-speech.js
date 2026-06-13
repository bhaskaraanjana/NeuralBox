// ============================================================
// Text to Speech (Kokoro-82M) — natural neural voice synthesis.
// Multiple voices, adjustable speed, and long-text support via
// sentence chunking + audio concatenation.
// ============================================================
import { el, clear, button, field, textarea, select, loader, downloadBlob, badge, toast } from '../ui.js';
import { pickDevice, splitForTTS, concatFloat32, pcmToWavBlob, aggregateProgress } from '../runtime.js';
import { KokoroTTS } from 'kokoro-js';
import { M } from '../models.js';

const MODEL = M.ttsKokoro.model;
const RATE = 24000; // Kokoro outputs 24kHz

// A curated subset of Kokoro's 28 voices (US/UK, female/male).
const VOICES = [
    { value: 'af_heart', label: '🇺🇸 Heart (F) — warm' },
    { value: 'af_bella', label: '🇺🇸 Bella (F)' },
    { value: 'af_nicole', label: '🇺🇸 Nicole (F) — soft' },
    { value: 'af_aoede', label: '🇺🇸 Aoede (F)' },
    { value: 'am_michael', label: '🇺🇸 Michael (M)' },
    { value: 'am_fenrir', label: '🇺🇸 Fenrir (M) — deep' },
    { value: 'am_puck', label: '🇺🇸 Puck (M)' },
    { value: 'bf_emma', label: '🇬🇧 Emma (F)' },
    { value: 'bf_isabella', label: '🇬🇧 Isabella (F)' },
    { value: 'bm_george', label: '🇬🇧 George (M)' },
    { value: 'bm_fable', label: '🇬🇧 Fable (M)' },
];

const SAMPLE = 'Hello! This voice is being generated entirely inside your browser — no server, no sign-up. Paste a whole paragraph and I will read it for you in a natural-sounding voice.';

export default function mount(host, ctx) {
    let tts = null;
    let voice = 'af_heart';
    let speed = 1.0;
    let busy = false;

    const input = textarea('Type or paste anything — a sentence, a paragraph, an article…', SAMPLE, 7);

    const voiceSelect = select(VOICES, voice);
    voiceSelect.addEventListener('change', () => { voice = voiceSelect.value; });

    const speedLabel = el('span', {}, '1.0×');
    const speedSlider = el('input', { type: 'range', class: 'sx-input', min: '0.6', max: '1.4', step: '0.1', value: '1.0' });
    speedSlider.addEventListener('input', () => { speed = parseFloat(speedSlider.value); speedLabel.textContent = `${speed.toFixed(1)}×`; });

    const loaderSlot = el('div');
    const speakBtn = button('Speak', { variant: 'primary', full: true, onClick: () => speak() });
    const status = el('div', { class: 'sx-muted', style: { marginTop: '10px', minHeight: '20px' } }, '');

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Text'),
        field('', input),
        field('Voice', voiceSelect),
        field('Speed', el('div', { class: 'sx-row' }, speedSlider, speedLabel)),
        el('div', { class: 'sx-row', style: { marginBottom: '12px' } }, badge('Kokoro-82M', 'accent'), el('span', { class: 'sx-muted' }, 'natural voice · ~86 MB')),
        speakBtn,
        status,
        loaderSlot,
    );

    const player = el('audio', { controls: true, style: { width: '100%', display: 'none', marginTop: '4px' } });
    const dlSlot = el('div', { class: 'sx-row', style: { marginTop: '12px' } });
    const outBody = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🔊'),
        el('div', {}, 'Your generated speech will play here'),
    );
    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🔊 Audio'),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    async function ensureTTS() {
        if (tts) return tts;
        const device = await pickDevice();
        const dtype = device === 'webgpu' ? 'fp16' : 'q8';
        const ld = loader('Loading Kokoro voice model');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try {
            tts = await KokoroTTS.from_pretrained(MODEL, { dtype, device, progress_callback: aggregateProgress((p) => ld.progress(p)) });
            ld.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return tts;
    }

    async function speak() {
        const text = input.value.trim();
        if (!text) { toast('Type something to speak first', 'info'); return; }
        if (busy) return;
        busy = true; speakBtn.disabled = true;
        try {
            const engine = await ensureTTS();
            const chunks = splitForTTS(text, 280);
            const parts = [];
            for (let i = 0; i < chunks.length; i++) {
                status.textContent = chunks.length > 1 ? `Synthesizing ${i + 1} / ${chunks.length}…` : 'Synthesizing…';
                const audio = await engine.generate(chunks[i], { voice, speed });
                parts.push(audio.audio); // Float32Array @ 24kHz
            }
            const merged = concatFloat32(parts, Math.round(RATE * 0.12)); // 120ms gap between sentences
            const blob = pcmToWavBlob(merged, RATE);
            const url = URL.createObjectURL(blob);

            clear(outBody);
            outBody.classList.remove('sx-placeholder');
            player.style.display = '';
            player.src = url;
            clear(dlSlot);
            dlSlot.append(button('Download .wav', { variant: 'ghost', onClick: () => downloadBlob(blob, 'neuralbox-speech.wav') }));
            outBody.append(
                el('div', { class: 'sx-muted', style: { marginBottom: '10px' } }, `${VOICES.find((v) => v.value === voice)?.label || voice} · ${(merged.length / RATE).toFixed(1)}s`),
                player, dlSlot,
            );
            status.textContent = 'Done.';
            try { await player.play(); } catch (_) { /* autoplay may be blocked; user can press play */ }
        } catch (err) {
            status.textContent = '';
            toast('Speech synthesis failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false; speakBtn.disabled = false;
        }
    }

    // Consume a piped text hand-off (prefill only; do not auto-run).
    const _h = ctx.takeHandoff("text");
    if (_h && _h.data) { input.value = _h.data; }

    // Warm the Kokoro model on mount so the download runs while the user
    // prepares input — the first Speak click is then instant. The loader
    // surfaces progress/errors, and ensureTTS() dedupes via the pipeline cache.
    ensureTTS().catch(() => {});

    return () => { /* model cache persists in module scope */ };
}
