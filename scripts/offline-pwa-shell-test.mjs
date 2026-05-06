import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    console.error(`Offline PWA shell test failed: ${message}`);
    process.exit(1);
  }
}

const mainJs = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

assert(!/import \* as webllm from '@mlc-ai\/web-llm'/.test(mainJs), 'WebLLM must not be statically imported by the app shell.');
assert(/import\('@mlc-ai\/web-llm'\)/.test(mainJs), 'WebLLM should be lazy-loaded only for model actions.');
assert(/from 'virtual:pwa-register'/.test(mainJs), 'PWA service worker registration should be explicit.');
assert(/function setOfflineShellMode\(/.test(mainJs), 'Offline shell mode helper is missing.');
assert(/if \(!webGpuAvailable\)\s*{\s*setOfflineShellMode/.test(mainJs), 'Startup should enter offline shell mode when WebGPU is missing.');
assert(!/if \(!navigator\.gpu\)\s*{\s*webgpuError\.style\.display = 'block';\s*downloadSection\.style\.display = 'none';\s*return;/.test(mainJs), 'Startup must not hard-return before app initialization when WebGPU is missing.');
assert(/Open Offline Library/.test(mainJs), 'No-WebGPU startup should expose an offline-library entry point.');
assert(/globIgnores: \[[^\]]+'\*\*\/webllm-\*\.js'/.test(viteConfig), 'PWA precache should continue excluding the large WebLLM chunk.');
assert(/navigateFallback: 'index.html'/.test(viteConfig), 'PWA should provide app-shell navigation fallback.');

console.log('Offline PWA shell test passed.');
