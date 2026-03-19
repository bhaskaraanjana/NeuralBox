// ============================================
// NeuralBox - Main Application
// Multi-conversation support
// ============================================
import * as webllm from '@mlc-ai/web-llm';
import {
    initDatabase,
    loadSettingsRecord,
    saveSettingsRecord,
    loadConversationsRecord,
    saveConversationsRecord,
    loadModelSelectionRecord,
    saveModelSelectionRecord,
} from './db/database.js';
let whisperModulePromise = null;
let whisperApi = null;

const LEGACY_SYSTEM_PROMPT = "You are NeuralBox, a private AI assistant running entirely in the user's browser. You were NOT made by OpenAI, Anthropic, Google, or Meta. You are a local AI model. You can ONLY have text conversations. You CANNOT browse the web, read images, run code, access files, or scrape websites. If you don't know something, say so honestly instead of guessing. Keep responses concise and helpful.";
const DEFAULT_SYSTEM_PROMPT = "You are NeuralBox, a private AI assistant running entirely in the user's browser. You were NOT made by OpenAI, Anthropic, Google, or Meta. You are a local AI model. If the active model supports vision, you can analyze user-provided images. You cannot browse the web unless the app explicitly provides search results, and you cannot run code, access local files, or scrape websites. If you don't know something, say so honestly instead of guessing. Keep responses concise and helpful.";

// ---- State ----
let engine = null;
let isGenerating = false;
let webSearchEnabled = false;
let generationCancelRequested = false;
let activeGenerationId = 0;
let conversationSearchQuery = '';
let verboseVisionLogs = false;

// Voice state
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let voiceChatActive = false;

// Conversations: { id, title, messages[], createdAt, updatedAt }
let conversations = [];
let activeConversationId = null;

// ---- DOM Refs ----
const $ = (sel) => document.querySelector(sel);
const loadingScreen = $('#loading-screen');
const chatScreen = $('#chat-screen');
const webgpuError = $('#webgpu-error');
const downloadSection = $('#download-section');
const statusText = $('#status-text');
const progressFill = $('#progress-fill');
const progressPercent = $('#progress-percent');
const startBtn = $('#start-btn');
const messagesContainer = $('#messages');
const userInput = $('#user-input');
const sendBtn = $('#send-btn');
const newChatBtn = $('#new-chat-btn');
const settingsBtn = $('#settings-btn');
const settingsPanel = $('#settings-panel');
const settingsOverlay = $('#settings-overlay');
const closeSettings = $('#close-settings');
const systemPrompt = $('#system-prompt');
const temperatureSlider = $('#temperature');
const tempValue = $('#temp-value');
const maxTokensSlider = $('#max-tokens');
const tokensValue = $('#tokens-value');
const clearHistoryBtn = $('#clear-history-btn');
const promptPresetSelect = $('#prompt-preset-select');
const applyPresetBtn = $('#apply-preset-btn');
const exportChatsBtn = $('#export-chats-btn');
const importChatsBtn = $('#import-chats-btn');
const importChatsInput = $('#import-chats-input');
const hotSwapStatus = $('#hot-swap-status');
const debugPanel = $('#debug-panel');
const debugState = $('#debug-state');
const debugEvents = $('#debug-events');
const debugPanelSetting = $('#debug-panel-setting');
const debugClearBtn = $('#debug-clear-btn');

// Sidebar refs
const sidebar = $('#sidebar');
const sidebarOverlay = $('#sidebar-overlay');
const sidebarToggle = $('#sidebar-toggle');
const sidebarNewChat = $('#sidebar-new-chat');
const conversationList = $('#conversation-list');
const conversationSearch = $('#conversation-search');

// Web search refs
const webSearchToggle = $('#web-search-toggle');
const webSearchSetting = $('#web-search-setting');
const visionVerboseSetting = $('#vision-verbose-setting');
const inputDisclaimer = $('#input-disclaimer');

// Voice refs
const micBtn = $('#mic-btn');
const voiceStatus = $('#voice-status');

// Voice chat overlay refs
const voiceChatBtn = $('#voice-chat-btn');
const voiceChatOverlay = $('#voice-chat-overlay');
const voiceChatClose = $('#voice-chat-close');
const voiceOrb = $('#voice-orb');
const voiceChatLabel = $('#voice-chat-label');
const voiceChatText = $('#voice-chat-text');

// Web / Think toggle refs
const thinkToggle = $('#think-toggle');

// Image / vision refs
const imageBtn = $('#image-btn');
const imageInput = $('#image-input');
const imagePreview = $('#image-preview');
const imagePreviewImg = $('#image-preview-img');
const imagePreviewClear = $('#image-preview-clear');
const inputWrapper = $('.input-wrapper');

// ---- Model Config ----
const MODEL_CATALOG = [
    {
        id: 'SmolLM2-135M-Instruct-q0f16-MLC',
        name: 'SmolLM2 - 135M',
        size: '~110MB',
        vramMB: 300,
        tier: 'nano',
        desc: 'Tiny fallback model for low-memory devices.',
    },
    {
        id: 'SmolLM2-360M-Instruct-q0f16-MLC',
        name: 'SmolLM2 - 360M',
        size: '~200MB',
        vramMB: 400,
        tier: 'nano',
        desc: 'Ultra-fast, minimal footprint. Basic chat only.',
    },
    {
        id: 'Qwen3-0.6B-q4f16_1-MLC',
        name: 'Qwen 3 - 0.6B',
        size: '~400MB',
        vramMB: 600,
        tier: 'lite',
        thinking: true,
        desc: 'Fast and lightweight. Better reasoning than Qwen2.5-0.5B.',
    },
    {
        id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 - 1B',
        size: '~750MB',
        vramMB: 900,
        tier: 'lite',
        desc: 'Balanced small model with solid general chat quality.',
    },
    {
        id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
        name: 'SmolLM2 - 1.7B',
        size: '~1GB',
        vramMB: 1200,
        tier: 'standard',
        desc: 'HuggingFace\'s efficient small model. Good for its size.',
    },
    {
        id: 'Qwen3-1.7B-q4f16_1-MLC',
        name: 'Qwen 3 - 1.7B',
        size: '~1.1GB',
        vramMB: 1500,
        tier: 'standard',
        thinking: true,
        desc: 'Great balance of speed and intelligence. Thinking mode.',
    },
    {
        id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 - 3B',
        size: '~2GB',
        vramMB: 2500,
        tier: 'performance',
        desc: 'Meta\'s compact model. Reliable all-rounder.',
    },
    {
        id: 'Qwen3-4B-q4f16_1-MLC',
        name: 'Qwen 3 - 4B',
        size: '~2.5GB',
        vramMB: 3500,
        tier: 'performance',
        thinking: true,
        desc: 'Best value. Matches larger models on reasoning tasks.',
    },
    {
        id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        name: 'Phi 3.5 Mini - 3.8B',
        size: '~2.4GB',
        vramMB: 3500,
        tier: 'performance',
        desc: 'Microsoft\'s model. Strong at math and logic.',
    },
    {
        id: 'Phi-3.5-vision-instruct-q4f16_1-MLC',
        name: 'Phi 3.5 Vision - 4.2B',
        size: '~2.7GB',
        vramMB: 4000,
        tier: 'vision',
        vision: true,
        desc: 'Can understand images! Describe, read text, answer questions about photos.',
    },
    {
        id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
        name: 'DeepSeek R1 Distill - 7B',
        size: '~4.5GB',
        vramMB: 5500,
        tier: 'premium',
        thinking: true,
        desc: 'DeepSeek R1 reasoning distilled into 7B. Top-tier thinking.',
    },
    {
        id: 'Qwen3-8B-q4f16_1-MLC',
        name: 'Qwen 3 - 8B',
        size: '~5GB',
        vramMB: 6000,
        tier: 'premium',
        thinking: true,
        desc: 'Best quality. Strong reasoning + thinking mode. Needs 6GB+ VRAM.',
    },
    {
        id: 'gemma-2-2b-it-q4f16_1-MLC',
        name: 'Gemma 2 - 2B',
        size: '~1.7GB',
        vramMB: 2200,
        tier: 'performance',
        advanced: true,
        desc: 'Advanced family option tuned for instruction following.',
    },
    {
        id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
        name: 'Mistral 7B Instruct v0.3',
        size: '~4.4GB',
        vramMB: 5500,
        tier: 'premium',
        advanced: true,
        desc: 'Advanced instruct-tuned 7B model.',
    },
    {
        id: 'OpenHermes-2.5-Mistral-7B-q4f16_1-MLC',
        name: 'OpenHermes 2.5 - Mistral 7B',
        size: '~4.4GB',
        vramMB: 5500,
        tier: 'premium',
        advanced: true,
        desc: 'Advanced conversational Mistral 7B variant.',
    },
    {
        id: 'NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC',
        name: 'NeuralHermes 2.5 - Mistral 7B',
        size: '~4.4GB',
        vramMB: 5500,
        tier: 'premium',
        advanced: true,
        desc: 'Advanced alternative tuned for assistant-style chat.',
    },
    {
        id: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
        name: 'Hermes 2 Pro - Llama 3 8B',
        size: '~5.1GB',
        vramMB: 6200,
        tier: 'premium',
        advanced: true,
        desc: 'Advanced Llama 8B family variant.',
    },
    {
        id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
        name: 'Hermes 3 - Llama 3.1 8B',
        size: '~5.1GB',
        vramMB: 6200,
        tier: 'premium',
        advanced: true,
        desc: 'Advanced Hermes 3 model for experimentation.',
    },
    {
        id: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',
        name: 'DeepSeek R1 Distill - Llama 8B',
        size: '~5.3GB',
        vramMB: 6500,
        tier: 'premium',
        thinking: true,
        advanced: true,
        desc: 'Advanced reasoning-focused Llama 8B distill.',
    },
    {
        id: 'gemma-2-9b-it-q4f16_1-MLC',
        name: 'Gemma 2 - 9B',
        size: '~5.8GB',
        vramMB: 7000,
        tier: 'premium',
        advanced: true,
        desc: 'Large advanced Gemma model, requires high VRAM.',
    },
];

let selectedModelId = MODEL_CATALOG[0].id; // default to smallest
const AUTO_MODEL_ID = '__auto__';
let modelSelectionId = MODEL_CATALOG[0].id; // user preference (model id or AUTO_MODEL_ID)
let pendingImage = null; // { dataUrl, file } - image waiting to be sent
let thinkingEnabled = false; // default to no thinking
let deviceCapabilities = null;
let modelRoutingProfileMode = 'balanced';
let modelSwitchPromise = null;
let debugPanelEnabled = false;
const DEBUG_EVENT_LIMIT = 100;
const runtimeEvents = [];

