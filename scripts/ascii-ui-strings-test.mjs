import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const targets = ['src/main.js', 'src/style.css'];

function findFirstNonAscii(text) {
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 127) {
      return i;
    }
  }
  return -1;
}

function lineColAt(text, index) {
  const slice = text.slice(0, index);
  const lines = slice.split(/\r?\n/);
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

function run() {
  const failures = [];

  for (const rel of targets) {
    const abs = path.join(ROOT, rel);
    const content = fs.readFileSync(abs, 'utf8');
    const idx = findFirstNonAscii(content);
    if (idx >= 0) {
      const { line, col } = lineColAt(content, idx);
      const code = content.charCodeAt(idx).toString(16).toUpperCase().padStart(4, '0');
      failures.push(`${rel}:${line}:${col} contains non-ASCII char U+${code}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`ASCII UI guard failed:\n${failures.join('\n')}`);
  }

  console.log('ASCII UI guard passed.');
}

run();
