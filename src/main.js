// ============================================
// NeuralBox - Main Application
// Multi-conversation support
// ============================================
import * as webllm from '@mlc-ai/web-llm';
import { MODEL_CATALOG } from './lib/models.js';
import {
    initDatabase,
    loadSettingsRecord,
    saveSettingsRecord,
    loadConversationsRecord,
    saveConversationsRecord,
    loadModelSelectionRecord,
    saveModelSelectionRecord,
    loadRagDocsRecord,
    saveRagDocsRecord,
} from './db/database.js';
import {
    formatMarkdown,
    safeParseHttpUrl,
} from './lib/rendering.js';
import {
    getFileExtension,
    getRagRetrievalProfileConfig,
    normalizeRagDocText,
    normalizeRagRetrievalProfile,
    RAG_RETRIEVAL_PROFILES,
    retrieveRagChunksFromIndex,
    splitTextIntoRagChunks,
} from './lib/rag.js';
import {
    analyzeRoutingTask,
    getModelTierRank,
    scoreModelForTask,
} from './lib/routing.js';
import {
    estimateVramMB,
    getDeviceTier,
    inferGpuClass,
} from './lib/device.js';
import {
    resolvePrimaryComposerAction,
    shouldDisableSendButton,
} from './lib/composer.js';
import {
    buildRouteSwitchFailureReason,
    getRouteSwitchFailureNotice,
    isGenerationCancelledError,
    isGenerationInterrupted,
} from './lib/generation.js';
import { bindTap } from './lib/events.js';
import {
    buildVoiceChatTranscript,
    formatVoiceTimer,
    getMicStatusMarkup,
    getVoiceOrbUi,
    isVoiceOrbIdleClassName,
    pickPreferredSpeechVoice,
} from './lib/voice.js';
import {
    getDeterministicModeNotice,
    isSettingGroupVisible,
    normalizeSettingsTab,
    parseDeterministicSeedInput,
} from './lib/settings.js';
import {
    classifyWebSearchError,
    getWebSearchNoResultsNotice,
    getWebSearchRecoveryNotice,
    shouldAutoWebSearch,
} from './lib/web-search.js';
import { renderTrustMetaHtml } from './lib/trust.js';
let whisperModulePromise = null;
let whisperApi = null;

const LEGACY_SYSTEM_PROMPT = "You are NeuralBox, a private AI assistant running entirely in the user's browser. You were NOT made by OpenAI, Anthropic, Google, or Meta. You are a local AI model. You can ONLY have text conversations. You CANNOT browse the web, read images, run code, access files, or scrape websites. If you don't know something, say so honestly instead of guessing. Keep responses concise and helpful.";
const DEFAULT_SYSTEM_PROMPT = "You are NeuralBox, a private AI assistant running entirely in the user's browser. You were NOT made by OpenAI, Anthropic, Google, or Meta. You are a local AI model. If the active model supports vision, you can analyze user-provided images. You cannot browse the web unless the app explicitly provides search results, and you cannot run code, access local files, or scrape websites. If you don't know something, say so honestly instead of guessing. Keep responses concise and helpful.";

// ---- State ----
let engine = null;
let isGenerating = false;
let webSearchEnabled = false;
let autoWebSearchEnabled = true;
let lastWebSearchFailure = null;
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
const settingsTabRegular = $('#settings-tab-regular');
const settingsTabAdvanced = $('#settings-tab-advanced');
const systemPrompt = $('#system-prompt');
const temperatureSlider = $('#temperature');
const tempValue = $('#temp-value');
const maxTokensSlider = $('#max-tokens');
const tokensValue = $('#tokens-value');
const clearHistoryBtn = $('#clear-history-btn');
const promptPresetSelect = $('#prompt-preset-select');
const applyPresetBtn = $('#apply-preset-btn');
const workflowSelect = $('#workflow-select');
const applyWorkflowBtn = $('#apply-workflow-btn');
const trustLayerSetting = $('#trust-layer-setting');
const deterministicSetting = $('#deterministic-setting');
const deterministicSeedInput = $('#deterministic-seed');
const exportChatsBtn = $('#export-chats-btn');
const importChatsBtn = $('#import-chats-btn');
const importChatsInput = $('#import-chats-input');
const hotSwapStatus = $('#hot-swap-status');
const debugPanel = $('#debug-panel');
const debugState = $('#debug-state');
const debugEvents = $('#debug-events');
const debugPanelSetting = $('#debug-panel-setting');
const debugClearBtn = $('#debug-clear-btn');
const workbenchPanel = $('#workbench-panel');
const workbenchBody = $('#workbench-body');
const workbenchSetting = $('#workbench-setting');
const workbenchClearBtn = $('#workbench-clear-btn');
const ragAddBtn = $('#rag-add-btn');
const ragClearBtn = $('#rag-clear-btn');
const ragFileInput = $('#rag-file-input');
const ragStatus = $('#rag-status');
const ragGuidance = $('#rag-guidance');
const ragDocList = $('#rag-doc-list');
const ragSearchInput = $('#rag-search-input');
const ragRetrievalProfileSelect = $('#rag-retrieval-profile');
const ragDropzone = $('#rag-dropzone');
const exportMdBtn = $('#export-md-btn');
const copyShareBtn = $('#copy-share-btn');

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
const autoWebSearchSetting = $('#auto-web-search-setting');
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
const docBtn = $('#doc-btn');
const docInput = $('#doc-input');
const docPreview = $('#doc-preview');
const docPreviewText = $('#doc-preview-text');
const docPreviewClear = $('#doc-preview-clear');
const inputWrapper = $('.input-wrapper');

// ---- Model Config ----
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
const BENCHMARK_MAX_TOKENS = 32;
let runtimeBenchmark = null;
let runtimeBenchmarkPromise = null;
let benchmarkDeferredUntilIdle = false;
let inlineNoticeTimer = null;
let activeSettingsTab = 'regular';
let workflowModeId = 'general';
let trustLayerEnabled = true;
let deterministicModeEnabled = false;
let deterministicSeed = 42;
let workbenchEnabled = false;
const workbenchEntries = [];
const WORKBENCH_LIMIT = 40;
let ragDocuments = [];
let ragChunks = [];
let ragDocSearchQuery = '';
let ragRetrievalProfile = 'balanced';
const RAG_MAX_DOCS = 24;
const RAG_MAX_CHARS_PER_DOC = 240000;
const RAG_CHUNK_SIZE = 900;
const RAG_CHUNK_OVERLAP = 160;
const RAG_MAX_MATCHES = 4;
const RAG_MAX_FILE_BYTES = 5 * 1024 * 1024;
const RAG_ALLOWED_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'json', 'csv', 'log',
    'js', 'ts', 'html', 'htm', 'xml',
    'yml', 'yaml', 'ini', 'cfg',
    'py', 'java', 'c', 'cpp', 'rs', 'go', 'sql',
]);
const reliabilityStats = {
    generationRetries: 0,
    generationFailures: 0,
    switchFailures: 0,
    recoveries: 0,
    lastError: '',
};

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

function getModelCapabilitiesLabel(model = getModelById(selectedModelId)) {
    if (!model) return 'Text';
    const caps = ['Text'];
    if (model.vision) caps.push('Vision');
    if (model.thinking) caps.push('Thinking');
    return caps.join(' + ');
}

function isRetryableGenerationError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (!msg) return false;
    return /(context|timeout|network|fetch|temporarily|interrupted|unavailable|reload|alloc|memory|outofmemory|gpu)/i.test(msg);
}

function toUserFriendlyError(err) {
    const msg = String(err?.message || err || '');
    if (/expect embed\.shape/i.test(msg)) {
        return 'Vision preprocessing mismatch detected. We retried with compatibility settings, but this model/runtime combination still failed.';
    }
    if (/startsWith/i.test(msg)) {
        return 'A malformed image payload was detected and blocked. Please re-attach the image and try again.';
    }
    if (/outofmemory|memory/i.test(msg)) {
        return 'Model ran out of memory. Try a smaller model or reduce context length.';
    }
    if (/timeout|network|fetch/i.test(msg)) {
        return 'Temporary runtime/network interruption. Please retry.';
    }
    return msg || 'Unexpected runtime error.';
}

function setInlineNotice(message, kind = 'info', durationMs = 2600) {
    if (!inputDisclaimer) return;
    if (inlineNoticeTimer) {
        clearTimeout(inlineNoticeTimer);
        inlineNoticeTimer = null;
    }
    inputDisclaimer.textContent = message || '';
    inputDisclaimer.classList.remove('web-active', 'notice-error', 'notice-warn', 'notice-info');
    inputDisclaimer.classList.add(`notice-${kind}`);
    inlineNoticeTimer = setTimeout(() => {
        inlineNoticeTimer = null;
        updateInputDisclaimer();
    }, durationMs);
}

function pushWorkbenchEvent(kind, payload = {}) {
    const item = {
        at: Date.now(),
        kind,
        payload,
    };
    workbenchEntries.push(item);
    if (workbenchEntries.length > WORKBENCH_LIMIT) {
        workbenchEntries.splice(0, workbenchEntries.length - WORKBENCH_LIMIT);
    }
    renderWorkbenchPanel();
}

function renderWorkbenchPanel() {
    if (!workbenchPanel || !workbenchBody) return;
    workbenchPanel.style.display = workbenchEnabled ? 'block' : 'none';
    if (!workbenchEnabled) return;
    if (!workbenchEntries.length) {
        workbenchBody.innerHTML = '<div class="workbench-row"><div class="workbench-row-title">No events yet</div><div class="workbench-row-meta">Send a message to inspect route decisions and context.</div></div>';
        return;
    }
    workbenchBody.innerHTML = workbenchEntries
        .slice()
        .reverse()
        .map((entry) => {
            const time = new Date(entry.at).toLocaleTimeString();
            const payloadStr = Object.entries(entry.payload || {})
                .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                .join(' | ');
            return `<div class="workbench-row"><div class="workbench-row-title">${escapeHtml(time)} | ${escapeHtml(entry.kind)}</div><div class="workbench-row-meta">${escapeHtml(payloadStr || '-')}</div></div>`;
        })
        .join('');
}

function clearWorkbenchEvents() {
    workbenchEntries.length = 0;
    renderWorkbenchPanel();
}

function rebuildRagChunkIndex() {
    const next = [];
    for (const doc of ragDocuments) {
        const chunks = Array.isArray(doc?.chunks) ? doc.chunks : [];
        for (let i = 0; i < chunks.length; i++) {
            next.push({
                docId: doc.id,
                docName: doc.name,
                idx: i,
                text: chunks[i],
            });
        }
    }
    ragChunks = next;
}

function retrieveRagChunks(query, maxMatches = null) {
    const profile = getRagRetrievalProfileConfig(ragRetrievalProfile);
    return retrieveRagChunksFromIndex(ragChunks, query, {
        profileId: profile.id,
        maxMatches: maxMatches || profile.maxMatches,
    });
}

function buildRagContext(matches) {
    if (!matches.length) return '';
    let ctx = '\n\n[LOCAL DOCUMENT CONTEXT - Use this if relevant]\n';
    matches.forEach((match, i) => {
        ctx += `[DOC ${i + 1}] ${match.docName}: ${match.text}\n`;
    });
    ctx += '\nIMPORTANT: Treat local document context as user-provided source material. If conflict exists, call it out clearly.\n';
    return ctx;
}

function getRagConfidenceSummary(matches = []) {
    const summary = {
        high: 0,
        medium: 0,
        low: 0,
        avgScore: 0,
        topScore: 0,
        topConfidence: 'n/a',
    };
    if (!Array.isArray(matches) || matches.length === 0) {
        return summary;
    }
    let totalScore = 0;
    for (const match of matches) {
        const score = Number(match?.score) || 0;
        totalScore += score;
        if (score > summary.topScore) {
            summary.topScore = score;
            summary.topConfidence = String(match?.confidenceLabel || 'low');
        }
        const label = String(match?.confidenceLabel || 'low').toLowerCase();
        if (label === 'high') summary.high += 1;
        else if (label === 'medium') summary.medium += 1;
        else summary.low += 1;
    }
    summary.avgScore = Number((totalScore / matches.length).toFixed(1));
    return summary;
}