const SEND_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>';
const STOP_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

function isVisionModel() {
    const model = getModelById(selectedModelId);
    return model?.vision === true;
}

function isThinkingModel() {
    const model = getModelById(selectedModelId);
    return model?.thinking === true;
}

async function detectDeviceCapabilities() {
    const result = { vramMB: 0, tier: 'lite', gpuName: 'Unknown' };

    try {
        if (!navigator.gpu) return result;

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) return result;

        const info = adapter.info || {};
        result.gpuName = info.description || info.device || info.vendor || 'Unknown GPU';

        // maxBufferSize is a good proxy for available VRAM
        const maxBuffer = adapter.limits?.maxBufferSize || 0;
        const maxStorageBuffer = adapter.limits?.maxStorageBufferBindingSize || 0;
        const estimatedVRAM = Math.max(maxBuffer, maxStorageBuffer);

        // Convert to MB - maxBufferSize is in bytes
        result.vramMB = Math.round(estimatedVRAM / (1024 * 1024));

        // Fallback heuristic if limits are too small (some browsers cap reported values)
        if (result.vramMB < 256) {
            // Use device memory as a fallback
            const deviceMem = navigator.deviceMemory || 4; // GB
            result.vramMB = deviceMem * 512; // rough estimate: half of system RAM
        }

        // Determine tier
        if (result.vramMB >= 6000) result.tier = 'premium';
        else if (result.vramMB >= 3000) result.tier = 'performance';
        else if (result.vramMB >= 1500) result.tier = 'standard';
        else result.tier = 'lite';

    } catch (err) {
        console.warn('GPU detection failed:', err);
    }

    return result;
}

function autoSelectModel(capabilities) {
    const curatedModels = MODEL_CATALOG.filter((m) => !m.advanced);
    // Find the best model that fits the detected VRAM
    const eligible = curatedModels.filter(m => m.vramMB <= capabilities.vramMB * 1.1); // 10% margin
    if (eligible.length === 0) return curatedModels[0] || MODEL_CATALOG[0]; // fallback to smallest curated
    return eligible[eligible.length - 1]; // pick the largest eligible
}

function getModelById(id) {
    return MODEL_CATALOG.find(m => m.id === id) || MODEL_CATALOG[0];
}

function getModelGroups() {
    const curated = MODEL_CATALOG.filter((m) => !m.advanced);
    const advanced = MODEL_CATALOG.filter((m) => m.advanced);
    return { curated, advanced };
}

function renderModelOptions(models, options = {}) {
    const selectionId = options.selectionId || modelSelectionId;
    const recommendedId = options.recommendedId || null;
    const capabilities = options.capabilities || { vramMB: 0 };
    const highVramLabel = options.highVramLabel || 'High VRAM';

    return models.map((m) => {
        const isRec = m.id === recommendedId;
        const tooLarge = m.vramMB > capabilities.vramMB * 1.2;
        return `<option value="${m.id}" ${m.id === selectionId ? 'selected' : ''} ${tooLarge ? 'data-warning="true"' : ''}>${m.name} (${m.size})${isRec ? ' - Recommended' : ''}${tooLarge ? ` - ${highVramLabel}` : ''}</option>`;
    }).join('');
}

function isAutoModelSelected() {
    return modelSelectionId === AUTO_MODEL_ID;
}

async function getSavedModelSelectionId() {
    const saved = await loadModelSelectionRecord();
    if (saved === AUTO_MODEL_ID) return AUTO_MODEL_ID;
    if (saved && MODEL_CATALOG.find((m) => m.id === saved)) return saved;
    return null;
}

function saveModelSelectionId() {
    void saveModelSelectionRecord(modelSelectionId).catch((err) => {
        console.error('[DB] Failed to persist model selection:', err);
    });
}

function resolveAutoModelCandidate() {
    const recommended = autoSelectModel(deviceCapabilities || { vramMB: 0 });
    return getModelById(recommended.id);
}

function syncModelSelectors() {
    const settingsSelect = document.getElementById('model-select');
    if (settingsSelect) settingsSelect.value = modelSelectionId;
    const startSelect = document.getElementById('start-model-select');
    if (startSelect) startSelect.value = modelSelectionId;
}

function applyModelUiState() {
    const model = getModelById(selectedModelId);
    const modelBadge = $('#model-badge');
    if (modelBadge) {
        modelBadge.textContent = isAutoModelSelected()
            ? `Auto | ${model.name}`
            : model.name;
    }

    if (isVisionModel()) {
        imageBtn.style.display = 'flex';
    } else {
        imageBtn.style.display = 'none';
        clearPendingImage();
    }

    if (isThinkingModel()) {
        thinkToggle.style.display = 'flex';
        thinkToggle.classList.toggle('active', thinkingEnabled);
    } else {
        thinkToggle.style.display = 'none';
        thinkingEnabled = false;
        thinkToggle.classList.remove('active');
    }

    if (isThinkingModel() && thinkingEnabled) {
        userInput.placeholder = 'Ask anything... (Thinking mode enabled)';
    } else if (isVisionModel()) {
        userInput.placeholder = 'Ask anything... (you can attach images!)';
    } else {
        userInput.placeholder = 'Ask anything...';
    }

    updateInputDisclaimer();
    syncModelSelectors();
    renderDebugPanel();
}

function setHotSwapStatus(text, percent = null, isActive = true) {
    if (!hotSwapStatus) return;
    if (!isActive) {
        hotSwapStatus.style.display = 'none';
        hotSwapStatus.classList.remove('active');
        hotSwapStatus.textContent = '';
        return;
    }

    hotSwapStatus.style.display = 'inline-flex';
    hotSwapStatus.classList.add('active');
    if (typeof percent === 'number' && Number.isFinite(percent)) {
        hotSwapStatus.textContent = `${text} ${percent}%`;
    } else {
        hotSwapStatus.textContent = text;
    }
}

function getRuntimeStateSummary() {
    const selectionLabel = isAutoModelSelected()
        ? 'Auto'
        : getModelById(modelSelectionId).name;
    const activeLabel = getModelById(selectedModelId).name;
    return `Selection: ${selectionLabel} | Active: ${activeLabel} | Generating: ${isGenerating ? 'yes' : 'no'} | GenerationId: ${activeGenerationId}`;
}

function renderDebugPanel() {
    if (!debugPanel || !debugState || !debugEvents) return;

    debugPanel.style.display = debugPanelEnabled ? 'block' : 'none';
    if (!debugPanelEnabled) return;

    debugState.textContent = getRuntimeStateSummary();
    debugEvents.innerHTML = runtimeEvents
        .slice()
        .reverse()
        .map((event) => {
            const payload = JSON.stringify(event.data || {});
            return `<div class="debug-event-row"><span class="debug-event-time">${event.time}</span><span class="debug-event-name">${event.name}</span><span class="debug-event-data">${escapeHtml(payload)}</span></div>`;
        })
        .join('');
}

function logRuntimeEvent(name, data = {}) {
    const now = new Date();
    runtimeEvents.push({
        at: now.toISOString(),
        time: now.toLocaleTimeString(),
        name,
        data: {
            ...data,
            selectionMode: isAutoModelSelected() ? 'auto' : 'manual',
            activeModelId: selectedModelId,
            activeModelName: getModelById(selectedModelId).name,
            generationId: activeGenerationId,
            generating: isGenerating,
        },
    });

    if (runtimeEvents.length > DEBUG_EVENT_LIMIT) {
        runtimeEvents.splice(0, runtimeEvents.length - DEBUG_EVENT_LIMIT);
    }

    renderDebugPanel();
}

function parseProgressPercent(reportText) {
    const text = String(reportText || '');
    const match = text.match(/(\d+)%/);
    if (!match) return null;
    const parsed = parseInt(match[1], 10);
    if (Number.isNaN(parsed)) return null;
    return parsed;
}

