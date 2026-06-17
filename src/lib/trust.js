function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function renderTrustMetaHtml(meta = {}) {
    const routeScore = Number.isFinite(meta.routeScore) ? ` (score ${meta.routeScore})` : '';
    const deterministicText = meta.deterministic
        ? `on${Number.isFinite(meta.seed) ? ` (seed ${meta.seed})` : ''}`
        : 'off';
    const ragDocNames = Array.isArray(meta.ragDocNames) ? meta.ragDocNames : [];
    const ragDocSummary = ragDocNames.length
        ? `${ragDocNames.slice(0, 3).join(', ')}${ragDocNames.length > 3 ? ', ...' : ''}`
        : 'n/a';
    const ragConfidence = String(meta.ragConfidence || 'n/a');
    const ragProfile = String(meta.ragProfile || 'balanced');
    const ragAvgScore = Number.isFinite(Number(meta.ragAvgScore)) ? Number(meta.ragAvgScore) : null;
    const ragBreakdown = meta.ragConfidenceBreakdown && typeof meta.ragConfidenceBreakdown === 'object'
        ? meta.ragConfidenceBreakdown
        : { high: 0, medium: 0, low: 0 };
    const ragBreakdownText = `H:${Number(ragBreakdown.high || 0)} M:${Number(ragBreakdown.medium || 0)} L:${Number(ragBreakdown.low || 0)}`;
    return `
        <details class="trust-meta">
            <summary>Trust Layer: why this answer</summary>
            <div class="trust-meta-grid">
                <span><strong>Model:</strong> ${escapeHtml(meta.modelName || '')}</span>
                <span><strong>Profile:</strong> ${escapeHtml(meta.profile || '')}</span>
                <span><strong>Workflow:</strong> ${escapeHtml(meta.workflowLabel || '')}</span>
                <span><strong>Deterministic:</strong> ${escapeHtml(deterministicText)}</span>
                <span><strong>Temperature:</strong> ${escapeHtml(String(meta.temperature ?? 'n/a'))}</span>
                <span><strong>Max tokens:</strong> ${escapeHtml(String(meta.maxTokens ?? 'n/a'))}</span>
                <span><strong>Web sources:</strong> ${escapeHtml(String(meta.webSources ?? 0))}</span>
                <span><strong>Web mode:</strong> ${escapeHtml(String(meta.webMode || 'off'))}</span>
                <span><strong>RAG matches:</strong> ${escapeHtml(String(meta.ragSources ?? 0))}</span>
                <span><strong>RAG profile:</strong> ${escapeHtml(ragProfile)}</span>
                <span><strong>RAG docs:</strong> ${escapeHtml(ragDocSummary)}</span>
                <span><strong>RAG confidence:</strong> ${escapeHtml(ragConfidence)}</span>
                <span><strong>RAG avg score:</strong> ${escapeHtml(ragAvgScore != null ? String(ragAvgScore) : 'n/a')}</span>
                <span><strong>RAG confidence mix:</strong> ${escapeHtml(ragBreakdownText)}</span>
                <span><strong>Image input:</strong> ${meta.hasImage ? 'yes' : 'no'}</span>
            </div>
            <div class="trust-meta-reason"><strong>Route reason:</strong> ${escapeHtml(String(meta.routeReason || 'n/a'))}${routeScore}</div>
        </details>
    `;
}
