function escapeHtmlText(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function safeParseHttpUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return null;
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed;
    } catch (_err) {
        return null;
    }
}

export function formatBasicHTML(text) {
    const safe = escapeHtmlText(String(text ?? ''));
    return safe
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

export function formatMarkdown(text) {
    const rawText = String(text ?? '');
    let processedText = rawText;

    const thinkOpenMatch = rawText.match(/<think>/g);
    const thinkCloseMatch = rawText.match(/<\/think>/g);

    if (thinkOpenMatch && (!thinkCloseMatch || thinkOpenMatch.length > thinkCloseMatch.length)) {
        const parts = processedText.split(/<think>/);
        const lastPart = parts.pop();
        const bodyBefore = parts.join('<think>');
        return `${formatBasicHTML(bodyBefore)}<details class="think-block" open><summary>Thinking...</summary><div class="think-content">${formatBasicHTML(lastPart)}<span class="typing-indicator" style="display:inline-flex;margin-left:8px;"><span></span><span></span><span></span></span></div></details>`;
    }

    const thinkBlocks = [];
    processedText = processedText.replace(/<think>([\s\S]*?)<\/think>/g, (_match, content) => {
        const token = `@@THINK_BLOCK_${thinkBlocks.length}@@`;
        thinkBlocks.push(`<details class="think-block"><summary>Thought Process</summary><div class="think-content">${formatBasicHTML(content)}</div></details>`);
        return token;
    });

    let formatted = formatBasicHTML(processedText);
    for (let i = 0; i < thinkBlocks.length; i++) {
        const token = `@@THINK_BLOCK_${i}@@`;
        formatted = formatted.replace(token, thinkBlocks[i]);
    }

    return `<p>${formatted}</p>`;
}
