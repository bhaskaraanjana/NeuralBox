// ============================================================
// Pro Chat — the full original NeuralBox WebLLM assistant
// (RAG, voice, vision, web search), embedded via same-origin
// iframe so it keeps every existing feature untouched.
// ============================================================
import { el, button, badge } from '../ui.js';
import { hasWebGPU } from '../runtime.js';

export default function mount(host, ctx) {
    const gpu = hasWebGPU();

    const notice = !gpu
        ? el('div', { class: 'sx-card', style: { borderColor: 'color-mix(in srgb, var(--warn) 40%, transparent)', marginBottom: '14px' } },
            el('div', { class: 'sx-row' }, el('span', { style: { fontSize: '1.4rem' } }, '⚠️'),
                el('div', {},
                    el('strong', { style: { color: 'var(--text-0)' } }, 'WebGPU not detected'),
                    el('p', { class: 'sx-muted', style: { margin: '4px 0 0' } },
                        'Pro Chat runs a full LLM on your GPU and needs WebGPU (latest Chrome/Edge, or Firefox/Safari with it enabled). On this device, try ',
                        el('a', { href: '#/mini-chat', onclick: () => ctx.navigate('mini-chat') }, 'Mini Chat'),
                        ' instead — it works anywhere.'),
                )))
        : null;

    const frame = el('iframe', {
        class: 'sx-iframe',
        src: '/chat.html',
        allow: 'microphone; camera; clipboard-write',
        title: 'NeuralBox Pro Chat',
    });

    host.append(
        el('div', { class: 'sx-row', style: { justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' } },
            el('div', { class: 'sx-row' },
                badge('WebLLM', 'gpu'),
                el('span', { class: 'sx-muted' }, 'The complete assistant: model picker, RAG, web search, voice, and vision.'),
            ),
            button('Open in full tab ↗', { variant: 'ghost', onClick: () => window.open('/chat.html', '_blank', 'noopener') }),
        ),
        notice,
        el('div', { class: 'sx-iframe-wrap' }, frame),
    );
}