function getModelTierRank(model) {
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

function getEligibleModels(options = {}) {
    const requireVision = options.requireVision === true;
    const excludeVision = options.excludeVision === true;
    const requireThinking = options.requireThinking === true;
    const includeAdvanced = options.includeAdvanced === true;
    const vramCap = (deviceCapabilities?.vramMB || 0) * 1.12;

    let models = MODEL_CATALOG.filter((model) => {
        if (!includeAdvanced && model.advanced) return false;
        if (requireVision && !model.vision) return false;
        if (excludeVision && model.vision) return false;
        if (requireThinking && !model.thinking) return false;
        if (vramCap > 0 && model.vramMB > vramCap) return false;
        return true;
    });

    if (!models.length) {
        models = MODEL_CATALOG.filter((model) => {
            if (!includeAdvanced && model.advanced) return false;
            if (requireVision && !model.vision) return false;
            if (excludeVision && model.vision) return false;
            if (requireThinking && !model.thinking) return false;
            return true;
        });
    }

    return models.sort((a, b) => a.vramMB - b.vramMB);
}

function analyzeRoutingTask(text) {
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

function scoreModelForTask(model, task, hasImage) {
    let score = getModelTierRank(model) * 20;

    if (model.thinking && (task.reasoning || task.coding || task.complex)) score += 25;
    if (!model.thinking && task.shortPrompt) score += 4;
    if (task.creative && getModelTierRank(model) >= 2) score += 6;
    if (hasImage && model.vision) score += 100;
    if (!hasImage && model.vision) score -= 15;

    if (modelRoutingProfileMode === 'speed') {
        score -= model.vramMB / 150;
        if (task.shortPrompt) score += 6;
    } else if (modelRoutingProfileMode === 'quality') {
        score += model.vramMB / 300;
        if (model.thinking) score += 10;
    } else {
        score -= model.vramMB / 350;
        if (!task.complex && getModelTierRank(model) >= 4) score -= 8;
    }

    return score;
}

function chooseModelRoute(text, hasImage) {
    if (hasImage) {
        const visionChoices = getEligibleModels({ requireVision: true });
        if (!visionChoices.length) {
            return {
                targetModelId: selectedModelId,
                reason: 'No compatible vision model available',
            };
        }
        const target = visionChoices[visionChoices.length - 1];
        return {
            targetModelId: target.id,
            reason: `Image detected. Routed to ${target.name}`,
        };
    }

    const task = analyzeRoutingTask(text);
    const eligible = getEligibleModels({ excludeVision: true });
    if (!eligible.length) {
        return {
            targetModelId: selectedModelId,
            reason: 'No compatible models available',
        };
    }

    let bestModel = eligible[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const model of eligible) {
        const score = scoreModelForTask(model, task, false);
        if (score > bestScore) {
            bestModel = model;
            bestScore = score;
        }
    }

    const currentModel = getModelById(selectedModelId);
    const currentScore = scoreModelForTask(currentModel, task, false);
    if (bestModel.id !== currentModel.id && bestScore - currentScore < 8) {
        return {
            targetModelId: currentModel.id,
            reason: `Stayed on ${currentModel.name} (similar score)`,
        };
    }

    return {
        targetModelId: bestModel.id,
        reason: `Routed to ${bestModel.name} for this request`,
    };
}

async function switchModelById(newModelId, options = {}) {
    if (!newModelId || newModelId === selectedModelId || !engine) {
        return { switched: false, reason: 'No switch needed' };
    }

    if (modelSwitchPromise) {
        await modelSwitchPromise;
        if (newModelId === selectedModelId) {
            return { switched: false, reason: 'Model already switched by a pending request' };
        }
    }

    const targetModel = getModelById(newModelId);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    setHotSwapStatus(`Hot swapping to ${targetModel.name}...`);
    logRuntimeEvent('hot_swap_start', {
        fromModelId: selectedModelId,
        toModelId: newModelId,
        toModelName: targetModel.name,
    });
    let lastLoggedPct = -1;

    modelSwitchPromise = (async () => {
        await engine.reload(newModelId, {
            initProgressCallback: (report) => {
                const pct = parseProgressPercent(report?.text || '');
                setHotSwapStatus(`Hot swapping to ${targetModel.name}...`, pct);
                if (typeof pct === 'number' && pct !== lastLoggedPct) {
                    lastLoggedPct = pct;
                    logRuntimeEvent('hot_swap_progress', {
                        toModelId: newModelId,
                        percent: pct,
                    });
                }
                if (onProgress) onProgress(report);
            },
        });
    })();

    try {
        await modelSwitchPromise;
        selectedModelId = newModelId;
        applyModelUiState();
        setHotSwapStatus(`Switched to ${targetModel.name}`, 100);
        setTimeout(() => {
            if (modelSwitchPromise) return;
            setHotSwapStatus('', null, false);
        }, 1200);
        logRuntimeEvent('hot_swap_done', {
            toModelId: newModelId,
            toModelName: targetModel.name,
        });
        return { switched: true, reason: `Switched to ${targetModel.name}` };
    } catch (err) {
        setHotSwapStatus('Hot swap failed', null, true);
        setTimeout(() => {
            if (modelSwitchPromise) return;
            setHotSwapStatus('', null, false);
        }, 1600);
        logRuntimeEvent('hot_swap_fail', {
            toModelId: newModelId,
            error: String(err?.message || err || ''),
        });
        throw err;
    } finally {
        modelSwitchPromise = null;
    }
}

const PROMPT_PRESETS = [
    {
        id: 'balanced',
        label: 'Balanced Assistant',
        prompt: DEFAULT_SYSTEM_PROMPT,
    },
    {
        id: 'writer',
        label: 'Writer',
        prompt: 'You are a concise writing assistant. Improve clarity, structure, and tone while preserving user intent. Offer 2-3 variants when useful.',
    },
    {
        id: 'coder',
        label: 'Coder',
        prompt: 'You are a practical coding assistant. Provide correct code first, then short explanations. Call out assumptions and suggest tests.',
    },
    {
        id: 'research',
        label: 'Research',
        prompt: 'You are a research assistant. Organize answers into key points, evidence, and caveats. Highlight uncertainty instead of guessing.',
    },
    {
        id: 'tutor',
        label: 'Tutor',
        prompt: 'You are a patient tutor. Explain step-by-step, check understanding, and use examples before introducing advanced terms.',
    },
];

async function getWhisperApi() {
    if (whisperApi) return whisperApi;
    if (!whisperModulePromise) {
        whisperModulePromise = import('./whisper.js');
    }
    const mod = await whisperModulePromise;
    whisperApi = {
        initWhisper: mod.initWhisper,
        transcribeAudio: mod.transcribeAudio,
        isWhisperReady: mod.isWhisperReady,
    };
    return whisperApi;
}

function setGeneratingState(active) {
    isGenerating = active;
    sendBtn.disabled = !active && (!userInput.value.trim() && !pendingImage);
    sendBtn.classList.toggle('generating', active);
    sendBtn.title = active ? 'Stop generation' : 'Send message';
    sendBtn.innerHTML = active ? STOP_ICON_SVG : SEND_ICON_SVG;
    renderDebugPanel();
}

function requestGenerationCancel() {
    if (!isGenerating) return;
    generationCancelRequested = true;
    logRuntimeEvent('generation_cancel', { source: 'user' });
    try {
        if (engine && typeof engine.interruptGenerate === 'function') {
            engine.interruptGenerate();
        }
    } catch (err) {
        console.warn('interruptGenerate failed:', err);
    }
}

function getSortedConversations() {
    return [...conversations].sort((a, b) => {
        const ap = a?.pinned ? 1 : 0;
        const bp = b?.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return (b?.updatedAt || 0) - (a?.updatedAt || 0);
    });
}

function getVisibleConversations() {
    const sorted = getSortedConversations();
    if (!conversationSearchQuery) return sorted;
    const q = conversationSearchQuery.toLowerCase();
    return sorted.filter((conv) => {
        const title = String(conv?.title || '').toLowerCase();
        const text = conv?.messages
            ?.map((m) => getMessageText(m?.content || ''))
            .join(' ')
            .toLowerCase() || '';
        return title.includes(q) || text.includes(q);
    });
}

// ---- Helpers ----
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
}

function generateTitle(messages) {
    // Use the first user message as a title, truncated
    const firstUserMsg = messages.find((m) => m.role === 'user');
    if (firstUserMsg) {
        const text = getMessageText(firstUserMsg.content)
            .replace(/^\/(no_)?think\n/, '')
            .trim();
        if (!text && getMessageImageUrl(firstUserMsg.content)) {
            return 'Image conversation';
        }
        return text.length > 40 ? text.slice(0, 40) + '...' : text;
    }
    return 'New conversation';
}

function getMessageText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .filter((part) => part?.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .join('\n')
            .trim();
    }
    return '';
}

function getMessageImageUrl(content) {
    if (!Array.isArray(content)) return null;
    const imagePart = content.find((part) => part?.type === 'image_url');
    if (!imagePart) return null;
    if (typeof imagePart.image_url === 'string') return imagePart.image_url;
    return imagePart.image_url?.url || null;
}

function getRenderableMessage(role, content) {
    const text = getMessageText(content);
    const imageUrl = role === 'user' ? getMessageImageUrl(content) : null;

    return {
        text: role === 'user' ? text.replace(/^\/(no_)?think\n/, '') : text,
        imageUrl,
    };
}

function getEffectiveSystemPrompt() {
    const rawPrompt = systemPrompt.value?.trim() || DEFAULT_SYSTEM_PROMPT;
    if (rawPrompt === LEGACY_SYSTEM_PROMPT) {
        return DEFAULT_SYSTEM_PROMPT;
    }
    return rawPrompt;
}

function safeStartsWith(value, prefix) {
    return typeof value === 'string' && value.startsWith(prefix);
}

function isVisionRecoverableError(err) {
    const errText = String(err?.message || err || '');
    return /startsWith|embed\.shape|image_url\.url/i.test(errText);
}

function visionDebug(label, payload) {
    if (!verboseVisionLogs) return;
    console.info(`[Vision Debug] ${label}`, payload);
}

function calculatePhiVisionResizeShape(imageHeight, imageWidth) {
    const hdNum = 16;
    const ratio = imageWidth / imageHeight;
    let scale = 1;
    while (scale * Math.ceil(scale / ratio) <= hdNum) {
        scale += 1;
    }
    scale -= 1;
    const newW = scale * 336;
    const newH = Math.floor(newW / ratio);
    return [newH, newW];
}

function calculatePhiVisionCropShape(imageHeight, imageWidth) {
    const [resizedHeight, resizedWidth] = calculatePhiVisionResizeShape(imageHeight, imageWidth);
    const padH = Math.ceil(resizedHeight / 336) * 336;
    const padW = resizedWidth;
    return [Math.floor(padH / 336), Math.floor(padW / 336)];
}

function estimatePhiVisionEmbedSize(imageHeight, imageWidth) {
    const [cropH, cropW] = calculatePhiVisionCropShape(imageHeight, imageWidth);
    const subTokens = cropH * 12 * ((cropW * 12) + 1);
    const globalTokens = 12 * (12 + 1);
    return {
        cropH,
        cropW,
        embedSize: subTokens + 1 + globalTokens,
    };
}

function readImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function normalizeUserMultimodalContent(content) {
    if (!Array.isArray(content)) return { content, changed: false };

    let changed = false;
    let normalized = [];

    for (const part of content) {
        if (part?.type === 'text') {
            const text = typeof part.text === 'string' ? part.text : '';
            if (text !== part.text) changed = true;
            normalized.push({ type: 'text', text });
            continue;
        }

        if (part?.type === 'image_url') {
            const rawUrl = typeof part.image_url === 'string'
                ? part.image_url
                : (typeof part.image_url?.url === 'string' ? part.image_url.url : '');

            if (!rawUrl) {
                changed = true;
                continue;
            }

            if (typeof part.image_url === 'string' || part.image_url?.url !== rawUrl) {
                changed = true;
            }

            normalized.push({
                type: 'image_url',
                image_url: { url: rawUrl },
            });
            continue;
        }

        normalized.push(part);
    }

    const textParts = normalized.filter((part) => part?.type === 'text');
    if (textParts.length > 1) {
        changed = true;
        const merged = textParts.map((part) => part.text || '').join('\n').trim();
        normalized = normalized.filter((part) => part?.type !== 'text');
        normalized.unshift({ type: 'text', text: merged });
    }

    if (!normalized.some((part) => part?.type === 'text')) {
        changed = true;
        normalized.unshift({ type: 'text', text: 'What is in this image?' });
    }

    return { content: normalized, changed };
}

