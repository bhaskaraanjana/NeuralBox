import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const RAG_MAX_DOCS = 24;
const RAG_MAX_CHARS_PER_DOC = 240000;
const RAG_CHUNK_SIZE = 900;
const RAG_CHUNK_OVERLAP = 160;
const RAG_MAX_MATCHES = 4;

const DATA_DIR = path.resolve(process.cwd(), 'scripts', 'rag-web-test-data');

const WEB_DOCS = [
  {
    name: 'rfc8259-json.txt',
    url: 'https://www.rfc-editor.org/rfc/rfc8259.txt',
    mustContain: ['JSON', 'object', 'array'],
    query: 'JSON objects arrays parser grammar',
  },
  {
    name: 'rfc2616-http.txt',
    url: 'https://www.rfc-editor.org/rfc/rfc2616.txt',
    mustContain: ['HTTP', 'request', 'response'],
    query: 'HTTP request response headers',
  },
  {
    name: 'gpl3.txt',
    url: 'https://raw.githubusercontent.com/github/choosealicense.com/gh-pages/_licenses/gpl-3.0.txt',
    mustContain: ['GNU GENERAL PUBLIC LICENSE', 'Version 3'],
    query: 'GNU General Public License version 3 terms',
  },
  {
    name: 'node-readme.md',
    url: 'https://raw.githubusercontent.com/nodejs/node/main/README.md',
    mustContain: ['Node.js', 'JavaScript'],
    query: 'Node.js JavaScript runtime project',
  },
  {
    name: 'vue-readme.md',
    url: 'https://raw.githubusercontent.com/vuejs/core/main/README.md',
    mustContain: ['vuejs/core', 'Getting Started'],
    query: 'Vue framework monorepo build',
  },
  {
    name: 'react-readme.md',
    url: 'https://raw.githubusercontent.com/facebook/react/main/README.md',
    mustContain: ['React', 'JavaScript'],
    query: 'React JavaScript library UI',
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeRagDocText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .trim();
}

function splitTextIntoRagChunks(text, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP) {
  const normalized = normalizeRagDocText(text);
  if (!normalized) return [];
  const chunks = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize);
    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }
  return chunks;
}

function tokenizeRagQuery(text) {
  return normalizeRagDocText(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter((t) => t.length > 2)
    .slice(0, 24);
}

function getRagMatchScore(queryTokens, chunkText) {
  if (!queryTokens.length || !chunkText) return 0;
  const hay = chunkText.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    const hits = hay.split(token).length - 1;
    if (hits > 0) score += Math.min(6, hits) * (token.length >= 6 ? 2 : 1);
  }
  return score;
}

