// Generate PWA PNG icons by rendering the NeuralBox mark with headless
// Chromium (no native image deps needed). Run: node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

await mkdir('public', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const { name, size } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;display:grid;place-content:center;
      background:radial-gradient(120% 120% at 20% 0%, #7c3aed 0%, #3b82f6 45%, #0b1422 100%);
      font-family:'Segoe UI Emoji',sans-serif;">
      <div style="font-size:${Math.round(size * 0.56)}px;line-height:1;filter:drop-shadow(0 ${size*0.02}px ${size*0.04}px rgba(0,0,0,.4))">🧠</div>
    </div></body></html>`);
  await page.screenshot({ path: `public/${name}` });
  console.log(`wrote public/${name} (${size}x${size})`);
}

await browser.close();