function normalizeConversationForModel(conv) {
    if (!conv || !Array.isArray(conv.messages)) return false;

    let changed = false;
    conv.messages = conv.messages.map((msg) => {
        if (!msg || msg.role !== 'user' || !Array.isArray(msg.content)) return msg;

        const normalized = normalizeUserMultimodalContent(msg.content);
        if (!normalized.changed) return msg;

        changed = true;
        return {
            ...msg,
            content: normalized.content,
        };
    });

    return changed;
}

async function normalizeConversationVisionImages(conv) {
    if (!conv || !Array.isArray(conv.messages)) return 0;
    let changed = 0;

    for (const msg of conv.messages) {
        if (!msg || msg.role !== 'user' || !Array.isArray(msg.content)) continue;

        for (let i = 0; i < msg.content.length; i++) {
            const part = msg.content[i];
            if (part?.type !== 'image_url') continue;

            const currentUrl = typeof part.image_url === 'string'
                ? part.image_url
                : part.image_url?.url;
            if (!safeStartsWith(currentUrl, 'data:image')) continue;

            let dims;
            try {
                dims = await readImageDimensions(currentUrl);
            } catch (err) {
                console.warn('[Vision] Failed to read stored image dimensions:', err);
                continue;
            }

            if (dims.width === 1344 && dims.height === 1008) continue;

            const normalized = await normalizeVisionDataUrl(currentUrl, 1344, 1008);
            const nextUrl = normalized.dataUrl;
            msg.content[i] = { ...part, image_url: { url: nextUrl } };

            changed += 1;
            visionDebug('Migrated stored image to landscape 4:3', {
                before: `${dims.width}x${dims.height}`,
                after: `${normalized.targetWidth}x${normalized.targetHeight}`,
                embedEstimate: estimatePhiVisionEmbedSize(normalized.targetHeight, normalized.targetWidth).embedSize,
            });
        }
    }

    return changed;
}

function updateLatestUserImageUrl(conv, dataUrl) {
    if (!conv || !Array.isArray(conv.messages) || !dataUrl) return false;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i];
        if (!msg || msg.role !== 'user' || !Array.isArray(msg.content)) continue;
        let changed = false;
        msg.content = msg.content.map((part) => {
            if (part?.type !== 'image_url') return part;
            changed = true;
            return { ...part, image_url: { url: dataUrl } };
        });
        return changed;
    }
    return false;
}

function buildVisionCompactContext(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return [];
    const latestIndex = messages.length - 1;

    return messages.map((msg, index) => {
        if (!msg || msg.role !== 'user' || !Array.isArray(msg.content)) return msg;
        const text = getMessageText(msg.content).trim();
        const imageUrl = getMessageImageUrl(msg.content);

        if (index === latestIndex && imageUrl) {
            return {
                role: 'user',
                content: [
                    { type: 'text', text: text || 'What is in this image?' },
                    { type: 'image_url', image_url: { url: imageUrl } },
                ],
            };
        }

        return {
            role: 'user',
            content: text || 'Please continue.',
        };
    });
}

// ============================================
// Web Search
// ============================================

function toggleWebSearch(enabled, options = {}) {
    const shouldPersist = options.persist !== false;
    webSearchEnabled = enabled;
    webSearchToggle.classList.toggle('active', enabled);
    webSearchSetting.checked = enabled;
    updateInputDisclaimer();

    if (shouldPersist) {
        saveSettings();
    }
}

function updateInputDisclaimer() {
    if (webSearchEnabled) {
        inputDisclaimer.textContent = 'Web-Enhanced mode is on. Search queries are sent to DuckDuckGo.';
        inputDisclaimer.classList.add('web-active');
        return;
    }

    if (isVisionModel()) {
        inputDisclaimer.textContent = 'Vision ready. Attach, paste, or drop an image to analyze.';
    } else {
        inputDisclaimer.textContent = 'AI runs locally in your browser. Responses may vary in quality.';
    }

    inputDisclaimer.classList.remove('web-active');
}

async function webSearch(query) {
    try {
        // Strategy: try DuckDuckGo HTML lite (simpler, better for parsing)
        const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;

        const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Search failed');

        const html = await response.text();
        const results = parseDDGLite(html);

        // If lite didn't get results, try the Instant Answer API as fallback
        if (results.length === 0) {
            return await webSearchFallback(query);
        }

        return results.slice(0, 6);
    } catch (err) {
        console.warn('Primary search failed, trying fallback:', err);
        return await webSearchFallback(query);
    }
}

function parseDDGLite(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // DuckDuckGo Lite uses a table layout with result links and snippets
    const links = doc.querySelectorAll('a.result-link');
    const snippets = doc.querySelectorAll('.result-snippet');

    if (links.length > 0) {
        for (let i = 0; i < Math.min(links.length, 6); i++) {
            const link = links[i];
            const snippet = snippets[i];
            if (link && snippet) {
                results.push({
                    title: link.textContent.trim(),
                    snippet: snippet.textContent.trim(),
                    url: link.href || '',
                });
            }
        }
    }

    // Alternative parsing: DDG lite sometimes uses different structure
    if (results.length === 0) {
        // Try parsing table rows
        const rows = doc.querySelectorAll('tr');
        let currentResult = null;

        for (const row of rows) {
            const linkEl = row.querySelector('a[href^="http"]');
            if (linkEl && !linkEl.href.includes('duckduckgo.com')) {
                if (currentResult && currentResult.snippet) {
                    results.push(currentResult);
                }
                currentResult = {
                    title: linkEl.textContent.trim(),
                    snippet: '',
                    url: linkEl.href,
                };
            } else if (currentResult) {
                const text = row.textContent.trim();
                if (text && text.length > 20 && !text.includes('duckduckgo.com')) {
                    currentResult.snippet = text;
                }
            }
        }
        if (currentResult && currentResult.snippet) {
            results.push(currentResult);
        }
    }

    return results;
}

async function webSearchFallback(query) {
    try {
        const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;

        const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return [];

        const data = await response.json();
        const results = [];

        if (data.Abstract) {
            results.push({
                title: data.Heading || 'Summary',
                snippet: data.Abstract,
                url: data.AbstractURL || '',
            });
        }

        if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics.slice(0, 5)) {
                if (topic.Text) {
                    results.push({
                        title: topic.Text.split(' - ')[0]?.slice(0, 60) || '',
                        snippet: topic.Text,
                        url: topic.FirstURL || '',
                    });
                }
            }
        }

        if (data.Answer) {
            results.unshift({ title: 'Quick Answer', snippet: data.Answer, url: '' });
        }

        return results.slice(0, 6);
    } catch (err) {
        console.warn('Fallback search also failed:', err);
        return [];
    }
}

function buildSearchContext(results) {
    if (!results.length) return '';
    let ctx = '\n\n[WEB SEARCH RESULTS - Use these to answer the question]\n';
    for (let i = 0; i < results.length; i++) {
        ctx += `[${i + 1}] ${results[i].snippet}\n`;
    }
    ctx += '\nIMPORTANT: Base your answer on the search results above. Quote specific facts from the results. If the results do not contain the answer, clearly say "I could not find this information in the search results." Do NOT make up information.\n';
    return ctx;
}

function renderSourceCitations(results, container) {
    if (!results.length) return;
    const sources = results.filter(r => r.url);
    if (!sources.length) return;

    const div = document.createElement('div');
    div.className = 'search-sources';
    div.innerHTML = `
    <div class="search-sources-title">Sources</div>
    ${sources.map(s => `<a class="search-source-link" href="${s.url}" target="_blank" rel="noopener">${new URL(s.url).hostname}</a>`).join('')}
  `;
    container.appendChild(div);
}

// ---- Init ----
async function init() {
    if (!navigator.gpu) {
        webgpuError.style.display = 'block';
        downloadSection.style.display = 'none';
        return;
    }

    await initDatabase();
    await loadSettings();
    renderPromptPresets();

    // Detect device capabilities and auto-select model
    statusText.textContent = 'Detecting device capabilities...';
    deviceCapabilities = await detectDeviceCapabilities();
    const recommended = autoSelectModel(deviceCapabilities);

    // Check if user has a saved model preference (manual model or auto)
    const savedSelectionId = await getSavedModelSelectionId();
    if (savedSelectionId) {
        modelSelectionId = savedSelectionId;
    } else {
        modelSelectionId = recommended.id;
    }
    selectedModelId = isAutoModelSelected() ? recommended.id : modelSelectionId;

    applyModelUiState();
    logRuntimeEvent('app_init', {
        gpu: deviceCapabilities?.gpuName || 'unknown',
        vramMB: deviceCapabilities?.vramMB || 0,
    });

    // Render the initial model selector on the loading screen
    renderStartModelSelector(deviceCapabilities, recommended);

    // Check cache and update UI
    await updateStartScreenUi(deviceCapabilities, recommended);

    // Populate model selector in settings
    renderModelSelector(deviceCapabilities, recommended);

    startBtn.addEventListener('click', loadModel);
    startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        loadModel();
    });
}

function renderStartModelSelector(capabilities, recommended) {
    const container = document.getElementById('start-model-selector-group');
    if (!container) return;
    const groups = getModelGroups();

    let html = `<select id="start-model-select" style="width: 100%; padding: 0.7rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-family: var(--font); cursor: pointer; outline: none;">`;
    html += `<option value="${AUTO_MODEL_ID}" ${modelSelectionId === AUTO_MODEL_ID ? 'selected' : ''}>Auto (smart per request)</option>`;
    html += `<optgroup label="Curated Models">`;
    html += renderModelOptions(groups.curated, {
        selectionId: modelSelectionId,
        recommendedId: recommended.id,
        capabilities,
        highVramLabel: 'High VRAM',
    });
    html += `</optgroup>`;
    if (groups.advanced.length > 0) {
        html += `<optgroup label="Advanced Models">`;
        html += renderModelOptions(groups.advanced, {
            selectionId: modelSelectionId,
            recommendedId: recommended.id,
            capabilities,
            highVramLabel: 'High VRAM',
        });
        html += `</optgroup>`;
    }
    html += `</select>`;
    html += `<p class="setting-hint" style="margin-top:0.4rem; text-align:center;">Your GPU: <strong>${capabilities.gpuName}</strong> (~${capabilities.vramMB}MB VRAM)</p>`;

    container.innerHTML = html;

    const select = document.getElementById('start-model-select');
    if (select) {
        select.addEventListener('change', async () => {
            modelSelectionId = select.value;
            saveModelSelectionId();
            selectedModelId = isAutoModelSelected() ? recommended.id : modelSelectionId;
            applyModelUiState();

            // Update cache status
            await updateStartScreenUi(capabilities, recommended);
        });
    }
}

