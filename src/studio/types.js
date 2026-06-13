// ============================================================
// NeuralBox Studio — shared JSDoc typedefs.
// No runtime code: this file documents the contracts so editors
// give autocomplete + shape-checking with no TypeScript build step.
// Import nothing from here; the @typedefs are project-global.
// ============================================================

/**
 * A transformers.js pipeline/model spec resolved by runtime.loadPipeline().
 * @typedef {Object} ModelSpec
 * @property {string} task - transformers.js pipeline task (e.g. 'object-detection').
 * @property {string} model - exact Hugging Face repo id (must have ONNX weights).
 * @property {string|{webgpu?:string,wasm?:string}} [dtype] - quantization; object form picks per device.
 * @property {'auto'|'webgpu'|'wasm'} [device] - force a backend (default: auto).
 * @property {Object} [options] - extra options forwarded to pipeline().
 */

/**
 * One selectable quality tier within a studio.
 * @typedef {Object} ModelTier
 * @property {string} label - human label shown in the picker (e.g. 'Accurate').
 * @property {ModelSpec} spec - the model to load for this tier.
 * @property {string} [size] - approx download size hint (e.g. '~84 MB').
 * @property {string} [queryPrefix] - embeddings only: prefix prepended to the query.
 */

/**
 * Normalized model-load progress (see runtime.aggregateProgress).
 * @typedef {Object} ProgressEvent
 * @property {string} status - 'initiate'|'download'|'progress'|'done'|'ready'.
 * @property {number} pct - aggregated 0..100.
 * @property {string} [file]
 * @property {number} [loaded]
 * @property {number} [total]
 * @property {boolean} [cached]
 */

/**
 * Services handed to every studio's mount().
 * @typedef {Object} StudioContext
 * @property {typeof import('./runtime.js')} runtime - the model engine + media helpers.
 * @property {typeof import('./ui.js')} ui - the shared UI toolkit.
 * @property {(routeId: string) => void} navigate - go to a route ('home' or a studio id).
 * @property {(message: string, kind?: 'info'|'success'|'error') => void} toast
 * @property {() => boolean} hasWebGPU
 */

/**
 * The default export of every src/studio/tasks/<id>.js module.
 * Fills `host` and returns an optional cleanup function.
 * @typedef {(host: HTMLElement, ctx: StudioContext) => (void | (() => void) | Promise<void | (() => void)>)} TaskModule
 */

/**
 * Gallery card metadata + lazy loader (see registry.js STUDIOS).
 * @typedef {Object} StudioMeta
 * @property {string} id
 * @property {string} title
 * @property {'vision'|'audio'|'language'|'chat'} category
 * @property {string} tagline
 * @property {string} emoji
 * @property {string} accent - CSS color driving per-studio theming.
 * @property {string} [badge]
 * @property {'any'|'webgpu'} device
 * @property {string} size
 * @property {'light'|'medium'|'heavy'} [tier]
 * @property {() => Promise<{default: TaskModule}>} load
 */

export {};
