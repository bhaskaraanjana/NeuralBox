import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testStorageFallback() {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('iOS private storage blocked');
    },
  });

  const db = await import(`../src/db/database.js?ios-storage=${Date.now()}`);
  await db.initDatabase();

  const settings = await db.loadSettingsRecord();
  const conversations = await db.loadConversationsRecord();
  const modelSelection = await db.loadModelSelectionRecord();
  const ragDocs = await db.loadRagDocsRecord();

  assert(settings && typeof settings === 'object', 'Settings should fall back to an empty object.');
  assert(Array.isArray(conversations), 'Conversations should fall back to an empty array.');
  assert(modelSelection === null, 'Model selection should fall back to null.');
  assert(Array.isArray(ragDocs), 'RAG docs should fall back to an empty array.');

  await db.saveSettingsRecord({ theme: 'light' });
  const saved = await db.loadSettingsRecord();
  assert(saved.theme === 'light', 'Memory fallback should support session reads after writes.');
}

async function testStaticContracts() {
  const [mainJs, html, packageJson] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);

  assert(/function getPlatformInfo\(\)/.test(mainJs), 'Runtime should detect iOS/iPadOS platform shape.');
  assert(/This iOS browser session does not expose the WebGPU API/.test(mainJs), 'iOS WebGPU fallback reason should be explicit.');
  assert(/function safeLocalStorageGet\(/.test(mainJs), 'Theme reads should be protected from iOS storage exceptions.');
  assert(/function safeLocalStorageSet\(/.test(mainJs), 'Theme writes should be protected from iOS storage exceptions.');
  assert(/function scheduleWhisperPreload\(/.test(mainJs), 'Whisper preload should be scheduled after startup.');
  assert(/if \(platformInfo\.isIOS\) return false;/.test(mainJs), 'iOS should not background-preload Whisper during startup.');
  assert(!/getWhisperApi\(\)\.then\(api => \{\s*\/\/ Suppress progress/.test(mainJs), 'Legacy eager Whisper preload should not exist.');
  assert(/apple-mobile-web-app-capable/.test(html), 'iOS PWA capable meta tag should exist.');
  assert(/"test:ios:compat"/.test(packageJson), 'iOS compatibility test script should be registered.');
}

await testStorageFallback();
await testStaticContracts();

console.log('iOS compatibility test passed.');
