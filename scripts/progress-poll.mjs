// Polls the .sx-loader from t=0 (no networkidle wait, which a big download or a
// cache hit would skew) and prints every distinct state. Run with a COLD cache
// to see the full download trail. Usage:
//   SMOKE_PORT=6978 STUDIO=speech-to-text node scripts/progress-poll.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const STUDIO = process.env.STUDIO || 'speech-to-text';
const PORT = Number(process.env.SMOKE_PORT || 6978);
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

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), shell: true, stdio: 'ignore',
});

let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch({ headless: true });
  // PHONE=1 emulates a mobile device: narrow viewport, touch, mobile UA. Phones
  // have no usable WebGPU in most browsers, so this also exercises the WASM path.
  const phone = process.env.PHONE === '1';
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    ...(phone ? {
      viewport: { width: 390, height: 844 }, // iPhone 14-ish
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    } : {}),
  });
  const page = await context.newPage();
  if (phone) console.log('  (emulating phone: 390×844, touch, mobile UA, WASM path)');
  // Clear the transformers cache so we always see a real download.
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    if (typeof caches !== 'undefined') for (const k of await caches.keys()) await caches.delete(k);
  });

  await page.goto(`${baseUrl}/#/${STUDIO}`, { waitUntil: 'domcontentloaded' });

  const start = Date.now();
  const TIMEOUT = Number(process.env.RUN_TIMEOUT || 120000);
  const trail = [];
  let lastKey = '', loaderSeen = false;

  while (Date.now() - start < TIMEOUT) {
    const snap = await page.evaluate(() => {
      const ld = document.querySelector('.sx-loader');
      if (!ld) return { present: false };
      return {
        present: true,
        status: ld.querySelector('.sx-loader-status')?.textContent?.trim() || '',
        pct: ld.querySelector('.sx-loader-pct')?.textContent?.trim() || '',
        indet: ld.classList.contains('sx-loader-indeterminate'),
        stalled: ld.classList.contains('sx-loader-stalled'),
        error: ld.classList.contains('sx-loader-error'),
      };
    });
    const t = ((Date.now() - start) / 1000).toFixed(1);
    if (snap.present) {
      loaderSeen = true;
      const key = `${snap.status}|${snap.pct}|${snap.indet}|${snap.stalled}|${snap.error}`;
      if (key !== lastKey) {
        lastKey = key;
        const tag = snap.error ? 'ERROR' : snap.stalled ? 'STALL' : snap.indet ? 'anim' : 'meas';
        trail.push(`[${t}s] ${tag} ${snap.pct.padStart(4)} "${snap.status}"`);
        if (snap.error) break;
      }
    } else if (loaderSeen) {
      trail.push(`[${t}s] DONE  loader removed → model ready`);
      break;
    }
    await sleep(150);
  }

  // On phones, verify nothing overflows the viewport horizontally (a classic
  // mobile bug: a wide loader/pane forcing a horizontal scrollbar).
  let overflow = null;
  if (phone) {
    overflow = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
    })).catch(() => null);
  }

  console.log(`\n## ${STUDIO} — loader trail (cold cache)`);
  for (const l of trail) console.log('  ' + l);

  // Extract the numeric % sequence to verify it climbs (never frozen).
  const nums = trail.map((l) => { const m = l.match(/meas\s+(\d+)%/); return m ? Number(m[1]) : null; }).filter((n) => n != null);
  const distinctPct = new Set(nums).size;
  const climbed = nums.length === 0 || nums[nums.length - 1] >= nums[0];
  const notFrozen = distinctPct >= 3; // saw at least 3 different % values
  console.log('\n  measured % seen:', nums.join(' → ') || '(none — stayed indeterminate w/ bytes)');
  console.log('  checks:');
  const checks = [
    ['loader appeared', loaderSeen],
    ['% advanced through ≥3 distinct values (not frozen at 99)', notFrozen],
    ['% climbed overall', climbed],
    ['ended ready (loader removed)', trail.some((l) => l.includes('DONE'))],
    ['no error/stall', !trail.some((l) => /ERROR|STALL/.test(l))],
  ];
  if (phone && overflow) {
    const fits = overflow.docWidth <= overflow.winWidth + 1; // allow sub-pixel rounding
    console.log(`  layout: doc ${overflow.docWidth}px vs viewport ${overflow.winWidth}px`);
    checks.push([`no horizontal overflow on phone`, fits]);
  }
  let ok = true;
  for (const [label, pass] of checks) { console.log(`  ${pass ? '✅' : '❌'} ${label}`); if (!pass) ok = false; }
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
