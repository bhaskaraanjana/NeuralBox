// ============================================================
// Mini Chat — a tiny LLM (Qwen2.5 / SmolLM2 / Llama-3.2) that
// runs and STREAMS entirely in-browser, on any device.
// ============================================================
import { el, clear, button, segmented, textarea, loader, badge, toast } from '../ui.js';
import { loadPipeline, loadLib, pickDevice } from '../runtime.js';
import { M } from '../models.js';

const TIERS = {
    lite: { label: 'Lite', model: M.chatLite.model, size: '~270 MB', dtype: M.chatLite.dtype },
    balanced: { label: 'Balanced', model: M.chatBalanced.model, size: '~480 MB', dtype: M.chatBalanced.dtype },
    smart: { label: 'Smart', model: M.chatSmart.model, size: '~750 MB', dtype: M.chatSmart.dtype },
};
const SYSTEM = 'You are NeuralBox Mini, a small AI assistant running entirely in the user\'s browser tab with no server. Be concise, warm, and genuinely helpful.';

export default function mount(host, ctx) {
    let tier = 'balanced';
    let generator = null;
    let loadedModel = null;
    let messages = [{ role: 'system', content: SYSTEM }];
    let generating = false;
    let stopRequested = false;

    const log = el('div', { class: 'sx-chat-log' });
    const input = textarea('Ask anything… it runs locally', '', 1);
    input.style.minHeight = '46px';
    const sendBtn = button('Send', { variant: 'primary', onClick: onSend });
    const stopBtn = button('Stop', { variant: 'danger', onClick: () => { stopRequested = true; } });
    stopBtn.style.display = 'none';

    const tierPicker = segmented(
        Object.entries(TIERS).map(([k, v]) => ({ value: k, label: v.label })),
        tier,
        (v) => { tier = v; sizeBadge.textContent = TIERS[v].size; if (loadedModel && loadedModel !== TIERS[v].model) { generator = null; loadedModel = null; addNote(`Switched to ${TIERS[v].label} — it will load on your next message.`); } ensureModel().catch(() => {}); },
    );
    const sizeBadge = el('span', { class: 'sx-muted' }, TIERS[tier].size);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    });

    const pane = el('div', { class: 'sx-pane' },
        el('div', { class: 'sx-row', style: { justifyContent: 'space-between', marginBottom: '14px' } },
            el('div', { class: 'sx-row' }, el('span', { class: 'sx-pane-title', style: { margin: 0 } }, '🤖 Model'), tierPicker),
            el('div', { class: 'sx-row' }, sizeBadge, badge('on-device', 'ok')),
        ),
        el('div', { class: 'sx-chat' }, log, el('div', { class: 'sx-chat-input' }, input, sendBtn, stopBtn)),
    );
    host.append(pane);

    addNote('Pick a model size and say hi. The first message downloads the model (cached afterward), then everything runs offline in this tab.');

    // ---- UI helpers ----
    function bubble(role, text = '') {
        const b = el('div', { class: `sx-msg sx-msg-${role === 'user' ? 'user' : 'bot'}` }, text);
        log.append(b);
        log.scrollTop = log.scrollHeight;
        return b;
    }
    function addNote(text) {
        log.append(el('div', { class: 'sx-muted', style: { textAlign: 'center', padding: '8px 12px', fontSize: '0.82rem' } }, text));
        log.scrollTop = log.scrollHeight;
    }

    async function ensureModel() {
        const spec = TIERS[tier];
        if (generator && loadedModel === spec.model) return generator;
        const wrap = el('div', { style: { alignSelf: 'center', width: '100%', maxWidth: '420px' } });
        const ld = loader(`Loading ${spec.label} model`);
        wrap.append(ld.el); log.append(wrap); log.scrollTop = log.scrollHeight;
        try {
            generator = await loadPipeline({ task: 'text-generation', model: spec.model, dtype: spec.dtype }, (p) => ld.progress(p));
            loadedModel = spec.model;
            wrap.remove();
        } catch (err) {
            ld.fail(err);
            throw err;
        }
        return generator;
    }

    async function onSend() {
        if (generating) return;
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        messages.push({ role: 'user', content: text });
        bubble('user', text);

        generating = true; stopRequested = false;
        sendBtn.style.display = 'none'; stopBtn.style.display = '';
        const botEl = bubble('bot', '');
        botEl.append(el('span', { class: 'sx-spinner' }));

        try {
            const gen = await ensureModel();
            const { TextStreamer } = await loadLib();
            let acc = '';
            let first = true;
            const streamer = new TextStreamer(gen.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (t) => {
                    if (stopRequested) throw new Error('__stop__');
                    if (first) { botEl.textContent = ''; first = false; }
                    acc += t;
                    botEl.textContent = acc;
                    log.scrollTop = log.scrollHeight;
                },
            });
            const out = await gen(messages, { max_new_tokens: 512, do_sample: false, temperature: 0.7, streamer });
            const reply = out?.[0]?.generated_text?.at?.(-1)?.content ?? acc;
            botEl.textContent = reply.trim() || acc.trim() || '…';
            messages.push({ role: 'assistant', content: botEl.textContent });
        } catch (err) {
            if (String(err?.message).includes('__stop__')) {
                botEl.textContent = (botEl.textContent || '').replace(/\s*$/, '') + ' ⏹';
                messages.push({ role: 'assistant', content: botEl.textContent });
            } else {
                botEl.textContent = '';
                botEl.append(el('span', { style: { color: 'var(--err)' } }, 'Error: ' + (err?.message || err)));
                toast('Generation failed', 'error');
            }
        } finally {
            generating = false;
            sendBtn.style.display = ''; stopBtn.style.display = 'none';
            input.focus();
        }
    }

    // ---- pipeline hand-off: prefill chat input from a piped text result (do NOT auto-send) ----
    const _h = ctx.takeHandoff("text");
    if (_h && _h.data) { input.value = _h.data; }

    // ---- warm: start loading the currently-selected model on mount so the first run is instant ----
    ensureModel().catch(() => {});

    return () => { /* pipeline cache persists in runtime; nothing to tear down */ };
}
