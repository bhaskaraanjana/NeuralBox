/**
 * Capture real-app screenshots for README / docs.
 * Default target: production live URL.
 *
 * Usage:
 *   node scripts/capture-docs-screenshots.mjs
 *   BASE_URL=http://127.0.0.1:4173 node scripts/capture-docs-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.BASE_URL || 'https://neuralbox.infinitemind.space';
const OUT = process.env.SHOT_DIR || 'docs/assets';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function hideChrome(page) {
  await page.evaluate(() => {
    const el = document.getElementById('pwa-install-prompt');
    if (el) el.style.display = 'none';
  }).catch(() => {});
}

async function open(page, path, waitMs = 2000) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch {
    // still try to screenshot whatever loaded
  }
  await sleep(waitMs);
  await hideChrome(page);
}

async function shot(page, name, fullPage = false) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage, type: 'png' });
  console.log('saved', path);
}

async function clickFirstSample(page) {
  // Sample strip near "Try:" or any public sample asset
  const candidates = [
    page.locator('img[src*="samples"]').first(),
    page.locator('img[src*="/samples/"]').first(),
    page.getByText(/^Try/i).locator('..').locator('img').first(),
  ];
  for (const loc of candidates) {
    if (await loc.count()) {
      await loc.click({ force: true });
      await sleep(800);
      return true;
    }
  }
  return false;
}

async function clickButton(page, pattern) {
  const btn = page.getByRole('button', { name: pattern }).first();
  if (await btn.count()) {
    await btn.click();
    return true;
  }
  return false;
}

async function waitForText(page, re, maxLoops = 60, stepMs = 2000) {
  for (let i = 0; i < maxLoops; i++) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (re.test(body)) return true;
    if (i % 5 === 0) console.log('  waiting…', i, body.slice(0, 80).replace(/\s+/g, ' '));
    await sleep(stepMs);
  }
  return false;
}

// ---- Static UI shots (fast) ----
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await open(page, '/', 2200);
  await shot(page, 'desktop-studios-home');

  await open(page, '/#/object-detection', 2200);
  await shot(page, 'desktop-object-detection');

  await open(page, '/#/caption', 2200);
  await shot(page, 'desktop-image-captioner');

  await open(page, '/#/speech-to-text', 2200);
  await shot(page, 'desktop-speech-to-text');

  await open(page, '/#/sentiment', 2200);
  await shot(page, 'desktop-sentiment');

  await open(page, '/chat.html', 2800);
  await shot(page, 'desktop-pro-chat');

  await context.close();
}

// ---- Mobile UI shots ----
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await open(page, '/', 2200);
  await shot(page, 'mobile-studios-home');

  await open(page, '/chat.html', 2800);
  await shot(page, 'mobile-pro-chat');

  await context.close();
}

// ---- In-action: object detection with sample image ----
{
  console.log('running object-detection demo…');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await open(page, '/#/object-detection', 2500);
  await clickFirstSample(page);
  await clickButton(page, /Detect objects/i);
  // Allow model download + inference on the live site
  await waitForText(page, /person|car|dog|cat|truck|bird|bicycle|traffic|LABEL|score/i, 90, 2000);
  await sleep(1500);
  await hideChrome(page);
  await shot(page, 'desktop-object-detection-result');
  await context.close();
}

// ---- In-action: sentiment (usually faster than vision) ----
{
  console.log('running sentiment demo…');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await open(page, '/#/sentiment', 2200);
  const ta = page.locator('textarea').first();
  if (await ta.count()) {
    await ta.fill('I absolutely love how NeuralBox runs AI privately in my browser!');
  }
  await clickButton(page, /Analyze|Run|Classify|Score|Detect/i);
  await waitForText(page, /POSITIVE|NEGATIVE|NEUTRAL|label|score|%|confidence/i, 50, 2000);
  await sleep(1000);
  await hideChrome(page);
  await shot(page, 'desktop-sentiment-result');
  await context.close();
}

// ---- In-action: image captioner ----
{
  console.log('running caption demo…');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await open(page, '/#/caption', 2500);
  await clickFirstSample(page);
  await clickButton(page, /Caption|Generate|Run/i);
  await waitForText(page, /a |the |photo|image|man|woman|dog|cat|street|sitting|standing/i, 70, 2000);
  await sleep(1500);
  await hideChrome(page);
  await shot(page, 'desktop-image-captioner-result');
  await context.close();
}

await browser.close();
console.log('done — screenshots in', OUT);
