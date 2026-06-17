import {
  getFileExtension,
  getRagConfidenceLabel,
  getRagMatchScore,
  getRagRetrievalProfileConfig,
  normalizeRagDocText,
  normalizeRagRetrievalProfile,
  retrieveRagChunksFromIndex,
  splitTextIntoRagChunks,
  tokenizeRagQuery,
} from '../src/lib/rag.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const normalized = normalizeRagDocText('Hello\t\tworld\r\n\r\ntext');
  assert(normalized === 'Hello world\n\ntext', 'RAG text normalization mismatch.');

  const chunks = splitTextIntoRagChunks('a '.repeat(300), 120, 20);
  assert(chunks.length > 1, 'Chunk splitter should produce multiple chunks for long text.');

  const tokens = tokenizeRagQuery('What is NeuralBox runtime architecture?');
  assert(tokens.includes('neuralbox'), 'Tokenization should include neuralbox token.');

  const score = getRagMatchScore(['neuralbox', 'runtime'], 'NeuralBox runtime is local runtime.');
  assert(score > 0, 'RAG score should be positive for matching tokens.');
  assert(getRagConfidenceLabel(score, 2) !== 'low', 'Confidence label should scale with score.');

  const index = [
    { docId: '1', docName: 'a.txt', idx: 0, text: 'NeuralBox runtime architecture details.' },
    { docId: '2', docName: 'b.txt', idx: 0, text: 'Completely unrelated content.' },
  ];
  const matches = retrieveRagChunksFromIndex(index, 'runtime architecture', 2);
  assert(matches.length === 1, 'RAG retrieval should return only matching chunks.');
  assert(matches[0].docId === '1', 'RAG retrieval should prioritize relevant document.');
  assert(['high', 'medium', 'low'].includes(matches[0].confidenceLabel), 'RAG retrieval should expose confidence label.');

  assert(normalizeRagRetrievalProfile('broad') === 'broad', 'Known RAG profile should normalize.');
  assert(normalizeRagRetrievalProfile('unknown') === 'balanced', 'Unknown RAG profile should fall back to balanced.');
  assert(getRagRetrievalProfileConfig('precise').maxMatches === 2, 'Precise profile max match count mismatch.');

  const broadIndex = [
    { docId: '1', docName: 'a.txt', idx: 0, text: 'runtime architecture details.' },
    { docId: '2', docName: 'b.txt', idx: 0, text: 'runtime notes.' },
    { docId: '3', docName: 'c.txt', idx: 0, text: 'runtime checklist.' },
  ];
  const broadMatches = retrieveRagChunksFromIndex(broadIndex, 'runtime', { profileId: 'broad' });
  assert(broadMatches.length === 3, 'Broad profile should allow more context matches.');

  assert(getFileExtension('notes.MD') === 'md', 'File extension helper should normalize case.');

  console.log('RAG helpers test passed.');
}

run();