function retrieveRagChunks(query, ragChunks, maxMatches = RAG_MAX_MATCHES) {
  if (!ragChunks.length) return [];
  const tokens = tokenizeRagQuery(query);
  if (!tokens.length) return [];
  return ragChunks
    .map((chunk) => ({
      ...chunk,
      score: getRagMatchScore(tokens, chunk.text),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMatches);
}

function rebuildRagChunkIndex(ragDocuments) {
  const next = [];
  for (const doc of ragDocuments) {
    const chunks = Array.isArray(doc?.chunks) ? doc.chunks : [];
    for (let i = 0; i < chunks.length; i++) {
      next.push({
        docId: doc.id,
        docName: doc.name,
        idx: i,
        text: chunks[i],
      });
    }
  }
  return next;
}

function ingestDocs(currentDocs, docsToIngest) {
  const docsToAdd = [];
  for (const fileDoc of docsToIngest) {
    const rawText = normalizeRagDocText(fileDoc.text || '');
    const text = rawText.slice(0, RAG_MAX_CHARS_PER_DOC);
    if (!text) continue;
    const chunks = splitTextIntoRagChunks(text);
    if (!chunks.length) continue;
    docsToAdd.push({
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: fileDoc.name || 'document',
      text,
      chunks,
      sizeChars: text.length,
      addedAt: Date.now(),
    });
  }

  const existingKeySet = new Set(currentDocs.map((doc) => `${doc.name}::${doc.sizeChars}`));
  const deduped = docsToAdd.filter((doc) => {
    const key = `${doc.name}::${doc.sizeChars}`;
    if (existingKeySet.has(key)) return false;
    existingKeySet.add(key);
    return true;
  });

  const combined = [...currentDocs, ...deduped].slice(-RAG_MAX_DOCS);
  return { combined, added: deduped.length, attempted: docsToAdd.length };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadWebDocs() {
  await ensureDir(DATA_DIR);
  const downloaded = [];
  for (const entry of WEB_DOCS) {
    const response = await fetch(entry.url);
    assert(response.ok, `Failed download: ${entry.url} (${response.status})`);
    const text = await response.text();
    assert(text.length > 0, `Downloaded empty doc: ${entry.url}`);

    const outputPath = path.join(DATA_DIR, entry.name);
    await fs.writeFile(outputPath, text, 'utf8');
    downloaded.push({
      ...entry,
      path: outputPath,
      text,
    });
  }
  return downloaded;
}

function summarize(title, data = {}) {
  const body = Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' | ');
  console.log(`${title}${body ? ` -> ${body}` : ''}`);
}

async function run() {
  console.log('Starting extensive RAG web-doc tests...');
  const downloaded = await downloadWebDocs();
  summarize('Downloaded docs', { count: downloaded.length, dir: DATA_DIR });

  for (const doc of downloaded) {
    for (const phrase of doc.mustContain || []) {
      assert(
        doc.text.toLowerCase().includes(String(phrase).toLowerCase()),
        `Doc ${doc.name} missing expected phrase: ${phrase}`
      );
    }
  }
  summarize('Content sanity', { status: 'pass' });

  let ragDocuments = [];
  const firstIngest = ingestDocs(
    ragDocuments,
    downloaded.map((d) => ({ name: d.name, text: d.text }))
  );
  ragDocuments = firstIngest.combined;
  assert(ragDocuments.length === downloaded.length, 'Initial ingest doc count mismatch');
  summarize('Initial ingest', { added: firstIngest.added, totalDocs: ragDocuments.length });

  // Dedup test: ingest the same files again.
  const secondIngest = ingestDocs(
    ragDocuments,
    downloaded.map((d) => ({ name: d.name, text: d.text }))
  );
  assert(secondIngest.added === 0, 'Dedup failed: duplicate docs were re-added');
  ragDocuments = secondIngest.combined;
  summarize('Dedup ingest', { added: secondIngest.added, totalDocs: ragDocuments.length });

  // Chunking and char-cap assertions.
  for (const doc of ragDocuments) {
    assert(doc.sizeChars <= RAG_MAX_CHARS_PER_DOC, `Doc exceeded char cap: ${doc.name}`);
    assert(doc.chunks.length > 0, `No chunks produced for doc: ${doc.name}`);
    assert(doc.chunks.every((c) => c.length <= RAG_CHUNK_SIZE), `Chunk too large in ${doc.name}`);
  }
  summarize('Chunking + caps', { status: 'pass', chunkSize: RAG_CHUNK_SIZE, overlap: RAG_CHUNK_OVERLAP });

  const ragChunks = rebuildRagChunkIndex(ragDocuments);
  assert(ragChunks.length > 0, 'RAG chunk index is empty');
  summarize('Chunk index', { chunks: ragChunks.length });

  // Retrieval quality checks per document query.
  for (const doc of downloaded) {
    const matches = retrieveRagChunks(doc.query, ragChunks);
    assert(matches.length > 0, `No retrieval matches for query: ${doc.query}`);
    assert(matches.length <= RAG_MAX_MATCHES, 'Returned more than max retrieval matches');
    const joinedNames = matches.map((m) => m.docName.toLowerCase()).join(' | ');
    const expectedToken = doc.name.split('-')[0].toLowerCase();
    assert(
      joinedNames.includes(expectedToken) || joinedNames.includes(doc.name.toLowerCase()),
      `Query did not surface expected doc near top: ${doc.name}`
    );
  }
  summarize('Retrieval relevance', { status: 'pass', maxMatches: RAG_MAX_MATCHES });

  // Query tokenization guardrails.
  const shortTokenOnly = retrieveRagChunks('a an to if by', ragChunks);
  assert(shortTokenOnly.length === 0, 'Short-token-only query should return no matches');
  const punctuationOnly = retrieveRagChunks('... !!! ???', ragChunks);
  assert(punctuationOnly.length === 0, 'Punctuation-only query should return no matches');
  summarize('Tokenization edge cases', { status: 'pass' });

  // Char cap test with a synthetic oversized document.
  const hugeDoc = {
    name: 'huge-synthetic.txt',
    text: 'ABCDEFGH '.repeat(40000), // ~360k chars
  };
  const hugeIngest = ingestDocs(ragDocuments, [hugeDoc]);
  const hugeRecord = hugeIngest.combined.find((d) => d.name === hugeDoc.name);
  assert(hugeRecord, 'Huge doc was not ingested');
  assert(hugeRecord.sizeChars === RAG_MAX_CHARS_PER_DOC, 'Huge doc did not respect char cap');
  ragDocuments = hugeIngest.combined;
  summarize('Char cap enforcement', { cappedAt: hugeRecord.sizeChars });

  // Max docs cap test by overfilling with synthetic docs.
  const syntheticDocs = Array.from({ length: 30 }, (_, i) => ({
    name: `synthetic-${String(i + 1).padStart(2, '0')}.txt`,
    text: `Synthetic document ${i + 1}. Local RAG cap test payload.`,
  }));
  const capIngest = ingestDocs(ragDocuments, syntheticDocs);
  ragDocuments = capIngest.combined;
  assert(ragDocuments.length === RAG_MAX_DOCS, `Doc cap failed: expected ${RAG_MAX_DOCS}, got ${ragDocuments.length}`);
  summarize('Max docs cap', { totalDocs: ragDocuments.length, cap: RAG_MAX_DOCS });

  console.log('\nAll extensive RAG web-doc tests passed.');
}

run().catch((err) => {
  console.error('\nRAG web-doc test failed:', err?.message || err);
  process.exit(1);
});
