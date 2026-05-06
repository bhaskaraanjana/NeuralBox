import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];

page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.addInitScript(() => {
  try {
    Object.defineProperty(Navigator.prototype, 'gpu', {
      configurable: true,
      get() {
        return undefined;
      },
    });
    window.localStorage.setItem('neuralbox_test_api', '1');
  } catch (_err) {
    // Best-effort WebGPU masking for browser smoke.
  }
});

try {
  await page.goto(`${baseUrl}/?nb_test=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#chat-screen.active', { timeout: 10000 });

  const state = await page.evaluate(() => ({
    loadingActive: document.querySelector('#loading-screen')?.classList.contains('active') || false,
    chatActive: document.querySelector('#chat-screen')?.classList.contains('active') || false,
    badge: document.querySelector('#model-badge')?.textContent || '',
    sendDisabled: document.querySelector('#send-btn')?.disabled || false,
    inputPlaceholder: document.querySelector('#user-input')?.getAttribute('placeholder') || '',
    webgpuErrorVisible: getComputedStyle(document.querySelector('#webgpu-error')).display !== 'none',
  }));

  assert(state.loadingActive === false, 'Loading screen should not remain active without WebGPU.');
  assert(state.chatActive === true, 'Chat shell should become active without WebGPU.');
  assert(/Offline Library Mode/i.test(state.badge), 'Model badge should show Offline Library Mode.');
  assert(state.sendDisabled === true, 'Send button should stay disabled without an inference engine.');
  assert(/WebGPU/i.test(state.inputPlaceholder), 'Composer placeholder should explain WebGPU requirement.');

  await page.click('#settings-btn');
  await page.waitForSelector('#settings-panel.open', { timeout: 5000 });
  const settingsOpen = await page.locator('#settings-panel.open').count();
  assert(settingsOpen === 1, 'Settings should still open in offline shell mode.');

  const relevantErrors = errors.filter((text) => !/favicon|Failed to load resource/i.test(text));
  assert(relevantErrors.length === 0, `Unexpected browser errors: ${relevantErrors.join(' | ')}`);

  console.log('Offline shell browser smoke passed.');
} finally {
  await browser.close();
}
