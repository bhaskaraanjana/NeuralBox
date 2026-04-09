export function getModelTierRank(model) {
    const rank = {
        nano: 0,
        lite: 1,
        standard: 2,
        performance: 3,
        vision: 3,
        premium: 4,
    };
    return rank[model?.tier] ?? 1;
}

export function analyzeRoutingTask(text) {
    const raw = String(text || '');
    const t = raw.toLowerCase();
    const qCount = (raw.match(/\?/g) || []).length;
    const longPrompt = raw.length > 500;
    const coding = /(code|debug|bug|stack trace|exception|typescript|javascript|python|refactor|algorithm|sql|api)/i.test(t);
    const reasoning = /(analy[sz]e|compare|tradeoff|root cause|plan|strategy|prove|derive|optimi[sz]e|diagnose)/i.test(t);
    const creative = /(poem|story|creative|brainstorm|lyrics|name ideas)/i.test(t);
    const complex = longPrompt || qCount > 1 || coding || reasoning;
    return { coding, reasoning, creative, complex, shortPrompt: raw.length < 100 };
}

export function scoreModelForTask(model, task, options = {}) {
    const hasImage = options.hasImage === true;
    const profileMode = options.profileMode || 'balanced';
    const deviceVramMB = Number(options.deviceVramMB || 2048);

    let score = getModelTierRank(model) * 20;

    if (model?.thinking && (task.reasoning || task.coding || task.complex)) score += 25;
    if (!model?.thinking && task.shortPrompt) score += 4;
    if (task.creative && getModelTierRank(model) >= 2) score += 6;
    if (hasImage && model?.vision) score += 100;
    if (!hasImage && model?.vision) score -= 15;

    if (profileMode === 'speed') {
        score -= (Number(model?.vramMB || 0) / 150);
        if (task.shortPrompt) score += 6;
    } else if (profileMode === 'quality') {
        score += (Number(model?.vramMB || 0) / 300);
        if (model?.thinking) score += 10;
    } else {
        score -= (Number(model?.vramMB || 0) / 350);
        if (!task.complex && getModelTierRank(model) >= 4) score -= 8;
    }

    // Slightly reward models that fit the current device better.
    if (deviceVramMB > 0) {
        const fitRatio = Number(model?.vramMB || 0) / Math.max(1, deviceVramMB);
        if (fitRatio <= 0.85) score += 6;
        else if (fitRatio > 1.1) score -= 18;
    }

    return score;
}
