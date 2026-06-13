// ============================================================
// NeuralBox Studio — shared studio helpers.
// Collapses the repeated tier-picker + per-tier pipeline cache +
// loader boilerplate that every multi-tier studio used to copy.
// @typedef {import('./types.js').ModelTier} ModelTier
// ============================================================
import { field, segmented, loader, clear } from './ui.js';
import { loadPipeline } from './runtime.js';

/**
 * A quality-tier picker with a built-in per-tier pipeline cache + loader.
 *
 * @param {Object<string, ModelTier>} tiers - { key: { label, spec } } (spec from models.js M).
 * @param {HTMLElement} loaderSlot - where the download loader renders.
 * @param {{label?:string, hint?:string, initial?:string}} [opts]
 * @returns {{ el: HTMLElement, key: string, spec: () => Object,
 *   ensure: (title?: string) => Promise<any>, onSwitch: (cb:(k:string)=>void)=>void }}
 */
export function createTierPicker(tiers, loaderSlot, { label = 'Quality', hint = '', initial } = {}) {
    const keys = Object.keys(tiers);
    let key = initial && tiers[initial] ? initial : keys[0];
    const cache = {};
    let switchCb = null;

    const seg = segmented(
        keys.map((k) => ({ value: k, label: tiers[k].label })),
        key,
        (k) => { key = k; switchCb?.(k); },
    );

    return {
        el: field(label, seg, hint),
        get key() { return key; },
        spec() { return tiers[key].spec; },
        loaded() { return !!cache[key]; },
        async ensure(title) {
            if (cache[key]) return cache[key];
            const ld = loader(title || `Loading ${tiers[key].label}`);
            clear(loaderSlot); loaderSlot.append(ld.el);
            try { cache[key] = await loadPipeline(tiers[key].spec, (p) => ld.progress(p)); ld.remove(); }
            catch (err) { ld.fail(err); throw err; }
            return cache[key];
        },
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
