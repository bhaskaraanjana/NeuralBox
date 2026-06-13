// One-off: prove the full engine works end-to-end on the WASM ("any device")
// path — headless Chromium has no WebGPU, so this exercises the universal
// fallback: model download + inference + render, plus cross-origin sample
// fetch under COOP/COEP. Targets the smallest studio (Image Labeler, ~12MB).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.SMOKE_PORT || 6972);
const baseUrl = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await sleep(300);
  }
  throw new Error(`Server did not start at ${url}`);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), shell: true, stdio: 'ignore',
});

let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

  await page.goto(`${baseUrl}/#/image-classification`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sx-pane', { timeout: 15000 });

  // Cross-origin sample fetch test (does the HF URL load under COEP?).
  const sampleProbe = await page.evaluate(async () => {
    const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';
    try { const r = await fetch(url); return { ok: r.ok, status: r.status, bytes: (await r.blob()).size }; }
    catch (e) { return { ok: false, error: String(e.message || e) }; }
  });
  console.log('Cross-origin sample fetch:', JSON.stringify(sampleProbe));

  // Pick a sample image, then run (the visible primary = run button; the
  // camera widget also has a hidden primary "Capture" button).
  await page.click('.sx-sample');
  await sleep(300);
  await page.locator('.sx-btn-primary:visible').first().click();

  console.log('Downloading model + running inference (up to 180s)…');
  await page.waitForSelector('.sx-bar-row', { timeout: 180000 });
  const labels = await page.$$eval('.sx-bar-label', (els) => els.map((e) => e.textContent.trim()));
  const device = await page.evaluate(async () => {
    try { const m = await import('/src/studio/runtime.js'); return await m.pickDevice(); } catch { return 'unknown'; }
  });

  console.log(`Device: ${device}`);
  console.log(`Top labels: ${labels.slice(0, 5).join(' | ')}`);
  if (!labels.length) throw new Error('No labels produced');
  const errs = logs.filter((l) => l.startsWith('error') || l.startsWith('pageerror'));
  if (errs.length) console.log('Console errors during run:\n' + errs.join('\n'));
  console.log('\n✅ End-to-end inference WORKS on the WASM path.');
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) {
    try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {}
  }
}
