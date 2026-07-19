/**
 * Record a short real-app walkthrough for docs (Playwright video).
 *
 * Usage:
 *   node scripts/capture-docs-video.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.BASE_URL || 'https://neuralbox.infinitemind.space';
const OUT = process.env.SHOT_DIR || 'docs/assets';
const TMP = join(OUT, '.video-tmp');
mkdirSync(OUT, { recursive: true });
if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

async function hideChrome() {
  await page.evaluate(() => {
    const el = document.getElementById('pwa-install-prompt');
    if (el) el.style.display = 'none';
  }).catch(() => {});
}

// Home gallery
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(2500);
await hideChrome();
await sleep(1500);

// Scroll a bit through models
await page.mouse.wheel(0, 500);
await sleep(1200);
await page.mouse.wheel(0, 500);
await sleep(1200);
await page.mouse.wheel(0, -800);
await sleep(800);

// Open object detection
await page.goto(`${BASE}/#/object-detection`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(2200);
await hideChrome();
await sleep(1500);

// Open caption studio
await page.goto(`${BASE}/#/caption`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(2200);
await hideChrome();
await sleep(1200);

// Speech to text
await page.goto(`${BASE}/#/speech-to-text`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(2200);
await hideChrome();
await sleep(1200);

// Sentiment with typed text
await page.goto(`${BASE}/#/sentiment`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(1800);
await hideChrome();
const ta = page.locator('textarea').first();
if (await ta.count()) {
  await ta.click();
  await ta.fill('I love running AI privately in my browser with NeuralBox.');
  await sleep(1000);
}
await sleep(1200);

// Pro chat
await page.goto(`${BASE}/chat.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(3000);
await hideChrome();
await sleep(2000);

await context.close();
await browser.close();

// Playwright saves webm under TMP; promote newest file
const files = readdirSync(TMP).filter((f) => f.endsWith('.webm'));
if (!files.length) {
  console.error('No video produced');
  process.exit(1);
}
const src = join(TMP, files[0]);
const dest = join(OUT, 'demo-walkthrough.webm');
copyFileSync(src, dest);
rmSync(TMP, { recursive: true, force: true });
console.log('saved', dest);
