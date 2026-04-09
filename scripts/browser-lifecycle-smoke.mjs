import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });

const errors = [];
context.on('page', (page) => {
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {
      requestAdapter: async () => ({
        info: { description: 'Playwright Fake GPU' },
        limits: {
          maxBufferSize: 6 * 1024 * 1024 * 1024,
          maxStorageBufferBindingSize: 6 * 1024 * 1024 * 1024,
        },
      }),
    },
  });

  try {
    localStorage.setItem('neuralbox_test_api', '1');
    localStorage.setItem('neuralbox_model', 'Qwen3-0.6B-q4f16_1-MLC');
  } catch {
    // Ignore storage errors.
  }

  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    });
  }
});

const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#send-btn', { state: 'attached', timeout: 15000 });
await page.waitForFunction(() => Boolean(window.__NB_TEST_API), null, { timeout: 15000 });

// In headless smoke mode we may not load a real model; switch to chat screen to validate UI lifecycle handlers.
await page.evaluate(() => {
  document.querySelector('#loading-screen')?.classList.remove('active');
  document.querySelector('#chat-screen')?.classList.add('active');
});
await page.waitForSelector('#send-btn', { state: 'visible', timeout: 10000 });

await page.click('#settings-btn');
await page.waitForFunction(() => {
  const panel = document.querySelector('#settings-panel');
  return Boolean(panel && panel.classList.contains('open'));
});

const importPayload = {
  version: 1,
  exportedAt: new Date().toISOString(),
  conversations: [
    {
      id: 'smoke-conv-1',
      title: 'Smoke Conversation',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        { role: 'user', content: 'Smoke question' },
        { role: 'assistant', content: 'Smoke answer' },
      ],
    },
  ],
};

await page.setInputFiles('#import-chats-input', {
  name: 'smoke-import.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(importPayload), 'utf8'),
});

await page.waitForFunction(() => window.__NB_TEST_API.getConversationCount() >= 1, null, {
  timeout: 10000,
});

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }),
  page.click('#export-chats-btn'),
]);
const filename = download.suggestedFilename();
assert(/neuralbox-export-.*\.json/i.test(filename), `Unexpected export filename: ${filename}`);

await page.click('#close-settings');
await page.waitForFunction(() => {
  const panel = document.querySelector('#settings-panel');
  return Boolean(panel && !panel.classList.contains('open'));
});

const generatingState = await page.evaluate(() => {
  window.__NB_TEST_API.resetGenerationCancelRequested();
  window.__NB_TEST_API.setGeneratingStateForTest(true);
  return window.__NB_TEST_API.getSendButtonState();
});
assert(generatingState.title === 'Stop generation', 'Send button should display stop title while generating.');
assert(generatingState.generatingClass === true, 'Send button should have generating class while generating.');

await page.click('#send-btn');
await page.waitForFunction(() => window.__NB_TEST_API.getGenerationCancelRequested() === true, null, {
  timeout: 5000,
});

const idleState = await page.evaluate(() => {
  window.__NB_TEST_API.setGeneratingStateForTest(false);
  return window.__NB_TEST_API.getSendButtonState();
});
assert(idleState.title === 'Send message', 'Send button should restore send title when idle.');

await browser.close();

if (errors.length > 0) {
  throw new Error(`Browser lifecycle smoke detected runtime errors: ${errors.join(' | ')}`);
}

console.log('Browser lifecycle smoke test passed.');
