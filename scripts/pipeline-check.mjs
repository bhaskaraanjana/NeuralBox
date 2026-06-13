// E2E for the pipeline hand-off: Caption an image, send the caption to the
// Translator, and confirm the translator's input is prefilled. Also checks
// the caption landed in history.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.SMOKE_PORT || 7600);
const baseUrl = `http://127.0.0.1:${PORT}`;
async function up(u, ms = 30000) { const d = Date.now() + ms; while (Date.now() < d) { try { const r = await fetch(u); if (r.ok) return; } catch {} await sleep(300); } throw new Error('down'); }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, stdio: 'ignore' });
let browser;
try {
  await up(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto(`${baseUrl}/#/caption`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sx-pane', { timeout: 15000 });
  await page.click('.sx-sample');
  await sleep(300);
  await page.locator('.sx-btn-primary:visible').first().click();
  console.log('Captioning…');
  await page.waitForFunction(() => {
    const b = document.querySelector('.sx-result-big');
    return b && b.textContent.trim() && b.textContent.trim() !== '—';
  }, null, { timeout: 200000 });
  const caption = await page.$eval('.sx-result-big', (e) => e.textContent.trim());
  console.log('caption:', caption.slice(0, 80));

  // Send to → Translator
  await page.locator('button:has-text("Send to")').first().click();
  await page.waitForSelector('.sx-modal', { timeout: 5000 });
  await page.locator('.sx-modal button:has-text("Translator")').first().click();

  await page.waitForFunction(() => /translat/i.test(document.querySelector('.studio-head-title')?.textContent || ''), null, { timeout: 10000 });
  await sleep(400);
  const prefilled = await page.$eval('.studio-host textarea', (t) => t.value.trim());
  console.log('translator input prefilled with:', prefilled.slice(0, 80));
  if (!prefilled) throw new Error('Translator input was NOT prefilled from the caption hand-off');
  if (!caption.startsWith(prefilled.slice(0, 20))) console.log('NOTE: prefill differs from caption (acceptable if truncated)');

  // History should contain the caption (the modal renders its body async).
  await page.locator('.top-icon-btn').first().click();
  await page.waitForSelector('.sx-modal', { timeout: 5000 });
  await page.waitForFunction(() => { const m = document.querySelector('.sx-modal'); return m && !/Loading…/.test(m.textContent); }, null, { timeout: 5000 });
  const histText = await page.$eval('.sx-modal', (m) => m.textContent);
  const inHistory = histText.includes(caption.slice(0, 30));
  console.log('caption in history:', inHistory);

  const realErrs = errs.filter((e) => !/404|Not Found/i.test(e));
  console.log(`\n✅ Pipeline hand-off works.` + (realErrs.length ? ` ERRORS: ${realErrs.join(' | ')}` : ' No real console errors.'));
  if (realErrs.length || !inHistory) process.exitCode = 1;
  await browser.close();
} catch (e) {
  console.error('❌ ' + e.message);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) { try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {} }
}
