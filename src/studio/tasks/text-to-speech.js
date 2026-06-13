// ============================================================
// Text to Speech (SpeechT5) — turn text into a spoken voice,
// synthesized entirely in the browser. Reference: text studios.
// ============================================================
import { el, clear, button, field, textarea, loader, badge, downloadBlob, toast } from '../ui.js';
import { loadPipeline, playPCM, pcmToWavBlob } from '../runtime.js';

// fp32 on BOTH devices — quantized SpeechT5 sounds noticeably worse.
const SPEC = { task: 'text-to-speech', model: 'Xenova/speecht5_tts', dtype: 'fp32' };
const SPK = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';

const DEFAULT_TEXT = 'Hello! This voice is being generated entirely inside your browser.';

const SAMPLES = [
    'The quick brown fox jumps over the lazy dog.',
    'Neural networks running locally — no servers, no waiting.',
    'Good morning! I hope you have a wonderful day ahead.',
];

export default function mount(host, ctx) {
    let tts = null;
    let busy = false;
    let lastURL = null;
    let lastBlob = null;

    // ---- DOM ----
    const input = textarea('Type anything you want spoken aloud…', DEFAULT_TEXT, 6);

    const sampleRow = el('div', { class: 'sx-row', style: { marginTop: '10px' } },
        el('span', { class: 'sx-muted' }, 'Try:'),
        ...SAMPLES.map((s, i) => button(`Sample ${i + 1}`, {
            variant: 'ghost',
            onClick: () => { input.value = s; },
        })),
    );

    const loaderSlot = el('div');
    const runBtn = button('Speak', { variant: 'primary', full: true, onClick: () => run() });

    const placeholder = el('div', { class: 'sx-placeholder' },
        el('div', { class: 'ph-emoji' }, '🔊'),
        el('div', {}, 'Your synthesized voice will appear here'),
    );
    const audioEl = el('audio', { controls: true, style: { width: '100%', display: 'none' } });
    const statusLine = el('div', { class: 'sx-muted', style: { marginTop: '12px' } }, '');
    const downloadSlot = el('div', { class: 'sx-row end', style: { marginTop: '12px' } });
    const outBody = el('div', {}, placeholder, audioEl, statusLine, downloadSlot);

    const controls = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '✍️ Text'),
        field('', input),
        sampleRow,
        el('div', { class: 'sx-row', style: { marginTop: '12px' } }, badge('SpeechT5', 'accent')),
        el('div', { style: { height: '12px' } }),
        runBtn,
        loaderSlot,
        el('p', { class: 'sx-muted', style: { marginTop: '12px', fontSize: '0.82rem' } },
            'First run downloads ~120MB+ of model weights, cached afterward. fp32 for clean audio.'),
    );

    const output = el('div', { class: 'sx-pane' },
        el('p', { class: 'sx-pane-title' }, '🔊 Voice' ),
        outBody,
    );

    host.append(el('div', { class: 'sx-split' }, controls, output));

    // ---- Logic ----
    async function ensureModel() {
        if (tts) return tts;
        const ld = loader('Loading SpeechT5 voice');
        clear(loaderSlot); loaderSlot.append(ld.el);
        try { tts = await loadPipeline(SPEC, (p) => ld.progress(p)); ld.remove(); }
        catch (err) { ld.fail(err); throw err; }
        return tts;
    }

    function revoke() {
        if (lastURL) { try { URL.revokeObjectURL(lastURL); } catch (_) {} lastURL = null; }
    }

    async function run() {
        const text = input.value.trim();
        if (!text) { toast('Enter some text to speak first', 'info'); return; }
        if (busy) return;
        busy = true;
        runBtn.disabled = true;
        statusLine.textContent = '';
        try {
            await ensureModel();
            const out = await tts(text, { speaker_embeddings: SPK }); // { audio:Float32Array, sampling_rate:16000 }
            const { audio, sampling_rate } = out;

            // Playback MUST happen inside this user-gesture-driven handler.
            playPCM(audio, sampling_rate);

            // Build a WAV blob for the <audio> element + download.
            revoke();
            lastBlob = pcmToWavBlob(audio, sampling_rate);
            lastURL = URL.createObjectURL(lastBlob);
            audioEl.src = lastURL;
            audioEl.style.display = '';
            placeholder.style.display = 'none';

            const seconds = (audio.length / sampling_rate).toFixed(1);
            statusLine.textContent = `Synthesized ${seconds}s of audio at ${sampling_rate.toLocaleString()} Hz.`;

            clear(downloadSlot);
            downloadSlot.append(button('Download WAV', {
                variant: 'ghost',
                iconPath: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
                onClick: () => { if (lastBlob) downloadBlob(lastBlob, 'speech.wav'); },
            }));
        } catch (err) {
            toast('Speech synthesis failed: ' + (err?.message || err), 'error');
        } finally {
            busy = false;
            runBtn.disabled = false;
        }
    }

    return () => { revoke(); };
}
