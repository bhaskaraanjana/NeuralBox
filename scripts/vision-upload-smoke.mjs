import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const imagePath = process.env.IMAGE_PATH || 'C:/DEV/NeuralBox/scripts/smoke-image.png';
const visionModelId = 'Phi-3.5-vision-instruct-q4f16_1-MLC';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

const errors = [];
context.on('page', (page) => {
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
});

await context.addInitScript((modelId) => {
  // Make init() pass WebGPU checks in headless smoke tests.
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
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      localStorage.setItem('neuralbox_model', modelId);
    }
  } catch {
    // Ignore storage errors in non-http contexts.
  }
}, visionModelId);

const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.setInputFiles('#image-input', imagePath);
await page.waitForTimeout(500);

const previewVisible = await page.evaluate(() => {
  const preview = document.querySelector('#image-preview');
  const img = document.querySelector('#image-preview-img');
  if (!preview || !img) return false;
  return preview.style.display !== 'none' && !!img.getAttribute('src');
});

await browser.close();

if (!previewVisible) {
  throw new Error(`Upload preview did not appear. Errors: ${errors.join(' | ')}`);
}

if (errors.length > 0) {
  throw new Error(`Runtime errors during upload smoke test: ${errors.join(' | ')}`);
}

console.log('Vision upload smoke test passed.');