async function updateStartScreenUi(capabilities, recommended) {
    const selectedModel = isAutoModelSelected() ? resolveAutoModelCandidate() : getModelById(modelSelectionId);
    const displayName = isAutoModelSelected()
        ? `Auto (starts with ${selectedModel.name})`
        : selectedModel.name;
    
    statusText.innerHTML = `Checking cache state...`;
    startBtn.style.display = 'none';
    
    let isCached = false;
    try {
        isCached = await webllm.hasModelInCache(selectedModel.id);
    } catch(err) {
        console.warn('Cache check failed:', err);
    }

    const noteEl = document.getElementById('cache-status-note');
    if (!noteEl) return;

    if (isCached) {
        startBtn.textContent = 'Start App (Cached)';
        noteEl.innerHTML = 'Model is ready locally. <strong>No download required.</strong>';
        statusText.innerHTML = `Ready to load <strong>${displayName}</strong>`;
    } else {
        startBtn.textContent = 'Download & Start';
        noteEl.innerHTML = `~${selectedModel.size} download, will be cached for future visits.`;
        statusText.innerHTML = `First-time setup for <strong>${displayName}</strong>`;
    }
    
    startBtn.style.display = 'inline-flex';
}

// ---- Model Loading ----
async function loadModel() {
    startBtn.style.display = 'none';
    const targetModel = isAutoModelSelected() ? resolveAutoModelCandidate() : getModelById(modelSelectionId);
    selectedModelId = targetModel.id;
    const model = targetModel;
    statusText.textContent = `Loading ${model.name}...`;

    try {
        const initProgressCallback = (report) => {
            const text = report.text || '';
            statusText.textContent = text;

            const match = text.match(/(\d+)%/);
            if (match) {
                const pct = parseInt(match[1]);
                progressFill.style.width = pct + '%';
                progressPercent.textContent = pct + '%';
            }

            if (text.includes('Loading model')) {
                statusText.textContent = `Loading ${model.name} into GPU memory...`;
            }
        };

        engine = await webllm.CreateMLCEngine(targetModel.id, {
            initProgressCallback,
        });

        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        statusText.textContent = `${model.name} loaded! Starting chat...`;
        applyModelUiState();
        logRuntimeEvent('model_loaded', {
            modelId: selectedModelId,
            modelName: model.name,
        });

        setTimeout(() => {
            void showChatScreen();
        }, 500);
    } catch (err) {
        console.error('Model loading failed:', err);
        statusText.textContent = 'Failed to load model: ' + err.message;
        startBtn.style.display = 'inline-flex';
        startBtn.textContent = 'Retry';
    }
}

function renderModelSelector(capabilities, recommended) {
    const container = document.getElementById('model-selector-group');
    if (!container) return;
    const groups = getModelGroups();

    let html = `<label for="model-select">AI Model</label>`;
    html += `<select id="model-select">`;
    html += `<option value="${AUTO_MODEL_ID}" ${modelSelectionId === AUTO_MODEL_ID ? 'selected' : ''}>Auto (smart per request)</option>`;
    html += `<optgroup label="Curated Models">`;
    html += renderModelOptions(groups.curated, {
        selectionId: modelSelectionId,
        recommendedId: recommended.id,
        capabilities,
        highVramLabel: 'May be too large',
    });
    html += `</optgroup>`;
    if (groups.advanced.length > 0) {
        html += `<optgroup label="Advanced Models">`;
        html += renderModelOptions(groups.advanced, {
            selectionId: modelSelectionId,
            recommendedId: recommended.id,
            capabilities,
            highVramLabel: 'May be too large',
        });
        html += `</optgroup>`;
    }
    html += `</select>`;
    html += `<p class="setting-hint">`;
    html += `GPU: ${capabilities.gpuName} - Est. VRAM: ${capabilities.vramMB}MB`;
    html += `</p>`;
    html += `<button id="switch-model-btn" class="btn-primary" style="display:none; margin-top:0.5rem; width:100%;">Switch Model</button>`;

    container.innerHTML = html;

    // Listen for changes
    const select = document.getElementById('model-select');
    const switchBtn = document.getElementById('switch-model-btn');

    if (select) {
        select.addEventListener('change', () => {
            const newSelection = select.value;
            if (newSelection !== modelSelectionId) {
                switchBtn.style.display = 'block';
            } else {
                switchBtn.style.display = 'none';
            }
        });
    }

    if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
            const requestedSelection = select.value;
            const targetModel = requestedSelection === AUTO_MODEL_ID
                ? resolveAutoModelCandidate()
                : getModelById(requestedSelection);
            if (requestedSelection === modelSelectionId && targetModel.id === selectedModelId) {
                switchBtn.style.display = 'none';
                return;
            }
            if (isGenerating) {
                alert('Please wait for generation to finish before switching models.');
                return;
            }
            modelSelectionId = requestedSelection;
            saveModelSelectionId();
            const model = targetModel;

            // Close settings
            const settingsPanel = $('#settings-panel');
            if (settingsPanel) settingsPanel.classList.remove('open');

            try {
                switchBtn.disabled = true;
                switchBtn.textContent = `Hot swapping to ${model.name}...`;
                await switchModelById(targetModel.id);
                switchBtn.style.display = 'none';
            } catch (err) {
                console.error('Model switch failed:', err);
                alert(`Model switch failed: ${err.message}`);
            } finally {
                switchBtn.disabled = false;
                switchBtn.textContent = 'Switch Model';
            }
        });
    }
}

// ---- Screen Management ----
async function showChatScreen() {
    loadingScreen.classList.remove('active');
    chatScreen.classList.add('active');
    userInput.focus();
    applyModelUiState();

    // Load conversations from storage
    await loadConversations();

    // If no conversations, show welcome screen (no active conversation)
    if (conversations.length === 0) {
        activeConversationId = null;
        renderWelcome();
    } else {
        // Load the most recent conversation
        const visible = getVisibleConversations();
        if (visible.length > 0) switchToConversation(visible[0].id);
    }

    renderSidebar();
}

// ============================================
// Conversation CRUD
// ============================================

function createConversation() {
    const conv = {
        id: generateId(),
        title: 'New conversation',
        messages: [],
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    conversations.unshift(conv);
    activeConversationId = conv.id;
    saveConversations();
    renderSidebar();
    renderWelcome();
    closeSidebar();
    userInput.focus();
    return conv;
}

function switchToConversation(id) {
    if (isGenerating) return;

    activeConversationId = id;
    const conv = getActiveConversation();
    if (!conv) return;
    const convWasNormalized = normalizeConversationForModel(conv);
    if (convWasNormalized) {
        saveConversations();
    }

    // Render messages
    messagesContainer.innerHTML = '';
    if (conv.messages.length === 0) {
        renderWelcome();
    } else {
        for (const msg of conv.messages) {
            const renderable = getRenderableMessage(msg.role, msg.content);
            addMessageToDOM(msg.role, renderable.text, renderable.imageUrl);
        }
        scrollToBottom();
    }

    renderSidebar();
    closeSidebar();
}

function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);

    if (activeConversationId === id) {
        const visible = getVisibleConversations();
        if (visible.length > 0) {
            switchToConversation(visible[0].id);
        } else {
            activeConversationId = null;
            renderWelcome();
        }
    }

    saveConversations();
    renderSidebar();
}

function getActiveConversation() {
    return conversations.find((c) => c.id === activeConversationId) || null;
}

// ============================================
// Sidebar Rendering
// ============================================

