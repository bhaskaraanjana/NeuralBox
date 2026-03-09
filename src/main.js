// ============================================
// NeuralBox — Main Application
// ============================================
import * as webllm from '@mlc-ai/web-llm';

// ---- State ----
let engine = null;
let isGenerating = false;
let conversations = [];
let currentMessages = [];

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

// ---- Model Config ----
const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

// ---- Init ----
async function init() {
    // Check WebGPU support
    if (!navigator.gpu) {
        webgpuError.style.display = 'block';
        downloadSection.style.display = 'none';
        return;
    }

    // WebGPU available — show load button
    statusText.textContent = 'Ready to load AI model';
    startBtn.style.display = 'inline-flex';

    startBtn.addEventListener('click', loadModel);
    startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        loadModel();
    });

    // Load saved settings
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

            // Parse progress from the report text
            const match = text.match(/(\d+)%/);
            if (match) {
                const pct = parseInt(match[1]);
                progressFill.style.width = pct + '%';
                progressPercent.textContent = pct + '%';
            }

            // Detect fetching phase for better UX
            if (text.includes('Loading model')) {
                statusText.textContent = 'Loading model into GPU memory...';
            }
        };

        engine = await webllm.CreateMLCEngine(MODEL_ID, {
            initProgressCallback,
        });

        // Model loaded — switch to chat
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
    loadConversationHistory();
}

// ---- Chat Logic ----
async function sendMessage(text) {
    if (!text.trim() || isGenerating || !engine) return;

    const userText = text.trim();
    userInput.value = '';
    autoResizeInput();
    sendBtn.disabled = true;

    // Remove welcome message
    const welcome = messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // Add user message
    addMessageToDOM('user', userText);
    currentMessages.push({ role: 'user', content: userText });

    // Add AI placeholder
    const aiMsg = addMessageToDOM('assistant', '');
    const contentEl = aiMsg.querySelector('.message-content');
    contentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    // Scroll to bottom
    scrollToBottom();

    // Generate response
    isGenerating = true;

    try {
        const messages = [
            { role: 'system', content: systemPrompt.value },
            ...currentMessages,
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

        // Add perf stats below the message
        const statsEl = document.createElement('div');
        statsEl.className = 'perf-stats';
        statsEl.innerHTML = `
      <span class="perf-stat">⚡ ${tokPerSec.toFixed(1)} tok/s</span>
      <span class="perf-stat">📝 ${tokenCount} tokens</span>
      <span class="perf-stat">⏱️ ${elapsed.toFixed(1)}s</span>
    `;
        aiMsg.appendChild(statsEl);

        // Save to conversation
        currentMessages.push({ role: 'assistant', content: fullResponse });
        saveConversationHistory();
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
    // Basic markdown: bold, italic, code blocks, inline code, paragraphs
    let html = text
        // Code blocks
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Line breaks to paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return '<p>' + html + '</p>';
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ---- Textarea Auto-resize ----
function autoResizeInput() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

// ---- Conversation Persistence ----
function saveConversationHistory() {
    try {
        localStorage.setItem('neuralbox_messages', JSON.stringify(currentMessages));
    } catch (e) { /* ignore quota errors */ }
}

function loadConversationHistory() {
    try {
        const saved = localStorage.getItem('neuralbox_messages');
        if (saved) {
            currentMessages = JSON.parse(saved);
            if (currentMessages.length > 0) {
                const welcome = messagesContainer.querySelector('.welcome-message');
                if (welcome) welcome.remove();

                for (const msg of currentMessages) {
                    addMessageToDOM(msg.role, msg.content);
                }
                scrollToBottom();
            }
        }
    } catch (e) { /* ignore parse errors */ }
}

function clearConversation() {
    currentMessages = [];
    localStorage.removeItem('neuralbox_messages');
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

// ---- Event Listeners ----

// Send message
sendBtn.addEventListener('click', () => sendMessage(userInput.value));
sendBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    sendMessage(userInput.value);
});

// Enter to send (Shift+Enter for newline)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(userInput.value);
    }
});

// Auto-resize textarea
userInput.addEventListener('input', () => {
    autoResizeInput();
    sendBtn.disabled = !userInput.value.trim() || isGenerating;
});

// New chat
newChatBtn.addEventListener('click', clearConversation);

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

// Clear history
clearHistoryBtn.addEventListener('click', () => {
    clearConversation();
    settingsPanel.classList.remove('open');
});

// Suggestion chips
bindSuggestionChips();

// ---- Start ----
init();
