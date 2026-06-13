// E2E for Mini Chat (transformers.js LLM). Uses the smallest tier (Lite /
// SmolLM2-360M) so it's feasible on the WASM path, sends a message, and waits
// for a streamed assistant reply.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.SMOKE_PORT || 7220);
const baseUrl = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, ms = 30000) {
  const d = Date.now() + ms;
  while (Date.now() < d) { try { const r = await fetch(url); if (r.ok) return; } catch {} await sleep(300); }
  throw new Error('server down');
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, stdio: 'ignore' });
let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto(`${baseUrl}/#/mini-chat`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sx-chat', { timeout: 15000 });
  await page.locator('button.sx-seg:has-text("Lite")').click();
  await page.fill('.sx-chat-input textarea', 'Reply with exactly: hello there friend');
  await page.locator('button:has-text("Send")').click();

  console.log('[mini-chat] loading SmolLM2 + generating (up to 420s)…');
  await page.waitForFunction(() => {
    const bots = document.querySelectorAll('.sx-msg-bot');
    const last = bots[bots.length - 1];
    return last && last.textContent.trim().length > 1;
  }, null, { timeout: 420000 });

  const reply = await page.evaluate(() => {
    const bots = document.querySelectorAll('.sx-msg-bot');
    return bots[bots.length - 1].textContent.trim().slice(0, 100);
  });
  const realErrs = errs.filter((e) => !/404|Not Found/i.test(e));
  console.log(`[mini-chat] ✅ reply: "${reply}"` + (realErrs.length ? ` | ERRORS: ${realErrs.join(' | ')}` : ' | no real console errors'));
  if (realErrs.length) process.exitCode = 1;
  await browser.close();
} catch (e) {
  console.error(`[mini-chat] ❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) { try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {} }
}
