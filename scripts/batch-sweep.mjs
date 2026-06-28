// ============================================================
// Full multi-file batch sweep: runs scripts/batch-check.mjs for every
// batchable studio (image, audio, text) on the real WebGPU Chrome path and
// reports one pass/fail line per studio. This is the single repeatable check
// for the whole multi-file feature.
//
// Usage: node scripts/batch-sweep.mjs
// ============================================================
import { spawn } from 'node:child_process';

// studio id → input kind fed to batch-check.
const STUDIOS = [
  // image
  ['object-detection', 'image'],
  ['zero-shot-detection', 'image'],
  ['image-classification', 'image'],
  ['zero-shot-image', 'image'],
  ['segmentation', 'image'],
  ['depth', 'image'],
  // audio
  ['audio-classification', 'audio'],
  ['speech-to-text', 'audio'],
  // text
  ['sentiment', 'text'],
  ['text-emotion', 'text'],
  ['zero-shot-text', 'text'],
  ['question-answering', 'text'],
  ['summarize', 'text'],
  ['translate', 'text'],
  ['ner', 'text'],
  ['fill-mask', 'text'],
];

const results = [];
let port = 7100;
for (const [studio, kind] of STUDIOS) {
  port++;
  const ok = await new Promise((resolve) => {
    const child = spawn('node', ['scripts/batch-check.mjs'], {
      cwd: process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, STUDIO: studio, KIND: kind, PORT: String(port) },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', () => resolve(/\nPASS/.test(out)));
  });
  results.push({ studio, ok });
  console.log(`${ok ? '✅' : '❌'} ${studio}`);
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n── ${passed} / ${results.length} batch studios passed ──`);
if (passed < results.length) {
  console.log('failed:', results.filter((r) => !r.ok).map((r) => r.studio).join(', '));
  process.exitCode = 1;
}
