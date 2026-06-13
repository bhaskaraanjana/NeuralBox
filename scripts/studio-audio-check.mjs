// E2E for the audio-INPUT studios. Generates a WAV tone, feeds it through
// the file dropzone, and confirms each produces output without console errors.
// (A pure tone won't transcribe to words, but it exercises the full
// decode -> pipeline -> render path, which is what we're verifying.)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.SMOKE_PORT || 7210);
const baseUrl = `http://127.0.0.1:${PORT}`;

function makeWav(seconds = 3, rate = 16000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    // Mix a couple of tones so it isn't pure silence.
    const s = (Math.sin(2 * Math.PI * 440 * i / rate) + Math.sin(2 * Math.PI * 660 * i / rate)) * 0.2;
    buf.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, 44 + i * 2);
  }
  return buf;
}

async function waitForServer(url, ms = 30000) {
  const d = Date.now() + ms;
  while (Date.now() < d) { try { const r = await fetch(url); if (r.ok) return; } catch {} await sleep(300); }
  throw new Error('server down');
}

const wavPath = join(tmpdir(), 'nb-test-tone.wav');
writeFileSync(wavPath, makeWav());

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, stdio: 'ignore' });
let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();

  for (const studio of ['speech-to-text', 'audio-classification']) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

    await page.goto(`${baseUrl}/#/${studio}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.sx-pane', { timeout: 15000 });
    await page.setInputFiles('input[type="file"]', wavPath);
    await sleep(400);
    // speech-to-text auto-transcribes on drop; audio-classification needs the
    // "Identify sound" button (NOT "Record", which also matches .sx-btn-primary).
    if (studio === 'audio-classification') {
      await page.locator('button:has-text("Identify sound")').click();
    }

    console.log(`[${studio}] running (up to 240s)…`);
    await page.waitForFunction(() => {
      const out = document.querySelectorAll('.sx-pane')[1] || document.body;
      if (out.querySelector('.sx-bar-row, .sx-result')) return true;
      const txt = out.textContent || '';
      if (/no speech detected|done\./i.test(txt)) return true;
      return false;
    }, null, { timeout: 240000 });

    const snippet = await page.evaluate(() => {
      const out = document.querySelectorAll('.sx-pane')[1];
      const bars = [...(out?.querySelectorAll('.sx-bar-label') || [])].slice(0, 3).map((b) => b.textContent.trim()).join(', ');
      const res = out?.querySelector('.sx-result')?.textContent?.trim();
      const muted = [...(out?.querySelectorAll('.sx-muted') || [])].map((m) => m.textContent.trim()).find((t) => /speech|done/i.test(t));
      return (bars || res || muted || 'output produced').replace(/\s+/g, ' ').slice(0, 90);
    });
    const realErrs = errs.filter((e) => !/404|Not Found/i.test(e));
    console.log(`[${studio}] ✅ output: "${snippet}"` + (realErrs.length ? ` | ERRORS: ${realErrs.join(' | ')}` : ' | no real console errors'));
    if (realErrs.length) process.exitCode = 1;
    await ctx.close();
  }
  await browser.close();
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) { try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {} }
}
