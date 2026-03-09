// ============================================
// NeuralBox — Main Application
// Multi-conversation support
// ============================================
import * as webllm from '@mlc-ai/web-llm';

// ---- State ----
let engine = null;
let isGenerating = false;

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

// Sidebar refs
const sidebar = $('#sidebar');
const sidebarOverlay = $('#sidebar-overlay');
const sidebarToggle = $('#sidebar-toggle');
const sidebarNewChat = $('#sidebar-new-chat');
const conversationList = $('#conversation-list');

// ---- Model Config ----
const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

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
        const text = firstUserMsg.content.trim();
        return text.length > 40 ? text.slice(0, 40) + '…' : text;
    }
    return 'New conversation';
}

// ---- Init ----
async function init() {
    if (!navigator.gpu) {
        webgpuError.style.display = 'block';
        downloadSection.style.display = 'none';
        return;
    }

    statusText.textContent = 'Ready to load AI model';
    startBtn.style.display = 'inline-flex';

    startBtn.addEventListener('click', loadModel);
    startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        loadModel();
    });

    loadSettings();
}

// ---- Model Loading ----
async function loadModel() {
    startBtn.style.display = 'none';
    statusText.textContent = 'Initializing AI engine...';

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
                statusText.textContent = 'Loading model into GPU memory...';
            }
        };

        engine = await webllm.CreateMLCEngine(MODEL_ID, {
            initProgressCallback,
        });

        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        statusText.textContent = 'Model loaded! Starting chat...';

        setTimeout(() => {
            showChatScreen();
        }, 500);
    } catch (err) {
        console.error('Model loading failed:', err);
        statusText.textContent = 'Failed to load model: ' + err.message;
        startBtn.style.display = 'inline-flex';
        startBtn.textContent = '🔄 Retry';
    }
}

