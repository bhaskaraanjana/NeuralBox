import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const mainJs = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert(
    /webGpuAdapterAvailable: false/.test(mainJs) && /navigator\.gpu\.requestAdapter/.test(mainJs),
    'Startup must verify a real WebGPU adapter, not only navigator.gpu.',
  );
  assert(
    /webGpuAvailable = Boolean\(deviceCapabilities\.webGpuAdapterAvailable\)/.test(mainJs),
    'Runtime WebGPU availability should be based on adapter detection.',
  );
  assert(
    /This browser exposes WebGPU but could not provide a compatible GPU adapter/.test(mainJs),
    'Android adapter failure should have a clear user-facing reason.',
  );
  assert(
    /function updateComposerSendState\(\)/.test(mainJs),
    'Composer state should be centralized so Offline Library Mode cannot silently enable send.',
  );
  assert(
    /hasEngine: isComposerRuntimeReady\(\)/.test(mainJs),
    'Composer actions should require an active engine and non-offline runtime.',
  );
  assert(
    !/sendBtn\.disabled = false;/.test(mainJs),
    'No mobile/voice path should force-enable send without checking runtime readiness.',
  );
  assert(
    /function getCompactFallbackModel\(\)/.test(mainJs) &&
    /model_load_compact_fallback/.test(mainJs),
    'Model loading should try a compact fallback when a larger model fails on constrained devices.',
  );

  console.log('Android chat compatibility test passed.');
}

main().catch((err) => {
  console.error('Android chat compatibility test failed:', err.message);
  process.exit(1);
});
