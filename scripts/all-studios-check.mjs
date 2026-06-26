// ============================================================
// Full-app E2E sweep on the REAL WebGPU path (system Chrome).
// For every studio: open it, drive its primary input, click Run, and wait for
// either real output or a loader error — recording load device, fallback, time,
// and any console errors. This is the path headless Chromium never exercises
// (no WebGPU adapter), which is exactly where the "stuck at compiling" bug hid.
//
// Usage:
//   node scripts/all-studios-check.mjs            # all studios
//   ONLY=speech-to-text,depth node scripts/all-studios-check.mjs
//   PORT=6985 node scripts/all-studios-check.mjs
// ============================================================
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.PORT || 6985);
const baseUrl = `https://127.0.0.1:${PORT}`;
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const PER_STUDIO_MS = Number(process.env.PER_STUDIO_MS || 180000);

// A 3s tone WAV for audio studios.
function makeWav(seconds = 3, rate = 16000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = (Math.sin(2 * Math.PI * 440 * i / rate) + Math.sin(2 * Math.PI * 660 * i / rate)) * 0.2;
    buf.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, 44 + i * 2);
  }
  return buf;
}

// How to exercise each studio. kind drives the input; done() checks for output.
const PLAN = {
  'object-detection':   { kind: 'image' },
  'zero-shot-detection':{ kind: 'image' },
  'image-classification': { kind: 'image' },
  'zero-shot-image':    { kind: 'image' },
  'segmentation':       { kind: 'image' },
  'depth':              { kind: 'image' },
  'background-removal': { kind: 'image' },
  'caption':            { kind: 'image' },
  'speech-to-text':     { kind: 'audio' },
  'text-to-speech':     { kind: 'text-run' },
  'audio-classification': { kind: 'audio', runText: 'Identify sound' },
  'sentiment':          { kind: 'text-run' },
  'zero-shot-text':     { kind: 'text-run' },
  'summarize':          { kind: 'text-run' },
  'translate':          { kind: 'text-run' },
  'semantic-search':    { kind: 'text-run' },
  'ner':                { kind: 'text-run' },
  'fill-mask':          { kind: 'text-run' },
  'question-answering': { kind: 'text-run' },
  'text-emotion':       { kind: 'text-run' },
  'mini-chat':          { kind: 'chat' },
  'chat-premium':       { kind: 'skip', reason: 'iframe WebLLM app, separate harness' },
};

async function waitForServer(url, ms = 30000) {
  const https = await import('node:https');
  const agent = new https.Agent({ rejectUnauthorized: false });
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const ok = await new Promise((res) => {
      const req = https.request(url, { agent }, (r) => { r.resume(); res(r.statusCode > 0); });
      req.on('error', () => res(false)); req.end();
    });
    if (ok) return;
    await sleep(300);
  }
  throw new Error(`Server did not start at ${url}`);
}

const wavPath = join(tmpdir(), 'nb-allcheck-tone.wav');
writeFileSync(wavPath, makeWav());

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, stdio: 'ignore' });

// Detect output presence inside the page (last pane).
function outputReady() {
  const panes = document.querySelectorAll('.sx-pane');
  const out = panes[panes.length - 1] || document.body;
  const ld = document.querySelector('.sx-loader');
  if (ld && ld.classList.contains('sx-loader-error')) return 'error';
  if (out.querySelector('canvas, audio[src], .sx-bar-row, mark, .sx-msg-bot')) {
    const bot = out.querySelector('.sx-msg-bot');
    if (bot && bot.textContent.trim().length <= 1) return false; // chat still streaming
    return true;
  }
  const ov = out.querySelector('.sx-overlay');
  if (ov && ov.childElementCount > 0) return true;
  const txt = (out.textContent || '');
  if (/found|match|no objects|no matches|no speech detected|done\./i.test(txt)) return true;
  if ([...document.querySelectorAll('button')].some((b) => /download/i.test(b.textContent))) return true;
  for (const sel of ['.sx-result-big', '.sx-result']) {
    const node = out.querySelector(sel);
    if (node && getComputedStyle(node).display !== 'none') {
      const t = node.textContent.trim();
      if (t && t !== '—' && t.length > 8 && !/loading|please wait|can take a moment/i.test(t)) return true;
    }
  }
  return false;
}

