export function shouldAutoWebSearch(query) {
    const text = String(query || '').trim().toLowerCase();
    if (!text) return false;
    if (/^(search web|web search|search the web)\b/.test(text)) return true;
    if (/\b(today|yesterday|tomorrow|latest|recent|breaking|right now|currently|as of now|this morning|tonight)\b/.test(text)) {
        return true;
    }
    if (/\b(news|headline|war|attack|bomb|strike|election|score|stock|price|weather|earthquake|fired|hired|ceo)\b/.test(text)) {
        return true;
    }
    return false;
}

export function classifyWebSearchError(err) {
    const rawMessage = String(err?.message || err || '').trim();
    const message = rawMessage || 'Unknown web-search error';
    const lower = message.toLowerCase();

    if (/abort|timeout|timed out/.test(lower)) {
        return {
            kind: 'timeout',
            message,
            retryable: true,
        };
    }

    if (/failed to fetch|network|offline|internet|connection/.test(lower)) {
        return {
            kind: 'network',
            message,
            retryable: true,
        };
    }

    const statusMatch = message.match(/\b(?:http|status)\s*(\d{3})\b/i);
    if (statusMatch) {
        const status = Number(statusMatch[1]);
        return {
            kind: status === 429 ? 'rate_limited' : 'endpoint',
            message,
            status,
            retryable: status === 429 || status >= 500,
        };
    }

    if (/json|parse|syntax|domparser/.test(lower)) {
        return {
            kind: 'parse',
            message,
            retryable: false,
        };
    }

    return {
        kind: 'unknown',
        message,
        retryable: true,
    };
}

export function getWebSearchRecoveryNotice(failure = {}, options = {}) {
    const modeLabel = options.mode === 'auto' ? 'Auto web search' : 'Web search';
    const kind = String(failure.kind || 'unknown');

    if (kind === 'timeout') {
        return `${modeLabel} timed out. Continuing locally; retry or use a more specific query.`;
    }
    if (kind === 'network') {
        return `${modeLabel} could not reach the network. Continuing locally; check connection or try again.`;
    }
    if (kind === 'rate_limited') {
        return `${modeLabel} appears rate-limited. Continuing locally; wait a bit and retry.`;
    }
    if (kind === 'endpoint') {
        return `${modeLabel} endpoint failed. Continuing locally; try again later.`;
    }
    if (kind === 'parse') {
        return `${modeLabel} response could not be read. Continuing locally; try again later.`;
    }
    return `${modeLabel} failed. Continuing locally; retry when the network is available.`;
}

export function getWebSearchNoResultsNotice(mode = 'manual') {
    const modeLabel = mode === 'auto' ? 'Auto web search' : 'Web search';
    return `${modeLabel} found no usable results. Continuing with local model knowledge.`;
}
