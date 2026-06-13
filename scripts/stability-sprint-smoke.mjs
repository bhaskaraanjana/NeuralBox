import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [html, mainJs, renderingJs] = await Promise.all([
    // The chat app's markup now lives in chat.html (index.html is the Studio shell).
    readFile(new URL('../chat.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/rendering.js', import.meta.url), 'utf8'),
  ]);

  // Send/stop dual button contract.
  assert(/id="send-btn"/.test(html), 'Missing #send-btn in index.html');
  assert(!/id="stop-btn"/.test(html), 'Legacy #stop-btn should not exist');
  assert(/sendBtn\.classList\.toggle\('generating', active\)/.test(mainJs), 'Send button generating state toggle missing');
  assert(/sendBtn\.innerHTML = active \? STOP_ICON_SVG : SEND_ICON_SVG;/.test(mainJs), 'Send/stop icon swap missing');
  assert(/function handleComposerPrimaryAction\(/.test(mainJs), 'Composer primary action handler missing');
  assert(/const action = resolvePrimaryComposerAction\(\{/.test(mainJs), 'Composer action resolver usage missing');
  assert(/if \(action === 'cancel'\)\s*{\s*requestGenerationCancel\(\);/.test(mainJs), 'Send button should cancel generation when active');
  assert(/function attachTestApiIfEnabled\(/.test(mainJs), 'Test API attach helper missing');
  assert(/from '\.\/lib\/voice\.js'/.test(mainJs), 'Voice helper module import missing');
  assert(/from '\.\/lib\/settings\.js'/.test(mainJs), 'Settings helper module import missing');

  // Routing should only run behind auto selection.
  assert(/if \(isAutoModelSelected\(\)\)\s*{\s*const routing = chooseModelRoute/.test(mainJs), 'Routing must be gated by Auto selection');

  // Hot swap and progress observability hooks.
  assert(/setHotSwapStatus\(`Hot swapping to \$\{targetModel\.name\}\.\.\.`/.test(mainJs), 'Hot swap status updates missing');
  assert(/logRuntimeEvent\('hot_swap_start'/.test(mainJs), 'hot_swap_start event missing');
  assert(/logRuntimeEvent\('hot_swap_progress'/.test(mainJs), 'hot_swap_progress event missing');
  assert(/logRuntimeEvent\('hot_swap_done'/.test(mainJs), 'hot_swap_done event missing');

  // Debug panel wiring.
  assert(/id="debug-panel"/.test(html), 'Missing #debug-panel in index.html');
  assert(/id="debug-panel-setting"/.test(html), 'Missing #debug-panel-setting in index.html');
  assert(/function logRuntimeEvent\(/.test(mainJs), 'logRuntimeEvent helper missing');
  assert(/debugPanelEnabled: debugPanelEnabled/.test(mainJs), 'Debug panel setting should persist');

  // Source citation safety and rendering safety.
  assert(/safeParseHttpUrl/.test(mainJs), 'safeParseHttpUrl import usage missing');
  assert(!/new URL\(s\.url\)\.hostname/.test(mainJs), 'Unsafe URL hostname rendering path still present');
  assert(/export function safeParseHttpUrl\(/.test(renderingJs), 'safeParseHttpUrl helper missing in rendering module');
  assert(/const safe = escapeHtmlText\(String\(text \?\? ''\)\);/.test(renderingJs), 'formatBasicHTML should escape raw HTML first');

  // Prefer non-blocking notices instead of window.alert for standard UI actions.
  assert(!/\balert\(/.test(mainJs), 'Blocking alert usage should not exist in main runtime flow');

  // RAG ingestion safety guardrails.
  assert(/const RAG_MAX_FILE_BYTES =/.test(mainJs), 'RAG max file-size guard missing');
  assert(/function isSupportedRagFile\(/.test(mainJs), 'RAG file-type guard helper missing');
  assert(/skippedTooLarge/.test(mainJs), 'RAG skipped-too-large reporting missing');
  assert(/id="rag-guidance"/.test(html), 'RAG guidance element missing in settings UI');
  assert(/function renderRagGuidance\(/.test(mainJs), 'RAG guidance renderer missing');
  assert(/function renderLocalRagCitations\(/.test(mainJs), 'RAG citation renderer missing');
  assert(/ragTopConfidence/.test(mainJs), 'RAG confidence telemetry missing');

  // Device heuristics extraction contract.
  assert(/estimateVramMB/.test(mainJs), 'Device heuristic module usage missing in main runtime');
  assert(/getDeviceTier/.test(mainJs), 'Device tier helper usage missing in main runtime');
  assert(/formatVoiceTimer/.test(mainJs), 'Voice timer helper usage missing');
  assert(/normalizeSettingsTab/.test(mainJs), 'Settings tab normalization helper usage missing');
  assert(/function getModelSelectionHint\(/.test(mainJs), 'Model selection hint helper missing');
  assert(/id="model-selection-summary"/.test(mainJs), 'Model selection summary UI missing');
  assert(/id="model-switch-live-status"/.test(mainJs), 'Model switch live-status UI missing');

  console.log('Stability sprint smoke test passed.');
}

main().catch((err) => {
  console.error('Stability sprint smoke test failed:', err.message);
  process.exit(1);
});

