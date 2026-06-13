// ============================================================
// NeuralBox Studio — bootstrap + shell + lifecycle
// ============================================================
import './styles/studio.css';
import * as runtime from './runtime.js';
import * as ui from './ui.js';
import { el, clear, button, badge, spinner } from './ui.js';
import { startRouter, navigate } from './router.js';
import { getStudio } from './registry.js';
import { renderHome } from './home.js';
import { pushRecent } from './state.js';

const { el: _e } = ui; // keep tree-shaker honest

const app = document.getElementById('app');
clear(app);

// ---- Persistent top bar -------------------------------------
const deviceChip = el('span', { class: 'top-device' }, '…');
const topbar = el('header', { class: 'studio-topbar' },
    el('button', { class: 'top-logo', type: 'button', title: 'Home', onClick: () => navigate('home') },
        el('span', { class: 'top-logo-mark', html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9 9h6v6H9z"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/></svg>' }),
        el('span', { class: 'top-logo-text' }, 'Neural', el('span', { class: 'grad' }, 'Box')),
    ),
    el('div', { class: 'top-right' },
        deviceChip,
        el('a', { class: 'top-link', href: 'https://github.com/huggingface/transformers.js', target: '_blank', rel: 'noopener', title: 'How it works' }, 'How it works'),
    ),
);

const studioBody = el('main', { id: 'studio-body', class: 'studio-body' });
app.append(topbar, studioBody);

// ---- Shared studio context ----------------------------------
const ctx = {
    runtime,
    ui,
    navigate,
    toast: ui.toast,
    hasWebGPU: runtime.hasWebGPU,
};

// ---- Lifecycle ----------------------------------------------
let cleanupFn = null;
let mountToken = 0;

async function unmountCurrent() {
    if (typeof cleanupFn === 'function') {
        try { await cleanupFn(); } catch (e) { console.warn('[studio] cleanup error', e); }
    }
    cleanupFn = null;
}

function studioHeader(studio) {
    return el('div', { class: 'studio-head', style: { '--accent': studio.accent } },
        button('All models', {
            variant: 'ghost',
            iconPath: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
            onClick: () => navigate('home'),
        }),
        el('div', { class: 'studio-head-main' },
            el('span', { class: 'studio-head-emoji' }, studio.emoji),
            el('div', {},
                el('h1', { class: 'studio-head-title' }, studio.title),
                el('p', { class: 'studio-head-tagline' }, studio.tagline),
            ),
        ),
        el('div', { class: 'studio-head-tags' },
            studio.badge ? badge(studio.badge, 'accent') : null,
            badge(studio.device === 'webgpu' ? 'WebGPU' : 'Any device', studio.device === 'webgpu' ? 'gpu' : 'ok'),
            el('span', { class: 'studio-head-size' }, studio.size),
        ),
    );
}

function errorCard(studio, err) {
    return el('div', { class: 'studio-error' },
        el('div', { class: 'studio-error-icon' }, '⚠️'),
        el('h3', {}, `Couldn't start ${studio.title}`),
        el('p', {}, String(err?.message || err || 'Unknown error')),
        el('p', { class: 'studio-error-hint' }, 'This usually means the model download was blocked or the device ran out of memory. Check your connection and try again.'),
        el('div', { class: 'studio-error-actions' },
            button('Retry', { variant: 'primary', onClick: () => navigate(studio.id) }),
            button('Back to models', { variant: 'ghost', onClick: () => navigate('home') }),
        ),
    );
}

async function handleRoute(routeId) {
    const token = ++mountToken;
    await unmountCurrent();
    if (token !== mountToken) return;
    window.scrollTo(0, 0);

    const studio = routeId === 'home' ? null : getStudio(routeId);

    if (!studio) {
        document.documentElement.style.setProperty('--accent', '#60a5fa');
        document.body.classList.remove('in-studio');
        await renderHome(studioBody, ctx);
        return;
    }

    document.documentElement.style.setProperty('--accent', studio.accent);
    document.body.classList.add('in-studio');
    pushRecent(studio.id).catch(() => {});

    const host = el('div', { class: 'studio-host' }, el('div', { class: 'studio-loading' }, spinner(), `Opening ${studio.title}…`));
    clear(studioBody);
    studioBody.append(el('div', { class: 'studio-view' }, studioHeader(studio), host));

    try {
        const mod = await studio.load();
        if (token !== mountToken) return;
        const mount = mod.default || mod.mount;
        if (typeof mount !== 'function') throw new Error('Studio module has no mount() export');
        clear(host);
        const cleanup = await mount(host, ctx);
        if (token !== mountToken) { if (typeof cleanup === 'function') cleanup(); return; }
        cleanupFn = cleanup;
    } catch (err) {
        if (token !== mountToken) return;
        console.error('[studio] mount failed', err);
        clear(host);
        host.append(errorCard(studio, err));
    }
}

// ---- Go ------------------------------------------------------
startRouter(handleRoute);

runtime.pickDevice().then((device) => {
    deviceChip.textContent = device === 'webgpu' ? '⚡ WebGPU' : '🧩 WASM';
    deviceChip.classList.add(device === 'webgpu' ? 'is-gpu' : 'is-wasm');
}).catch(() => { deviceChip.textContent = '🧩 WASM'; });
