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
// The chat app now lives at /chat.html (index.html is the Studio shell).
await page.goto(`${baseUrl}/chat.html`, { waitUntil: 'domcontentloaded' });
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

const pendingManualSwitch = await page.evaluate(() => {
  const select = document.querySelector('#model-select');
  const switchBtn = document.querySelector('#switch-model-btn');
  if (!select || !switchBtn) {
    return { ok: false };
  }
  const optionValues = Array.from(select.options || []).map((opt) => opt.value).filter(Boolean);
  const currentValue = select.value;
  const nextValue = optionValues.find((value) => value !== currentValue) || '';
  if (!nextValue) {
    return { ok: false };
  }
  select.value = nextValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return {
    ok: true,
    nextValue,
    buttonDisabled: Boolean(switchBtn.disabled),
    noteText: String(document.querySelector('#model-switch-note')?.textContent || '').trim(),
  };
});
assert(pendingManualSwitch.ok === true, 'Model selector should provide at least one alternative option.');
assert(pendingManualSwitch.buttonDisabled === false, 'Switch model button should be enabled for pending selection.');
assert(/pending/i.test(pendingManualSwitch.noteText), 'Pending switch note should be shown after selection change.');

await page.click('#switch-model-btn');
await page.waitForFunction(() => {
  const btn = document.querySelector('#switch-model-btn');
  return Boolean(btn && /Selection Up To Date/i.test(btn.textContent || ''));
}, null, { timeout: 10000 });

const postManualSwitch = await page.evaluate(() => {
  return {
    noteText: String(document.querySelector('#model-switch-note')?.textContent || '').trim(),
  };
});
assert(!/pending/i.test(postManualSwitch.noteText), 'Pending switch note should clear after applying selection.');

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

const routeSwitchFallbackText = await page.evaluate(() => {
  return window.__NB_TEST_API.injectRouteSwitchFailureBannerForTest();
});
const expectedRouteSwitchText = await page.evaluate(() => {
  return window.__NB_TEST_API.getRouteSwitchFailureNoticeForTest();
});
assert(
  routeSwitchFallbackText.includes(expectedRouteSwitchText),
  `Expected route-switch fallback banner text \"${expectedRouteSwitchText}\".`,
);

await browser.close();

if (errors.length > 0) {
  throw new Error(`Browser lifecycle smoke detected runtime errors: ${errors.join(' | ')}`);
}

console.log('Browser lifecycle smoke test passed.');
