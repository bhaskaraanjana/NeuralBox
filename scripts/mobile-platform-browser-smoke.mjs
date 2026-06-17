import { spawn } from 'node:child_process';
import https from 'node:https';
import { chromium } from 'playwright';

const port = Number(process.env.MOBILE_SMOKE_PORT || 4174);
const baseUrl = `https://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function startPreviewServer() {
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => {
    const text = String(chunk || '');
    if (!/Local:|Network:/.test(text)) {
      process.stderr.write(text);
    }
  });

  return child;
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      await new Promise((resolve, reject) => {
        const req = https.get(baseUrl, { rejectUnauthorized: false }, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error(`Preview returned ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1500, () => {
          req.destroy(new Error('Preview request timed out'));
        });
      });
      return;
    } catch (_err) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for Vite preview server.');
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    isMobile: true,
    hasTouch: true,
    userAgent: scenario.userAgent,
    ignoreHTTPSErrors: true,
  });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });

  await page.addInitScript(({ platform }) => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      get() {
        return platform;
      },
    });
    Object.defineProperty(Navigator.prototype, 'gpu', {
      configurable: true,
      get() {
        return undefined;
      },
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage blocked for mobile smoke', 'SecurityError');
      },
    });
  }, { platform: scenario.platform });

  try {
    await page.goto(`${baseUrl}/?nb_test=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#chat-screen.active', { timeout: 12000 });

    const state = await page.evaluate(() => ({
      loadingActive: document.querySelector('#loading-screen')?.classList.contains('active') || false,
      chatActive: document.querySelector('#chat-screen')?.classList.contains('active') || false,
      badge: document.querySelector('#model-badge')?.textContent || '',
      sendDisabled: document.querySelector('#send-btn')?.disabled || false,
      settingsButtonVisible: Boolean(document.querySelector('#settings-btn')),
      webgpuErrorVisible: getComputedStyle(document.querySelector('#webgpu-error')).display !== 'none',
      bodyWidth: document.body.getBoundingClientRect().width,
    }));

    assert(state.loadingActive === false, `${scenario.name}: loading screen should clear.`);
    assert(state.chatActive === true, `${scenario.name}: chat shell should be active.`);
    assert(/Offline Library Mode/i.test(state.badge), `${scenario.name}: badge should show Offline Library Mode.`);
    assert(state.sendDisabled === true, `${scenario.name}: send should remain disabled without an engine.`);
    assert(state.settingsButtonVisible === true, `${scenario.name}: settings should be reachable.`);
    assert(state.webgpuErrorVisible === true, `${scenario.name}: compatibility notice should be visible.`);
    assert(state.bodyWidth <= scenario.viewport.width + 1, `${scenario.name}: layout should fit the mobile viewport.`);

    const relevantErrors = errors.filter((text) => !/favicon|Failed to load resource|SSL certificate error occurred when fetching the script/i.test(text));
    assert(relevantErrors.length === 0, `${scenario.name}: unexpected browser errors: ${relevantErrors.join(' | ')}`);
  } finally {
    await context.close();
  }
}

const scenarios = [
  {
    name: 'iPhone compatibility shell',
    viewport: { width: 390, height: 844 },
    platform: 'iPhone',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'Android compatibility shell',
    viewport: { width: 412, height: 915 },
    platform: 'Linux armv8l',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  },
];

const server = startPreviewServer();

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of scenarios) {
      await runScenario(browser, scenario);
    }
  } finally {
    await browser.close();
  }
  console.log('Mobile platform browser smoke passed.');
} finally {
  server.kill();
}
