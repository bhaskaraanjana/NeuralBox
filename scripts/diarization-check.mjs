// Focused E2E for speaker diarization in speech-to-text. Feeds a REAL spoken
// sample (not a tone, which produces no speech) and verifies the speaker-grouped
// transcript renders: speaker chips, turns, no console errors. Runs on the real
// WebGPU Chrome path (the one that exposed the earlier session bug).
//
// Usage: node scripts/diarization-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';

const PORT = Number(process.env.SMOKE_PORT || 7250);
const baseUrl = `https://127.0.0.1:${PORT}`;
// A short, clearly-spoken sample from the transformers.js docs dataset.
const SAMPLE_URL = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/mlk.wav';

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

// Fetch the real speech sample once to a temp file we can feed to the file input.
async function fetchSample() {
  const path = join(tmpdir(), 'nb-speech-sample.wav');
  if (existsSync(path)) return path;
  const r = await fetch(SAMPLE_URL);
  if (!r.ok) throw new Error(`sample fetch failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(path, buf);
  return path;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, stdio: 'ignore' });
let browser;
try {
  const wavPath = await fetchSample();
  await waitForServer(baseUrl);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const errs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errs.push(t);
    if (/diar|whisper|transcri|speaker|chunk|decode/i.test(t)) console.log(`  [console] ${t.slice(0, 140)}`);
  });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto(`${baseUrl}/#/speech-to-text`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sx-pane', { timeout: 15000 });

  // "Identify speakers" is on by default — confirm the toggle exists and is checked.
  const toggleChecked = await page.evaluate(() => {
    const cb = document.querySelector('.sx-checkbox');
    return cb ? cb.checked : null;
  });
  console.log(`speaker toggle present & checked: ${toggleChecked}`);

  await page.setInputFiles('input[type="file"]', wavPath);
  console.log('fed real speech sample; transcribing + diarizing (up to 240s)…');

  // Poll the status line + any toast so we can see exactly where the pipeline goes.
  let lastStatus = '', lastToast = '';
  const statusPoll = setInterval(async () => {
    try {
      const snap = await page.evaluate(() => ({
        status: document.querySelector('.sx-muted')?.textContent?.trim() || '',
        toast: [...document.querySelectorAll('.sx-toast')].map((t) => t.textContent.trim()).join(' | '),
      }));
      if (snap.status && snap.status !== lastStatus) { lastStatus = snap.status; console.log(`  [status] ${snap.status.slice(0, 120)}`); }
      if (snap.toast && snap.toast !== lastToast) { lastToast = snap.toast; console.log(`  [TOAST] ${snap.toast.slice(0, 160)}`); }
    } catch {}
  }, 300);

  // Wait for the speaker-grouped transcript (or an explicit no-speech message).
  await page.waitForFunction(() => {
    const panes = document.querySelectorAll('.sx-pane');
    const out = panes[panes.length - 1] || document.body;
    const title = [...out.querySelectorAll('.sx-pane-title')].map((p) => p.textContent).join(' ');
    if (/Transcript ·/.test(title)) return true;
    if (/no speech detected/i.test(out.textContent || '')) return true;
    return false;
  }, null, { timeout: 240000 });
  clearInterval(statusPoll);

  const result = await page.evaluate(() => {
    const panes = document.querySelectorAll('.sx-pane');
    const out = panes[panes.length - 1];
    const title = [...out.querySelectorAll('.sx-pane-title')].map((p) => p.textContent.trim()).find((t) => /Transcript ·/.test(t)) || '';
    // Speaker chips are the pill spans with a background color; count distinct labels.
    const chips = [...out.querySelectorAll('span')].map((s) => s.textContent.trim()).filter((t) => /^Speaker \d+$/.test(t));
    const distinct = [...new Set(chips)];
    const turns = out.querySelectorAll('.sx-stack > div').length;
    const sample = out.querySelector('.sx-stack > div')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
    const hasOldMixedParagraph = !!out.querySelector('.sx-result'); // the removed view
    const downloads = [...document.querySelectorAll('button')].map((b) => b.textContent).filter((t) => /Download/.test(t));
    return { title, speakers: distinct, turns, sample, hasOldMixedParagraph, downloads };
  });

  console.log('\n── result ──');
  console.log('  title        :', result.title);
  console.log('  speakers     :', result.speakers.join(', ') || '(none)');
  console.log('  turns        :', result.turns);
  console.log('  first turn   :', result.sample);
  console.log('  downloads    :', result.downloads.join(', '));
  console.log('  mixed-para?  :', result.hasOldMixedParagraph);

  const realErrs = errs.filter((e) => !/404|Not Found|favicon|fonts\.googleapis|vercel\.live|feedback\.js|apple-mobile-web-app-capable|VerifyEachNodeIsAssignedToAnEp|session_state|onnxruntime/i.test(e));

  console.log('\n  checks:');
  const checks = [
    ['speaker toggle on by default', toggleChecked === true],
    ['transcript rendered with turns', result.turns > 0],
    ['speaker labels present', result.speakers.length >= 1],
    ['old mixed-paragraph view removed', !result.hasOldMixedParagraph],
    ['srt + txt downloads offered', result.downloads.some((d) => /srt/i.test(d)) && result.downloads.some((d) => /txt/i.test(d))],
    ['no real console errors', realErrs.length === 0],
  ];
  let ok = true;
  for (const [label, pass] of checks) { console.log(`  ${pass ? '✅' : '❌'} ${label}`); if (!pass) ok = false; }
  if (realErrs.length) console.log('  errors:', realErrs.slice(0, 3).join(' | '));
  console.log(ok ? '\nPASS' : '\nFAIL');
  process.exitCode = ok ? 0 : 1;
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  try { server.kill(); } catch {}
  if (process.platform === 'win32' && server.pid) {
    try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }); } catch {}
  }
}