function renderSidebar() {
    const visibleConversations = getVisibleConversations();
    if (visibleConversations.length === 0) {
        conversationList.innerHTML = `
      <div class="conv-empty">
        <p>${conversations.length === 0 ? 'No conversations yet.' : 'No matches found.'}</p>
        <p>${conversations.length === 0 ? 'Start a new chat!' : 'Try another search.'}</p>
      </div>
    `;
        return;
    }

    conversationList.innerHTML = visibleConversations
        .map(
            (conv) => `
      <div class="conv-item ${conv.id === activeConversationId ? 'active' : ''} ${conv.pinned ? 'pinned' : ''}" data-id="${conv.id}">
        <span class="conv-icon">[chat]</span>
        <div class="conv-info">
          <div class="conv-title">${escapeHtml(conv.title)}</div>
          <div class="conv-time">${formatTime(conv.updatedAt)}</div>
        </div>
        <button class="conv-pin" data-pin-id="${conv.id}" title="${conv.pinned ? 'Unpin conversation' : 'Pin conversation'}">
          ${conv.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button class="conv-delete" data-delete-id="${conv.id}" title="Delete conversation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `
        )
        .join('');

    // Bind click handlers
    conversationList.querySelectorAll('.conv-item').forEach((item) => {
        item.addEventListener('click', (e) => {
            // Don't switch if clicking delete
            if (e.target.closest('.conv-delete') || e.target.closest('.conv-pin')) return;
            switchToConversation(item.dataset.id);
        });
        item.addEventListener('touchend', (e) => {
            if (e.target.closest('.conv-delete') || e.target.closest('.conv-pin')) return;
            e.preventDefault();
            switchToConversation(item.dataset.id);
        });
    });

    conversationList.querySelectorAll('.conv-pin').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleConversationPin(btn.dataset.pinId);
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleConversationPin(btn.dataset.pinId);
        });
    });

    conversationList.querySelectorAll('.conv-delete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(btn.dataset.deleteId);
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteConversation(btn.dataset.deleteId);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Sidebar Toggle (mobile)
// ============================================

function openSidebar() {
    sidebar.classList.add('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
}

// ============================================
// Chat Logic
// ============================================

async function sendMessage(text) {
    if ((!text.trim() && !pendingImage) || isGenerating || !engine) return;

    const userText = text.trim();
    userInput.value = '';
    autoResizeInput();
    sendBtn.disabled = true;

    // If no active conversation, create one
    if (!activeConversationId) {
        createConversation();
    }

    const conv = getActiveConversation();
    if (!conv) return;
    if (normalizeConversationForModel(conv)) {
        saveConversations();
    }
    if (isVisionModel()) {
        const migrated = await normalizeConversationVisionImages(conv);
        if (migrated > 0) {
            saveConversations();
        }
    }

    // Remove welcome message
    const welcome = messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // Formulate final text for user
    let finalUserText = userText;
    
    // If thinking model, explicitly request mode
    if (isThinkingModel()) {
        const instruction = thinkingEnabled ? '/think\n' : '/no_think\n';
        finalUserText = instruction + userText;
    }

    // Add user message (with optional image)
    const imageDataUrl = pendingImage?.dataUrl || null;
    const imageMeta = pendingImage?.meta || null;
    if (imageDataUrl) {
        addMessageToDOM('user', userText, imageDataUrl);
        const est = imageMeta
            ? estimatePhiVisionEmbedSize(imageMeta.targetHeight, imageMeta.targetWidth)
            : null;
        visionDebug('Sending image prompt', {
            model: selectedModelId,
            source: imageMeta ? `${imageMeta.sourceWidth}x${imageMeta.sourceHeight}` : 'unknown',
            prepared: imageMeta ? `${imageMeta.targetWidth}x${imageMeta.targetHeight}` : 'unknown',
            crop: est ? `${est.cropH}x${est.cropW}` : 'unknown',
            embedEstimate: est ? est.embedSize : 'unknown',
            promptLength: (finalUserText || '').length,
        });
        // For vision models, use multimodal content format
        conv.messages.push({
            role: 'user',
            content: [
                { type: 'text', text: finalUserText || 'What is in this image?' },
                { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
        });
        // Clear pending image
        pendingImage = null;
        imagePreview.style.display = 'none';
        imagePreviewImg.src = '';
    } else {
        addMessageToDOM('user', userText);
        conv.messages.push({ role: 'user', content: finalUserText });
    }

    // Update title from first user message
    if (conv.messages.filter((m) => m.role === 'user').length === 1) {
        conv.title = generateTitle(conv.messages);
        renderSidebar();
    }

    // Add AI placeholder
    const aiMsg = addMessageToDOM('assistant', '');
    const contentEl = aiMsg.querySelector('.message-content');
    contentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    const hasAssistantHistory = conv.messages.some((m) => m?.role === 'assistant');

    scrollToBottom();
    generationCancelRequested = false;
    const generationId = ++activeGenerationId;
    setGeneratingState(true);
    logRuntimeEvent('generation_start', {
        generationId,
        hasImage: Boolean(imageDataUrl),
        userChars: userText.length,
    });

    try {
        if (isAutoModelSelected()) {
            const routing = chooseModelRoute(userText, Boolean(imageDataUrl));
            logRuntimeEvent('route_decision', {
                reason: routing.reason,
                targetModelId: routing.targetModelId,
                currentModelId: selectedModelId,
            });
            if (routing.targetModelId !== selectedModelId) {
                if (hasAssistantHistory) {
                    contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Preparing the best model for this request...</div>';
                    scrollToBottom();
                }
                await switchModelById(routing.targetModelId, {
                    onProgress: () => {
                        if (hasAssistantHistory) {
                            contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Loading selected model...</div>';
                        }
                    },
                });
                visionDebug('Model routing switch', {
                    routeReason: routing.reason,
                    targetModel: routing.targetModelId,
                });
            }
        }

        // Web search if enabled
        let searchResults = [];
        if (webSearchEnabled && userText) {
            contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Searching the web...</div>';
            scrollToBottom();
            searchResults = await webSearch(userText);
        }

        // Build messages with optional search context
        const searchContext = buildSearchContext(searchResults);
        const sysContent = getEffectiveSystemPrompt() + searchContext;

        const messages = [
            { role: 'system', content: sysContent },
            ...conv.messages,
        ];

        const temperature = parseFloat(temperatureSlider.value);
        const maxTokens = parseInt(maxTokensSlider.value);
        const createStream = (requestMessages) => engine.chat.completions.create({
            messages: requestMessages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
        });

        contentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

        let fullResponse = '';
        let tokenCount = 0;
        const startTime = performance.now();

        let chunks;
        const isVisionRequest = Boolean(imageDataUrl && isVisionModel());
        let requestMessages = messages;
        let finalErr = null;

        for (let attempt = 0; attempt < 3; attempt++) {
            if (generationCancelRequested || generationId !== activeGenerationId) {
                throw new Error('Generation cancelled by user.');
            }
            try {
                chunks = await createStream(requestMessages);
                finalErr = null;
                break;
            } catch (err) {
                if (generationCancelRequested || generationId !== activeGenerationId) {
                    throw new Error('Generation cancelled by user.');
                }
                finalErr = err;
                if (!isVisionRequest || !isVisionRecoverableError(err)) {
                    throw err;
                }

                if (attempt === 0) {
                    console.warn('[Vision] Generation failed, retrying with compatibility resize', {
                        reason: String(err?.message || err || ''),
                        model: selectedModelId,
                    });
                    contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Vision retry: applying compatibility resize...</div>';
                    scrollToBottom();

                    const fallback = await normalizeVisionDataUrl(imageDataUrl, 1008, 756);
                    const fallbackDataUrl = fallback.dataUrl;
                    const fallbackEst = estimatePhiVisionEmbedSize(fallback.targetHeight, fallback.targetWidth);
                    visionDebug('Retry image prepared (compatibility)', {
                        target: `${fallback.targetWidth}x${fallback.targetHeight}`,
                        crop: `${fallbackEst.cropH}x${fallbackEst.cropW}`,
                        embedEstimate: fallbackEst.embedSize,
                    });
                    updateLatestUserImageUrl(conv, fallbackDataUrl);
                    requestMessages = [
                        { role: 'system', content: sysContent },
                        ...conv.messages,
                    ];
                    continue;
                }

                if (attempt === 1) {
                    console.warn('[Vision] Second vision attempt failed, retrying with compact context', {
                        reason: String(err?.message || err || ''),
                        model: selectedModelId,
                    });
                    contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Vision retry: compacting context for compatibility...</div>';
                    scrollToBottom();

                    const canonical = await normalizeVisionDataUrl(imageDataUrl, 1344, 1008);
                    updateLatestUserImageUrl(conv, canonical.dataUrl);
                    requestMessages = [
                        { role: 'system', content: sysContent },
                        ...buildVisionCompactContext(conv.messages),
                    ];
                    continue;
                }
            }
        }

        if (!chunks) {
            throw finalErr || new Error('Vision generation failed after automatic retries.');
        }

        for await (const chunk of chunks) {
            if (generationCancelRequested || generationId !== activeGenerationId) {
                break;
            }
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
                fullResponse += delta;
                tokenCount++;
                contentEl.innerHTML = formatMarkdown(fullResponse);
                scrollToBottom();
            }
        }

        if (generationCancelRequested || generationId !== activeGenerationId) {
            if (!fullResponse.trim()) {
                contentEl.innerHTML = '<span style="color: #9ca3af;">Generation stopped.</span>';
            }
            return;
        }

        const elapsed = (performance.now() - startTime) / 1000;
        const tokPerSec = tokenCount / elapsed;

        const statsEl = document.createElement('div');
        statsEl.className = 'perf-stats';
        statsEl.innerHTML = `
      <span class="perf-stat">${tokPerSec.toFixed(1)} tok/s</span>
      <span class="perf-stat">${tokenCount} tokens</span>
      <span class="perf-stat">${elapsed.toFixed(1)}s</span>
    `;
        
        const messageBody = aiMsg.querySelector('.message-body') || aiMsg;
        messageBody.appendChild(statsEl);

        // Show source citations if we used web search
        if (searchResults.length > 0) {
            renderSourceCitations(searchResults, messageBody);
        }

        // Save to conversation
        logRuntimeEvent('generation_done', {
            generationId,
            tokenCount,
            elapsedSec: Number(elapsed.toFixed(2)),
        });
        conv.messages.push({ role: 'assistant', content: fullResponse });
        conv.updatedAt = Date.now();
        saveConversations();
        renderSidebar();
    } catch (err) {
        const errText = String(err?.message || err || '');
        if (/cancelled by user/i.test(errText) || generationCancelRequested || generationId !== activeGenerationId) {
            if (!contentEl.textContent?.trim()) {
                contentEl.innerHTML = '<span style="color: #9ca3af;">Generation stopped.</span>';
            }
            logRuntimeEvent('generation_cancelled', {
                generationId,
                reason: 'interrupted',
            });
        } else {
            console.error('Generation error:', err);
            contentEl.innerHTML = `<span style="color: #f87171;">Error: ${err.message}</span>`;
            logRuntimeEvent('generation_error', {
                generationId,
                error: String(err?.message || err || ''),
            });
        }
    } finally {
        if (generationId === activeGenerationId) {
            setGeneratingState(false);
        }
    }
}

// ---- DOM Helpers ----
function addMessageToDOM(role, content, imageUrl) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'You' : 'AI';

    const body = document.createElement('div');
    body.className = 'message-body';

    const bubble = document.createElement('div');
    bubble.className = 'message-content';

    // If there's an image, show it above the text
    if (imageUrl && role === 'user') {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'message-image';
        img.alt = 'Attached image';
        bubble.appendChild(img);
    }

    if (content) {
        // Hide internal thinking instructions from the UI
        let displayContent = content;
        if (role === 'user' && typeof displayContent === 'string') {
            displayContent = displayContent.replace(/^\/(no_)?think\n/, '');
        }
        
        const textDiv = document.createElement('div');
        textDiv.innerHTML = formatMarkdown(displayContent);
        bubble.appendChild(textDiv);
    }

    body.appendChild(bubble);
    msg.appendChild(avatar);
    msg.appendChild(body);
    messagesContainer.appendChild(msg);

    return msg;
}

function formatMarkdown(text) {
    // Extract thinking blocks if present
    let processedText = text;
    
    // Check if there is an unclosed think tag (model is currently thinking)
    const thinkOpenMatch = text.match(/<think>/g);
    const thinkCloseMatch = text.match(/<\/think>/g);
    
    // Handle completed thinking blocks
    processedText = processedText.replace(/<think>([\s\S]*?)<\/think>/g, (match, content) => {
        return `<details class="think-block"><summary>Thought Process</summary><div class="think-content">${formatBasicHTML(content)}</div></details>`;
    });

    // Handle unclosed thinking block (currently generating)
    if (thinkOpenMatch && (!thinkCloseMatch || thinkOpenMatch.length > thinkCloseMatch.length)) {
        const parts = processedText.split(/<think>/);
        const lastPart = parts.pop(); // The thinking part
        const bodyBefore = parts.join('<think>'); // Everything before the current thinking
        
        return formatBasicHTML(bodyBefore) + `<details class="think-block" open><summary>Thinking...</summary><div class="think-content">${formatBasicHTML(lastPart)}<span class="typing-indicator" style="display:inline-flex;margin-left:8px;"><span></span><span></span><span></span></span></div></details>`;
    }

    return '<p>' + formatBasicHTML(processedText) + '</p>';
}

function formatBasicHTML(text) {
    return text
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function autoResizeInput() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

function renderWelcome() {
    messagesContainer.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">AI</div>
      <h3>Welcome to NeuralBox</h3>
      <p>Your AI is running <strong>entirely in your browser</strong>. No data ever leaves your device.</p>
      <div class="welcome-suggestions">
        <button class="suggestion-chip" data-prompt="Explain quantum computing in simple terms">Explain quantum computing</button>
        <button class="suggestion-chip" data-prompt="Write a short poem about the ocean">Write a poem about the ocean</button>
        <button class="suggestion-chip" data-prompt="What are the benefits of learning a second language?">Benefits of learning languages</button>
        <button class="suggestion-chip" data-prompt="Give me 5 creative project ideas for a weekend">Weekend project ideas</button>
      </div>
    </div>
  `;
    bindSuggestionChips();
}

// ---- Persistence ----
function saveConversations() {
    void saveConversationsRecord(conversations).catch((err) => {
        console.error('[DB] Failed to save conversations:', err);
    });
}

async function loadConversations() {
    try {
        const parsed = await loadConversationsRecord();
        conversations = Array.isArray(parsed) ? parsed : [];

        let normalizedAny = false;
        for (const conv of conversations) {
            conv.pinned = Boolean(conv?.pinned);
            if (normalizeConversationForModel(conv)) {
                normalizedAny = true;
            }
        }
        if (normalizedAny) {
            saveConversations();
        }
    } catch (e) {
        conversations = [];
    }
}

function clearAllConversations() {
    conversations = [];
    activeConversationId = null;
    saveConversations();
    renderSidebar();
    renderWelcome();
}

function renderPromptPresets() {
    if (!promptPresetSelect) return;
    promptPresetSelect.innerHTML = PROMPT_PRESETS
        .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
        .join('');
    const match = PROMPT_PRESETS.find((p) => p.prompt === (systemPrompt.value || '').trim());
    promptPresetSelect.value = match?.id || 'balanced';
}

function applyPromptPreset(presetId) {
    const preset = PROMPT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    systemPrompt.value = preset.prompt;
    saveSettings();
}

async function exportConversationsToFile() {
    const storedSettings = await loadSettingsRecord();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        conversations,
        settings: storedSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `neuralbox-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function importConversationsFromFile(file) {
    if (!file) return;
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const importedConversations = Array.isArray(parsed?.conversations) ? parsed.conversations : [];
    conversations = importedConversations.map((conv) => ({
        ...conv,
        pinned: Boolean(conv?.pinned),
        messages: Array.isArray(conv?.messages) ? conv.messages : [],
    }));
    await saveConversationsRecord(conversations);

    if (parsed?.settings && typeof parsed.settings === 'object') {
        await saveSettingsRecord(parsed.settings);
        await loadSettings();
    }

    const visible = getVisibleConversations();
    if (visible.length > 0) {
        switchToConversation(visible[0].id);
    } else {
        activeConversationId = null;
        renderWelcome();
    }
    renderSidebar();
}

// ---- Settings ----
async function loadSettings() {
    try {
        const settings = await loadSettingsRecord();
        systemPrompt.value = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        if (systemPrompt.value === LEGACY_SYSTEM_PROMPT) {
            systemPrompt.value = DEFAULT_SYSTEM_PROMPT;
        }
        if (settings.temperature != null) {
            temperatureSlider.value = settings.temperature;
            tempValue.textContent = settings.temperature;
        }
        if (settings.maxTokens != null) {
            maxTokensSlider.value = settings.maxTokens;
            tokensValue.textContent = settings.maxTokens;
        }
        if (settings.webSearch) {
            toggleWebSearch(true, { persist: false });
        } else {
            toggleWebSearch(false, { persist: false });
        }
        verboseVisionLogs = Boolean(settings.verboseVisionLogs);
        debugPanelEnabled = Boolean(settings.debugPanelEnabled);
        if (visionVerboseSetting) {
            visionVerboseSetting.checked = verboseVisionLogs;
        }
        if (debugPanelSetting) {
            debugPanelSetting.checked = debugPanelEnabled;
        }
        renderDebugPanel();
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    const snapshot = {
        systemPrompt: systemPrompt.value,
        temperature: parseFloat(temperatureSlider.value),
        maxTokens: parseInt(maxTokensSlider.value),
        webSearch: webSearchEnabled,
        verboseVisionLogs: verboseVisionLogs,
        debugPanelEnabled: debugPanelEnabled,
    };
    void saveSettingsRecord(snapshot).catch((err) => {
        console.error('[DB] Failed to save settings:', err);
    });
}

// ---- Suggestion Chips ----
function bindSuggestionChips() {
    document.querySelectorAll('.suggestion-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt;
            if (prompt) sendMessage(prompt);
        });
        chip.addEventListener('touchend', (e) => {
            e.preventDefault();
            const prompt = chip.dataset.prompt;
            if (prompt) sendMessage(prompt);
        });
    });
}

// ============================================
// Event Listeners
// ============================================

// Send message
sendBtn.addEventListener('click', () => {
    if (isGenerating) {
        requestGenerationCancel();
        return;
    }
    sendMessage(userInput.value);
});
sendBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isGenerating) {
        requestGenerationCancel();
        return;
    }
    sendMessage(userInput.value);
});