function renderLocalRagCitations(matches, container) {
    if (!container || !Array.isArray(matches) || !matches.length) return;
    const div = document.createElement('div');
    div.className = 'rag-citations';
    const title = document.createElement('div');
    title.className = 'rag-citations-title';
    title.textContent = 'Local docs';
    div.appendChild(title);

    for (const match of matches) {
        const item = document.createElement('div');
        item.className = 'rag-citation-item';

        const name = document.createElement('span');
        name.className = 'rag-citation-doc';
        name.textContent = String(match?.docName || 'document');

        const score = Number(match?.score) || 0;
        const confidence = String(match?.confidenceLabel || 'low').toLowerCase();
        const badge = document.createElement('span');
        badge.className = `rag-citation-confidence ${confidence}`;
        badge.textContent = `${confidence} (${score})`;

        item.appendChild(name);
        item.appendChild(badge);
        div.appendChild(item);
    }
    container.appendChild(div);
}

function formatCompactNumber(value) {
    const n = Number(value) || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function renderRagDocList() {
    if (!ragDocList) return;

    const query = String(ragDocSearchQuery || '').trim().toLowerCase();
    const docs = query
        ? ragDocuments.filter((doc) => String(doc?.name || '').toLowerCase().includes(query))
        : ragDocuments;

    if (!docs.length) {
        ragDocList.innerHTML = `<div class="rag-doc-empty">${ragDocuments.length ? 'No matching docs.' : 'No documents yet. Add files to start local RAG.'}</div>`;
        return;
    }

    ragDocList.innerHTML = docs
        .slice()
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .map((doc) => {
            const chunkCount = Array.isArray(doc?.chunks) ? doc.chunks.length : 0;
            const charCount = Number(doc?.sizeChars) || String(doc?.text || '').length;
            return `
            <div class="rag-doc-item">
                <div class="rag-doc-main">
                    <div class="rag-doc-name">${escapeHtml(String(doc?.name || 'document'))}</div>
                    <div class="rag-doc-meta">${chunkCount} chunks - ${formatCompactNumber(charCount)} chars</div>
                </div>
                <button class="rag-doc-remove-btn" type="button" data-rag-doc-id="${escapeHtml(String(doc?.id || ''))}" title="Remove document">Remove</button>
            </div>
            `;
        })
        .join('');
}

function renderDocAttachmentPreview() {
    if (!docPreview || !docPreviewText) return;
    const count = ragDocuments.length;
    if (!count) {
        docPreview.style.display = 'none';
        docPreviewText.textContent = 'No docs attached';
        return;
    }
    const sample = ragDocuments.slice(-2).map((d) => String(d?.name || '').trim()).filter(Boolean);
    const suffix = count > 2 ? ', ...' : '';
    const sampleText = sample.length ? ` (${sample.join(', ')}${suffix})` : '';
    docPreviewText.textContent = `${count} doc${count === 1 ? '' : 's'} attached${sampleText}`;
    docPreview.style.display = 'flex';
}

function renderRagStatus() {
    if (!ragStatus) return;
    const docCount = ragDocuments.length;
    const chunkCount = ragChunks.length;
    if (!docCount) {
        ragStatus.textContent = 'No local docs loaded.';
        renderRagDocList();
        renderDocAttachmentPreview();
        return;
    }
    ragStatus.textContent = `${docCount} docs indexed - ${chunkCount} chunks ready. Retrieval runs automatically when relevant.`;
    renderRagDocList();
    renderDocAttachmentPreview();
}

function renderRagGuidance() {
    if (!ragGuidance) return;
    const profile = getRagRetrievalProfileConfig(ragRetrievalProfile);
    ragGuidance.textContent = `Profile: ${profile.label} - ${profile.description} Limits: ${RAG_MAX_DOCS} docs, ${formatCompactNumber(RAG_MAX_CHARS_PER_DOC)} chars/doc, ${(RAG_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)}MB/file.`;
}

function renderRagRetrievalProfiles() {
    if (!ragRetrievalProfileSelect) return;
    ragRetrievalProfileSelect.innerHTML = Object.values(RAG_RETRIEVAL_PROFILES)
        .map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)} - ${escapeHtml(profile.description)}</option>`)
        .join('');
    ragRetrievalProfileSelect.value = normalizeRagRetrievalProfile(ragRetrievalProfile);
    renderRagGuidance();
}

function persistRagDocs() {
    void saveRagDocsRecord(ragDocuments).catch((err) => {
        console.error('[DB] Failed to save RAG docs:', err);
    });
}

function sanitizeRagDoc(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    const name = String(raw.name || '').trim();
    const text = normalizeRagDocText(raw.text || '');
    const chunksRaw = Array.isArray(raw.chunks)
        ? raw.chunks
        : splitTextIntoRagChunks(text, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP);
    const chunks = chunksRaw
        .map((c) => normalizeRagDocText(c))
        .filter(Boolean);
    if (!id || !name || !text || !chunks.length) return null;
    return {
        id,
        name,
        text,
        chunks,
        sizeChars: Number(raw.sizeChars) || text.length,
        addedAt: Number(raw.addedAt) || Date.now(),
    };
}

function loadRagDocsIntoState(docs = []) {
    ragDocuments = docs
        .map(sanitizeRagDoc)
        .filter(Boolean)
        .slice(0, RAG_MAX_DOCS);
    rebuildRagChunkIndex();
    renderRagStatus();
}

function isSupportedRagFile(file) {
    if (!file) return false;
    const ext = getFileExtension(file.name || '');
    if (RAG_ALLOWED_EXTENSIONS.has(ext)) return true;
    const mime = String(file.type || '').toLowerCase();
    if (!mime) return false;
    return mime.startsWith('text/') || mime === 'application/json';
}

async function readFileAsText(file) {
    if (!file) return '';
    try {
        return await file.text();
    } catch (_err) {
        return '';
    }
}

async function ingestRagFiles(files = []) {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (ragStatus) {
        ragStatus.textContent = `Indexing ${list.length} file(s)...`;
    }
    const docsToAdd = [];
    let skippedUnsupported = 0;
    let skippedTooLarge = 0;
    let skippedEmpty = 0;
    for (const file of list) {
        if (!file) continue;
        if (!isSupportedRagFile(file)) {
            skippedUnsupported += 1;
            continue;
        }
        if (Number(file.size || 0) > RAG_MAX_FILE_BYTES) {
            skippedTooLarge += 1;
            continue;
        }
        const rawText = await readFileAsText(file);
        const text = normalizeRagDocText(rawText).slice(0, RAG_MAX_CHARS_PER_DOC);
        if (!text) {
            skippedEmpty += 1;
            continue;
        }
        const chunks = splitTextIntoRagChunks(text, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP);
        if (!chunks.length) {
            skippedEmpty += 1;
            continue;
        }
        docsToAdd.push({
            id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || 'document',
            text,
            chunks,
            sizeChars: text.length,
            addedAt: Date.now(),
        });
    }
    if (!docsToAdd.length) {
        const reasons = [];
        if (skippedUnsupported > 0) reasons.push(`${skippedUnsupported} unsupported`);
        if (skippedTooLarge > 0) reasons.push(`${skippedTooLarge} too large`);
        if (skippedEmpty > 0) reasons.push(`${skippedEmpty} empty`);
        const suffix = reasons.length ? ` (${reasons.join(', ')})` : '';
        setInlineNotice(`No indexable text documents found${suffix}.`, 'warn', 2600);
        renderRagStatus();
        return;
    }
    const existingKeySet = new Set(ragDocuments.map((doc) => `${doc.name}::${doc.sizeChars}`));
    const deduped = docsToAdd.filter((doc) => {
        const key = `${doc.name}::${doc.sizeChars}`;
        if (existingKeySet.has(key)) return false;
        existingKeySet.add(key);
        return true;
    });
    const combined = [...ragDocuments, ...deduped].slice(-RAG_MAX_DOCS);
    loadRagDocsIntoState(combined);
    persistRagDocs();
    const skipSummary = [];
    if (skippedUnsupported > 0) skipSummary.push(`${skippedUnsupported} unsupported`);
    if (skippedTooLarge > 0) skipSummary.push(`${skippedTooLarge} too large`);
    if (skippedEmpty > 0) skipSummary.push(`${skippedEmpty} empty`);
    const skipSuffix = skipSummary.length ? ` Skipped ${skipSummary.join(', ')}.` : '';
    if (deduped.length === 0) {
        setInlineNotice(`Skipped duplicates. Your RAG library is already up to date.${skipSuffix}`, 'info', 2600);
    } else {
        setInlineNotice(`Indexed ${deduped.length} document(s) for local RAG.${skipSuffix}`, 'info', 2600);
    }
    pushWorkbenchEvent('rag_docs_indexed', {
        added: deduped.length,
        totalDocs: ragDocuments.length,
        totalChunks: ragChunks.length,
        skippedUnsupported,
        skippedTooLarge,
        skippedEmpty,
    });
}

function clearRagDocs() {
    ragDocSearchQuery = '';
    if (ragSearchInput) ragSearchInput.value = '';
    loadRagDocsIntoState([]);
    persistRagDocs();
    setInlineNotice('Cleared local RAG documents.', 'info', 1800);
    pushWorkbenchEvent('rag_docs_cleared', {});
}

function removeRagDocById(docId) {
    const id = String(docId || '').trim();
    if (!id) return;
    const next = ragDocuments.filter((doc) => String(doc?.id || '') !== id);
    if (next.length === ragDocuments.length) return;
    loadRagDocsIntoState(next);
    persistRagDocs();
    setInlineNotice('Removed document from local RAG.', 'info', 1800);
}

function getModelFitGrade(model, capabilities = deviceCapabilities || { vramMB: 0 }) {
    const modelVram = Number(model?.vramMB) || 0;
    const deviceVram = Number(capabilities?.vramMB) || 0;
    if (deviceVram <= 0 || modelVram <= 0) return 'unknown';
    const ratio = modelVram / Math.max(1, deviceVram);
    if (ratio <= 0.72) return 'perfect';
    if (ratio <= 0.96) return 'good';
    if (ratio <= 1.12) return 'marginal';
    return 'unrunnable';
}

function getFitGradeRank(grade) {
    const map = {
        unrunnable: 0,
        marginal: 1,
        unknown: 1,
        good: 2,
        perfect: 3,
    };
    return map[String(grade || '').toLowerCase()] ?? 1;
}

function getFitGradeLabel(grade) {
    const map = {
        perfect: 'Perfect',
        good: 'Good',
        marginal: 'Tight',
        unrunnable: 'Too large',
        unknown: 'Unknown',
    };
    return map[String(grade || '').toLowerCase()] || 'Unknown';
}

function clampScore(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

function getCompositeWeights(profileMode = modelRoutingProfileMode) {
    if (profileMode === 'speed') {
        return { quality: 0.18, speed: 0.48, fit: 0.28, context: 0.06 };
    }
    if (profileMode === 'quality') {
        return { quality: 0.46, speed: 0.1, fit: 0.24, context: 0.2 };
    }
    return { quality: 0.3, speed: 0.28, fit: 0.26, context: 0.16 };
}

function getModelScoreCard(model, profileMode = modelRoutingProfileMode, capabilities = deviceCapabilities || { vramMB: 0 }) {
    const tierRank = getModelTierRank(model);
    const qualityScore = clampScore(30 + (tierRank * 16) + (model?.thinking ? 8 : 0) + (model?.vision ? 3 : 0));
    const deviceVram = Math.max(256, Number(capabilities?.vramMB) || 2048);
    const speedScore = clampScore(100 - ((Number(model?.vramMB) || 0) / deviceVram) * 85 + (tierRank <= 1 ? 6 : 0));
    const fitGrade = getModelFitGrade(model, capabilities);
    const fitScoreMap = { perfect: 100, good: 78, marginal: 42, unrunnable: 0, unknown: 55 };
    const fitScore = fitScoreMap[fitGrade] ?? 55;
    const contextScore = clampScore(42 + (tierRank * 11) + (model?.thinking ? 8 : 0));
    const weights = getCompositeWeights(profileMode);
    const total = Math.round(
        qualityScore * weights.quality +
        speedScore * weights.speed +
        fitScore * weights.fit +
        contextScore * weights.context
    );
    return {
        qualityScore,
        speedScore,
        fitScore,
        contextScore,
        total,
        fitGrade,
        fitLabel: getFitGradeLabel(fitGrade),
        fitRank: getFitGradeRank(fitGrade),
    };
}

function rankModelsByComposite(models = [], profileMode = modelRoutingProfileMode, capabilities = deviceCapabilities || { vramMB: 0 }) {
    return models
        .map((model) => ({ model, card: getModelScoreCard(model, profileMode, capabilities) }))
        .sort((a, b) => {
            if (b.card.total !== a.card.total) return b.card.total - a.card.total;
            return (a.model?.vramMB || 0) - (b.model?.vramMB || 0);
        });
}

function getBenchmarkSummary() {
    if (!runtimeBenchmark) return 'pending';
    return `${runtimeBenchmark.tokensPerSec.toFixed(1)} tok/s, ${Math.round(runtimeBenchmark.firstTokenMs)}ms first token`;
}

function applyRoutingProfileFromBenchmark(benchmark) {
    if (!benchmark) return;
    if (benchmark.tokensPerSec < 8) modelRoutingProfileMode = 'speed';
    else if (benchmark.tokensPerSec > 24) modelRoutingProfileMode = 'quality';
    else modelRoutingProfileMode = 'balanced';
}

function scheduleRuntimeBenchmarkCalibration() {
    if (!engine || runtimeBenchmark || runtimeBenchmarkPromise || isGenerating) return;
    const shouldDefer = !chatScreen.classList.contains('active');
    if (shouldDefer) {
        benchmarkDeferredUntilIdle = true;
        return;
    }

    benchmarkDeferredUntilIdle = false;
    runtimeBenchmarkPromise = (async () => {
        const startedAt = performance.now();
        let tokenCount = 0;
        let firstTokenMs = 0;
        try {
            const stream = await engine.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a concise benchmark responder.' },
                    { role: 'user', content: 'Reply with exactly: ok' },
                ],
                temperature: 0,
                max_tokens: BENCHMARK_MAX_TOKENS,
                stream: true,
            });
            for await (const chunk of stream) {
                const delta = chunk?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;
                tokenCount++;
                if (!firstTokenMs) {
                    firstTokenMs = performance.now() - startedAt;
                }
                if (tokenCount >= BENCHMARK_MAX_TOKENS) break;
            }
            const elapsedSec = Math.max((performance.now() - startedAt) / 1000, 0.001);
            runtimeBenchmark = {
                tokensPerSec: tokenCount / elapsedSec,
                firstTokenMs: firstTokenMs || (elapsedSec * 1000),
                tokenCount,
                elapsedSec,
            };
            applyRoutingProfileFromBenchmark(runtimeBenchmark);
            logRuntimeEvent('device_benchmark_done', {
                tokenCount,
                elapsedSec: Number(elapsedSec.toFixed(2)),
                tokensPerSec: Number(runtimeBenchmark.tokensPerSec.toFixed(2)),
                firstTokenMs: Number(runtimeBenchmark.firstTokenMs.toFixed(0)),
                profile: modelRoutingProfileMode,
            });
            renderModelSelector(deviceCapabilities || { vramMB: 0, gpuName: 'Unknown' }, autoSelectModel(deviceCapabilities || { vramMB: 0 }));
            renderDebugPanel();
        } catch (err) {
            logRuntimeEvent('device_benchmark_fail', {
                error: String(err?.message || err || ''),
            });
        } finally {
            runtimeBenchmarkPromise = null;
        }
    })();
}

function scheduleDeferredBenchmarkIfIdle() {
    if (!benchmarkDeferredUntilIdle || !engine || isGenerating) return;
    const activeConv = getActiveConversation();
    const hasHistory = Boolean(activeConv && Array.isArray(activeConv.messages) && activeConv.messages.length > 0);
    if (hasHistory || userInput.value.trim().length > 0) return;
    scheduleRuntimeBenchmarkCalibration();
}

async function detectDeviceCapabilities() {
    const result = {
        vramMB: 0,
        tier: 'lite',
        gpuName: 'Unknown',
        gpuClass: 'unknown',
        vramEstimateSource: 'none',
    };

    try {
        if (!navigator.gpu) return result;

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) return result;

        let info = adapter.info || {};
        if ((!info || !info.description) && typeof adapter.requestAdapterInfo === 'function') {
            try {
                info = await adapter.requestAdapterInfo();
            } catch (_err) {
                // Keep best-effort adapter.info values.
            }
        }
        result.gpuName = info.description || info.device || info.vendor || 'Unknown GPU';
        result.gpuClass = inferGpuClass(result.gpuName);

        const maxBuffer = Number(adapter.limits?.maxBufferSize || 0);
        const maxStorageBuffer = Number(adapter.limits?.maxStorageBufferBindingSize || 0);
        const reportedLimitMB = Math.round(Math.max(maxBuffer, maxStorageBuffer) / (1024 * 1024));
        const deviceMemGB = Number(navigator.deviceMemory) || 0;
        const estimated = estimateVramMB({
            adapterLimitMB: reportedLimitMB,
            gpuName: result.gpuName,
            deviceMemGB,
            gpuClass: result.gpuClass,
        });

        result.vramMB = estimated.vramMB;
        result.vramEstimateSource = estimated.source;
        result.tier = getDeviceTier(result.vramMB);

    } catch (err) {
        console.warn('GPU detection failed:', err);
    }

    return result;
}

function getAutoTargetUtilization() {
    if (!runtimeBenchmark) return 0.8;
    if (runtimeBenchmark.tokensPerSec >= 24) return 0.95;
    if (runtimeBenchmark.tokensPerSec >= 16) return 0.9;
    if (runtimeBenchmark.tokensPerSec >= 10) return 0.84;
    return 0.72;
}

function autoSelectModel(capabilities) {
    const curatedModels = MODEL_CATALOG.filter((m) => !m.advanced);
    const deviceVram = Number(capabilities?.vramMB) || 0;
    const runnable = curatedModels.filter((m) => m.vramMB <= deviceVram * 1.1);
    const pool = runnable.length ? runnable : (curatedModels[0] ? [curatedModels[0]] : [MODEL_CATALOG[0]]);
    const ranked = rankModelsByComposite(pool, modelRoutingProfileMode, capabilities);
    const bestByScore = ranked[0]?.model || pool[pool.length - 1] || MODEL_CATALOG[0];

    // Keep auto mode practical: bias toward the largest still-safe model.
    const targetUtil = getAutoTargetUtilization();
    const safeUpperBound = deviceVram > 0 ? Math.floor(deviceVram * targetUtil) : 0;
    const biggerSafe = pool
        .filter((m) => {
            if (safeUpperBound <= 0) return true;
            const fit = getModelFitGrade(m, capabilities);
            return m.vramMB <= safeUpperBound && (fit === 'perfect' || fit === 'good' || fit === 'unknown');
        })
        .sort((a, b) => b.vramMB - a.vramMB)[0];

    if (!biggerSafe) return bestByScore;
    const biggerCard = getModelScoreCard(biggerSafe, modelRoutingProfileMode, capabilities);
    const bestCard = getModelScoreCard(bestByScore, modelRoutingProfileMode, capabilities);
    return biggerCard.total >= bestCard.total - 12 ? biggerSafe : bestByScore;
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
        const card = getModelScoreCard(m, modelRoutingProfileMode, capabilities);
        const tooLarge = card.fitGrade === 'unrunnable' || m.vramMB > capabilities.vramMB * 1.2;
        const warningText = tooLarge ? ` - ${highVramLabel}` : (card.fitGrade === 'marginal' ? ' - Tight fit' : '');
        const capText = m.vision ? 'Vision' : (m.thinking ? 'Thinking' : 'Text');
        return `<option value="${m.id}" ${m.id === selectionId ? 'selected' : ''} ${tooLarge ? 'data-warning="true"' : ''}>${m.name} (${m.size})${isRec ? ' - Recommended' : ''} - ${capText} - Fit ${card.fitLabel} - Score ${card.total}${warningText}</option>`;
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

function setSettingsTab(tab = 'regular', options = {}) {
    const nextTab = normalizeSettingsTab(tab);
    activeSettingsTab = nextTab;

    if (settingsTabRegular) settingsTabRegular.classList.toggle('active', nextTab === 'regular');
    if (settingsTabAdvanced) settingsTabAdvanced.classList.toggle('active', nextTab === 'advanced');

    document.querySelectorAll('.setting-group[data-setting-level]').forEach((group) => {
        const level = group.getAttribute('data-setting-level') || 'regular';
        group.classList.toggle('hidden-by-tab', !isSettingGroupVisible(level, nextTab));
    });

    if (options.persist) saveSettings();
}

function applyModelUiState() {
    const model = getModelById(selectedModelId);
    const capabilityLabel = getModelCapabilitiesLabel(model);
    const modelBadge = $('#model-badge');
    if (modelBadge) {
        modelBadge.textContent = isAutoModelSelected()
            ? `Auto | ${model.name}`
            : model.name;
        modelBadge.title = `Capabilities: ${capabilityLabel}`;
    }

    if (isVisionModel()) {
        imageBtn.style.display = 'flex';
    } else {
        const hadImage = Boolean(pendingImage);
        imageBtn.style.display = 'none';
        clearPendingImage();
        if (hadImage) {
            setInlineNotice('Cleared image attachment: selected model is text-only.', 'warn', 2600);
        }
    }

    if (isThinkingModel()) {
        thinkToggle.style.display = 'flex';
        thinkToggle.classList.toggle('active', thinkingEnabled);
        thinkToggle.setAttribute('aria-pressed', thinkingEnabled ? 'true' : 'false');
    } else {
        thinkToggle.style.display = 'none';
        thinkingEnabled = false;
        thinkToggle.classList.remove('active');
        thinkToggle.setAttribute('aria-pressed', 'false');
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
    renderWorkbenchPanel();
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
    const deterministicLabel = deterministicModeEnabled
        ? `on${Number.isFinite(parseInt(deterministicSeed, 10)) ? ` (seed ${parseInt(deterministicSeed, 10)})` : ''}`
        : 'off';
    const vramSummary = `${deviceCapabilities?.vramMB || 0}MB (${deviceCapabilities?.vramEstimateSource || 'unknown'})`;
    return `Selection: ${selectionLabel} | Active: ${activeLabel} | Workflow: ${getWorkflowById(workflowModeId).label} | Deterministic: ${deterministicLabel} | VRAM: ${vramSummary} | RAG: ${ragDocuments.length} docs/${ragChunks.length} chunks | Profile: ${modelRoutingProfileMode} | Benchmark: ${getBenchmarkSummary()} | Retries: ${reliabilityStats.generationRetries} | Failures: ${reliabilityStats.generationFailures} | Generating: ${isGenerating ? 'yes' : 'no'} | GenerationId: ${activeGenerationId}`;
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

function chooseModelRoute(text, hasImage) {
    if (hasImage) {
        const visionChoices = getEligibleModels({ requireVision: true });
        if (!visionChoices.length) {
            return {
                targetModelId: selectedModelId,
                reason: 'No compatible vision model available',
                targetScore: null,
            };
        }
        const rankedVision = rankModelsByComposite(visionChoices, 'quality', deviceCapabilities || { vramMB: 0 });
        const target = rankedVision[0]?.model || visionChoices[visionChoices.length - 1];
        return {
            targetModelId: target.id,
            reason: `Image detected. Routed to ${target.name}`,
            targetScore: rankedVision[0]?.card?.total ?? null,
        };
    }

    const task = analyzeRoutingTask(text);
    const eligible = getEligibleModels({ excludeVision: true });
    if (!eligible.length) {
        return {
            targetModelId: selectedModelId,
            reason: 'No compatible models available',
            targetScore: null,
        };
    }

    let bestModel = eligible[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const model of eligible) {
        const score = scoreModelForTask(model, task, {
            hasImage: false,
            profileMode: modelRoutingProfileMode,
            deviceVramMB: deviceCapabilities?.vramMB || 0,
        });
        if (score > bestScore) {
            bestModel = model;
            bestScore = score;
        }
    }

    const currentModel = getModelById(selectedModelId);
    const currentScore = scoreModelForTask(currentModel, task, {
        hasImage: false,
        profileMode: modelRoutingProfileMode,
        deviceVramMB: deviceCapabilities?.vramMB || 0,
    });
    if (bestModel.id !== currentModel.id && bestScore - currentScore < 8) {
        const currentCard = getModelScoreCard(currentModel, modelRoutingProfileMode, deviceCapabilities || { vramMB: 0 });
        return {
            targetModelId: currentModel.id,
            reason: `Stayed on ${currentModel.name} (similar score, fit ${currentCard.fitLabel}, score ${currentCard.total})`,
            targetScore: currentCard.total,
        };
    }

    const bestCard = getModelScoreCard(bestModel, modelRoutingProfileMode, deviceCapabilities || { vramMB: 0 });
    return {
        targetModelId: bestModel.id,
        reason: `Routed to ${bestModel.name} for this request (fit ${bestCard.fitLabel}, score ${bestCard.total})`,
        targetScore: bestCard.total,
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
    pushWorkbenchEvent('hot_swap_start', {
        from: getModelById(selectedModelId).name,
        to: targetModel.name,
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
                    pushWorkbenchEvent('hot_swap_progress', {
                        to: targetModel.name,
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
        pushWorkbenchEvent('hot_swap_done', {
            to: targetModel.name,
        });
        scheduleDeferredBenchmarkIfIdle();
        return { switched: true, reason: `Switched to ${targetModel.name}` };
    } catch (err) {
        reliabilityStats.switchFailures += 1;
        reliabilityStats.lastError = String(err?.message || err || '');
        setHotSwapStatus('Hot swap failed', null, true);
        setTimeout(() => {
            if (modelSwitchPromise) return;
            setHotSwapStatus('', null, false);
        }, 1600);
        logRuntimeEvent('hot_swap_fail', {
            toModelId: newModelId,
            error: String(err?.message || err || ''),
        });
        pushWorkbenchEvent('hot_swap_fail', {
            to: targetModel.name,
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
    {
        id: 'summarizer',
        label: 'Summarizer',
        prompt: 'You are a concise summarization assistant. Return key points, important details, and a short action checklist.',
    },
    {
        id: 'product_manager',
        label: 'Product Manager',
        prompt: 'You are a product manager assistant. Structure output into Problem, User Impact, Options, Tradeoffs, and Recommendation.',
    },
];

const WORKFLOW_MODES = [
    {
        id: 'general',
        label: 'General',
        instruction: '',
    },
    {
        id: 'structured_json',
        label: 'Structured JSON',
        instruction: '\n\nWorkflow mode: Return a valid JSON object only. Use keys: summary, key_points (array), actions (array), risks (array).',
    },
    {
        id: 'code_review',
        label: 'Code Review',
        instruction: '\n\nWorkflow mode: Focus on correctness and regressions first. Return sections: Findings, Risks, Suggested Fixes, Tests.',
    },
    {
        id: 'study_tutor',
        label: 'Study Tutor',
        instruction: '\n\nWorkflow mode: Teach in steps. Use sections: Concept, Example, Quick Check, Next Step.',
    },
    {
        id: 'meeting_notes',
        label: 'Meeting Notes',
        instruction: '\n\nWorkflow mode: Return concise meeting notes with sections: Decisions, Action Items (owner + due date), Open Questions.',
    },
];

function getWorkflowById(id) {
    return WORKFLOW_MODES.find((w) => w.id === id) || WORKFLOW_MODES[0];
}

function renderWorkflowModes() {
    if (!workflowSelect) return;
    workflowSelect.innerHTML = WORKFLOW_MODES
        .map((workflow) => `<option value="${workflow.id}">${workflow.label}</option>`)
        .join('');
    workflowSelect.value = getWorkflowById(workflowModeId).id;
}

function applyWorkflowMode(modeId, options = {}) {
    const persist = options.persist !== false;
    const notify = options.notify !== false;
    const workflow = getWorkflowById(modeId);
    workflowModeId = workflow.id;
    if (workflowSelect) workflowSelect.value = workflow.id;
    if (persist) saveSettings();
    if (notify) {
        setInlineNotice(`Workflow mode set to "${workflow.label}".`, 'info', 1800);
    }
}

function getWorkflowInstruction() {
    const workflow = getWorkflowById(workflowModeId);
    return workflow?.instruction || '';
}

function getGenerationRequestConfig() {
    const maxTokens = parseInt(maxTokensSlider.value);
    const baseTemperature = parseFloat(temperatureSlider.value);
    const config = {
        maxTokens,
        temperature: deterministicModeEnabled ? 0 : baseTemperature,
        deterministic: deterministicModeEnabled,
        seed: deterministicModeEnabled ? parseInt(deterministicSeed, 10) : null,
    };
    if (!Number.isFinite(config.seed)) {
        config.seed = null;
    }
    return config;
}

async function createStreamingCompletion(requestMessages, config, options = {}) {
    const includeUsage = options.includeUsage === true;
    const payload = {
        messages: requestMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
    };
    if (includeUsage) {
        payload.stream_options = { include_usage: true };
    }
    if (config.deterministic && Number.isFinite(config.seed)) {
        payload.seed = config.seed;
    }

    try {
        return await engine.chat.completions.create(payload);
    } catch (err) {
        const msg = String(err?.message || err || '');
        if (Object.prototype.hasOwnProperty.call(payload, 'seed') && /seed|unknown field/i.test(msg)) {
            reliabilityStats.recoveries += 1;
            reliabilityStats.lastError = msg;
            logRuntimeEvent('deterministic_seed_unsupported', {
                reason: msg,
            });
            delete payload.seed;
            return await engine.chat.completions.create(payload);
        }
        throw err;
    }
}

function buildTrustMeta(payload = {}) {
    const ragDocNames = Array.isArray(payload.ragDocNames)
        ? payload.ragDocNames.map((name) => String(name || '').trim()).filter(Boolean).slice(0, 8)
        : [];
    return {
        modelId: payload.modelId || selectedModelId,
        modelName: payload.modelName || getModelById(selectedModelId).name,
        routeReason: payload.routeReason || 'Manual model selection',
        routeScore: payload.routeScore ?? null,
        profile: modelRoutingProfileMode,
        workflowId: workflowModeId,
        workflowLabel: getWorkflowById(workflowModeId).label,
        deterministic: Boolean(deterministicModeEnabled),
        seed: deterministicModeEnabled && Number.isFinite(parseInt(deterministicSeed, 10))
            ? parseInt(deterministicSeed, 10)
            : null,
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
        hasImage: Boolean(payload.hasImage),
        webSources: Number(payload.webSources || 0),
        webMode: payload.webMode || 'off',
        ragSources: Number(payload.ragSources || 0),
        ragProfile: normalizeRagRetrievalProfile(payload.ragProfile || ragRetrievalProfile),
        ragDocNames,
        ragConfidence: String(payload.ragConfidence || 'n/a'),
        ragAvgScore: Number.isFinite(Number(payload.ragAvgScore)) ? Number(payload.ragAvgScore) : null,
        ragConfidenceBreakdown: payload.ragConfidenceBreakdown && typeof payload.ragConfidenceBreakdown === 'object'
            ? {
                high: Number(payload.ragConfidenceBreakdown.high || 0),
                medium: Number(payload.ragConfidenceBreakdown.medium || 0),
                low: Number(payload.ragConfidenceBreakdown.low || 0),
            }
            : { high: 0, medium: 0, low: 0 },
        generatedAt: Date.now(),
    };
}

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
    sendBtn.disabled = shouldDisableSendButton({
        isGenerating: active,
        inputText: userInput.value,
        hasPendingImage: Boolean(pendingImage),
    });
    sendBtn.classList.toggle('generating', active);
    sendBtn.title = active ? 'Stop generation' : 'Send message';
    sendBtn.setAttribute('aria-label', active ? 'Stop generation' : 'Send message');
    sendBtn.innerHTML = active ? STOP_ICON_SVG : SEND_ICON_SVG;
    renderDebugPanel();
}

function handleComposerPrimaryAction() {
    const action = resolvePrimaryComposerAction({
        isGenerating,
        inputText: userInput.value,
        hasPendingImage: Boolean(pendingImage),
        hasEngine: Boolean(engine),
    });
    if (action === 'cancel') {
        requestGenerationCancel();
        return;
    }
    if (action === 'send') {
        sendMessage(userInput.value);
    }
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
    webSearchToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    webSearchSetting.checked = enabled;
    updateInputDisclaimer();

    if (shouldPersist) {
        saveSettings();
    }
}

function attachTestApiIfEnabled() {
    if (typeof window === 'undefined') return;
    let enabled = false;
    try {
        enabled = window.localStorage?.getItem('neuralbox_test_api') === '1';
    } catch {
        enabled = false;
    }
    if (!enabled && /(?:\?|&)nb_test=1(?:&|$)/.test(window.location.search)) {
        enabled = true;
    }
    if (!enabled) return;

    window.__NB_TEST_API = {
        setGeneratingStateForTest(active) {
            setGeneratingState(Boolean(active));
        },
        getSendButtonState() {
            return {
                disabled: Boolean(sendBtn?.disabled),
                title: String(sendBtn?.title || ''),
                generatingClass: Boolean(sendBtn?.classList?.contains('generating')),
                html: String(sendBtn?.innerHTML || ''),
            };
        },
        getGenerationCancelRequested() {
            return Boolean(generationCancelRequested);
        },
        resetGenerationCancelRequested() {
            generationCancelRequested = false;
        },
        getConversationCount() {
            return Array.isArray(conversations) ? conversations.length : 0;
        },
        getActiveConversationId() {
            return activeConversationId;
        },
        getRuntimeEvents() {
            return Array.isArray(runtimeEvents) ? [...runtimeEvents] : [];
        },
        injectRouteSwitchFailureBannerForTest() {
            const aiMsg = addMessageToDOM('assistant', '');
            const contentEl = aiMsg?.querySelector?.('.message-content');
            if (!contentEl) return '';
            contentEl.innerHTML = `<div class="search-badge"><span class="spinner"></span> ${getRouteSwitchFailureNotice()}</div>`;
            return String(contentEl.textContent || '').trim();
        },
        getRouteSwitchFailureNoticeForTest() {
            return getRouteSwitchFailureNotice();
        },
    };
}

function resolveWebSearchQuery(userText, conversation) {
    const raw = String(userText || '').trim();
    if (!raw) return '';

    if (/^search web[:\s]+/i.test(raw)) {
        return raw.replace(/^search web[:\s]+/i, '').trim();
    }
    if (/^web search[:\s]+/i.test(raw)) {
        return raw.replace(/^web search[:\s]+/i, '').trim();
    }
    if (!/^(search web|web search|search the web)$/i.test(raw)) {
        return raw;
    }

    const msgs = Array.isArray(conversation?.messages) ? conversation.messages : [];
    for (let i = msgs.length - 2; i >= 0; i--) {
        if (msgs[i]?.role !== 'user') continue;
        const priorText = getMessageText(msgs[i].content)
            .replace(/^\/(no_)?think\n/, '')
            .trim();
        if (!priorText) continue;
        if (/^(search web|web search|search the web)$/i.test(priorText)) continue;
        return priorText;
    }
    return '';
}

function updateInputDisclaimer() {
    const capabilityLabel = getModelCapabilitiesLabel(getModelById(selectedModelId));
    const ragLabel = ragDocuments.length > 0
        ? ` Local docs: ${ragDocuments.length} indexed.`
        : ' Attach documents with the Docs button for grounded answers.';
    if (webSearchEnabled) {
        inputDisclaimer.textContent = `Web-Enhanced mode is on. Search queries are sent to DuckDuckGo. Active model supports: ${capabilityLabel}.${ragLabel}`;
        inputDisclaimer.classList.add('web-active');
        return;
    }
    if (autoWebSearchEnabled) {
        inputDisclaimer.textContent = `Auto Web Search is on for time-sensitive queries. Active model supports: ${capabilityLabel}.${ragLabel}`;
        inputDisclaimer.classList.add('web-active');
        return;
    }

    if (isVisionModel()) {
        inputDisclaimer.textContent = `Vision ready. Attach, paste, or drop an image to analyze. Supports: ${capabilityLabel}.${ragLabel}`;
    } else {
        inputDisclaimer.textContent = `AI runs locally in your browser. Supports: ${capabilityLabel}.${ragLabel}`;
    }

    inputDisclaimer.classList.remove('web-active', 'notice-error', 'notice-warn', 'notice-info');
}

async function webSearch(query) {
    lastWebSearchFailure = null;
    try {
        // Strategy: try DuckDuckGo HTML lite (simpler, better for parsing)
        const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;

        const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Search endpoint returned HTTP ${response.status}`);

        const html = await response.text();
        const results = parseDDGLite(html);

        // If lite didn't get results, try the Instant Answer API as fallback
        if (results.length === 0) {
            return await webSearchFallback(query);
        }

        return results.slice(0, 6);
    } catch (err) {
        console.warn('Primary search failed, trying fallback:', err);
        const primaryFailure = classifyWebSearchError(err);
        const fallbackResults = await webSearchFallback(query);
        if (!fallbackResults.length && !lastWebSearchFailure) {
            lastWebSearchFailure = primaryFailure;
        }
        return fallbackResults;
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
        if (!response.ok) {
            lastWebSearchFailure = classifyWebSearchError(`Search fallback returned HTTP ${response.status}`);
            return [];
        }

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
        lastWebSearchFailure = classifyWebSearchError(err);
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
    if (!container || !results.length) return;
    const sources = results
        .map((result) => {
            const parsed = safeParseHttpUrl(result?.url);
            if (!parsed) return null;
            return {
                href: parsed.toString(),
                host: parsed.hostname || parsed.href,
            };
        })
        .filter(Boolean);
    if (!sources.length) return;

    const div = document.createElement('div');
    div.className = 'search-sources';
    const title = document.createElement('div');
    title.className = 'search-sources-title';
    title.textContent = 'Sources';
    div.appendChild(title);

    for (const source of sources) {
        const link = document.createElement('a');
        link.className = 'search-source-link';
        link.href = source.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.host;
        div.appendChild(link);
    }
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
    loadRagDocsIntoState(await loadRagDocsRecord());
    renderRagRetrievalProfiles();
    renderPromptPresets();
    renderWorkflowModes();
    renderWorkbenchPanel();

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
        vramSource: deviceCapabilities?.vramEstimateSource || 'unknown',
        gpuClass: deviceCapabilities?.gpuClass || 'unknown',
        profile: modelRoutingProfileMode,
        benchmark: getBenchmarkSummary(),
        workflow: workflowModeId,
        deterministic: deterministicModeEnabled,
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

    let html = `<label for="start-model-select" class="start-model-select-label">Startup Model</label>`;
    html += `<select id="start-model-select" class="start-model-select">`;
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
    const selected = isAutoModelSelected() ? resolveAutoModelCandidate() : getModelById(modelSelectionId);
    const selectedCard = getModelScoreCard(selected, modelRoutingProfileMode, capabilities);
    html += `<div class="start-model-meta">`;
    html += `<p class="setting-hint">GPU: <strong>${capabilities.gpuName}</strong> (~${capabilities.vramMB}MB VRAM)</p>`;
    html += `<p class="setting-hint">Profile: <strong>${modelRoutingProfileMode}</strong> | Benchmark: <strong>${getBenchmarkSummary()}</strong></p>`;
    html += `<p class="setting-hint">Workflow: <strong>${getWorkflowById(workflowModeId).label}</strong> | Deterministic: <strong>${deterministicModeEnabled ? 'on' : 'off'}</strong></p>`;
    html += `<p class="setting-hint">Local RAG: <strong>${ragDocuments.length} docs</strong> | Workbench: <strong>${workbenchEnabled ? 'on' : 'off'}</strong></p>`;
    html += `<p class="setting-hint">Selected supports: <strong>${getModelCapabilitiesLabel(selected)}</strong> | Fit: <strong>${selectedCard.fitLabel}</strong> | Score: <strong>${selectedCard.total}</strong></p>`;
    html += `</div>`;

    container.innerHTML = html;

    const select = document.getElementById('start-model-select');
    if (select) {
        select.addEventListener('change', async () => {
            modelSelectionId = select.value;
            saveModelSelectionId();
            selectedModelId = isAutoModelSelected() ? resolveAutoModelCandidate().id : modelSelectionId;
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

        let lastLoadErr = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                engine = await webllm.CreateMLCEngine(targetModel.id, {
                    initProgressCallback,
                });
                lastLoadErr = null;
                break;
            } catch (loadErr) {
                lastLoadErr = loadErr;
                if (attempt === 0 && isRetryableGenerationError(loadErr)) {
                    reliabilityStats.recoveries += 1;
                    logRuntimeEvent('model_load_retry', {
                        modelId: targetModel.id,
                        reason: String(loadErr?.message || loadErr || ''),
                    });
                    statusText.textContent = `Load hiccup detected. Retrying ${model.name}...`;
                    continue;
                }
                throw loadErr;
            }
        }
        if (!engine && lastLoadErr) {
            throw lastLoadErr;
        }

        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        statusText.textContent = `${model.name} loaded! Starting chat...`;
        applyModelUiState();
        logRuntimeEvent('model_loaded', {
            modelId: selectedModelId,
            modelName: model.name,
        });
        scheduleRuntimeBenchmarkCalibration();

        setTimeout(() => {
            void showChatScreen();
        }, 500);
    } catch (err) {
        console.error('Model loading failed:', err);
        reliabilityStats.lastError = String(err?.message || err || '');
        statusText.textContent = 'Failed to load model: ' + err.message;
        startBtn.style.display = 'inline-flex';
        startBtn.textContent = 'Retry';
    }
}

