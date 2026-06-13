// ============================================================
// NeuralBox Studio — on-device storage panel
// See how much model cache is stored locally and clear it.
// ============================================================
import { el, clear, button, modal, toast } from './ui.js';
import { clearModelCache } from './runtime.js';

function fmtBytes(b) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return `${(b / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

async function cacheStats() {
    let usage = 0, quota = 0, files = 0;
    try { const est = await navigator.storage?.estimate?.(); usage = est?.usage || 0; quota = est?.quota || 0; } catch (_) {}
    try {
        if (typeof caches !== 'undefined') {
            const names = await caches.keys();
            for (const n of names) {
                if (/transformers|onnx/i.test(n)) {
                    const c = await caches.open(n);
                    files += (await c.keys()).length;
                }
            }
        }
    } catch (_) {}
    return { usage, quota, files };
}

async function clearCaches() {
    clearModelCache();
    try {
        if (typeof caches !== 'undefined') {
            const names = await caches.keys();
            await Promise.all(names.filter((n) => /transformers|onnx/i.test(n)).map((n) => caches.delete(n)));
        }
    } catch (_) {}
}

function statRow(label, value) {
    return el('div', { class: 'sx-stat-row' },
        el('span', { class: 'sx-muted' }, label),
        el('strong', { class: 'sx-mono', style: { color: 'var(--text-0)' } }, value),
    );
}

export async function openStorageModal() {
    const body = el('div');
    modal('On-device storage', body);
    clear(body); body.append(el('div', { class: 'sx-muted' }, 'Reading storage…'));

    // Re-render the whole body so every stat (files, bytes, bar) refreshes after a clear.
    async function render() {
        const s = await cacheStats();
        const usedPct = s.quota ? Math.min(100, Math.round((s.usage / s.quota) * 100)) : 0;
        clear(body);
        body.append(
            el('p', { class: 'sx-result', style: { marginBottom: '16px' } },
                'NeuralBox caches model files in your browser so studios load instantly and keep working offline after the first use.'),
            statRow('Cached model files', String(s.files)),
            statRow('Storage used', fmtBytes(s.usage)),
            s.quota ? statRow('Storage available', fmtBytes(s.quota)) : null,
            s.quota ? el('div', { class: 'sx-loader-track', style: { marginTop: '10px' } },
                el('div', { class: 'sx-loader-fill', style: { width: `${usedPct}%` } })) : null,
            el('div', { class: 'sx-row', style: { marginTop: '20px' } },
                button('Clear cached models', {
                    variant: 'danger',
                    onClick: async (e) => {
                        const btn = e.currentTarget;
                        btn.disabled = true;
                        await clearCaches();
                        toast('Cleared cached models — they will re-download on next use', 'success');
                        await render();
                    },
                }),
            ),
            el('p', { class: 'sx-hint', style: { marginTop: '10px' } },
                'Clearing frees space; models re-download next time you open a studio. Your pinned favorites and recents are kept.'),
        );
    }

    await render();
}