// Enter to send
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(userInput.value);
    }
});

// Auto-resize
userInput.addEventListener('input', () => {
    autoResizeInput();
    sendBtn.disabled = !isGenerating && (!userInput.value.trim() && !pendingImage);
});

// New chat (header button)
newChatBtn.addEventListener('click', createConversation);

// Sidebar toggle
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});

sidebarOverlay.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('touchend', (e) => {
    e.preventDefault();
    closeSidebar();
});

// Sidebar new chat button
sidebarNewChat.addEventListener('click', createConversation);
sidebarNewChat.addEventListener('touchend', (e) => {
    e.preventDefault();
    createConversation();
});
if (conversationSearch) {
    conversationSearch.addEventListener('input', () => {
        conversationSearchQuery = String(conversationSearch.value || '').trim();
        renderSidebar();
    });
}

// Settings
settingsBtn.addEventListener('click', () => {
    renderPromptPresets();
    settingsPanel.classList.add('open');
});
settingsOverlay.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    saveSettings();
});
closeSettings.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    saveSettings();
});

// Temperature slider
temperatureSlider.addEventListener('input', () => {
    tempValue.textContent = temperatureSlider.value;
});

// Max tokens slider
maxTokensSlider.addEventListener('input', () => {
    tokensValue.textContent = maxTokensSlider.value;
});

// Clear all conversations
clearHistoryBtn.addEventListener('click', () => {
    clearAllConversations();
    settingsPanel.classList.remove('open');
});
// Suggestion chips
bindSuggestionChips();

// Web search toggles
webSearchToggle.addEventListener('click', () => toggleWebSearch(!webSearchEnabled));
webSearchToggle.addEventListener('touchend', (e) => {
    e.preventDefault();
    toggleWebSearch(!webSearchEnabled);
});
webSearchSetting.addEventListener('change', () => toggleWebSearch(webSearchSetting.checked));
if (visionVerboseSetting) {
    visionVerboseSetting.addEventListener('change', () => {
        verboseVisionLogs = Boolean(visionVerboseSetting.checked);
        saveSettings();
    });
}
if (debugPanelSetting) {
    debugPanelSetting.addEventListener('change', () => {
        debugPanelEnabled = Boolean(debugPanelSetting.checked);
        renderDebugPanel();
        saveSettings();
    });
}
if (debugClearBtn) {
    debugClearBtn.addEventListener('click', () => {
        runtimeEvents.length = 0;
        logRuntimeEvent('debug_cleared', { source: 'user' });
    });
}
if (promptPresetSelect && applyPresetBtn) {
    applyPresetBtn.addEventListener('click', () => {
        applyPromptPreset(promptPresetSelect.value);
    });
}
if (exportChatsBtn) {
    exportChatsBtn.addEventListener('click', () => {
        void exportConversationsToFile().catch((err) => {
            console.error('Export failed:', err);
            alert(`Export failed: ${err.message}`);
        });
    });
}
if (importChatsBtn && importChatsInput) {
    importChatsBtn.addEventListener('click', () => importChatsInput.click());
    importChatsInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await importConversationsFromFile(file);
        } catch (err) {
            console.error('Import failed:', err);
            alert(`Import failed: ${err.message}`);
        } finally {
            importChatsInput.value = '';
        }
    });
}

// Voice / mic (regular mode)
micBtn.addEventListener('click', handleMicClick);
micBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleMicClick();
});

async function handleMicClick() {
    if (isRecording) {
        stopRecording();
        return;
    }
    await startRecording();
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processRecording(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;
        recordingSeconds = 0;

        micBtn.classList.add('recording');
        voiceStatus.style.display = 'flex';
        voiceStatus.className = 'voice-status recording';
        voiceStatus.innerHTML = '<span class="rec-dot"></span> Recording... <span class="voice-timer">0:00</span>';

        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const mins = Math.floor(recordingSeconds / 60);
            const secs = recordingSeconds % 60;
            const timerEl = voiceStatus.querySelector('.voice-timer');
            if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);

    } catch (err) {
        console.error('Mic access failed:', err);
        voiceStatus.style.display = 'flex';
        voiceStatus.className = 'voice-status';
        voiceStatus.textContent = 'Microphone access denied';
        setTimeout(() => { voiceStatus.style.display = 'none'; }, 3000);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    clearInterval(recordingTimer);
    micBtn.classList.remove('recording');
}

async function processRecording(audioBlob) {
    voiceStatus.style.display = 'flex';
    voiceStatus.className = 'voice-status transcribing';
    voiceStatus.innerHTML = '<span class="voice-spinner"></span> Loading Whisper model...';
    micBtn.classList.add('loading');

    try {
        const whisper = await getWhisperApi();
        await whisper.initWhisper((progress) => {
            voiceStatus.innerHTML = `<span class="voice-spinner"></span> Loading Whisper... ${progress}%`;
        });

        voiceStatus.innerHTML = '<span class="voice-spinner"></span> Transcribing...';
        const text = await whisper.transcribeAudio(audioBlob);

        if (text) {
            userInput.value = userInput.value ? userInput.value + ' ' + text : text;
            autoResizeInput();
            sendBtn.disabled = false;
            userInput.focus();
            voiceStatus.className = 'voice-status';
            voiceStatus.innerHTML = 'Transcribed! Edit and send, or record more.';
            setTimeout(() => { voiceStatus.style.display = 'none'; }, 3000);
        } else {
            voiceStatus.innerHTML = 'No speech detected. Try again.';
            setTimeout(() => { voiceStatus.style.display = 'none'; }, 3000);
        }
    } catch (err) {
        console.error('Transcription failed:', err);
        voiceStatus.className = 'voice-status';
        voiceStatus.innerHTML = `Transcription error: ${err.message}`;
        setTimeout(() => { voiceStatus.style.display = 'none'; }, 5000);
    }

    micBtn.classList.remove('loading');
}

