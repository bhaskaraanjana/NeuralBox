// ============================================================
// NeuralBox Studio — shared studio helpers.
// Collapses the repeated tier-picker + per-tier pipeline cache +
// loader boilerplate that every multi-tier studio used to copy.
// @typedef {import('./types.js').ModelTier} ModelTier
// ============================================================
import { el, field, segmented, loader, clear } from './ui.js';
import { loadPipeline, pickDevice } from './runtime.js';

/**
 * A short download-size + device guidance string for a model spec, e.g.
 * "≈ 84 MB · 🧩 WASM (slower — WebGPU is much faster)".
 * @param {{size?: string}} spec
 */
export async function deviceHint(spec) {
    const size = spec?.size ? `≈ ${String(spec.size).replace(/^~/, '')} download` : '';
    let device = 'wasm';
    try { device = await pickDevice(); } catch (_) {}
    const heavy = /GB|[3-9]\d\d MB|[1-9]\d{3} MB/.test(spec?.size || '');
    const dev = device === 'webgpu' ? '⚡ WebGPU' : `🧩 WASM${heavy ? ' (slower — WebGPU is much faster)' : ''}`;
    return [size, dev].filter(Boolean).join(' · ');
}

/**
 * A quality-tier picker with a built-in per-tier pipeline cache + loader.
 *
 * @param {Object<string, ModelTier>} tiers - { key: { label, spec } } (spec from models.js M).
 * @param {HTMLElement} loaderSlot - where the download loader renders.
 * @param {{label?:string, hint?:string, initial?:string}} [opts]
 * @returns {{ el: HTMLElement, key: string, spec: () => Object,
 *   ensure: (title?: string) => Promise<any>, onSwitch: (cb:(k:string)=>void)=>void }}
 */
export function createTierPicker(tiers, loaderSlot, { label = 'Quality', hint = '', initial, warm = false } = {}) {
    const keys = Object.keys(tiers);
    let key = initial && tiers[initial] ? initial : keys[0];
    const cache = {}; // key -> in-flight/resolved load promise (dedupes warm + run)
    const ready = {}; // key -> true once loaded
    let switchCb = null;

    const sizeNote = el('p', { class: 'sx-hint', style: { marginTop: '4px' } }, '');
    const updateNote = () => {
        const sz = tiers[key].spec?.size;
        sizeNote.textContent = sz ? `≈ ${String(sz).replace(/^~/, '')} download` : '';
    };

    function ensure(title) {
        const k = key;
        if (cache[k]) return cache[k];
        const ld = loader(title || `Loading ${tiers[k].label}`);
        clear(loaderSlot); loaderSlot.append(ld.el);
        cache[k] = loadPipeline(tiers[k].spec, (p) => ld.progress(p)).then(
            (pipe) => { ld.remove(); ready[k] = true; return pipe; },
            (err) => { ld.fail(err); delete cache[k]; throw err; },
        );
        return cache[k];
    }

    const seg = segmented(
        keys.map((k) => ({ value: k, label: tiers[k].label })),
        key,
        (k) => { key = k; updateNote(); if (warm) ensure().catch(() => {}); switchCb?.(k); },
    );
    updateNote();
    // Warm the initial tier on open so the first run is instant.
    if (warm) ensure().catch(() => {});

    return {
        el: el('div', {}, field(label, seg, hint), sizeNote),
        get key() { return key; },
        spec() { return tiers[key].spec; },
        loaded() { return !!ready[key]; },
        ensure,
        onSwitch(cb) { switchCb = cb; },
    };
}

/**
 * Run an async task while showing a loader in a slot; cleans up after.
 * Returns the task's result, or rethrows after surfacing the error on the loader.
 */
export async function runWithLoader(loaderSlot, title, task) {
    const ld = loader(title);
    clear(loaderSlot); loaderSlot.append(ld.el);
    try { const out = await task((p) => ld.progress(p)); ld.remove(); return out; }
    catch (err) { ld.fail(err); throw err; }
}
