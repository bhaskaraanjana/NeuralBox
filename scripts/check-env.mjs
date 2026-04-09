import { existsSync } from 'node:fs';

function fail(message) {
  console.error(`Environment check failed: ${message}`);
  process.exit(1);
}

const [major] = process.versions.node.split('.').map((x) => Number.parseInt(x, 10));
if (Number.isNaN(major)) {
  fail(`Cannot parse Node version: ${process.versions.node}`);
}

if (major < 20 || major >= 26) {
  fail(`Node ${process.versions.node} is unsupported. Use Node >=20 and <26.`);
}

const requiredFiles = [
  'package.json',
  'vite.config.js',
  'src/main.js',
  'src/lib/rendering.js',
  'src/lib/rag.js',
  'src/lib/routing.js',
  'src/lib/device.js',
  'src/lib/trust.js',
  'src/lib/composer.js',
  'src/lib/generation.js',
  'src/lib/events.js',
  'src/lib/voice.js',
  'src/lib/settings.js',
  'scripts/composer-actions-test.mjs',
  'scripts/generation-lifecycle-test.mjs',
  'scripts/events-bindings-test.mjs',
  'scripts/voice-helpers-test.mjs',
  'scripts/settings-helpers-test.mjs',
  'scripts/rag-helpers-test.mjs',
  'scripts/browser-lifecycle-smoke.mjs',
  'scripts/ascii-ui-strings-test.mjs',
  'src/db/database.js',
  'PROGRESS.md',
  'core/task.md',
  'rules.md',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    fail(`Missing required project file: ${file}`);
  }
}

console.log('Environment check passed.');
console.log(`Node: ${process.versions.node}`);
console.log('Project files and runtime constraints are valid.');
