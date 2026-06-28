// ============================================================
// Focused E2E for multi-file batch support. Opens a studio's batch panel,
// feeds N files, and verifies: N result rows render, each reaches a terminal
// status (done/error), and a combined download appears — on the real WebGPU
// Chrome path. Defaults to image-classification.
//
// Usage:
//   node scripts/batch-check.mjs
//   STUDIO=segmentation node scripts/batch-check.mjs
//   STUDIO=sentiment KIND=text node scripts/batch-check.mjs
// ============================================================
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const STUDIO = process.env.STUDIO || 'image-classification';
const KIND = process.env.KIND || 'image'; // image | audio | text
const PORT = Number(process.env.PORT || 6987);
const baseUrl = `https://127.0.0.1:${PORT}`;

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

// Build the N test files to feed the batch input.
function makeFiles() {
  if (KIND === 'image') {
    // Use the bundled sample images (copied to dist by the build).
    const names = ['cats.jpg', 'tiger.jpg', 'bread.jpg'];
    const paths = names.map((n) => join(process.cwd(), 'public', 'samples', n)).filter(existsSync);
    return paths;
  }
  if (KIND === 'text') {
    const files = [];
    for (let i = 0; i < 3; i++) {
      const p = join(tmpdir(), `nb-batch-text-${i}.txt`);
      writeFileSync(p, ['I absolutely loved this, best ever!', 'This was terrible and slow.', 'It was perfectly fine and ok.'][i]);
      files.push(p);
    }
    return files;
  }
  // audio: 3 short tone WAVs
  const files = [];
  for (let i = 0; i < 2; i++) {
    const p = join(tmpdir(), `nb-batch-audio-${i}.wav`);
    const rate = 16000, n = 2 * rate;
    const buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
    buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let j = 0; j < n; j++) buf.writeInt16LE(Math.sin(2 * Math.PI * 440 * j / rate) * 0.3 * 32767, 44 + j * 2);
    writeFileSync(p, buf); files.push(p);
  }
  return files;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, stdio: 'ignore' });
let browser;
try {
  const files = makeFiles();
  if (!files.length) throw new Error('no test files');
  await waitForServer(baseUrl);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  // NOGPU=1 hides navigator.gpu so the app runs the WASM path (isolates whether
  // a failure is WebGPU-inference-specific).
  if (process.env.NOGPU === '1') {
    await page.addInitScript(() => { try { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); } catch {} });
  }
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto(`${baseUrl}/#/${STUDIO}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sx-pane', { timeout: 20000 });

  // Open the batch panel.
  await page.locator('.sx-batch-toggle').click();
  await sleep(200);
  // The batch panel's file input is the multiple one inside .sx-batch.
  const input = page.locator('.sx-batch input[type="file"]');
  await input.setInputFiles(files);
  console.log(`fed ${files.length} files to ${STUDIO} batch; processing (up to 240s)…`);

  // Wait until every row reaches a terminal status (done/error) — i.e. no "Queued"/"Running".
  await page.waitForFunction((n) => {
    const rows = document.querySelectorAll('.sx-batch-row');
    if (rows.length < n) return false;
    const chips = [...document.querySelectorAll('.sx-batch-summary .sx-badge')].map((b) => b.textContent.trim());
    return chips.length >= n && chips.every((c) => /Done|Error/.test(c));
  }, files.length, { timeout: 240000 });

  const result = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.sx-batch-row')];
    const statuses = rows.map((r) => r.querySelector('.sx-badge')?.textContent?.trim());
    const dl = [...document.querySelectorAll('.sx-batch button')].map((b) => b.textContent).filter((t) => /Download all/.test(t));
    return { rows: rows.length, statuses, downloads: dl };
  });

  console.log('\n── result ──');
  console.log('  rows      :', result.rows);
  console.log('  statuses  :', result.statuses.join(', '));
  console.log('  downloads :', result.downloads.join(', ') || '(none)');

  const realErrs = errs.filter((e) => !/404|Not Found|favicon|fonts\.googleapis|vercel\.live|feedback\.js|apple-mobile|VerifyEachNode|session_state|onnxruntime|powerPreference|Some nodes were|Rerunning with/i.test(e));
  const doneCount = result.statuses.filter((s) => /Done/.test(s)).length;

  console.log('\n  checks:');
  const checks = [
    [`fed ${files.length} files → ${files.length} rows`, result.rows === files.length],
    ['every row reached terminal status', result.statuses.every((s) => /Done|Error/.test(s))],
    ['at least one succeeded', doneCount >= 1],
    ['combined download offered', result.downloads.length >= 1],
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
