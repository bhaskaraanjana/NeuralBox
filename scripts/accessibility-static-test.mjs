import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`Accessibility static test failed: ${message}`);
    process.exit(1);
  }
}

const html = readFileSync('index.html', 'utf8');
const mainJs = readFileSync('src/main.js', 'utf8');
const css = readFileSync('src/style.css', 'utf8');

const requiredHtmlContracts = [
  { pattern: /id="settings-panel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="settings-title"/, message: 'Settings panel must expose dialog semantics.' },
  { pattern: /id="voice-chat-overlay"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="voice-chat-label"/, message: 'Voice chat overlay must expose dialog semantics.' },
  { pattern: /id="status-text"[^>]*role="status"[^>]*aria-live="polite"/, message: 'Startup status must be announced politely.' },
  { pattern: /id="hot-swap-status"[^>]*role="status"[^>]*aria-live="polite"/, message: 'Hot-swap status must be announced politely.' },
  { pattern: /id="voice-status"[^>]*role="status"[^>]*aria-live="polite"/, message: 'Voice status must be announced politely.' },
  { pattern: /id="rag-status"[^>]*role="status"[^>]*aria-live="polite"/, message: 'RAG status must be announced politely.' },
  { pattern: /id="send-btn"[^>]*aria-label="Send message"/, message: 'Composer send button needs an accessible name.' },
  { pattern: /id="voice-orb"[^>]*role="button"[^>]*tabindex="0"/, message: 'Voice orb must be keyboard focusable.' },
  { pattern: /id="rag-dropzone"[^>]*role="button"/, message: 'RAG dropzone must expose button semantics.' },
  { pattern: /id="rag-retrieval-profile"[^>]*aria-label="RAG retrieval profile"/, message: 'RAG retrieval profile select needs an accessible name.' },
  { pattern: /id="conversation-search"[^>]*aria-label="Search conversations"/, message: 'Conversation search input needs an accessible name.' },
  { pattern: /id="user-input"[^>]*aria-label="Message NeuralBox"/, message: 'Composer textarea needs an accessible name.' },
  { pattern: /id="settings-btn"[^>]*aria-expanded="false"/, message: 'Settings button must expose collapsed state.' },
  { pattern: /id="voice-chat-btn"[^>]*aria-expanded="false"/, message: 'Voice chat button must expose collapsed state.' },
];

for (const contract of requiredHtmlContracts) {
  assert(contract.pattern.test(html), contract.message);
}

const requiredRuntimeContracts = [
  { pattern: /sendBtn\.setAttribute\('aria-label', active \? 'Stop generation' : 'Send message'\)/, message: 'Send button aria-label must track send/stop state.' },
  { pattern: /webSearchToggle\.setAttribute\('aria-pressed', enabled \? 'true' : 'false'\)/, message: 'Web search toggle must track pressed state.' },
  { pattern: /thinkToggle\.setAttribute\('aria-pressed', thinkingEnabled \? 'true' : 'false'\)/, message: 'Thinking toggle must track pressed state.' },
  { pattern: /settingsBtn\.setAttribute\('aria-expanded', 'true'\)/, message: 'Settings open state must update aria-expanded.' },
  { pattern: /voiceChatBtn\.setAttribute\('aria-expanded', 'true'\)/, message: 'Voice chat open state must update aria-expanded.' },
  { pattern: /voiceOrb\.addEventListener\('keydown'/, message: 'Voice orb must support keyboard activation.' },
];

for (const contract of requiredRuntimeContracts) {
  assert(contract.pattern.test(mainJs), contract.message);
}

assert(/button:focus-visible/.test(css), 'Keyboard focus-visible styling must exist for buttons.');
assert(/\[role='button'\]:focus-visible/.test(css), 'Keyboard focus-visible styling must exist for role=button controls.');

console.log('Accessibility static test passed.');
