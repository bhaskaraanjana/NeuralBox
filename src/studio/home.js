// ============================================================
// NeuralBox Studio — Home / launcher gallery
// ============================================================
import { el, clear, badge } from './ui.js';
import { CATEGORIES, STUDIOS, studiosByCategory } from './registry.js';

function studioCard(studio, ctx, index = 0) {
    const tags = el('div', { class: 'home-card-tags' },
        studio.badge ? badge(studio.badge, 'accent') : null,
        badge(studio.device === 'webgpu' ? 'WebGPU' : 'Any device', studio.device === 'webgpu' ? 'gpu' : 'ok'),
        el('span', { class: 'home-card-size' }, studio.size),
    );
    const card = el('button', {
        class: 'home-card',
        type: 'button',
        style: { '--accent': studio.accent, '--i': String(index) },
        'data-search': `${studio.title} ${studio.tagline} ${studio.category} ${studio.badge || ''}`.toLowerCase(),
        onClick: () => ctx.navigate(studio.id),
    },
        el('div', { class: 'home-card-glow' }),
        el('div', { class: 'home-card-emoji' }, studio.emoji),
        el('div', { class: 'home-card-body' },
            el('h3', { class: 'home-card-title' }, studio.title),
            el('p', { class: 'home-card-tagline' }, studio.tagline),
            tags,
        ),
        el('span', { class: 'home-card-arrow', html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' }),
    );
    return card;
}

export async function renderHome(root, ctx) {
    clear(root);

    const deviceChip = el('span', { class: 'home-chip' }, 'Detecting hardware…');
    const hero = el('header', { class: 'home-hero' },
        el('div', { class: 'home-hero-badge' }, '🧠 100% on-device · no server · no sign-up'),
        el('h1', { class: 'home-hero-title' }, 'Run ', el('span', { class: 'grad' }, 'any AI model'), el('br'), 'in your browser.'),
        el('p', { class: 'home-hero-sub' },
            'Object detection, depth, segmentation, speech, translation, chat and more — every model runs locally on your device. Nothing you upload ever leaves this tab.'),
        el('div', { class: 'home-hero-meta' },
            deviceChip,
            el('span', { class: 'home-chip' }, `${STUDIOS.length} models`),
            el('span', { class: 'home-chip' }, 'Works on phones too'),
        ),
    );

    const search = el('input', { class: 'home-search', type: 'search', placeholder: '🔎  Search models — try "detect", "voice", "translate"…' });
    const sections = el('div', { class: 'home-sections' });

    let activeCat = 'all';
    let currentFilter = '';

    // Category quick-filter pills.
    const pills = el('div', { class: 'home-pills' });
    const pillDefs = [{ id: 'all', label: 'All', emoji: '✨' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji }))];
    const pillEls = [];
    pillDefs.forEach((p) => {
        const pill = el('button', {
            class: `home-pill${p.id === 'all' ? ' active' : ''}`,
            type: 'button',
            onClick: () => {
                activeCat = p.id;
                pillEls.forEach((x) => x.classList.toggle('active', x === pill));
                build();
            },
        }, el('span', {}, p.emoji), p.label);
        pillEls.push(pill);
    });
    pills.append(...pillEls);

    function build() {
        clear(sections);
        const q = currentFilter.trim().toLowerCase();
        let total = 0;
        for (const cat of CATEGORIES) {
            if (activeCat !== 'all' && cat.id !== activeCat) continue;
            const items = studiosByCategory(cat.id)
                .filter((s) => !q || `${s.title} ${s.tagline} ${s.category} ${s.badge || ''}`.toLowerCase().includes(q));
            if (!items.length) continue;
            total += items.length;
            const grid = el('div', { class: 'home-grid' }, ...items.map((s, i) => studioCard(s, ctx, i)));
            sections.append(el('section', { class: 'home-section' },
                el('div', { class: 'home-section-head' },
                    el('h2', { class: 'home-section-title' }, el('span', { class: 'home-section-emoji' }, cat.emoji), cat.label),
                    el('span', { class: 'home-section-blurb' }, cat.blurb),
                ),
                grid,
            ));
        }
        if (!total) {
            sections.append(el('div', { class: 'home-empty' },
                el('div', { class: 'home-empty-emoji' }, '🔍'),
                el('div', {}, q ? `No models match “${currentFilter}”.` : 'No models in this category.'),
            ));
        }
    }

    search.addEventListener('input', () => { currentFilter = search.value; build(); });
    build();

    root.append(el('div', { class: 'home' },
        hero,
        el('div', { class: 'home-searchbar' }, search, pills),
        sections,
        el('footer', { class: 'home-footer' },
            'NeuralBox · powered by ',
            el('a', { href: 'https://github.com/huggingface/transformers.js', target: '_blank', rel: 'noopener' }, 'transformers.js'),
            ' + ',
            el('a', { href: 'https://github.com/mlc-ai/web-llm', target: '_blank', rel: 'noopener' }, 'WebLLM'),
            ' · your data stays on your device.',
        ),
    ));

    // Fill in the live backend once probed.
    try {
        const device = await ctx.runtime.pickDevice();
        deviceChip.textContent = device === 'webgpu' ? '⚡ WebGPU accelerated' : '🧩 WASM (works anywhere)';
        deviceChip.classList.add(device === 'webgpu' ? 'chip-gpu' : 'chip-wasm');
    } catch (_) {
        deviceChip.textContent = '🧩 WASM ready';
    }
}