// ---- Screen Management ----
function showChatScreen() {
    loadingScreen.classList.remove('active');
    chatScreen.classList.add('active');
    userInput.focus();

    // Load conversations from storage
    loadConversations();

    // If no conversations, show welcome screen (no active conversation)
    if (conversations.length === 0) {
        activeConversationId = null;
        renderWelcome();
    } else {
        // Load the most recent conversation
        switchToConversation(conversations[0].id);
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

    // Render messages
    messagesContainer.innerHTML = '';
    if (conv.messages.length === 0) {
        renderWelcome();
    } else {
        for (const msg of conv.messages) {
            addMessageToDOM(msg.role, msg.content);
        }
        scrollToBottom();
    }

    renderSidebar();
    closeSidebar();
}

function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);

    if (activeConversationId === id) {
        if (conversations.length > 0) {
            switchToConversation(conversations[0].id);
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
    if (conversations.length === 0) {
        conversationList.innerHTML = `
      <div class="conv-empty">
        <p>No conversations yet.</p>
        <p>Start a new chat!</p>
      </div>
    `;
        return;
    }

    conversationList.innerHTML = conversations
        .map(
            (conv) => `
      <div class="conv-item ${conv.id === activeConversationId ? 'active' : ''}" data-id="${conv.id}">
        <span class="conv-icon">💬</span>
        <div class="conv-info">
          <div class="conv-title">${escapeHtml(conv.title)}</div>
          <div class="conv-time">${formatTime(conv.updatedAt)}</div>
        </div>
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
            if (e.target.closest('.conv-delete')) return;
            switchToConversation(item.dataset.id);
        });
        item.addEventListener('touchend', (e) => {
            if (e.target.closest('.conv-delete')) return;
            e.preventDefault();
            switchToConversation(item.dataset.id);
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
    if (!text.trim() || isGenerating || !engine) return;

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

    // Remove welcome message
    const welcome = messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // Add user message
    addMessageToDOM('user', userText);
    conv.messages.push({ role: 'user', content: userText });

    // Update title from first user message
    if (conv.messages.filter((m) => m.role === 'user').length === 1) {
        conv.title = generateTitle(conv.messages);
        renderSidebar();
    }

    // Add AI placeholder
    const aiMsg = addMessageToDOM('assistant', '');
    const contentEl = aiMsg.querySelector('.message-content');
    contentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    scrollToBottom();

    isGenerating = true;

    try {
        const messages = [
            { role: 'system', content: systemPrompt.value },
            ...conv.messages,
        ];

        const temperature = parseFloat(temperatureSlider.value);
        const maxTokens = parseInt(maxTokensSlider.value);

        let fullResponse = '';
        let tokenCount = 0;
        const startTime = performance.now();

        const chunks = await engine.chat.completions.create({
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
        });

        for await (const chunk of chunks) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
                fullResponse += delta;
                tokenCount++;
                contentEl.innerHTML = formatMarkdown(fullResponse);
                scrollToBottom();
            }
        }

        const elapsed = (performance.now() - startTime) / 1000;
        const tokPerSec = tokenCount / elapsed;

        const statsEl = document.createElement('div');
        statsEl.className = 'perf-stats';
        statsEl.innerHTML = `
      <span class="perf-stat">⚡ ${tokPerSec.toFixed(1)} tok/s</span>
      <span class="perf-stat">📝 ${tokenCount} tokens</span>
      <span class="perf-stat">⏱️ ${elapsed.toFixed(1)}s</span>
    `;
        aiMsg.appendChild(statsEl);

        // Save to conversation
        conv.messages.push({ role: 'assistant', content: fullResponse });
        conv.updatedAt = Date.now();
        saveConversations();
        renderSidebar();
    } catch (err) {
        console.error('Generation error:', err);
        contentEl.innerHTML = `<span style="color: #f87171;">Error: ${err.message}</span>`;
    }

    isGenerating = false;
    sendBtn.disabled = !userInput.value.trim();
}

// ---- DOM Helpers ----
function addMessageToDOM(role, content) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🧠';

    const bubble = document.createElement('div');
    bubble.className = 'message-content';
    bubble.innerHTML = content ? formatMarkdown(content) : '';

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    messagesContainer.appendChild(msg);

    return msg;
}

function formatMarkdown(text) {
    let html = text
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return '<p>' + html + '</p>';
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
      <div class="welcome-icon">🧠</div>
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
    try {
        localStorage.setItem('neuralbox_conversations', JSON.stringify(conversations));
    } catch (e) { /* ignore quota errors */ }
}

function loadConversations() {
    try {
        const saved = localStorage.getItem('neuralbox_conversations');
        if (saved) {
            conversations = JSON.parse(saved);
        }

        // Migrate old single-conversation format
        if (conversations.length === 0) {
            const oldMessages = localStorage.getItem('neuralbox_messages');
            if (oldMessages) {
                const msgs = JSON.parse(oldMessages);
                if (msgs.length > 0) {
                    const conv = {
                        id: generateId(),
                        title: generateTitle(msgs),
                        messages: msgs,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };
                    conversations.push(conv);
                    saveConversations();
                    localStorage.removeItem('neuralbox_messages');
                }
            }
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

// ---- Settings ----
function loadSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem('neuralbox_settings') || '{}');
        if (settings.systemPrompt) systemPrompt.value = settings.systemPrompt;
        if (settings.temperature != null) {
            temperatureSlider.value = settings.temperature;
            tempValue.textContent = settings.temperature;
        }
        if (settings.maxTokens != null) {
            maxTokensSlider.value = settings.maxTokens;
            tokensValue.textContent = settings.maxTokens;
        }
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    try {
        localStorage.setItem('neuralbox_settings', JSON.stringify({
            systemPrompt: systemPrompt.value,
            temperature: parseFloat(temperatureSlider.value),
            maxTokens: parseInt(maxTokensSlider.value),
        }));
    } catch (e) { /* ignore */ }
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
sendBtn.addEventListener('click', () => sendMessage(userInput.value));
sendBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
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
    sendBtn.disabled = !userInput.value.trim() || isGenerating;
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

// Settings
settingsBtn.addEventListener('click', () => settingsPanel.classList.add('open'));
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

// ---- Start ----
init();