function getModelSelectionModeLabel(selectionId, targetModel) {
    if (selectionId === AUTO_MODEL_ID) {
        return `Auto (starts with ${targetModel.name})`;
    }
    return `Manual (${targetModel.name})`;
}

function getModelSelectionHint({ currentSelectionId, draftSelectionId, targetModel, activeModel, targetCard }) {
    const hasPending = draftSelectionId !== currentSelectionId;
    const isAutoDraft = draftSelectionId === AUTO_MODEL_ID;
    let fitHint = 'Fit looks safe for this device.';
    if (targetCard.fitGrade === 'marginal') {
        fitHint = 'Tight VRAM fit; heavy multitasking can cause failures.';
    } else if (targetCard.fitGrade === 'unrunnable') {
        fitHint = 'Likely too large for current VRAM.';
    }

    if (!hasPending) {
        if (isAutoDraft) {
            return `Auto mode is active. NeuralBox can hot-swap by request complexity. ${fitHint}`;
        }
        return `Manual mode is active. ${targetModel.name} stays pinned until changed. ${fitHint}`;
    }

    if (isAutoDraft) {
        return `Pending: enable Auto mode. Active model may change per request after apply. ${fitHint}`;
    }
    if (targetModel.id === activeModel.id) {
        return `Pending: keep ${activeModel.name} active and lock selection to Manual mode. ${fitHint}`;
    }
    return `Pending: hot swap from ${activeModel.name} to ${targetModel.name}. ${fitHint}`;
}

