// ============================================================
// NeuralBox Studio — pipeline + history panels.
// ============================================================
import { el, button, copyButton, modal, toast } from './ui.js';
import { setHandoff } from './handoff.js';
import { handoffTargets, getStudio } from './registry.js';
import { getHistory, clearHistory } from './state.js';

/**
 * Offer to send a result ({kind:'text'|'image', data, from}) to a compatible
 * studio as its input. Shows a chooser, then hands off + navigates.
 */
export function sendResultTo(payload, navigate) {
    const targets = handoffTargets(payload.kind, payload.from);
    if (!targets.length) { toast('No studio can take this as input', 'info'); return; }
    const body = el('div', { class: 'sx-stack' },
        el('p', { class: 'sx-muted', style: { marginBottom: '4px' } }, `Use this ${payload.kind} as the input for:`),
    );
    const m = modal('Send result to', body);
    for (const t of targets) {
        body.append(button(`${t.emoji}  ${t.title}`, {
            variant: 'ghost', full: true,
            onClick: () => { setHandoff(payload); m.close(); navigate(t.id); },
        }));
    }
}

/** History viewer: saved text results, with copy + reuse. */
export async function openHistoryModal(navigate) {
    const body = el('div');
    const m = modal('History', body);
    body.append(el('div', { class: 'sx-muted' }, 'Loading…'));

    const hist = await getHistory();
    body.replaceChildren();
    if (!hist.length) {
        body.append(el('div', { class: 'sx-placeholder', style: { minHeight: '140px' } },
            el('div', { class: 'ph-emoji' }, '🗂️'),
            el('div', {}, 'No saved results yet.'),
            el('div', { class: 'sx-muted', style: { fontSize: '0.84rem' } }, 'Captions, transcripts, summaries, translations and chat replies are saved here automatically.'),
        ));
        return;
    }

    body.append(el('div', { class: 'sx-row end', style: { marginBottom: '10px' } },
        button('Clear history', { variant: 'danger', onClick: async () => { await clearHistory(); m.close(); } })));

    const list = el('div', { class: 'sx-stack', style: { maxHeight: '58vh', overflowY: 'auto' } });
    for (const h of hist) {
        const studio = getStudio(h.studio);
        list.append(el('div', { class: 'sx-card', style: { padding: '12px' } },
            el('div', { class: 'sx-row', style: { justifyContent: 'space-between', gap: '8px' } },
                el('strong', { style: { color: 'var(--text-0)', fontSize: '0.9rem' } }, `${studio?.emoji || ''} ${studio?.title || h.studio}`),
                el('div', { class: 'sx-row' },
                    copyButton(() => h.text, 'Copy'),
                    studio ? button('Open', { variant: 'ghost', onClick: () => { m.close(); navigate(h.studio); } }) : null,
                ),
            ),
            el('div', { class: 'sx-muted', style: { marginTop: '8px', whiteSpace: 'pre-wrap', lineHeight: '1.5' } }, h.text.slice(0, 400) + (h.text.length > 400 ? '…' : '')),
        ));
    }
    body.append(list);
}
