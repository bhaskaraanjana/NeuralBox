// ============================================================
// NeuralBox Studio — shared multi-file batch runner.
// One component every input-taking studio reuses to process many
// files: a multi-file dropzone, sequential processing (one model
// load, N inferences — never parallel, to avoid OOM), a per-file
// expandable result list with isolated errors, and per-file +
// combined ("Download all") exports.
//
// A studio supplies how to process ONE item and how to render it;
// the runner owns the list UI, progress, error isolation, and zips.
// ============================================================
import { el, clear, button, badge, toast, downloadBlob } from './ui.js';
import { makeZip, safeName } from './zip.js';

/**
 * @typedef {Object} BatchItem
 * @property {string} name      filename (or synthetic label for pasted text)
 * @property {File|Blob} [file] the source file (image/audio studios)
 * @property {string} [text]    the source text (text studios)
 */

/**
 * @param {Object} opts
 * @param {'image'|'audio'|'text'} opts.kind      input type (drives the dropzone + paste affordances)
 * @param {string} [opts.accept]                  file input accept attr (defaults per kind)
 * @param {(item: BatchItem, api: {onProgress: Function}) => Promise<any>} opts.process
 *        Process ONE item → an arbitrary result object. Throwing marks the row failed.
 * @param {(result: any, item: BatchItem) => HTMLElement} opts.renderResult
 *        Render one item's result into its expandable row body.
 * @param {(result: any, item: BatchItem) => ({name: string, data: Blob|string}|null)} [opts.exportItem]
 *        Map a result to a downloadable file (for per-row + combined zip). Return null to skip.
 * @param {string} [opts.combinedName]            base name for the combined download (default 'results')
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
export function createBatchRunner(opts) {
    const {
        kind,
        accept = kind === 'image' ? 'image/*' : kind === 'audio' ? 'audio/*' : '.txt,.csv,.md,.json,text/*',
        process,
        renderResult,
        exportItem,
        combinedName = 'results',
    } = opts;

    let running = false;
    let destroyed = false;
    /** @type {{item: BatchItem, result: any, status: string, body: HTMLElement, exportBtn?: HTMLElement}[]} */
    let rows = [];

    // ---- File intake ----
    const fileInput = el('input', { type: 'file', accept, multiple: true, style: { display: 'none' } });
    fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = '';
        if (files.length) start(filesToItems(files));
    });

    const dropTitle = kind === 'text'
        ? 'Drop text files or click to add'
        : `Drop ${kind === 'image' ? 'images' : 'audio files'} or click to add`;
    const dropSub = kind === 'image' ? 'JPG · PNG · WebP — process many at once'
        : kind === 'audio' ? 'WAV · MP3 · M4A · OGG — process many at once'
        : 'TXT · CSV · MD — one file = one item';
    const drop = el('div', { class: 'sx-drop', tabindex: '0', onClick: () => fileInput.click() },
        el('div', { class: 'sx-drop-title' }, dropTitle),
        el('div', { class: 'sx-drop-sub' }, dropSub),
        fileInput,
    );
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('dragover');
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length) start(filesToItems(files));
    });
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

    // Text studios also accept a paste-many box: each non-empty line = one item.
    let pasteBox = null;
    if (kind === 'text') {
        pasteBox = el('textarea', { class: 'sx-textarea', rows: 4, placeholder: '…or paste text here — one item per line, then click Run' });
        const pasteBtn = button('Run pasted lines', { variant: 'ghost', full: true, onClick: () => {
            const lines = String(pasteBox.value || '').split('\n').map((l) => l.trim()).filter(Boolean);
            if (!lines.length) { toast('Paste at least one line', 'info'); return; }
            start(lines.map((text, i) => ({ name: `Item ${i + 1}`, text })));
        } });
        pasteBox = el('div', { class: 'sx-field' }, pasteBox, pasteBtn);
    }

    function filesToItems(files) {
        return files.map((f) => kind === 'text'
            ? { name: f.name, file: f, text: null /* read lazily in start() */ }
            : { name: f.name, file: f });
    }

    // ---- Progress + list UI ----
    const progressFill = el('div', { class: 'sx-loader-fill' });
    const progressTrack = el('div', { class: 'sx-loader-track' }, progressFill);
    const progressLabel = el('div', { class: 'sx-loader-status' }, '');
    const progressWrap = el('div', { class: 'sx-loader', style: { display: 'none', maxWidth: 'none' } },
        el('div', { class: 'sx-loader-head' }, el('strong', {}, 'Batch')),
        progressLabel,
        progressTrack,
    );

    const downloadAllBtn = button('Download all (.zip)', { variant: 'ghost', onClick: () => downloadAll() });
    const downloadTxtBtn = button('Download all (.txt)', { variant: 'ghost', onClick: () => downloadCombinedText() });
    const toolbar = el('div', { class: 'sx-row end', style: { display: 'none', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' } });

    const list = el('div', { class: 'sx-batch-list' });
    const root = el('div', { class: 'sx-batch' },
        drop,
        pasteBox || null,
        progressWrap,
        toolbar,
        list,
    );

    function setProgress(done, total, label) {
        progressWrap.style.display = total ? '' : 'none';
        const pct = total ? Math.round((done / total) * 100) : 0;
        progressFill.style.width = `${pct}%`;
        progressLabel.textContent = label || `${done} / ${total}`;
    }

    function statusChip(status) {
        const map = {
            queued: ['Queued', 'neutral'],
            running: ['Running…', 'accent'],
            done: ['Done', 'success'],
            error: ['Error', 'danger'],
        };
        const [text, kindB] = map[status] || ['…', 'neutral'];
        return badge(text, kindB);
    }

    function makeRow(item, index) {
        const chip = statusChip('queued');
        const summary = el('div', { class: 'sx-batch-summary' },
            el('span', { class: 'sx-batch-idx' }, String(index + 1)),
            el('span', { class: 'sx-batch-name', title: item.name }, item.name),
            chip,
            el('span', { class: 'sx-batch-caret' }, '▸'),
        );
        const bodyInner = el('div', {});
        const body = el('div', { class: 'sx-batch-body', style: { display: 'none' } }, bodyInner);
        summary.addEventListener('click', () => {
            const open = body.style.display === 'none';
            body.style.display = open ? '' : 'none';
            summary.querySelector('.sx-batch-caret').textContent = open ? '▾' : '▸';
            summary.classList.toggle('open', open);
        });
        const row = el('div', { class: 'sx-batch-row' }, summary, body);
        return { row, chip, summary, bodyInner, body };
    }

    function setChip(rowRef, status) {
        const fresh = statusChip(status);
        rowRef.chip.replaceWith(fresh);
        rowRef.chip = fresh;
    }

    async function readText(item) {
        if (item.text != null) return item.text;
        if (item.file) return (await item.file.text());
        return '';
    }

    // ---- Run ----
    async function start(items) {
        if (running) { toast('A batch is already running', 'info'); return; }
        if (!items.length) return;
        running = true;
        clear(list);
        toolbar.style.display = 'none';
        rows = [];

        const refs = items.map((item, i) => {
            const ref = makeRow(item, i);
            list.append(ref.row);
            rows.push({ item, result: null, status: 'queued', body: ref.bodyInner, ref });
            return ref;
        });

        let okCount = 0;
        for (let i = 0; i < items.length; i++) {
            if (destroyed) return;
            const item = items[i];
            const rec = rows[i];
            setProgress(i, items.length, `Processing ${i + 1} / ${items.length} — ${item.name}`);
            setChip(refs[i], 'running');
            refs[i].summary.classList.add('active');
            try {
                if (kind === 'text') item.text = await readText(item);
                const result = await process(item, { onProgress: () => {} });
                if (destroyed) return;
                rec.result = result;
                rec.status = 'done';
                clear(rec.body);
                rec.body.append(renderResult(result, item));
                setChip(refs[i], 'done');
                okCount++;
                // Open the first result so the user sees output immediately.
                if (i === 0) { refs[i].body.style.display = ''; refs[i].summary.querySelector('.sx-batch-caret').textContent = '▾'; }
            } catch (err) {
                rec.status = 'error';
                clear(rec.body);
                rec.body.style.display = '';
                rec.body.append(el('div', { class: 'sx-batch-err' }, String(err?.message || err)));
                setChip(refs[i], 'error');
            }
            refs[i].summary.classList.remove('active');
        }

        setProgress(items.length, items.length, `Done — ${okCount} / ${items.length} succeeded`);
        running = false;
        updateToolbar();
    }

    function updateToolbar() {
        clear(toolbar);
        const done = rows.filter((r) => r.status === 'done');
        if (!done.length || !exportItem) { toolbar.style.display = 'none'; return; }
        toolbar.style.display = '';
        // Decide combined format by what exportItem yields (text vs blob).
        const sample = exportItem(done[0].result, done[0].item);
        const isText = sample && typeof sample.data === 'string';
        toolbar.append(el('span', { class: 'sx-muted', style: { marginRight: 'auto' } }, `${done.length} result${done.length === 1 ? '' : 's'}`));
        toolbar.append(isText ? downloadTxtBtn : downloadAllBtn);
    }

    async function downloadAll() {
        const files = [];
        const used = new Set();
        for (const r of rows) {
            if (r.status !== 'done') continue;
            const out = exportItem?.(r.result, r.item);
            if (!out || out.data == null) continue;
            let name = safeName(out.name || r.item.name || 'file');
            // De-dupe names within the archive.
            let n = name, k = 1;
            while (used.has(n)) { const dot = name.lastIndexOf('.'); n = dot > 0 ? `${name.slice(0, dot)}_${k}${name.slice(dot)}` : `${name}_${k}`; k++; }
            used.add(n);
            files.push({ name: n, data: out.data });
        }
        if (!files.length) { toast('Nothing to download', 'info'); return; }
        try {
            const blob = await makeZip(files);
            downloadBlob(blob, `${combinedName}.zip`);
        } catch (err) {
            toast('Could not build zip: ' + (err?.message || err), 'error');
        }
    }

    function downloadCombinedText() {
        const parts = [];
        for (const r of rows) {
            if (r.status !== 'done') continue;
            const out = exportItem?.(r.result, r.item);
            if (!out || typeof out.data !== 'string') continue;
            parts.push(`===== ${r.item.name} =====\n${out.data}`);
        }
        if (!parts.length) { toast('Nothing to download', 'info'); return; }
        downloadBlob(new Blob([parts.join('\n\n')], { type: 'text/plain' }), `${combinedName}.txt`);
    }

    return {
        el: root,
        destroy: () => { destroyed = true; },
    };
}

/**
 * Wrap a batch runner in a collapsible panel a studio can drop in with one line:
 *   const batch = batchPanel({ kind:'image', process, renderResult, exportItem });
 *   controls.append(batch.el);
 * Collapsed by default so the single-file UX stays primary.
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
export function batchPanel(opts) {
    const runner = createBatchRunner(opts);
    const label = opts.label || 'Batch — process multiple files';
    const caret = el('span', { class: 'sx-batch-toggle-caret' }, '▸');
    const bodyWrap = el('div', { class: 'sx-batch-panel-body', style: { display: 'none' } }, runner.el);
    const toggle = el('button', { class: 'sx-batch-toggle', type: 'button', onClick: () => {
        const open = bodyWrap.style.display === 'none';
        bodyWrap.style.display = open ? '' : 'none';
        caret.textContent = open ? '▾' : '▸';
    } }, caret, el('span', {}, label));
    const root = el('div', { class: 'sx-batch-panel' }, toggle, bodyWrap);
    return { el: root, destroy: runner.destroy };
}
