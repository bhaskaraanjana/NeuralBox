// Generic E2E: open an image studio, pick a sample, run, and confirm it
// produces visible output (canvas / bars / big result / download) with no
// console errors. Validates render paths classification doesn't cover.
// Usage: STUDIO=background-removal node scripts/studio-run-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const STUDIO = process.env.STUDIO || 'background-removal';
const PORT = Number(process.env.SMOKE_PORT || 6973);
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
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto(`${baseUrl}/#/${STUDIO}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sx-pane', { timeout: 15000 });
  // Image studios have sample thumbnails; text studios ship with default input.
  if (await page.$('.sx-sample')) { await page.click('.sx-sample'); await sleep(300); }
  await page.locator('.sx-btn-primary:visible').first().click();

  console.log(`[${STUDIO}] running (up to 200s)…`);
  await page.waitForFunction(() => {
    const panes = document.querySelectorAll('.sx-pane');
    const out = panes[panes.length - 1] || document.body;
    if (out.querySelector('canvas')) return true;
    if (out.querySelector('.sx-bar-row')) return true;
    if (out.querySelector('.sx-overlay') && out.querySelector('.sx-overlay').childElementCount > 0) return true;
    if (out.querySelector('mark')) return true;
    const big = out.querySelector('.sx-result-big');
    if (big && big.textContent.trim() && big.textContent.trim() !== '—') return true;
    const muted = [...out.querySelectorAll('.sx-muted')].map((m) => m.textContent).join(' ');
    if (/found|match|no objects|no matches/i.test(muted)) return true;
    if ([...document.querySelectorAll('button')].some((b) => /download/i.test(b.textContent))) return true;
    return false;
  }, null, { timeout: 200000 });

  const realErrs = errs.filter((e) => !/404|Not Found/i.test(e));
  console.log(`[${STUDIO}] ✅ produced output.` + (realErrs.length ? ` (non-404 console errors: ${realErrs.join(' | ')})` : ' No real console errors.'));
  if (realErrs.length) process.exitCode = 1;
} catch (e) {
  console.error(`[${STUDIO}] ❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) {
    try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {}
  }
}
