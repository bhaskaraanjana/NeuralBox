// ============================================================
// NeuralBox Studio — pipeline hand-off.
// Lets one studio pass its result as the input of another
// ("Send result to →"). A tiny one-shot store consumed on mount.
// ============================================================

/** @type {{ kind: 'text'|'image', data: string, from?: string } | null} */
let pending = null;

export function setHandoff(payload) { pending = payload || null; }

/** Take the pending hand-off if it matches `kind` (or any kind). Clears it. */
export function takeHandoff(kind) {
    if (!pending) return null;
    if (kind && pending.kind !== kind) return null;
    const p = pending;
    pending = null;
    return p;
}

export function peekHandoff() { return pending; }
