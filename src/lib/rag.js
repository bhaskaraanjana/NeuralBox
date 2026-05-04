export function normalizeRagDocText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, '  ')
        .replace(/[ \u00a0]{2,}/g, ' ')
        .trim();
}

export function splitTextIntoRagChunks(text, chunkSize = 900, overlap = 160) {
    const normalized = normalizeRagDocText(text);
    if (!normalized) return [];
    const chunks = [];
    let cursor = 0;
    while (cursor < normalized.length) {
        const end = Math.min(normalized.length, cursor + chunkSize);
        const chunk = normalized.slice(cursor, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= normalized.length) break;
        cursor = Math.max(end - overlap, cursor + 1);
    }
    return chunks;
}

export function tokenizeRagQuery(text) {
    return normalizeRagDocText(text)
        .toLowerCase()
        .split(/[^a-z0-9_]+/i)
        .filter((t) => t.length > 2)
        .slice(0, 24);
}

export function getRagMatchScore(queryTokens, chunkText) {
    if (!queryTokens.length || !chunkText) return 0;
    const hay = String(chunkText).toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
        const hits = hay.split(token).length - 1;
        if (hits > 0) {
            score += Math.min(6, hits) * (token.length >= 6 ? 2 : 1);
        }
    }
    return score;
}

export function getRagConfidenceLabel(score, queryTokenCount = 0) {
    const baseScore = Number(score) || 0;
    if (baseScore <= 0) return 'low';
    const tokenCount = Math.max(1, Number(queryTokenCount) || 1);
    const normalized = baseScore / tokenCount;
    if (normalized >= 3) return 'high';
    if (normalized >= 1.5) return 'medium';
    return 'low';
}

export const RAG_RETRIEVAL_PROFILES = {
    precise: {
        id: 'precise',
        label: 'Precise',
        maxMatches: 2,
        minScore: 4,
        description: 'Fewer, stronger matches for focused answers.',
    },
    balanced: {
        id: 'balanced',
        label: 'Balanced',
        maxMatches: 4,
        minScore: 1,
        description: 'Default mix of context size and relevance.',
    },
    broad: {
        id: 'broad',
        label: 'Broad',
        maxMatches: 6,
        minScore: 1,
        description: 'More context for exploratory or fuzzy questions.',
    },
};

export function normalizeRagRetrievalProfile(profileId = 'balanced') {
    const id = String(profileId || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(RAG_RETRIEVAL_PROFILES, id) ? id : 'balanced';
}

export function getRagRetrievalProfileConfig(profileId = 'balanced') {
    return RAG_RETRIEVAL_PROFILES[normalizeRagRetrievalProfile(profileId)];
}

export function retrieveRagChunksFromIndex(ragChunks, query, options = 4) {
    if (!Array.isArray(ragChunks) || !ragChunks.length) return [];
    const tokens = tokenizeRagQuery(query);
    if (!tokens.length) return [];

    const config = typeof options === 'object' && options !== null
        ? getRagRetrievalProfileConfig(options.profileId)
        : null;
    const maxMatches = config
        ? Number(options.maxMatches || config.maxMatches)
        : Number(options || 4);
    const minScore = config ? Number(config.minScore || 1) : 1;

    return ragChunks
        .map((chunk) => {
            const score = getRagMatchScore(tokens, chunk.text);
            return {
                ...chunk,
                score,
                confidenceLabel: getRagConfidenceLabel(score, tokens.length),
            };
        })
        .filter((c) => c.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxMatches);
}

export function getFileExtension(filename = '') {
    const clean = String(filename || '').trim().toLowerCase();
    if (!clean || !clean.includes('.')) return '';
    return clean.split('.').pop() || '';
}