// ============================================
// Voice Chat Mode
// ============================================

function speakText(text) {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
            resolve();
            return;
        }
        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to pick a good English voice
        const voices = speechSynthesis.getVoices();
        const preferred = voices.find((v) => safeStartsWith(v?.lang, 'en') && typeof v?.name === 'string' && v.name.includes('Google')) ||
            voices.find((v) => safeStartsWith(v?.lang, 'en'));
        if (preferred) utterance.voice = preferred;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
    });
}

function setVoiceChatState(state) {
    voiceOrb.className = 'voice-orb ' + state;
    const icons = { idle: 'Mic', listening: 'Listen', thinking: 'AI', speaking: 'Speak' };
    const labels = {
        idle: 'Tap to start talking',
        listening: 'Listening...',
        thinking: 'Thinking...',
        speaking: 'Speaking...',
    };
    voiceOrb.querySelector('.voice-orb-icon').textContent = icons[state] || icons.idle;
    voiceChatLabel.textContent = labels[state] || labels.idle;
}

function openVoiceChat() {
    voiceChatActive = true;
    voiceChatOverlay.classList.add('active');
    voiceChatBtn.classList.add('active');
    setVoiceChatState('idle');
    voiceChatText.textContent = 'Tap the orb to start a voice conversation.';
}

function closeVoiceChat() {
    voiceChatActive = false;
    voiceChatOverlay.classList.remove('active');
    voiceChatBtn.classList.remove('active');
    speechSynthesis.cancel();
    if (isRecording) stopRecording();
    setVoiceChatState('idle');
}

async function voiceChatListen() {
    if (!voiceChatActive) return;

    setVoiceChatState('listening');
    voiceChatText.textContent = '';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        const recordingDone = new Promise((resolve) => {
            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                resolve();
            };
        });

        recorder.start();

        // Wait for user to tap orb again to stop
        await new Promise((resolve) => {
            const stopHandler = () => {
                if (recorder.state !== 'inactive') recorder.stop();
                voiceOrb.removeEventListener('click', stopHandler);
                voiceOrb.removeEventListener('touchend', stopTouchHandler);
                resolve();
            };
            const stopTouchHandler = (e) => {
                e.preventDefault();
                stopHandler();
            };
            voiceOrb.addEventListener('click', stopHandler);
            voiceOrb.addEventListener('touchend', stopTouchHandler);
        });

        await recordingDone;

        if (!voiceChatActive) return;

        // Transcribe
        setVoiceChatState('thinking');
        voiceChatText.textContent = 'Transcribing...';

        const whisper = await getWhisperApi();
        await whisper.initWhisper((p) => {
            voiceChatText.textContent = `Loading Whisper... ${p}%`;
        });

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const userText = await whisper.transcribeAudio(audioBlob);

        if (!userText || !voiceChatActive) {
            voiceChatText.textContent = 'No speech detected. Tap to try again.';
            setVoiceChatState('idle');
            return;
        }

        voiceChatText.textContent = `You: "${userText}"`;

        // Ensure a conversation exists
        if (!activeConversationId) createConversation();
        const conv = getActiveConversation();
        if (!conv) return;

        // Add user message to conversation
        conv.messages.push({ role: 'user', content: userText });
        if (conv.messages.filter(m => m.role === 'user').length === 1) {
            conv.title = generateTitle(conv.messages);
            renderSidebar();
        }

        // Generate response
        voiceChatText.textContent = `You: "${userText}"\n\nThinking...`;

        const sysContent = getEffectiveSystemPrompt();
        const messages = [
            { role: 'system', content: sysContent },
            ...conv.messages,
        ];

        let fullResponse = '';
        const chunks = await engine.chat.completions.create({
            messages,
            temperature: parseFloat(temperatureSlider.value),
            max_tokens: parseInt(maxTokensSlider.value),
            stream: true,
        });

        for await (const chunk of chunks) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
                fullResponse += delta;
                voiceChatText.textContent = `You: "${userText}"\n\nAI: ${fullResponse}`;
            }
        }

        conv.messages.push({ role: 'assistant', content: fullResponse });
        conv.updatedAt = Date.now();
        saveConversations();
        renderSidebar();

        if (!voiceChatActive) return;

        // Speak response
        setVoiceChatState('speaking');
        await speakText(fullResponse);

        if (!voiceChatActive) return;

        // Auto-listen again
        voiceChatListen();

    } catch (err) {
        console.error('Voice chat error:', err);
        voiceChatText.textContent = `Error: ${err.message}. Tap to try again.`;
        setVoiceChatState('idle');
    }
}

// Voice chat event listeners
voiceChatBtn.addEventListener('click', () => {
    if (voiceChatActive) closeVoiceChat();
    else openVoiceChat();
});

voiceChatClose.addEventListener('click', closeVoiceChat);
voiceChatClose.addEventListener('touchend', (e) => {
    e.preventDefault();
    closeVoiceChat();
});

// Tap orb to start listening (idle state)
voiceOrb.addEventListener('click', () => {
    if (!voiceChatActive) return;
    const state = voiceOrb.className;
    if (state.includes('idle')) voiceChatListen();
});
voiceOrb.addEventListener('touchend', (e) => {
    if (!voiceChatActive) return;
    const state = voiceOrb.className;
    if (state.includes('idle')) {
        e.preventDefault();
        voiceChatListen();
    }
});

// Image / vision event listeners
imageBtn.addEventListener('click', () => imageInput.click());
imageBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    attachImageFile(file);
    imageInput.value = ''; // Reset so same file can be selected again
});

imagePreviewClear.addEventListener('click', () => {
    clearPendingImage();
});

userInput.addEventListener('paste', (e) => {
    if (!isVisionModel()) return;
    const file = getImageFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    attachImageFile(file);
});

if (inputWrapper) {
    inputWrapper.addEventListener('dragover', (e) => {
        if (!isVisionModel()) return;
        if (!getImageFromDataTransfer(e.dataTransfer)) return;
        e.preventDefault();
        inputWrapper.classList.add('drag-active');
    });

    inputWrapper.addEventListener('dragleave', () => {
        inputWrapper.classList.remove('drag-active');
    });

    inputWrapper.addEventListener('drop', (e) => {
        if (!isVisionModel()) return;
        const file = getImageFromDataTransfer(e.dataTransfer);
        if (!file) return;
        e.preventDefault();
        inputWrapper.classList.remove('drag-active');
        attachImageFile(file);
    });
}

function attachImageFile(file) {
    const mimeType = typeof file?.type === 'string' ? file.type : '';
    if (!file || !safeStartsWith(mimeType, 'image/')) return;
    if (!isVisionModel()) return;
    normalizeVisionImage(file)
        .then((normalized) => {
            pendingImage = { dataUrl: normalized.dataUrl, file, meta: normalized };
            imagePreviewImg.src = normalized.dataUrl;
            imagePreview.style.display = 'flex';
            sendBtn.disabled = false; // Allow sending with just image
            const est = estimatePhiVisionEmbedSize(normalized.targetHeight, normalized.targetWidth);
            visionDebug('Image prepared', {
                source: `${normalized.sourceWidth}x${normalized.sourceHeight}`,
                target: `${normalized.targetWidth}x${normalized.targetHeight}`,
                sourceOrientation: normalized.orientation,
                crop: `${est.cropH}x${est.cropW}`,
                embedEstimate: est.embedSize,
            });
        })
        .catch((err) => {
            console.error('Image processing failed:', err);
        });
}

function clearPendingImage() {
    pendingImage = null;
    imagePreview.style.display = 'none';
    imagePreviewImg.src = '';
    if (!userInput.value.trim()) sendBtn.disabled = true;
}

function getImageFromClipboard(clipboardData) {
    if (!clipboardData?.items) return null;
    for (const item of clipboardData.items) {
        if (safeStartsWith(item?.type, 'image/')) {
            return item.getAsFile();
        }
    }
    return null;
}

function getImageFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return null;
    const files = dataTransfer.files;
    if (!files || files.length === 0) return null;
    const file = files[0];
    const mimeType = typeof file?.type === 'string' ? file.type : '';
    return safeStartsWith(mimeType, 'image/') ? file : null;
}

function normalizeVisionImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            normalizeVisionDataUrl(String(reader.result || ''), 1344, 1008).then(resolve).catch(reject);
        };
        reader.readAsDataURL(file);
    });
}

function toggleConversationPin(id) {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    conv.pinned = !conv.pinned;
    conv.updatedAt = Date.now();
    saveConversations();
    renderSidebar();
}

function normalizeVisionDataUrl(dataUrl, longEdge = 1344, shortEdge = 1008) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const sourceLandscape = img.width >= img.height;
            // Keep the output image in landscape 4:3. WebLLM phi-3.5 vision currently
            // hardcodes a 1921 image embed size and only the 3x4 crop layout matches it.
            const targetWidth = longEdge;
            const targetHeight = shortEdge;

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get 2D canvas context'));
                return;
            }

            ctx.fillStyle = '#111111';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
            const drawW = Math.max(1, Math.round(img.width * scale));
            const drawH = Math.max(1, Math.round(img.height * scale));
            const offsetX = Math.floor((targetWidth - drawW) / 2);
            const offsetY = Math.floor((targetHeight - drawH) / 2);
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

            resolve({
                dataUrl: canvas.toDataURL('image/jpeg', 0.92),
                sourceWidth: img.width,
                sourceHeight: img.height,
                targetWidth,
                targetHeight,
                orientation: sourceLandscape ? 'landscape' : 'portrait',
            });
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Think toggle handling
thinkToggle.addEventListener('click', () => {
    thinkingEnabled = !thinkingEnabled;
    applyModelUiState();
});

// ---- Start ----
setGeneratingState(false);
init();
