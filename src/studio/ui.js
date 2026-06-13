// ============================================================
// NeuralBox Studio — Shared UI toolkit (framework-free)
// Hyperscript + the common controls every studio reuses so the
// whole app stays visually consistent.
// ============================================================
import { startCamera, stopStream } from './runtime.js';

/** Tiny hyperscript: el('div', {class:'x', onClick}, child, ...) */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
    }
    appendChildren(node, children);
    return node;
}

function appendChildren(node, children) {
    for (const c of children.flat(Infinity)) {
        if (c == null || c === false) continue;
        node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export function icon(svgPath, size = 18) {
    return el('span', {
        class: 'sx-icon',
        html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`,
    });
}

export function button(label, { variant = 'primary', onClick, iconPath, disabled, title, full } = {}) {
    const b = el('button', {
        class: `sx-btn sx-btn-${variant}${full ? ' sx-btn-full' : ''}`,
        type: 'button',
        title: title || label,
        onClick,
    }, iconPath ? icon(iconPath, 16) : null, label ? el('span', {}, label) : null);
    if (disabled) b.disabled = true;
    return b;
}

export function field(labelText, control, hint) {
    return el('div', { class: 'sx-field' },
        labelText ? el('label', { class: 'sx-label' }, labelText) : null,
        control,
        hint ? el('p', { class: 'sx-hint' }, hint) : null,
    );
}

export function textarea(placeholder = '', value = '', rows = 5) {
    const t = el('textarea', { class: 'sx-textarea', placeholder, rows });
    t.value = value;
    return t;
}

export function textInput(placeholder = '', value = '') {
    const i = el('input', { class: 'sx-input', type: 'text', placeholder });
    i.value = value;
    return i;
}

export function select(options, value) {
    // options: [{value,label}] or [string]
    const s = el('select', { class: 'sx-select' });
    for (const o of options) {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const node = el('option', { value: opt.value }, opt.label);
        if (opt.value === value) node.selected = true;
        s.append(node);
    }
    return s;
}

/** Segmented tab control. Returns the element. onChange(value). */
export function segmented(options, value, onChange) {
    const wrap = el('div', { class: 'sx-segmented' });
    const buttons = [];
    for (const o of options) {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const b = el('button', {
            class: `sx-seg${opt.value === value ? ' active' : ''}`,
            type: 'button',
            onClick: () => {
                buttons.forEach((x) => x.classList.remove('active'));
                b.classList.add('active');
                onChange?.(opt.value);
            },
        }, opt.label);
        buttons.push(b);
        wrap.append(b);
    }
    return wrap;
}

export function badge(text, kind = 'neutral') {
    return el('span', { class: `sx-badge sx-badge-${kind}` }, text);
}

export function chip(text, onClick) {
    return el('button', { class: 'sx-chip', type: 'button', onClick }, text);
}

export function card(children, props = {}) {
    return el('div', { class: `sx-card ${props.class || ''}` }, ...(Array.isArray(children) ? children : [children]));
}

export function spinner() {
    return el('span', { class: 'sx-spinner', html: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="40 60"/></svg>' });
}

/** A model-loading card with an aggregated progress bar. */
export function loader(title = 'Loading model') {
    const status = el('div', { class: 'sx-loader-status' }, 'Preparing…');
    const fill = el('div', { class: 'sx-loader-fill' });
    const pctEl = el('span', { class: 'sx-loader-pct' }, '0%');
    const root = el('div', { class: 'sx-loader' },
        el('div', { class: 'sx-loader-head' }, spinner(), el('strong', {}, title)),
        status,
        el('div', { class: 'sx-loader-track' }, fill),
        pctEl,
    );
    return {
        el: root,
        progress(p) {
            const pct = typeof p === 'number' ? p : (p?.pct ?? 0);
            fill.style.width = `${pct}%`;
            pctEl.textContent = `${pct}%`;
            if (p?.status === 'ready' || pct >= 100) status.textContent = 'Warming up…';
            else if (p?.cached) status.textContent = 'Loaded from cache';
            else status.textContent = pct > 0 ? 'Downloading model…' : 'Connecting…';
        },
        status(text) { status.textContent = text; },
        fail(err) {
            root.classList.add('sx-loader-error');
            status.textContent = String(err?.message || err || 'Failed to load');
        },
        remove() { root.remove(); },
    };
}

/** Horizontal score bars for classification-style results. items:[{label,score}] */
export function scoreBars(items, { accent } = {}) {
    const wrap = el('div', { class: 'sx-bars' });
    const max = Math.max(0.0001, ...items.map((i) => i.score || 0));
    for (const it of items) {
        const pct = Math.round((it.score / max) * 100);
        const truePct = Math.round((it.score || 0) * 100);
        wrap.append(el('div', { class: 'sx-bar-row' },
            el('div', { class: 'sx-bar-label', title: it.label }, it.label),
            el('div', { class: 'sx-bar-track' },
                el('div', { class: 'sx-bar-fill', style: { width: `${pct}%`, background: accent || 'var(--accent)' } })),
            el('div', { class: 'sx-bar-val' }, `${truePct}%`),
        ));
    }
    return wrap;
}

/** Drag + drop / click file picker. onFiles(FileList). */
export function dropZone({ accept = '*/*', multiple = false, onFiles, title = 'Drop a file or click to browse', sub = '' } = {}) {
    const input = el('input', { type: 'file', accept, style: { display: 'none' } });
    if (multiple) input.multiple = true;
    input.addEventListener('change', () => { if (input.files?.length) onFiles?.(input.files); input.value = ''; });
    const zone = el('div', { class: 'sx-drop', tabindex: '0', onClick: () => input.click() },
        el('div', { class: 'sx-drop-title' }, title),
        sub ? el('div', { class: 'sx-drop-sub' }, sub) : null,
        input,
    );
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer?.files?.length) onFiles?.(e.dataTransfer.files);
    });
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    return zone;
}

// Bundled, same-origin sample images (in public/samples). Same-origin means no
// COEP/CORS blocking under our cross-origin-isolation headers, and they work offline.
export const SAMPLE_IMAGES = {
    street: '/samples/street.jpg',
    cats: '/samples/cats.jpg',
    football: '/samples/football.jpg',
    tiger: '/samples/tiger.jpg',
    portrait: '/samples/portrait.jpg',
    bread: '/samples/bread.jpg',
};

/**
 * Reusable image source picker: upload / sample / camera snapshot.
 * Calls onImage(url) whenever a new image is chosen.
 * Returns { el, setImage(url), destroy() }.
 */
export function imageInput({ onImage, samples = ['street', 'cats', 'football', 'portrait'], allowCamera = true } = {}) {
    let activeStream = null;
    const camWrap = el('div', { class: 'sx-cam', style: { display: 'none' } });
    const video = el('video', { class: 'sx-cam-video', autoplay: true, playsinline: true, muted: true });
    const drop = dropZone({
        accept: 'image/*',
        title: 'Drop an image or click to upload',
        sub: 'JPG · PNG · WebP — never leaves your device',
        onFiles: (files) => {
            const url = URL.createObjectURL(files[0]);
            onImage?.(url);
        },
    });

    const sampleRow = el('div', { class: 'sx-samples' },
        el('span', { class: 'sx-samples-label' }, 'Try:'),
        ...samples.map((key) => el('button', {
            class: 'sx-sample',
            type: 'button',
            title: key,
            onClick: () => onImage?.(SAMPLE_IMAGES[key]),
            style: { backgroundImage: `url(${SAMPLE_IMAGES[key]})` },
        })),
    );

    async function openCamera() {
        try {
            camWrap.style.display = '';
            activeStream = await startCamera(video, { facingMode: 'environment' });
        } catch (err) {
            camWrap.style.display = 'none';
            toast('Camera unavailable: ' + (err?.message || err), 'error');
        }
    }
    function closeCamera() {
        stopStream(activeStream);
        activeStream = null;
        camWrap.style.display = 'none';
    }
    function snap() {
        const c = el('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        c.toBlob((b) => { if (b) onImage?.(URL.createObjectURL(b)); }, 'image/jpeg', 0.92);
        closeCamera();
    }

    camWrap.append(video, el('div', { class: 'sx-cam-actions' },
        button('Capture', { variant: 'primary', onClick: snap }),
        button('Cancel', { variant: 'ghost', onClick: closeCamera }),
    ));

    const actions = el('div', { class: 'sx-imageinput-actions' },
        allowCamera ? button('Use camera', { variant: 'ghost', onClick: openCamera }) : null,
    );

    const root = el('div', { class: 'sx-imageinput' }, drop, sampleRow, actions, camWrap);
    return {
        el: root,
        setImage: (url) => onImage?.(url),
        destroy: () => closeCamera(),
    };
}

/** Center-screen modal. Returns { el, close }. */
export function modal(title, body) {
    const overlay = el('div', { class: 'sx-modal-overlay' });
    const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 220); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const panel = el('div', { class: 'sx-modal' },
        el('div', { class: 'sx-modal-head' },
            el('h3', { class: 'sx-modal-title' }, title),
            el('button', { class: 'sx-modal-close', type: 'button', 'aria-label': 'Close', onClick: close }, '✕'),
        ),
        el('div', { class: 'sx-modal-body' }, body),
    );
    overlay.append(panel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    return { el: overlay, close };
}

let _toastHost = null;
export function toast(message, kind = 'info', ms = 3200) {
    if (!_toastHost) {
        _toastHost = el('div', { class: 'sx-toast-host' });
        document.body.append(_toastHost);
    }
    const t = el('div', { class: `sx-toast sx-toast-${kind}` }, message);
    _toastHost.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
}

export function copyButton(getText, label = 'Copy') {
    return button(label, {
        variant: 'ghost',
        iconPath: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        onClick: async () => {
            try { await navigator.clipboard.writeText(getText()); toast('Copied to clipboard', 'success'); }
            catch { toast('Copy failed', 'error'); }
        },
    });
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Deterministic, vivid color from a string label (for boxes / segments).
export function labelColor(label, alpha = 1) {
    let h = 0;
    const s = String(label);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return `hsla(${h}, 85%, 60%, ${alpha})`;
}
