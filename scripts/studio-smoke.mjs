// Self-contained smoke for the NeuralBox Studio shell.
// Builds are assumed done; this spawns `vite preview`, then drives the
// gallery: cards render, a studio mounts with zero console errors,
// routing + back + search work. It does NOT download models.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.SMOKE_PORT || 6971);
const baseUrl = `http://127.0.0.1:${PORT}`;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function waitForServer(url, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ }
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
  const errors = [];
  context.on('page', (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // Gallery renders a healthy number of model cards.
  await page.waitForSelector('.home-card', { timeout: 15000 });
  const cardCount = await page.$$eval('.home-card', (els) => els.length);
  assert(cardCount >= 18, `Expected >=18 model cards, got ${cardCount}`);

  // Category sections present.
  const sections = await page.$$eval('.home-section-title', (els) => els.map((e) => e.textContent.trim()));
  for (const cat of ['Vision', 'Audio', 'Language', 'Chat']) {
    assert(sections.some((s) => s.includes(cat)), `Missing category section: ${cat}`);
  }

  // Search filters the gallery.
  await page.fill('.home-search', 'detect');
  await page.waitForFunction(() => document.querySelectorAll('.home-card').length < 18, null, { timeout: 5000 });
  await page.fill('.home-search', '');
  await page.waitForFunction(() => document.querySelectorAll('.home-card').length >= 18, null, { timeout: 5000 });

  // Favorites: pinning a card surfaces a Pinned section (persisted in IndexedDB).
  await page.click('.home-fav');
  await page.waitForFunction(() => [...document.querySelectorAll('.home-section-title')].some((e) => /Pinned/.test(e.textContent)), null, { timeout: 5000 });

  // Storage panel opens and closes.
  await page.click('.top-icon-btn');
  await page.waitForSelector('.sx-modal', { timeout: 5000 });
  await page.click('.sx-modal-close');
  await page.waitForFunction(() => !document.querySelector('.sx-modal-overlay'), null, { timeout: 5000 });

  // Open the Sentiment studio (text studio, no model auto-load) via hash route.
  await page.evaluate(() => { location.hash = '#/sentiment'; });
  await page.waitForSelector('.studio-head-title', { timeout: 10000 });
  const title = await page.$eval('.studio-head-title', (e) => e.textContent.trim());
  assert(/sentiment/i.test(title), `Studio header wrong: ${title}`);
  await page.waitForFunction(() => /Sentiment/.test(document.title), null, { timeout: 3000 });
  await page.waitForSelector('.sx-pane', { timeout: 5000 });
  await page.waitForSelector('.sx-btn-primary', { timeout: 5000 });

  // Open the object-detection studio too (vision shell mounts cleanly).
  await page.evaluate(() => { location.hash = '#/object-detection'; });
  await page.waitForFunction(() => /object detection/i.test(document.querySelector('.studio-head-title')?.textContent || ''), null, { timeout: 10000 });

  // Back to gallery via the "All models" button.
  await page.click('.studio-head .sx-btn-ghost');
  await page.waitForSelector('.home-hero-title', { timeout: 5000 });

  // Escape returns to the gallery from a studio.
  await page.evaluate(() => { location.hash = '#/depth'; });
  await page.waitForFunction(() => /depth/i.test(document.querySelector('.studio-head-title')?.textContent || ''), null, { timeout: 10000 });
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Escape');
  await page.waitForSelector('.home-hero-title', { timeout: 5000 });

  await browser.close();
  if (errors.length) throw new Error(`Console/page errors: ${errors.join(' | ')}`);
  console.log(`Studio smoke passed (${cardCount} model cards, sections: ${sections.join(', ')}).`);
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  // Ensure the preview process tree is gone on Windows.
  if (process.platform === 'win32' && server.pid) {
    try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {}
  }
}