let browser;
const results = [];
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
  });

  const ids = Object.keys(PLAN).filter((id) => !ONLY.length || ONLY.includes(id));
  for (const id of ids) {
    const plan = PLAN[id];
    if (plan.kind === 'skip') { results.push({ id, status: 'SKIP', note: plan.reason }); continue; }

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    const start = Date.now();
    let status = 'FAIL', note = '', fellBack = false;

    try {
      await page.goto(`${baseUrl}/#/${id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.sx-pane, .sx-chat', { timeout: 20000 });

      // Drive the input per kind.
      if (plan.kind === 'image') {
        const sample = await page.$('.sx-sample');
        if (sample) { await sample.click(); await sleep(400); }
        await page.locator('.sx-btn-primary:visible').first().click().catch(() => {});
      } else if (plan.kind === 'audio') {
        await page.setInputFiles('input[type="file"]', wavPath);
        await sleep(400);
        if (plan.runText) await page.locator(`button:has-text("${plan.runText}")`).first().click().catch(() => {});
      } else if (plan.kind === 'text-run') {
        // Most text studios ship a default input; just click Run/primary.
        await page.locator('.sx-btn-primary:visible').first().click().catch(() => {});
      } else if (plan.kind === 'chat') {
        await page.locator('button.sx-seg:has-text("Lite")').click().catch(() => {});
        await page.fill('.sx-chat-input textarea', 'Say hello.').catch(() => {});
        await page.locator('button:has-text("Send")').first().click().catch(() => {});
      }

      // Watch for fallback signal in the loader text.
      const watch = setInterval(async () => {
        try {
          const s = await page.evaluate(() => document.querySelector('.sx-loader-status')?.textContent || '');
          if (/compatibility mode|GPU mode failed/i.test(s)) fellBack = true;
        } catch {}
      }, 1000);

      const res = await page.waitForFunction(outputReady, null, { timeout: PER_STUDIO_MS });
      clearInterval(watch);
      const val = await res.jsonValue();
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      if (val === 'error') {
        const emsg = await page.evaluate(() => document.querySelector('.sx-loader-error .sx-loader-status')?.textContent || 'load error');
        status = 'FAIL'; note = `loader error: ${emsg}`;
      } else {
        status = 'PASS'; note = `${secs}s${fellBack ? ' (fell back to WASM)' : ''}`;
      }
    } catch (e) {
      note = e.message.slice(0, 80);
    }

    const realErrs = errs.filter((e) => !/404|Not Found|favicon|fonts\.googleapis|vercel\.live|feedback\.js|apple-mobile-web-app-capable|VerifyEachNodeIsAssignedToAnEp|session_state|onnxruntime|powerPreference|Some nodes were|Rerunning with/i.test(e));
    if (realErrs.length && status === 'PASS') { status = 'WARN'; note += ` | console: ${realErrs[0].slice(0, 60)}`; }
    else if (realErrs.length) note += ` | console: ${realErrs[0].slice(0, 60)}`;
    results.push({ id, status, note });
    const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : status === 'SKIP' ? '⏭️ ' : '❌';
    console.log(`${icon} ${id.padEnd(22)} ${status.padEnd(5)} ${note}`);
    await context.close();
  }
} catch (e) {
  console.error(`❌ harness error: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) {
    try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {}
  }
}

const pass = results.filter((r) => r.status === 'PASS').length;
const warn = results.filter((r) => r.status === 'WARN').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
console.log(`\n── ${pass} passed · ${warn} warned · ${fail} failed · ${results.filter((r) => r.status === 'SKIP').length} skipped ──`);
if (fail) process.exitCode = 1;
