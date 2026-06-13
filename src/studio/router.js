// ============================================================
// NeuralBox Studio — Hash router
// #/            -> home gallery
// #/<studio-id> -> a studio
// ============================================================

export function currentRoute() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
    return h || 'home';
}

export function navigate(id) {
    const target = id === 'home' ? '#/' : `#/${id}`;
    if (location.hash === target) {
        // Same route requested — dispatch manually so re-clicks still work.
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
        location.hash = target;
    }
}

export function startRouter(handler) {
    const go = () => handler(currentRoute());
    window.addEventListener('hashchange', go);
    // Defer initial dispatch so callers can finish wiring.
    queueMicrotask(go);
    return { refresh: go };
}