function renderModelSelector(capabilities, recommended) {
    const container = document.getElementById('model-selector-group');
    if (!container) return;
    const groups = getModelGroups();
    let draftSelectionId = modelSelectionId;

    let html = `<label for="model-select">Model Selection</label>`;
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
    html += `<div id="model-selection-summary" class="model-selection-summary"></div>`;
    html += `<p id="model-switch-note" class="setting-hint model-switch-note"></p>`;
    html += `<button id="switch-model-btn" class="btn-primary model-switch-btn" type="button" style="width:100%;">Apply Selection</button>`;
    html += `<p id="model-switch-live-status" class="setting-hint model-switch-live-status" aria-live="polite"></p>`;

    container.innerHTML = html;

    const select = document.getElementById('model-select');
    const switchBtn = document.getElementById('switch-model-btn');
    const summaryEl = document.getElementById('model-selection-summary');
    const switchNote = document.getElementById('model-switch-note');
    const switchLiveStatus = document.getElementById('model-switch-live-status');

    const updateSelectorUi = () => {
        const targetModel = draftSelectionId === AUTO_MODEL_ID
            ? resolveAutoModelCandidate()
            : getModelById(draftSelectionId);
        const activeModel = getModelById(selectedModelId);
        const targetCard = getModelScoreCard(targetModel, modelRoutingProfileMode, capabilities);
        const hasPending = draftSelectionId !== modelSelectionId;
        const currentModeTarget = isAutoModelSelected()
            ? resolveAutoModelCandidate()
            : getModelById(modelSelectionId);
        const currentMode = getModelSelectionModeLabel(modelSelectionId, currentModeTarget);
        const draftMode = getModelSelectionModeLabel(draftSelectionId, targetModel);

        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="model-selection-row"><span class="model-selection-key">Active</span><strong class="model-selection-value">${activeModel.name}</strong></div>
                <div class="model-selection-row"><span class="model-selection-key">Current mode</span><strong class="model-selection-value">${currentMode}</strong></div>
                <div class="model-selection-row"><span class="model-selection-key">Pending mode</span><strong class="model-selection-value">${draftMode}</strong></div>
                <div class="model-selection-row"><span class="model-selection-key">Capabilities</span><strong class="model-selection-value">${getModelCapabilitiesLabel(targetModel)}</strong></div>
                <div class="model-selection-row"><span class="model-selection-key">Fit</span><strong class="model-selection-value">${targetCard.fitLabel} (score ${targetCard.total})</strong></div>
                <div class="model-selection-row"><span class="model-selection-key">Device</span><strong class="model-selection-value">${capabilities.gpuName} | ${capabilities.vramMB}MB</strong></div>
                <div class="model-selection-row"><span class="model-selection-key">Benchmark</span><strong class="model-selection-value">${getBenchmarkSummary()} | ${modelRoutingProfileMode}</strong></div>
            `;
        }
        if (switchNote) {
            switchNote.textContent = getModelSelectionHint({
                currentSelectionId: modelSelectionId,
                draftSelectionId,
                targetModel,
                activeModel,
                targetCard,
            });
        }
        if (switchBtn) {
            switchBtn.disabled = !hasPending || isGenerating;
            switchBtn.textContent = hasPending
                ? (targetModel.id === selectedModelId ? 'Apply Selection' : 'Apply + Hot Swap')
                : 'Selection Up To Date';
        }
    };

    if (select) {
        select.addEventListener('change', () => {
            draftSelectionId = select.value;
            if (switchLiveStatus) {
                switchLiveStatus.textContent = '';
            }
            updateSelectorUi();
        });
    }

    if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
            if (!select) return;
            const requestedSelection = draftSelectionId;
            const targetModel = requestedSelection === AUTO_MODEL_ID
                ? resolveAutoModelCandidate()
                : getModelById(requestedSelection);
            if (requestedSelection === modelSelectionId && targetModel.id === selectedModelId) {
                updateSelectorUi();
                return;
            }
            if (isGenerating) {
                setInlineNotice('Please wait for generation to finish before switching models.', 'warn', 2200);
                return;
            }
            const previousSelectionId = modelSelectionId;
            modelSelectionId = requestedSelection;
            saveModelSelectionId();
            applyModelUiState();
            if (switchLiveStatus) {
                switchLiveStatus.textContent = targetModel.id === selectedModelId
                    ? 'Selection saved.'
                    : `Switching active model to ${targetModel.name}...`;
            }

            try {
                switchBtn.disabled = true;
                switchBtn.textContent = `Applying ${targetModel.name}...`;
                const result = await switchModelById(targetModel.id);
                if (switchLiveStatus) {
                    if (result?.switched) {
                        switchLiveStatus.textContent = `Now active: ${targetModel.name}.`;
                    } else {
                        switchLiveStatus.textContent = targetModel.id === selectedModelId
                            ? 'Selection saved.'
                            : `Selection saved. ${targetModel.name} will apply when model runtime is ready.`;
                    }
                }
                setInlineNotice(`Model selection updated to ${getModelSelectionModeLabel(modelSelectionId, targetModel)}.`, 'success', 2200);
            } catch (err) {
                console.error('Model switch failed:', err);
                modelSelectionId = previousSelectionId;
                saveModelSelectionId();
                draftSelectionId = previousSelectionId;
                if (select) select.value = previousSelectionId;
                applyModelUiState();
                setInlineNotice(`Model switch failed: ${toUserFriendlyError(err)}`, 'error', 3200);
                if (switchLiveStatus) {
                    switchLiveStatus.textContent = 'Switch failed. Selection rolled back.';
                }
            } finally {
                switchBtn.disabled = false;
                renderModelSelector(capabilities, recommended);
            }
        });
    }

    updateSelectorUi();
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
    scheduleRuntimeBenchmarkCalibration();
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
            addMessageToDOM(msg.role, renderable.text, renderable.imageUrl, msg.meta || null);
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
    sidebarToggle?.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarToggle?.setAttribute('aria-expanded', 'false');
}

// ============================================
// Chat Logic
// ============================================

async function sendMessage(text) {
    if ((!text.trim() && !pendingImage) || isGenerating || !engine) return;
    if (pendingImage && !isVisionModel()) {
        clearPendingImage();
        setInlineNotice('Current model is text-only. Switch to a vision model to send images.', 'warn', 3200);
        logRuntimeEvent('capability_guard_block', {
            reason: 'vision_required_for_image',
            modelId: selectedModelId,
        });
        return;
    }

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
    let routeReason = `Manual model selection (${getModelById(selectedModelId).name})`;
    let routeScore = null;
    let webMode = 'off';
    let effectiveSearchQuery = '';
    logRuntimeEvent('generation_start', {
        generationId,
        hasImage: Boolean(imageDataUrl),
        userChars: userText.length,
        workflow: workflowModeId,
        deterministic: deterministicModeEnabled,
        seed: deterministicModeEnabled ? deterministicSeed : null,
    });
    pushWorkbenchEvent('generation_start', {
        generationId,
        hasImage: Boolean(imageDataUrl),
        workflow: getWorkflowById(workflowModeId).label,
        deterministic: deterministicModeEnabled,
        seed: deterministicModeEnabled ? deterministicSeed : null,
        model: getModelById(selectedModelId).name,
    });

    try {
        if (isAutoModelSelected()) {
            const routing = chooseModelRoute(userText, Boolean(imageDataUrl));
            routeReason = routing.reason;
            routeScore = routing.targetScore ?? null;
            logRuntimeEvent('route_decision', {
                reason: routing.reason,
                targetModelId: routing.targetModelId,
                currentModelId: selectedModelId,
                targetScore: routing.targetScore,
                profile: modelRoutingProfileMode,
            });
            pushWorkbenchEvent('route_decision', {
                reason: routing.reason,
                targetModel: getModelById(routing.targetModelId).name,
                targetScore: routing.targetScore,
            });
            if (routing.targetModelId !== selectedModelId) {
                if (hasAssistantHistory) {
                    contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Preparing the best model for this request...</div>';
                    scrollToBottom();
                }
                try {
                    await switchModelById(routing.targetModelId, {
                        onProgress: () => {
                            if (hasAssistantHistory) {
                                contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Loading selected model...</div>';
                            }
                        },
                    });
                    reliabilityStats.recoveries += 1;
                    visionDebug('Model routing switch', {
                        routeReason: routing.reason,
                        targetModel: routing.targetModelId,
                    });
                } catch (switchErr) {
                    reliabilityStats.switchFailures += 1;
                    reliabilityStats.lastError = String(switchErr?.message || switchErr || '');
                    routeReason = buildRouteSwitchFailureReason({
                        routeReason: routing.reason,
                        activeModelName: getModelById(selectedModelId).name,
                    });
                    logRuntimeEvent('route_switch_failed', {
                        targetModelId: routing.targetModelId,
                        error: reliabilityStats.lastError,
                    });
                    pushWorkbenchEvent('route_switch_failed', {
                        targetModel: getModelById(routing.targetModelId).name,
                        error: reliabilityStats.lastError,
                    });
                    contentEl.innerHTML = `<div class="search-badge"><span class="spinner"></span> ${getRouteSwitchFailureNotice()}</div>`;
                    scrollToBottom();
                }
            }
        }

        let ragMatches = [];
        let ragDocNames = [];
        let ragConfidence = getRagConfidenceSummary([]);
        const ragProfile = getRagRetrievalProfileConfig(ragRetrievalProfile);
        if (userText && ragChunks.length > 0) {
            ragMatches = retrieveRagChunks(userText);
            if (ragMatches.length > 0) {
                ragDocNames = Array.from(new Set(ragMatches.map((m) => String(m.docName || '').trim()).filter(Boolean)));
                ragConfidence = getRagConfidenceSummary(ragMatches);
                routeReason = `${routeReason} | Local docs ${ragProfile.label} (${ragMatches.length} matches from ${ragDocNames.length} docs)`;
                pushWorkbenchEvent('rag_retrieval', {
                    profile: ragProfile.id,
                    matches: ragMatches.length,
                    docs: ragDocNames.join(', '),
                    confidence: ragConfidence.topConfidence,
                    avgScore: ragConfidence.avgScore,
                });
            }
        }

        // Web search (manual or auto)
        let searchResults = [];
        effectiveSearchQuery = resolveWebSearchQuery(userText, conv);
        if (/^(search web|web search|search the web)$/i.test(userText) && !effectiveSearchQuery) {
            setInlineNotice('No search topic found. Ask a question first or use "search web: <topic>".', 'warn', 3200);
        }
        const shouldSearchWeb = Boolean(effectiveSearchQuery) && (
            webSearchEnabled ||
            (autoWebSearchEnabled && shouldAutoWebSearch(effectiveSearchQuery))
        );
        if (shouldSearchWeb) {
            webMode = webSearchEnabled ? 'manual' : 'auto';
            contentEl.innerHTML = `<div class="search-badge"><span class="spinner"></span> Searching the web (${webMode})...</div>`;
            scrollToBottom();
            searchResults = await webSearch(effectiveSearchQuery);
            if (searchResults.length > 0) {
                routeReason = `${routeReason} | Web lookup ${webMode} (${searchResults.length} results)`;
            } else {
                routeReason = `${routeReason} | Web lookup ${webMode} (no results)`;
                const notice = lastWebSearchFailure
                    ? getWebSearchRecoveryNotice(lastWebSearchFailure, { mode: webMode })
                    : getWebSearchNoResultsNotice(webMode);
                setInlineNotice(notice, lastWebSearchFailure ? 'warn' : 'info', 4200);
            }
            pushWorkbenchEvent('web_search', {
                mode: webMode,
                query: effectiveSearchQuery,
                results: searchResults.length,
                failure: lastWebSearchFailure?.kind || '',
            });
            logRuntimeEvent('web_search', {
                mode: webMode,
                query: effectiveSearchQuery,
                results: searchResults.length,
                failure: lastWebSearchFailure?.kind || '',
            });
        }

        // Build messages with optional search context
        const searchContext = buildSearchContext(searchResults);
        const ragContext = buildRagContext(ragMatches);
        const sysContent = getEffectiveSystemPrompt() + ragContext + searchContext + getWorkflowInstruction();

        const messages = [
            { role: 'system', content: sysContent },
            ...conv.messages,
        ];

        const requestConfig = getGenerationRequestConfig();
        const createStream = (requestMessages) => createStreamingCompletion(
            requestMessages,
            requestConfig,
            { includeUsage: true },
        );

        contentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

        let fullResponse = '';
        let tokenCount = 0;
        const startTime = performance.now();

        let chunks;
        const isVisionRequest = Boolean(imageDataUrl && isVisionModel());
        let requestMessages = messages;
        let finalErr = null;

        const maxAttempts = isVisionRequest ? 3 : 2;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (isGenerationInterrupted({
                cancelRequested: generationCancelRequested,
                generationId,
                activeGenerationId,
            })) {
                throw new Error('Generation cancelled by user.');
            }
            try {
                chunks = await createStream(requestMessages);
                finalErr = null;
                break;
            } catch (err) {
                if (isGenerationInterrupted({
                    cancelRequested: generationCancelRequested,
                    generationId,
                    activeGenerationId,
                })) {
                    throw new Error('Generation cancelled by user.');
                }
                finalErr = err;
                if (!isVisionRequest || !isVisionRecoverableError(err)) {
                    const canRetry = attempt === 0 && isRetryableGenerationError(err);
                    if (canRetry) {
                        reliabilityStats.generationRetries += 1;
                        reliabilityStats.recoveries += 1;
                        logRuntimeEvent('generation_retry', {
                            generationId,
                            attempt: attempt + 1,
                            reason: String(err?.message || err || ''),
                        });
                        pushWorkbenchEvent('generation_retry', {
                            attempt: attempt + 1,
                            reason: String(err?.message || err || ''),
                        });
                        contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Recovering from runtime issue, retrying...</div>';
                        scrollToBottom();
                        requestMessages = [
                            { role: 'system', content: sysContent },
                            ...conv.messages.slice(-8),
                        ];
                        continue;
                    }
                    throw err;
                }

                if (attempt === 0) {
                    console.warn('[Vision] Generation failed, retrying with compatibility resize', {
                        reason: String(err?.message || err || ''),
                        model: selectedModelId,
                    });
                    contentEl.innerHTML = '<div class="search-badge"><span class="spinner"></span> Vision retry: applying compatibility resize...</div>';
                    scrollToBottom();
                    pushWorkbenchEvent('vision_retry_resize', {
                        reason: String(err?.message || err || ''),
                    });

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
                    pushWorkbenchEvent('vision_retry_compact_context', {
                        reason: String(err?.message || err || ''),
                    });

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
            if (isGenerationInterrupted({
                cancelRequested: generationCancelRequested,
                generationId,
                activeGenerationId,
            })) {
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

        if (isGenerationInterrupted({
            cancelRequested: generationCancelRequested,
            generationId,
            activeGenerationId,
        })) {
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

        if (ragMatches.length > 0) {
            renderLocalRagCitations(ragMatches, messageBody);
        }

        // Show source citations if we used web search
        if (searchResults.length > 0) {
            renderSourceCitations(searchResults, messageBody);
        }

        // Save to conversation
        logRuntimeEvent('generation_done', {
            generationId,
            tokenCount,
            elapsedSec: Number(elapsed.toFixed(2)),
            routeReason,
            routeScore,
            workflow: workflowModeId,
            deterministic: deterministicModeEnabled,
            ragMatches: ragMatches.length,
            ragProfile: ragProfile.id,
            ragDocNames,
            ragTopConfidence: ragConfidence.topConfidence,
            ragAvgScore: ragConfidence.avgScore,
            webResults: searchResults.length,
            webMode,
            webQuery: effectiveSearchQuery,
        });
        const trustMeta = buildTrustMeta({
            routeReason,
            routeScore,
            modelId: selectedModelId,
            modelName: getModelById(selectedModelId).name,
            temperature: requestConfig.temperature,
            maxTokens: requestConfig.maxTokens,
            hasImage: Boolean(imageDataUrl),
            webSources: searchResults.length,
            webMode,
            ragSources: ragMatches.length,
            ragProfile: ragProfile.id,
            ragDocNames,
            ragConfidence: ragConfidence.topConfidence,
            ragAvgScore: ragConfidence.avgScore,
            ragConfidenceBreakdown: {
                high: ragConfidence.high,
                medium: ragConfidence.medium,
                low: ragConfidence.low,
            },
        });
        conv.messages.push({ role: 'assistant', content: fullResponse, meta: trustMeta });
        if (trustLayerEnabled) {
            const messageBodyForTrust = aiMsg.querySelector('.message-body');
            if (messageBodyForTrust && !messageBodyForTrust.querySelector('.trust-meta')) {
                const trustContainer = document.createElement('div');
                trustContainer.innerHTML = renderTrustMetaHtml(trustMeta);
                messageBodyForTrust.appendChild(trustContainer);
            }
        }
        conv.updatedAt = Date.now();
        saveConversations();
        renderSidebar();
        pushWorkbenchEvent('generation_done', {
            tokenCount,
            elapsedSec: Number(elapsed.toFixed(2)),
            ragMatches: ragMatches.length,
            ragConfidence: ragConfidence.topConfidence,
            ragAvgScore: ragConfidence.avgScore,
            webResults: searchResults.length,
        });
    } catch (err) {
        const errText = String(err?.message || err || '');
        if (isGenerationCancelledError({
            errText,
            cancelRequested: generationCancelRequested,
            generationId,
            activeGenerationId,
        })) {
            if (!contentEl.textContent?.trim()) {
                contentEl.innerHTML = '<span style="color: #9ca3af;">Generation stopped.</span>';
            }
            logRuntimeEvent('generation_cancelled', {
                generationId,
                reason: 'interrupted',
            });
        } else {
            reliabilityStats.generationFailures += 1;
            reliabilityStats.lastError = errText;
            console.error('Generation error:', err);
            contentEl.innerHTML = `<span style="color: #f87171;">Error: ${toUserFriendlyError(err)}</span>`;
            logRuntimeEvent('generation_error', {
                generationId,
                error: String(err?.message || err || ''),
            });
            pushWorkbenchEvent('generation_error', {
                error: String(err?.message || err || ''),
            });
        }
    } finally {
        if (generationId === activeGenerationId) {
            setGeneratingState(false);
            scheduleDeferredBenchmarkIfIdle();
        }
    }
}

// ---- DOM Helpers ----
function addMessageToDOM(role, content, imageUrl, meta = null) {
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

    if (role === 'assistant' && meta && trustLayerEnabled) {
        const trust = document.createElement('div');
        trust.innerHTML = renderTrustMetaHtml(meta);
        body.appendChild(trust);
    }

    msg.appendChild(avatar);
    msg.appendChild(body);
    messagesContainer.appendChild(msg);

    return msg;
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
    const removedCount = conversations.length;
    conversations = [];
    activeConversationId = null;
    saveConversations();
    renderSidebar();
    renderWelcome();
    setInlineNotice(`Cleared ${removedCount} conversation${removedCount === 1 ? '' : 's'}.`, 'info', 2200);
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

function formatConversationAsMarkdown(conv) {
    if (!conv) return '';
    const lines = [];
    lines.push(`# ${conv.title || 'Conversation'}`);
    lines.push('');
    lines.push(`- Exported: ${new Date().toISOString()}`);
    lines.push(`- Model Selection: ${isAutoModelSelected() ? 'Auto' : getModelById(modelSelectionId).name}`);
    lines.push(`- Workflow: ${getWorkflowById(workflowModeId).label}`);
    lines.push(`- Deterministic: ${deterministicModeEnabled ? `on (seed ${deterministicSeed})` : 'off'}`);
    lines.push('');
    for (const msg of conv.messages || []) {
        const roleLabel = msg.role === 'assistant' ? 'AI' : (msg.role === 'user' ? 'You' : String(msg.role || 'System'));
        const renderable = getRenderableMessage(msg.role, msg.content);
        const text = (renderable.text || '').trim();
        lines.push(`## ${roleLabel}`);
        lines.push('');
        if (renderable.imageUrl) {
            lines.push(`![Attached image](${renderable.imageUrl})`);
            lines.push('');
        }
        if (text) {
            lines.push(text);
            lines.push('');
        } else {
            lines.push('_No text content_');
            lines.push('');
        }
        if (msg.role === 'assistant' && msg.meta && trustLayerEnabled) {
            const ragDocs = Array.isArray(msg.meta.ragDocNames) && msg.meta.ragDocNames.length
                ? msg.meta.ragDocNames.join('|')
                : 'none';
            lines.push(`_Trust: model=${msg.meta.modelName || msg.meta.modelId || 'unknown'}, route="${msg.meta.routeReason || 'n/a'}", workflow=${msg.meta.workflowLabel || 'n/a'}, deterministic=${msg.meta.deterministic ? 'on' : 'off'}, rag_docs=${ragDocs}, rag_profile=${msg.meta.ragProfile || 'balanced'}, rag_confidence=${msg.meta.ragConfidence || 'n/a'}_`);
            lines.push('');
        }
    }
    return lines.join('\n');
}

async function exportActiveConversationMarkdown() {
    const conv = getActiveConversation();
    if (!conv) {
        setInlineNotice('Open a conversation first to export Markdown.', 'warn', 2200);
        return;
    }
    const markdown = formatConversationAsMarkdown(conv);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `neuralbox-${(conv.title || 'conversation').replace(/[^a-z0-9_-]+/ig, '-').slice(0, 48)}-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setInlineNotice('Exported active conversation as Markdown.', 'info', 1800);
}

async function copyActiveConversationShareText() {
    const conv = getActiveConversation();
    if (!conv) {
        setInlineNotice('Open a conversation first to copy share text.', 'warn', 2200);
        return;
    }
    const markdown = formatConversationAsMarkdown(conv);
    try {
        await navigator.clipboard.writeText(markdown);
        setInlineNotice('Copied conversation to clipboard.', 'info', 1800);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        setInlineNotice('Clipboard copy failed in this browser context.', 'warn', 2200);
    }
}

async function exportConversationsToFile() {
    const storedSettings = await loadSettingsRecord();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        conversations,
        settings: storedSettings,
        localRagDocs: ragDocuments,
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
    setInlineNotice(`Exported ${conversations.length} conversation${conversations.length === 1 ? '' : 's'}.`, 'info', 2200);
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

    if (Array.isArray(parsed?.localRagDocs)) {
        loadRagDocsIntoState(parsed.localRagDocs);
        await saveRagDocsRecord(ragDocuments);
    }

    const visible = getVisibleConversations();
    if (visible.length > 0) {
        switchToConversation(visible[0].id);
    } else {
        activeConversationId = null;
        renderWelcome();
    }
    renderSidebar();
    setInlineNotice(`Imported ${conversations.length} conversation${conversations.length === 1 ? '' : 's'}.`, 'info', 2200);
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
        autoWebSearchEnabled = settings.autoWebSearchEnabled !== false;
        verboseVisionLogs = Boolean(settings.verboseVisionLogs);
        debugPanelEnabled = Boolean(settings.debugPanelEnabled);
        workbenchEnabled = Boolean(settings.workbenchEnabled);
        trustLayerEnabled = settings.trustLayerEnabled !== false;
        deterministicModeEnabled = Boolean(settings.deterministicModeEnabled);
        activeSettingsTab = normalizeSettingsTab(settings.activeSettingsTab);
        ragRetrievalProfile = normalizeRagRetrievalProfile(settings.ragRetrievalProfile || ragRetrievalProfile);
        workflowModeId = getWorkflowById(settings.workflowModeId || workflowModeId).id;
        const parsedSeed = parseInt(settings.deterministicSeed, 10);
        deterministicSeed = Number.isFinite(parsedSeed) ? parsedSeed : deterministicSeed;
        if (visionVerboseSetting) {
            visionVerboseSetting.checked = verboseVisionLogs;
        }
        if (autoWebSearchSetting) {
            autoWebSearchSetting.checked = autoWebSearchEnabled;
        }
        if (debugPanelSetting) {
            debugPanelSetting.checked = debugPanelEnabled;
        }
        if (workbenchSetting) {
            workbenchSetting.checked = workbenchEnabled;
        }
        if (trustLayerSetting) {
            trustLayerSetting.checked = trustLayerEnabled;
        }
        if (deterministicSetting) {
            deterministicSetting.checked = deterministicModeEnabled;
        }
        if (deterministicSeedInput) {
            deterministicSeedInput.value = String(deterministicSeed);
        }
        renderRagRetrievalProfiles();
        renderWorkflowModes();
        if (workflowSelect) {
            workflowSelect.value = workflowModeId;
        }
        setSettingsTab(activeSettingsTab, { persist: false });
        renderDebugPanel();
        renderWorkbenchPanel();
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    const snapshot = {
        systemPrompt: systemPrompt.value,
        temperature: parseFloat(temperatureSlider.value),
        maxTokens: parseInt(maxTokensSlider.value),
        webSearch: webSearchEnabled,
        autoWebSearchEnabled: autoWebSearchEnabled,
        verboseVisionLogs: verboseVisionLogs,
        debugPanelEnabled: debugPanelEnabled,
        workbenchEnabled: workbenchEnabled,
        trustLayerEnabled: trustLayerEnabled,
        deterministicModeEnabled: deterministicModeEnabled,
        deterministicSeed: deterministicSeed,
        ragRetrievalProfile: ragRetrievalProfile,
        workflowModeId: workflowModeId,
        activeSettingsTab: activeSettingsTab,
    };
    void saveSettingsRecord(snapshot).catch((err) => {
        console.error('[DB] Failed to save settings:', err);
    });
}

// ---- Suggestion Chips ----
function bindSuggestionChips() {
    document.querySelectorAll('.suggestion-chip').forEach((chip) => {
        bindTap(chip, () => {
            const prompt = chip.dataset.prompt;
            if (prompt) sendMessage(prompt);
        });
    });
}

// ============================================
// Event Listeners
// ============================================

// Send message
bindTap(sendBtn, () => {
    handleComposerPrimaryAction();
});

// Enter to send
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const action = resolvePrimaryComposerAction({
            isGenerating,
            inputText: userInput.value,
            hasPendingImage: Boolean(pendingImage),
            hasEngine: Boolean(engine),
        });
        if (action === 'send') {
            sendMessage(userInput.value);
        }
    }
});

// Auto-resize
userInput.addEventListener('input', () => {
    autoResizeInput();
    sendBtn.disabled = shouldDisableSendButton({
        isGenerating,
        inputText: userInput.value,
        hasPendingImage: Boolean(pendingImage),
    });
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
    renderWorkflowModes();
    setSettingsTab(activeSettingsTab, { persist: false });
    settingsPanel.classList.add('open');
    settingsBtn.setAttribute('aria-expanded', 'true');
});
settingsOverlay.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    settingsBtn.setAttribute('aria-expanded', 'false');
    saveSettings();
});
closeSettings.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    settingsBtn.setAttribute('aria-expanded', 'false');
    saveSettings();
});
if (settingsTabRegular) {
    settingsTabRegular.addEventListener('click', () => {
        setSettingsTab('regular', { persist: true });
    });
}
if (settingsTabAdvanced) {
    settingsTabAdvanced.addEventListener('click', () => {
        setSettingsTab('advanced', { persist: true });
    });
}

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
    settingsBtn.setAttribute('aria-expanded', 'false');
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
if (autoWebSearchSetting) {
    autoWebSearchSetting.addEventListener('change', () => {
        autoWebSearchEnabled = Boolean(autoWebSearchSetting.checked);
        updateInputDisclaimer();
        saveSettings();
    });
}
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
if (workbenchSetting) {
    workbenchSetting.addEventListener('change', () => {
        workbenchEnabled = Boolean(workbenchSetting.checked);
        renderWorkbenchPanel();
        saveSettings();
    });
}
if (debugClearBtn) {
    debugClearBtn.addEventListener('click', () => {
        runtimeEvents.length = 0;
        logRuntimeEvent('debug_cleared', { source: 'user' });
    });
}
if (workbenchClearBtn) {
    workbenchClearBtn.addEventListener('click', () => {
        clearWorkbenchEvents();
        pushWorkbenchEvent('workbench_cleared', { source: 'user' });
    });
}
if (ragAddBtn && ragFileInput) {
    ragAddBtn.addEventListener('click', () => ragFileInput.click());
}
if (docBtn && docInput) {
    docBtn.addEventListener('click', () => docInput.click());
    docBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        docInput.click();
    });
}
if (docInput) {
    docInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        await ingestRagFiles(files);
        docInput.value = '';
    });
}
if (docPreviewClear) {
    docPreviewClear.addEventListener('click', () => {
        clearRagDocs();
    });
}
if (ragDropzone && ragFileInput) {
    ragDropzone.addEventListener('click', () => ragFileInput.click());
    ragDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ragFileInput.click();
        }
    });
    ragDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        ragDropzone.classList.add('drag-active');
    });
    ragDropzone.addEventListener('dragleave', () => {
        ragDropzone.classList.remove('drag-active');
    });
    ragDropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        ragDropzone.classList.remove('drag-active');
        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;
        await ingestRagFiles(files);
    });
}
if (ragFileInput) {
    ragFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        await ingestRagFiles(files);
        ragFileInput.value = '';
    });
}
if (ragClearBtn) {
    ragClearBtn.addEventListener('click', () => {
        clearRagDocs();
    });
}
if (ragRetrievalProfileSelect) {
    ragRetrievalProfileSelect.addEventListener('change', () => {
        ragRetrievalProfile = normalizeRagRetrievalProfile(ragRetrievalProfileSelect.value);
        renderRagGuidance();
        saveSettings();
        setInlineNotice(`RAG retrieval profile set to ${getRagRetrievalProfileConfig(ragRetrievalProfile).label}.`, 'info', 2200);
    });
}
if (ragSearchInput) {
    ragSearchInput.addEventListener('input', () => {
        ragDocSearchQuery = String(ragSearchInput.value || '');
        renderRagDocList();
    });
}
if (ragDocList) {
    ragDocList.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const id = target.getAttribute('data-rag-doc-id');
        if (!id) return;
        removeRagDocById(id);
    });
}
if (promptPresetSelect && applyPresetBtn) {
    applyPresetBtn.addEventListener('click', () => {
        applyPromptPreset(promptPresetSelect.value);
    });
}
if (workflowSelect && applyWorkflowBtn) {
    applyWorkflowBtn.addEventListener('click', () => {
        applyWorkflowMode(workflowSelect.value);
    });
}
if (workflowSelect) {
    workflowSelect.addEventListener('change', () => {
        workflowModeId = getWorkflowById(workflowSelect.value).id;
    });
}
if (trustLayerSetting) {
    trustLayerSetting.addEventListener('change', () => {
        trustLayerEnabled = Boolean(trustLayerSetting.checked);
        saveSettings();
        const conv = getActiveConversation();
        if (conv) switchToConversation(conv.id);
    });
}
if (deterministicSetting) {
    deterministicSetting.addEventListener('change', () => {
        deterministicModeEnabled = Boolean(deterministicSetting.checked);
        saveSettings();
        setInlineNotice(getDeterministicModeNotice(deterministicModeEnabled), 'info', 1800);
    });
}
if (deterministicSeedInput) {
    deterministicSeedInput.addEventListener('change', () => {
        const parsed = parseDeterministicSeedInput(deterministicSeedInput.value, deterministicSeed);
        if (parsed.ok) {
            deterministicSeed = parsed.seed;
            deterministicSeedInput.value = parsed.inputValue;
            saveSettings();
            return;
        }
        deterministicSeedInput.value = parsed.inputValue;
        setInlineNotice(parsed.error, 'warn', 1800);
    });
}
if (exportChatsBtn) {
    exportChatsBtn.addEventListener('click', () => {
        void exportConversationsToFile().catch((err) => {
            console.error('Export failed:', err);
            setInlineNotice(`Export failed: ${toUserFriendlyError(err)}`, 'error', 3200);
        });
    });
}
if (exportMdBtn) {
    exportMdBtn.addEventListener('click', () => {
        void exportActiveConversationMarkdown().catch((err) => {
            console.error('Markdown export failed:', err);
            setInlineNotice(`Markdown export failed: ${toUserFriendlyError(err)}`, 'error', 3200);
        });
    });
}
if (copyShareBtn) {
    copyShareBtn.addEventListener('click', () => {
        void copyActiveConversationShareText().catch((err) => {
            console.error('Copy share failed:', err);
            setInlineNotice(`Copy share failed: ${toUserFriendlyError(err)}`, 'error', 3200);
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
            setInlineNotice(`Import failed: ${toUserFriendlyError(err)}`, 'error', 3200);
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
        voiceStatus.innerHTML = getMicStatusMarkup('recording');

        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const timerEl = voiceStatus.querySelector('.voice-timer');
            if (timerEl) timerEl.textContent = formatVoiceTimer(recordingSeconds);
        }, 1000);

    } catch (err) {
        console.error('Mic access failed:', err);
        voiceStatus.style.display = 'flex';
        voiceStatus.className = 'voice-status';
        voiceStatus.textContent = getMicStatusMarkup('mic_denied');
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
    voiceStatus.innerHTML = getMicStatusMarkup('loading');
    micBtn.classList.add('loading');

    try {
        const whisper = await getWhisperApi();
        await whisper.initWhisper((progress) => {
            voiceStatus.innerHTML = getMicStatusMarkup('loading_progress', { progress });
        });

        voiceStatus.innerHTML = getMicStatusMarkup('transcribing');
        const baseText = userInput.value ? userInput.value + (userInput.value.endsWith(' ') ? '' : ' ') : '';
        const text = await whisper.transcribeAudio(audioBlob, (partial) => {
            userInput.value = baseText + partial;
            autoResizeInput();
        });

        if (text) {
            userInput.value = baseText + text;
            autoResizeInput();
            sendBtn.disabled = false;
            userInput.focus();
            voiceStatus.className = 'voice-status';
            voiceStatus.innerHTML = getMicStatusMarkup('transcribed');
            setTimeout(() => { voiceStatus.style.display = 'none'; }, 3000);
        } else {
            voiceStatus.innerHTML = getMicStatusMarkup('empty');
            setTimeout(() => { voiceStatus.style.display = 'none'; }, 3000);
        }
    } catch (err) {
        console.error('Transcription failed:', err);
        voiceStatus.className = 'voice-status';
        voiceStatus.innerHTML = getMicStatusMarkup('error', { errorMessage: err?.message || 'Unknown error' });
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

        const preferred = pickPreferredSpeechVoice(speechSynthesis.getVoices());
        if (preferred) utterance.voice = preferred;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
    });
}

function setVoiceChatState(state) {
    voiceOrb.className = 'voice-orb ' + state;
    const ui = getVoiceOrbUi(state);
    voiceOrb.querySelector('.voice-orb-icon').textContent = ui.icon;
    voiceChatLabel.textContent = ui.label;
}

function openVoiceChat() {
    voiceChatActive = true;
    voiceChatOverlay.classList.add('active');
    voiceChatBtn.classList.add('active');
    voiceChatBtn.setAttribute('aria-expanded', 'true');
    setVoiceChatState('idle');
    voiceChatText.textContent = 'Tap the orb to start a voice conversation.';
}

function closeVoiceChat() {
    voiceChatActive = false;
    voiceChatOverlay.classList.remove('active');
    voiceChatBtn.classList.remove('active');
    voiceChatBtn.setAttribute('aria-expanded', 'false');
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
        const userText = await whisper.transcribeAudio(audioBlob, (partial) => {
            if (voiceChatActive && partial) {
                voiceChatText.textContent = buildVoiceChatTranscript(partial);
            }
        });

        if (!userText || !voiceChatActive) {
            voiceChatText.textContent = 'No speech detected. Tap to try again.';
            setVoiceChatState('idle');
            return;
        }

        voiceChatText.textContent = buildVoiceChatTranscript(userText);

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
        voiceChatText.textContent = buildVoiceChatTranscript(userText, '', 'thinking');

        const sysContent = getEffectiveSystemPrompt() + getWorkflowInstruction();
        const messages = [
            { role: 'system', content: sysContent },
            ...conv.messages,
        ];

        let fullResponse = '';
        const requestConfig = getGenerationRequestConfig();
        const chunks = await createStreamingCompletion(messages, requestConfig);

        for await (const chunk of chunks) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
                fullResponse += delta;
                voiceChatText.textContent = buildVoiceChatTranscript(userText, fullResponse);
            }
        }

        const trustMeta = buildTrustMeta({
            routeReason: 'Voice chat response',
            modelId: selectedModelId,
            modelName: getModelById(selectedModelId).name,
            temperature: requestConfig.temperature,
            maxTokens: requestConfig.maxTokens,
            hasImage: false,
            webSources: 0,
        });
        conv.messages.push({ role: 'assistant', content: fullResponse, meta: trustMeta });
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
    if (isVoiceOrbIdleClassName(state)) voiceChatListen();
});
voiceOrb.addEventListener('keydown', (e) => {
    if (!voiceChatActive) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const state = voiceOrb.className;
    if (isVoiceOrbIdleClassName(state)) {
        e.preventDefault();
        voiceChatListen();
    }
});
voiceOrb.addEventListener('touchend', (e) => {
    if (!voiceChatActive) return;
    const state = voiceOrb.className;
    if (isVoiceOrbIdleClassName(state)) {
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
    if (!isVisionModel()) {
        if (getImageFromClipboard(e.clipboardData)) {
            setInlineNotice('This model is text-only. Switch to a vision model before pasting images.', 'warn', 2800);
            logRuntimeEvent('capability_guard_block', {
                reason: 'paste_image_requires_vision',
                modelId: selectedModelId,
            });
        }
        return;
    }
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
        if (!isVisionModel()) {
            if (getImageFromDataTransfer(e.dataTransfer)) {
                e.preventDefault();
                setInlineNotice('This model is text-only. Switch to a vision model before dropping images.', 'warn', 2800);
                logRuntimeEvent('capability_guard_block', {
                    reason: 'drop_image_requires_vision',
                    modelId: selectedModelId,
                });
            }
            return;
        }
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
    if (!isVisionModel()) {
        setInlineNotice('Current model is text-only. Switch to a vision model to attach images.', 'warn', 3000);
        logRuntimeEvent('capability_guard_block', {
            reason: 'attach_image_requires_vision',
            modelId: selectedModelId,
        });
        return;
    }
    normalizeVisionImage(file)
        .then((normalized) => {
            pendingImage = { dataUrl: normalized.dataUrl, file, meta: normalized };
            imagePreviewImg.src = normalized.dataUrl;
            imagePreview.style.display = 'flex';
            sendBtn.disabled = shouldDisableSendButton({
                isGenerating,
                inputText: userInput.value,
                hasPendingImage: true,
            });
            const est = estimatePhiVisionEmbedSize(normalized.targetHeight, normalized.targetWidth);
            visionDebug('Image prepared', {
                source: `${normalized.sourceWidth}x${normalized.sourceHeight}`,
                target: `${normalized.targetWidth}x${normalized.targetHeight}`,
                sourceOrientation: normalized.orientation,
                crop: `${est.cropH}x${est.cropW}`,
                embedEstimate: est.embedSize,
            });
            pushWorkbenchEvent('image_prepared', {
                source: `${normalized.sourceWidth}x${normalized.sourceHeight}`,
                target: `${normalized.targetWidth}x${normalized.targetHeight}`,
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
    sendBtn.disabled = shouldDisableSendButton({
        isGenerating,
        inputText: userInput.value,
        hasPendingImage: false,
    });
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

// Prevent accidental page reloads
window.addEventListener('beforeunload', (e) => {
    if (engine) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ---- Start ----
setGeneratingState(false);
attachTestApiIfEnabled();

// Preload Whisper API in the background
getWhisperApi().then(api => {
    // Suppress progress as we just want to cache it in the background
    api.initWhisper().catch(err => {
        console.warn('Background whisper preload failed (non-fatal):', err);
    });
});

init();
