import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [html, mainJs] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  ]);

  // Send/stop dual button contract.
  assert(/id="send-btn"/.test(html), 'Missing #send-btn in index.html');
  assert(!/id="stop-btn"/.test(html), 'Legacy #stop-btn should not exist');
  assert(/sendBtn\.classList\.toggle\('generating', active\)/.test(mainJs), 'Send button generating state toggle missing');
  assert(/sendBtn\.innerHTML = active \? STOP_ICON_SVG : SEND_ICON_SVG;/.test(mainJs), 'Send/stop icon swap missing');
  assert(/if \(isGenerating\)\s*{\s*requestGenerationCancel\(\);/.test(mainJs), 'Send button should cancel generation when active');

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

  console.log('Stability sprint smoke test passed.');
}

main().catch((err) => {
  console.error('Stability sprint smoke test failed:', err.message);
  process.exit(1);
});

